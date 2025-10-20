import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosError, AxiosInstance } from "axios";
import * as crypto from "crypto-js";
import { v4 as UUID } from "uuid";
import {
  CryptoAsset,
  FiatCurrency,
  LiquidityProviderProcessorType,
  PayoutParams,
  PayoutResult,
  PayoutWebhookEvent,
  ProviderCapabilities,
} from "src/common/types/liquidity-provider";
import { UserType } from "src/common/types/wallet-custody";
import { YC_API_KEY, YC_SECRET_KEY } from "src/config/env/list";
import { AbstractLiquidityProvider } from "src/interface/liquidity-provider/abstract-provider";
import {
  ApiResponse,
  Channel,
  ChannelsResponse,
  NetworksResponse,
  PayoutEvents,
  Rate,
  RatesResponse,
  SubmitedPayment,
  SubmittedPayoutEvent,
} from "./types";
import {
  acceptSubmissionRequest,
  channels,
  initiateRecipientPayoutUrl,
  networks,
  rates as ratesUrl,
} from "./endpoints";
import { CountryCode } from "libphonenumber-js";
import { TransactionService } from "src/transaction/transaction.service";
import { PaymentTransactionStatus } from "src/models/offramp-transaction";
import { SocketGateway } from "src/gateway/socket.gateway";

export const providerId = LiquidityProviderProcessorType.YC;

@Injectable()
export class YellowCardProviderProcessor
  extends AbstractLiquidityProvider
  implements OnModuleInit
{
  constructor(
    private configService: ConfigService,
    private transactionService: TransactionService,
    private socketGateway: SocketGateway,
  ) {
    super(transactionService, socketGateway);
  }

  private readonly FEE = 50;
  protected readonly providerId: LiquidityProviderProcessorType = providerId;
  private readonly logger = new Logger(YellowCardProviderProcessor.name);
  private baseUrl = "https://sandbox.api.yellowcard.io";
  private httpClient: AxiosInstance;

  private capabilities: ProviderCapabilities = {
    supportedAssets: [
      CryptoAsset.BASE_USDC,
      CryptoAsset.ETH_USDT,
      CryptoAsset.ETH_PYUSD,
      CryptoAsset.POLYGON_USDC,
      CryptoAsset.POLYGON_USDT,
      CryptoAsset.SOLANA_USDC,
      CryptoAsset.SOLANA_USDT,
      CryptoAsset.BASE_USDC,
      CryptoAsset.TRON_USDT,
    ],
    supportedFiatCurrencies: [FiatCurrency.NGN, FiatCurrency.GHC],
    minAmount: {
      [FiatCurrency.NGN]: 2500,
      [FiatCurrency.GHC]: 10000,
    },
    maxAmount: {
      [FiatCurrency.NGN]: 1000000,
      [FiatCurrency.GHC]: 10000000,
    },
    avgProcessingTime: "10-30 mins",
  };

  async onModuleInit() {
    // Setup Axios for yellow card
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
    });

    // Setup Yellow card request authentication interceptor
    this.httpClient.interceptors.request.use(
      (config) => {
        const hash = this.getHeaders(
          config.url as string,
          (config.method as string).toUpperCase(),
          config.data,
        );
        config.headers["Authorization"] = hash["Authorization"];
        config.headers["X-YC-Timestamp"] = hash["X-YC-Timestamp"];
        if (config.data) {
          config.headers["Content-Type"] = "application/json";
        }
        return config;
      },
      (err) => {
        return Promise.reject(err);
      },
    );

    this.logger.log("Yellow card liquidity provider added.");
  }

  protected getCapabilities(): ProviderCapabilities {
    return this.capabilities;
  }

  isAssetSupported(asset: CryptoAsset): boolean {
    return this.capabilities.supportedAssets.includes(asset);
  }

  protected async processPayout(
    params: PayoutParams,
    userType: UserType,
  ): Promise<PayoutResult> {
    const {
      amount,
      comment,
      recipient: { accountName, accountNumber, country, bankCode },
      userId,
      transactionReference,
    } = params;

    try {
      // Select the appropriate network and channel Ids based on the passed credentials
      const { channel, network } = await this.getNetworskAndChannels(
        "withdraw",
        country,
        // bankCode,
        "011",
      );

      // We are sending the fiat to the user (Submitting payout request)
      const { data: submittedPaymentData } =
        await this.execute<SubmitedPayment>({
          method: "POST",
          endpoint: initiateRecipientPayoutUrl,
          data: {
            channelId: channel.id,
            sequenceId: transactionReference,
            localAmount: Number(amount),
            // reason: comment ?? "entertainment",
            reason: "entertainment",
            destination: {
              networkId: network.id,
              accountType: network.accountNumberType,
              accountNumber,
              accountName,
              country,
            },
            forceAccept: true,
            customerType: userType === "regular" ? "retail" : "retail",
            // customerType: userType === "regular" ? "retail" : "institution",
            customerUID: "customer_" + userId,
            sender: {
              // Get stored KYC for user, use placeholder for now
              name: "Ameh Cyril",
              phone: "+2349032435663",
              email: "cyrilameh1313@gmail.com",
              country: "NG",
              address: "23 Savage Crescent, G.R.A, Enugu",
              dob: "01/15/1998",
              idNumber: "123456789",
              idType: "NIN",
              additionalIdType: "BVN",
              additionalIdNumber: "123456",
            },
          },
        });

      return {
        success: true,
        result: {
          processorType: LiquidityProviderProcessorType.YC,
          status: PaymentTransactionStatus.INITIATED,
          transactionId: submittedPaymentData.id,
        },
      };
    } catch (err) {
      // Since our api execution is done with axios.
      console.log(err);
      const error = err as AxiosError<{ statusCode: number; message: string }>;
      return {
        success: false,
        error: error.response?.data.message || "Unknown error",
      };
    }
  }

  protected async processQuotes(request: {
    amount: number;
    fromAsset: string;
    toAsset: string;
  }) {
    this.logger.log(
      `Getting quote from Provider A for ${request.amount} ${request.fromAsset}`,
    );

    const rates = await this.processRate([request.fromAsset, request.toAsset]);

    const toAssetRate = rates.find(
      (rate) => rate.code.toLowerCase() === request.toAsset,
    ) as Rate;
    const fromAssetRate = rates.find(
      (rate) => rate.code.toLowerCase() === request.fromAsset,
    ) as Rate;

    // Get amount from conversion...
    const fiatAmount = fromAssetRate.buy * request.amount * toAssetRate.sell;

    return {
      processorType: LiquidityProviderProcessorType.YC,
      exchangeRate: rates,
      fiatAmount,
      fees: this.FEE,
      assetReturned: toAssetRate.code,
    };
  }

  protected async processRate(params: Array<string>) {
    const {
      data: { rates },
    } = await this.execute<RatesResponse>({
      method: "GET",
      endpoint: ratesUrl,
    });

    // Return a specific rates...
    return rates.filter((rate) => params.includes(rate.code.toLowerCase()));
  }

  protected async processPayoutWebhookEvent({
    event,
    id,
  }: SubmittedPayoutEvent): Promise<PayoutWebhookEvent> {
    switch (event) {
      case PayoutEvents.created: {
        // The status should be updated to processing payout
        return {
          updateStatus: true,
          status: PaymentTransactionStatus.PENDING,
        };
      }
      case PayoutEvents.pending: {
        return {
          updateStatus: true,
          status: PaymentTransactionStatus.TRANSIT,
        };
      }
      case PayoutEvents.complete: {
        return {
          updateStatus: true,
          status: PaymentTransactionStatus.COMPLETED,
        };
      }
      case PayoutEvents.failed: {
        return {
          updateStatus: true,
          status: PaymentTransactionStatus.FAILED,
        };
      }
      case PayoutEvents.pendingApproval: {
        // Accepts the submission
        // Shouldn't come to this stage again because the submit payout function "forced accept" to true
        try {
          await this.execute({
            method: "POST",
            endpoint: acceptSubmissionRequest(id),
          });
        } catch (err) {
          return {
            updateStatus: true,
            status: PaymentTransactionStatus.FAILED,
          };
        }
      }
      default:
        return { updateStatus: false };
    }
  }

  private async getNetworskAndChannels(
    rampType: "withdraw" | "deposit",
    country: CountryCode,
    bankCode: string,
  ) {
    const status = "active";
    const configs = {
      channel: {
        settlement: "instant",
        status,
      },
      network: {
        status,
        type: "bank",
      },
    };
    const { data: businessChannels } = await this.execute<ChannelsResponse>({
      method: "GET",
      endpoint: channels,
    });

    const { data: accountNetworks } = await this.execute<NetworksResponse>({
      method: "GET",
      endpoint: networks,
    });

    const network = accountNetworks.networks.find(
      (network) =>
        network.status === configs.network.status &&
        network.code === bankCode &&
        network.accountNumberType === configs.network.type &&
        network.country.toLowerCase() === country.toLowerCase(),
    );

    if (!network)
      throw new InternalServerErrorException(
        "No account network found for the bank code " +
          bankCode +
          " belonging to the country ",
        country,
      );

    const channel = businessChannels.channels.find((channel) => {
      return (
        channel.country.toLowerCase() === country.toLowerCase() &&
        channel.rampType === rampType &&
        channel.settlementType === configs.channel.settlement &&
        channel.status === configs.channel.status &&
        network &&
        network.channelIds.includes(channel.id)
      );
    }) as Channel;

    return {
      channel,
      network,
    };
  }

  private getHeaders(
    path: string,
    method: string,
    body?: any,
  ): {
    "X-YC-Timestamp": string;
    Authorization: string;
  } {
    const apiKey = this.configService.getOrThrow<string>(YC_API_KEY);
    const secretKey = this.configService.getOrThrow<string>(YC_SECRET_KEY);

    const date = new Date().toISOString();

    const hmac = crypto.algo.HMAC.create(crypto.algo.SHA256, secretKey) as any;

    hmac.update(date, "");
    hmac.update(path, "");
    hmac.update(method, "");

    if (body) {
      let bodyHmac = crypto
        .SHA256(JSON.stringify(body))
        .toString(crypto.enc.Base64);
      hmac.update(bodyHmac);
    }

    const hash = hmac.finalize();
    const signature = crypto.enc.Base64.stringify(hash);

    return {
      "X-YC-Timestamp": date,
      Authorization: `YcHmacV1 ${apiKey}:${signature}`,
    };
  }

  private async execute<T = any>(requestData: {
    method: "GET" | "POST" | "PUT" | "DELETE";
    endpoint: string;
    data?: any;
    params?: Record<string, any>;
  }): Promise<ApiResponse<T>> {
    const { endpoint, method, data, params } = requestData;

    const url = `/${endpoint.replace(/^\//, "")}`;

    try {
      const response = await this.httpClient.request({
        method,
        url,
        data,
        params,
      });

      return { data: response.data };
    } catch (error) {
      console.error(`API request failed`, error);
      throw error;
    }
  }
}
