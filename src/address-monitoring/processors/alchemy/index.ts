import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance, AxiosResponse } from "axios";
import {
  ALCHEMY_AUTH_TOKEN,
  ALCHEMY_BASE_WEBHOOK_ID,
  ALCHEMY_ETH_WEBHOOK_ID,
} from "src/config/env/list";
import { AbstractAddressMonitoringProcessor } from "src/interface/monitor-addresses";
import { ApiResponse } from "./types";
import { updateWebhookAddressesEndpoint } from "./endpoint";
import { AvailableWalletChains } from "src/common/types/wallet-custody";
import { AddressMonitoringProcessorType } from "src/common/types/address-monitoring";
import { WalletService } from "src/wallet/wallet.service";
import ExternalWalletAddressUtil from "src/utils/virtual-wallet-address";
import { TransactionService } from "src/transaction/transaction.service";
import { PaymentService } from "src/payment/payment.service";
import { MerchantService } from "src/merchant/merchant.service";
import { LedgerService } from "src/ledger/ledger.service";

export const providerId = AddressMonitoringProcessorType.ALCHEMY;

@Injectable()
export class AlchemyProcessor
  extends AbstractAddressMonitoringProcessor
  implements OnModuleInit
{
  private baseUrl = "https://dashboard.alchemy.com/api/";
  private httpClient: AxiosInstance;
  private baseWebhookId: string;
  private ethWebhookId: string;
  private readonly logger = new Logger(AlchemyProcessor.name);

  private readonly providerId: AddressMonitoringProcessorType = providerId;

  constructor(
    private configService: ConfigService,
    private walletService: WalletService,
    private externalWalletAddrUtil: ExternalWalletAddressUtil,
    private transactionService: TransactionService,
    private paymentService: PaymentService,
    private merchantService: MerchantService,
    private ledgerService: LedgerService,
  ) {
    super(
      walletService,
      externalWalletAddrUtil,
      transactionService,
      paymentService,
      merchantService,
      ledgerService,
    );
  }

  onModuleInit() {
    this.baseWebhookId = this.configService.getOrThrow<string>(
      ALCHEMY_BASE_WEBHOOK_ID,
    );
    this.ethWebhookId = this.configService.getOrThrow<string>(
      ALCHEMY_ETH_WEBHOOK_ID,
    );
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
    });
  }

  public getProviderId() {
    return this.providerId;
  }

  protected async processAddAddressesToMonitor(
    addresses: string[],
    chain: AvailableWalletChains,
  ): Promise<void> {
    if (!chain)
      throw new InternalServerErrorException(
        "Unable to select webhook id, No chain provided",
      );
    const response = await this.execute<{}>({
      method: "PATCH",
      endpoint: updateWebhookAddressesEndpoint,
      data: {
        webhook_id:
          chain === AvailableWalletChains.ERC20
            ? this.ethWebhookId
            : this.baseWebhookId,
        addresses_to_add: addresses,
        addresses_to_remove: [],
      },
    });

    console.log(response);
  }

  protected async processStopMonitoringForAddresses(
    addresses: string[],
    chain: AvailableWalletChains,
  ): Promise<void> {
    const response = await this.execute<{}>({
      method: "PATCH",
      endpoint: updateWebhookAddressesEndpoint,
      data: {
        webhook_id:
          chain === AvailableWalletChains.ERC20
            ? this.ethWebhookId
            : this.baseWebhookId,
        addresses_to_add: [],
        addresses_to_remove: addresses,
      },
    });

    console.log(response);
  }

  /**
   * Get authentication headers for alchemy requests.
   *
   * @returns Headers object with authentication
   */
  private getHeaders(): Record<string, string> {
    return {
      "X-Alchemy-Token":
        this.configService.getOrThrow<string>(ALCHEMY_AUTH_TOKEN),
      "Content-Type": "application/json",
    };
  }

  /**
   * Make an authenticated request to BlockRadar API.
   *
   * @param method - HTTP method
   * @param endpoint - API endpoint
   * @param data - Request data (for POST/PUT requests)
   * @param params - Query parameters
   * @returns Promise resolving to API response
   */
  private async execute<T = any>(requestData: {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    endpoint: string;
    data?: any;
    params?: Record<string, any>;
  }): Promise<ApiResponse<T>> {
    const { endpoint, method, data, params } = requestData;

    const url = `/${endpoint.replace(/^\//, "")}`;
    const headers = this.getHeaders();

    try {
      const response: AxiosResponse<{
        message: string;
        statusCode: number;
        data: T;
      }> = await this.httpClient.request({
        method,
        url,
        headers,
        data,
        params,
      });

      return response.data;
    } catch (error) {
      console.error(`API request failed during address monitoring `, error);
      throw error;
    }
  }
}
