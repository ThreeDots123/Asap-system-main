import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import {
  AssetWithdrawalResponse,
  AssetWithdrawalWebhookEvent,
  AvailableWalletChains,
  BlockRadarCustodialConfig,
  CryptoWithdrawalParams,
  ProcessorType,
  RetrieveAssetResponse,
  UserType,
} from "src/common/types/wallet-custody";
import {
  BLOCKRADAR_AVALANCHE_ID,
  BLOCKRADAR_AVALANCHE_SECRET,
  BLOCKRADAR_BASE_ID,
  BLOCKRADAR_BASE_SECRET,
  BLOCKRADAR_ETH_ID,
  BLOCKRADAR_ETH_SECRET,
} from "src/config/env/list";
import { AbstractWalletCustodialProcessor } from "src/interface/wallet-custody/abstract-custody";
import { WalletService } from "src/wallet/wallet.service";
import {
  AddressResponse,
  ApiResponse,
  AssetBalance,
  AssetRateData,
  AssetWithdrawalFee,
  TransactionData,
  WithdrawalWebhookTransactionData,
} from "./types";
import {
  assetWithdrawalFee,
  createWalletAddress,
  getRates,
  getWalletBalances,
  withdrawWalletAssetFromMaster,
} from "./endpoints";
import { CreateWalletChainParams } from "src/interface/wallet-custody/types";
import { walletChainDetails } from "src/wallet-custodial/chain-details";
import { EventService } from "src/event/event.service";
import { UserService } from "src/user/user.service";
import {
  TransactionStatus,
  TransactionType,
} from "src/models/wallet/transaction.entity";
import { TransactionStatus as BlockradarTxnStatus } from "./types";
import { TransactionService } from "src/transaction/transaction.service";
import { LedgerService } from "src/ledger/ledger.service";

export const providerId = ProcessorType.BLOCKRADAR;

type AdvancedBlockRadarConfig = BlockRadarCustodialConfig & {
  address: string;
  id: string;
  assets: Record<string, { id: string }>;
};

@Injectable()
export class BlockradarProcessor
  extends AbstractWalletCustodialProcessor
  implements OnModuleInit
{
  private readonly providerId: ProcessorType = providerId;
  private baseUrl = "https://api.blockradar.co";
  private httpClient: AxiosInstance;
  protected walletChains: Map<AvailableWalletChains, AdvancedBlockRadarConfig>;
  private readonly logger = new Logger(BlockradarProcessor.name);

  type = this.providerId;
  constructor(
    private walletService: WalletService,
    private configService: ConfigService,
    private userService: UserService,
    private eventService: EventService,
    private transactionService: TransactionService,
    private ledgerService: LedgerService,
  ) {
    super(
      walletService,
      eventService,
      userService,
      transactionService,
      ledgerService,
    );
  }

  getSupportedWalletChains() {
    return [
      {
        chain: AvailableWalletChains.AVALANCHE,
        config: {
          chainId: this.configService.getOrThrow<string>(
            BLOCKRADAR_AVALANCHE_ID,
          ),
          secretKey: this.configService.getOrThrow<string>(
            BLOCKRADAR_AVALANCHE_SECRET,
          ),
        },
        address: "0x8160af15Dc79f73a88f053c10C6b7B537075B72F",
        id: "12a8114d-56c1-4f6c-be43-41e77e3d2399",
        assets: {
          avalanche: { id: "d2eff50b-1654-4938-a31c-02aa308ce764" },
          "usd coin": { id: "9fd0ee45-e4db-4616-ab65-fc2d2189851b" },
        } as const,
      },
      {
        chain: AvailableWalletChains.BASE,
        config: {
          chainId: this.configService.getOrThrow<string>(BLOCKRADAR_BASE_ID),
          secretKey: this.configService.getOrThrow<string>(
            BLOCKRADAR_BASE_SECRET,
          ),
        },
        address: "0x8160af15Dc79f73a88f053c10C6b7B537075B72F",
        id: "2986dc45-848a-427a-91e8-2489228f688e",
        assets: {
          ethereum: { id: "3cdf2ad6-9ce1-42c7-9cc3-b63598ba320a" },
          "usd coin": { id: "8a0245c8-d331-44de-a851-97bb1acb0ce2" },
        } as const,
      },
      {
        chain: AvailableWalletChains.ERC20,
        config: {
          chainId: this.configService.getOrThrow<string>(BLOCKRADAR_ETH_ID),
          secretKey: this.configService.getOrThrow<string>(
            BLOCKRADAR_ETH_SECRET,
          ),
        },
        address: "0x8160af15Dc79f73a88f053c10C6b7B537075B72F",
        id: "c3766c0f-ebb0-4384-94e7-26133b395e1a",
        assets: {
          ethereum: { id: "e4a0099c-6a78-4a8e-bc7f-7b1493aebbaa" },
          "usd coin": { id: "aaad8f6b-8064-45db-83e7-bb19e10da9c9" },
        } as const,
      },
    ];
  }

  onModuleInit() {
    this.walletChains = new Map<
      AvailableWalletChains,
      AdvancedBlockRadarConfig
    >();
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
    });

    // Add all its supported wallets to the map chain
    this.getSupportedWalletChains().forEach(
      ({ chain, config: { chainId, secretKey }, address, id, assets }) => {
        this.addWalletChainToMap(
          chainId,
          secretKey,
          chain,
          { address, id },
          assets as any,
        );
      },
    );
  }

  public getProviderId() {
    return this.providerId;
  }

  protected async processChainCreation(
    chainConfig: BlockRadarCustodialConfig,
    data: CreateWalletChainParams["metadata"],
    opts: { userType: UserType; chain: AvailableWalletChains },
  ) {
    const { userId } = data;
    const { userType, chain } = opts;

    // check If user Already has a wallet created by blockradar
    if (userType === "regular") {
      const foundWallet = await this.walletService.findWalletsByProcessor(
        { userId: userId.toString(), userType },
        ProcessorType.BLOCKRADAR,
      );

      if (foundWallet.length > 0) {
        // No need to go through the create flow again, blockradar shares the same address across all their chains, hence just save the address along witht the new wallet information
        const wallet = foundWallet[0]; // Picking any one.
        return {
          address: wallet.address,
          chain: walletChainDetails[chain].name,
          custodialId: wallet.custodialId,
          processedBy: this.type,
        };
      }
    } else {
      const foundWallet = await this.walletService.findWalletsByProcessor(
        { userId: userId.toString(), userType },
        ProcessorType.BLOCKRADAR,
      );

      if (foundWallet.length > 0) {
        // No need to go through the create flow again, blockradar shares the same address across all their chains, hence just save the address along witht the new wallet information
        const wallet = foundWallet[0]; // Picking any one.
        return {
          address: wallet.address,
          chain: walletChainDetails[chain].name,
          custodialId: wallet.custodialId,
          processedBy: this.type,
        };
      }
    }

    const payload = {
      disableAutoSweep: !this.autoSweep,
      enableGaslessWithdraw: !this.gaslessWithdrawals,
      metadata: data,
      name: data.userId,
    };

    const { data: result } = await this.execute<AddressResponse>({
      method: "POST",
      endpoint: createWalletAddress(chainConfig.chainId),
      chainConfig,
      data: payload,
    });

    return {
      address: result.address,
      chain: result.blockchain.name,
      custodialId: result.id,
      processedBy: this.type,
    };
  }

  protected async processAssetWithdrawal(
    params: CryptoWithdrawalParams,
    chainConfig: BlockRadarCustodialConfig,
    chain: AvailableWalletChains,
  ): Promise<AssetWithdrawalResponse> {
    if (!chain)
      throw new InternalServerErrorException(
        "A chain is required to process chain's asset for " + this.type,
      );

    try {
      const { recipientAddr, asset, amount } = params;

      const masterWltAsset = this.walletChains.get(chain);
      if (!masterWltAsset)
        throw new InternalServerErrorException(
          "Cannot find the master wallet asset for this transaction.",
        );

      const masterWltAssetId = masterWltAsset.assets[asset.name];

      const { data: transaction } = await this.execute<TransactionData>({
        method: "POST",
        endpoint: withdrawWalletAssetFromMaster(chainConfig.chainId),
        chainConfig,
        data: {
          address: recipientAddr,
          amount: amount,
          assetId: masterWltAssetId.id,
          reference: params.reference,
          metadata: { ...(params.metadata && { ...params.metadata }) },
        },
      });

      const {
        amount: assetAmt,
        hash,
        blockNumber,
        id,
        senderAddress,
        recipientAddress,
        status,
        asset: { name: assetName },
      } = transaction;

      return {
        success: true,
        message: "Withdrawal successful",
        transaction: {
          fromAddr: senderAddress,
          toAddr: recipientAddress,
          masterWltAddr: masterWltAsset.address,
          txnHash: hash,
          blockNo: String(blockNumber) ?? "nil",
          amount: assetAmt,
          chain: "",
          asset: assetName,
          status: this.convertCustodialStatusToApplicationStatus(status),
          type: TransactionType.P2P_TRANSFER,
          processedBy: this.type,
          custodialTxnId: id,
        },
      };
    } catch (err: unknown) {
      // Since our api execution is done with axios.
      const error = err as AxiosError<{ statusCode: number; message: string }>;
      return {
        success: false,
        error: error.response?.data.message || "Unknown error",
      };
    }
  }

  protected async processChainAssetRetrieval(
    chainConfig: BlockRadarCustodialConfig,
    custodialId: string,
  ): Promise<RetrieveAssetResponse[]> {
    if (!custodialId)
      throw new InternalServerErrorException(
        "A custodial id is required to process chain's asset for " + this.type,
      );

    const { data } = await this.execute<AssetBalance[]>({
      method: "GET",
      endpoint: getWalletBalances(chainConfig.chainId, custodialId),
      chainConfig,
    });

    return data.map(({ asset: { asset, id }, balance, convertedBalance }) => ({
      name: asset.name.toLowerCase(),
      balance,
      convertedBalance,
      processedBy: this.type,
      logo: asset.logoUrl,
      symbol: asset.symbol,
      custodialId: id,
    }));
  }

  protected async processRateRetrieval(
    chainConfig: BlockRadarCustodialConfig,
    assetSymbol: string,
    currency: string,
  ): Promise<number> {
    try {
      const { data } = await this.execute<AssetRateData>({
        method: "GET",
        endpoint: getRates(assetSymbol, currency),
        chainConfig,
      });

      if (data.Response) throw new InternalServerErrorException(data.Message);

      return data[assetSymbol.toUpperCase()][currency.toUpperCase()];
    } catch (err) {
      return 0;
    }
  }

  protected async processAssetWithdrawalFee(
    amountToWithdraw: string,
    chainConfig: BlockRadarCustodialConfig,
    asset: {
      recipientAddr?: string;
      assetCustodialId?: string;
    },
    custodialId?: string,
  ) {
    try {
      if (!custodialId)
        throw new InternalServerErrorException(
          "A custodial id is required to process chain's asset for " +
            this.type,
        );

      if (!asset.recipientAddr || !asset.assetCustodialId)
        throw new InternalServerErrorException(
          "A recipient address and asset custodial-id is required to process asset withdrawal fee for " +
            this.type,
        );

      const { data } = await this.execute<AssetWithdrawalFee>({
        method: "POST",
        endpoint: assetWithdrawalFee(chainConfig.chainId, custodialId),
        chainConfig,
        data: {
          assetId: asset.assetCustodialId,
          address: asset.recipientAddr,
          amount: amountToWithdraw,
        },
      });

      return { amount: data.networkFee, asset: "ETH" };
    } catch (err) {
      const error = err as AxiosError<{ statusCode: number; message: string }>;
      throw new InternalServerErrorException(
        error.response?.data.message || "Unknown error",
      );
    }
  }

  protected async processWithdrawalWebhookEvent({
    event,
    data,
  }: WithdrawalWebhookTransactionData): Promise<AssetWithdrawalWebhookEvent> {
    if (event === "withdraw.success")
      return {
        updateStatus: true,
        status: TransactionStatus.COMPLETED,
        fromAddress: data.senderAddress,
      };

    return {
      updateStatus: true,
      status: TransactionStatus.FAILED,
      fromAddress: data.senderAddress,
    };
  }

  private addWalletChainToMap(
    chainId: string,
    secretKey: string,
    name: AvailableWalletChains,
    attr: { address: string; id: string },
    assets: AdvancedBlockRadarConfig["assets"],
  ) {
    const chainConfig: BlockRadarCustodialConfig = {
      chainId,
      secretKey,
    };

    this.walletChains.set(name, { ...chainConfig, ...attr, assets });
    this.logger.log(`Added wallet chain: ${name} to blockradar custodial`);
  }

  private convertCustodialStatusToApplicationStatus(
    status: BlockradarTxnStatus,
  ) {
    if (status === "PENDING") return TransactionStatus.PENDING;
    else if ((status = "CANCELLED")) return TransactionStatus.CANCELLED;
    else if ((status = "CONFIRMED")) return TransactionStatus.COMPLETED;
    else return TransactionStatus.FAILED;
  }

  /**
   * Get authentication headers for a chain management.
   *
   * @param name - name of an available wallet selected
   * @returns Headers object with authentication
   * @throws Error if wallet is not found
   */
  private getHeaders(
    config: BlockRadarCustodialConfig,
  ): Record<string, string> {
    return {
      "x-api-key": config.secretKey,
      "Content-Type": "application/json",
    };
  }

  /**
   * Make an authenticated request to BlockRadar API.
   *
   * @param method - HTTP method
   * @param endpoint - API endpoint
   * @param chainConfig - configuration for the selected wallet
   * @param data - Request data (for POST/PUT requests)
   * @param params - Query parameters
   * @returns Promise resolving to API response
   */
  private async execute<T = any>(requestData: {
    method: "GET" | "POST" | "PUT" | "DELETE";
    endpoint: string;
    chainConfig: BlockRadarCustodialConfig;
    data?: any;
    params?: Record<string, any>;
  }): Promise<ApiResponse<T>> {
    const { endpoint, chainConfig, method, data, params } = requestData;

    const url = `/${endpoint.replace(/^\//, "")}`;
    const headers = this.getHeaders(chainConfig);

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
      console.error(
        `API request failed for wallet ${chainConfig.chainId}:`,
        error,
      );
      throw error;
    }
  }
}
