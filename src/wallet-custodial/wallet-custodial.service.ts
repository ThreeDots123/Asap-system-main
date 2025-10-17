import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { AbstractWalletCustodialProcessor } from "src/interface/wallet-custody/abstract-custody";
import { BlockradarProcessor } from "./processors/blockradar/index.processor";
import {
  AvailableWalletChains,
  ProcessorType,
  UserType,
} from "src/common/types/wallet-custody";
import {
  AssetDeposit,
  CreateWalletChainParams,
  TransferAssetParams,
} from "src/interface/wallet-custody/types";
import { Types } from "mongoose";
import { TransactionService } from "src/transaction/transaction.service";
import { TransactionType } from "src/models/wallet/transaction.entity";

@Injectable()
export class WalletCustodialService implements OnModuleInit {
  private processors: Map<ProcessorType, AbstractWalletCustodialProcessor> =
    new Map();
  private walletToProcessorMap: Map<AvailableWalletChains, ProcessorType>;
  private readonly logger = new Logger(WalletCustodialService.name);

  constructor(
    private blockradarProcessor: BlockradarProcessor,
    private transactionService: TransactionService,
  ) {}

  async onModuleInit() {
    await this.registerProcessors();

    // Initialize wallet-to-processor mapping
    this.walletToProcessorMap = this.initWalletChainToProcessorMapping();
  }

  private initWalletChainToProcessorMapping() {
    const mapping = new Map<AvailableWalletChains, ProcessorType>();
    // Defining the preferred processor assignment for each wallet
    // When multiple processors support the same wallet, assign to preferred one

    const walletAssignments: Record<AvailableWalletChains, ProcessorType> = {
      [AvailableWalletChains.AVALANCHE]: ProcessorType.BLOCKRADAR, // Prefer blockradar over others
      [AvailableWalletChains.BASE]: ProcessorType.BLOCKRADAR, // Prefer blockradar over others
      [AvailableWalletChains.ERC20]: ProcessorType.BLOCKRADAR, // PPrefer blockradar over others
    };

    // Validate the processors actually support these chains as configured in their processors and then build the mapping
    for (const [wallet, preferredProcessor] of Object.entries(
      walletAssignments,
    )) {
      const walletType = wallet as AvailableWalletChains;
      const processor = this.processors.get(preferredProcessor);

      if (
        processor &&
        processor
          .getSupportedWalletChains()
          .find((walletChain) => walletChain.chain === walletType)
      ) {
        mapping.set(walletType, preferredProcessor);
      } else {
        this.logger.error(
          "Unable to find wallet chain for the assigned processor",
        );
        // Fallback: find first processor that supports this wallet
        const supportingProcessor = this.findSupportingProcessor(walletType);
        if (supportingProcessor) {
          this.logger.warn(
            "Using Fallback Processor " +
              supportingProcessor +
              " for the chain " +
              walletType,
          );
          mapping.set(walletType, supportingProcessor);
        }
      }
    }

    return mapping;
  }

  private findSupportingProcessor(
    wallet: AvailableWalletChains,
  ): ProcessorType | null {
    for (const [processorType, processor] of this.processors) {
      if (
        processor
          .getSupportedWalletChains()
          .find((walletChain) => walletChain.chain === wallet)
      ) {
        return processorType;
      }
    }
    return null;
  }

  private async registerProcessors(): Promise<void> {
    // Register each processor with its provider ID on the instantiated service
    await this.registerProcessor(this.blockradarProcessor);
  }

  private async registerProcessor(processor: AbstractWalletCustodialProcessor) {
    const providerId = await processor.getProviderId();

    if (this.processors.has(providerId))
      throw new Error(
        "Processor with a providerId of " + providerId + " already exists",
      );

    // Append provider to intance service
    this.processors.set(providerId, processor);
  }

  private getProcessor(
    providerId: ProcessorType,
  ): AbstractWalletCustodialProcessor {
    const processor = this.processors.get(providerId);
    if (!processor)
      throw new BadRequestException(`Processor not found: ${providerId}`);

    return processor;
  }

  private getAssignedProcessor(wallet: AvailableWalletChains): ProcessorType {
    const assignedProcessor = this.walletToProcessorMap.get(wallet);
    if (!assignedProcessor)
      throw new BadRequestException(
        `No processor assigned for wallet: ${wallet}`,
      );

    return assignedProcessor;
  }

  async processWallet(
    wallet: AvailableWalletChains,
  ): Promise<AbstractWalletCustodialProcessor> {
    const assignedProcessorType = this.getAssignedProcessor(wallet);
    const processor = this.getProcessor(assignedProcessorType);

    return processor;
  }

  //   The actual methods that communicates with other applications
  async assignWallet(data: CreateWalletChainParams) {
    const { chain } = data;
    const processor = await this.processWallet(chain);

    const result = await processor.createWalletChain(data);
    return result;
  }

  async retrieveChainBalance(data: {
    chain: AvailableWalletChains;
    userId: Types.ObjectId;
    userType: UserType;
  }) {
    const { chain, userId, userType } = data;
    const processor = await this.processWallet(chain);

    const result = await processor.getChainAssetBalance({
      userId,
      chain,
      userType,
    });

    return result;
  }

  async initiateAssetTransferTransaction(
    params: TransferAssetParams,
    userType: UserType,
  ) {
    const { chain } = params;
    const processor = await this.processWallet(chain);
    const result = processor.initiateAssetTransfer(params, userType);
    return result;
  }

  async transferChainAsset(
    userId: Types.ObjectId,
    transactionReference: string,
    userType: UserType,
  ) {
    // Get ongoing transaction
    const onGoingTxn =
      await this.transactionService.retrieveAuthorizedTransaction(
        transactionReference,
        TransactionType.P2P_TRANSFER,
      );

    if (!onGoingTxn)
      throw new NotFoundException(
        "There is no ongoing transaction for this reference " +
          transactionReference,
      );

    const { chain } = onGoingTxn;
    const processor = await this.processWallet(chain);

    const result = processor.transferAssetToDestinstion(
      userId,
      onGoingTxn,
      userType,
    );

    return result;
  }

  async handleAssetWithdrawalWebhook(
    processorType: ProcessorType,
    event: any,
    reference: string,
    gasFee: string,
  ) {
    const processor = this.getProcessor(processorType);
    await processor.handleWithdrawalWebhookEvent(event, reference, gasFee);
  }

  async handleAssetDepositWebhook(
    processor: { type: ProcessorType; reference: string },
    event: AssetDeposit,
  ) {
    const walletProcessor = this.getProcessor(processor.type);
    await walletProcessor.handleDepositWebhookEvent(
      event,
      processor.type,
      processor.reference,
    );
  }

  async handleAssetSweepWebhook(
    processor: { type: ProcessorType; reference: string },
    gasFee: string,
  ) {
    const walletProcessor = this.getProcessor(processor.type);
    await walletProcessor.handleDepositSweptEvent(processor.reference, gasFee);
  }
}
