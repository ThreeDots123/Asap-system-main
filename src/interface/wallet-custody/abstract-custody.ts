import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import {
  AssetWithdrawalResponse,
  AssetWithdrawalWebhookEvent,
  AvailableWalletChains,
  CreatedChainResponse,
  CryptoWithdrawalParams,
  ProcessorType,
  RetrieveAssetResponse,
  UserType,
  WalletConfig,
  WalletCustodialProcessor,
} from "src/common/types/wallet-custody";
import { WalletService } from "src/wallet/wallet.service";
import {
  AssetDeposit,
  CreateWalletChainParams,
  RetrieveWalletChainAssetsParams,
  TransferAssetParams,
} from "./types";
import { MerchantWalletDocument } from "src/models/wallet/merchant-wallet.entity";
import { UserWalletDocument } from "src/models/wallet/user-wallet.entity";
import { Types } from "mongoose";
import {
  ChainAssetDocument,
  WalletType,
} from "src/models/wallet/chain-asset-details.entity";
import { EventService } from "src/event/event.service";
import events from "src/event";
import { AssetBalanceChangedEvent } from "src/event/subscribers/wallet-chain/asset/balance.subscriber";
import toInternationalFormat from "src/utils/to-intl-format";
import { UserService } from "src/user/user.service";
import { TransactionService } from "src/transaction/transaction.service";
import {
  TransactionDocument,
  TransactionStatus,
  TransactionType,
} from "src/models/wallet/transaction.entity";
import { LedgerService } from "src/ledger/ledger.service";
import { AccountOrigin, AccountType } from "src/models/ledger/entry.entity";
import securityChecks from "src/utils/security-checks";
import { PaymentTransactionStatus } from "src/models/offramp-transaction";
import { OfframTransactionFundedEvent } from "src/event/subscribers/offramp/transaction.subscriber";
import processWithdrawalFee from "src/utils/process-withdrawal-fee";
import Decimal from "decimal.js";

@Injectable()
export abstract class AbstractWalletCustodialProcessor
  implements WalletCustodialProcessor
{
  // ##############################################################
  // In Children processors, replace WalletConfig with the config specific for that processor, since WalletConfig is a combination of them all.
  // ##############################################################

  protected gaslessWithdrawals: true;
  protected autoSweep: false;

  protected abstract walletChains: Map<
    AvailableWalletChains,
    WalletConfig & { address: string }
  >;
  abstract type: WalletCustodialProcessor["type"];

  constructor(
    private baseWalletService: WalletService,
    private baseEventService: EventService,
    private baseUserService: UserService,
    private baseTransactionService: TransactionService,
    private baseLedgerService: LedgerService,
  ) {}

  /**
   * Provider-specific implementation to get provider ID
   */
  public abstract getProviderId(): Promise<ProcessorType> | ProcessorType;

  async createWalletChain(data: CreateWalletChainParams) {
    const { chain, metadata, userType } = data;
    const validatedChain = this.validateSelectedChain(chain);

    // check if user already has that wallet chain
    let chainExist = await this.returnWalletChain(
      chain,
      metadata.userId,
      userType,
    );
    if (chainExist) return null;

    const response = await this.processChainCreation(validatedChain, metadata, {
      userType,
      chain,
    });

    // Persist created data to the database
    await this.baseWalletService.registerNewChain(userType, {
      ...response,
      userId: metadata.userId,
    });

    return response;
  }

  async getChainAssetBalance(params: RetrieveWalletChainAssetsParams) {
    const { userId, userType, chain } = params;
    const validatedChain = this.validateSelectedChain(chain);

    // find user wallet chain
    let foundChain = await this.returnWalletChain(chain, userId, userType);

    if (!foundChain)
      throw new BadRequestException(
        "Cannot retrieve assets for this chain. Does not belong to user.",
      );

    // Retrieve assets for this chains
    const assets = await this.baseWalletService.retrieveAssetsForChain(
      foundChain._id as Types.ObjectId,
      userType === "regular" ? WalletType.USER : WalletType.MERCHANT,
    );

    if (assets.length === 0) {
      // Fetch wallet assets from custodial service and update db.

      const chainAssets = await this.processChainAssetRetrieval(
        validatedChain,
        foundChain.custodialId,
      );

      await this.baseWalletService.createChainBalance(
        chainAssets.map((asset) => ({
          ...asset,
          walletModelType:
            userType === "regular" ? WalletType.USER : WalletType.MERCHANT,
          walletId: foundChain._id as Types.ObjectId,
        })),
      );

      return {
        chain,
        assets: chainAssets,
      };
    }

    // Get the converted balances of all user's assets
    const updatedAssets = await Promise.all(
      assets.map(async (asset) => {
        const rate = await this.processRateRetrieval(
          validatedChain,
          asset.symbol,
          "usd",
        );
        asset.convertedBalance = String(Number(asset.balance) * rate);
        return asset;
      }),
    );

    // Return cached data
    return {
      chain,
      assets: updatedAssets,
    };
  }

  async initiateAssetTransfer(params: TransferAssetParams, userType: UserType) {
    const { recipient, chain, assetName, userId, amount, comment } = params;
    let recipientAddr: string;
    let internalTxn:
      | {
          status: false;
        }
      | {
          status: true;
          recipient: Types.ObjectId;
        } = {
      status: false,
    };

    const { chain: foundWalletChain, asset } =
      await this.getChainWalletAndAsset(userId, userType, { chain, assetName });

    if (Number(asset.balance) < Number(amount))
      throw new BadRequestException(
        "User balance not sufficient enough for this transaction.",
      );

    // find user wallet chain
    let foundChain = await this.returnWalletChain(chain, userId, userType);
    if (!foundChain)
      throw new BadRequestException(
        "Cannot retrieve assets for this chain. Does not belong to user.",
      );

    if (recipient.type === "phone") {
      const { countryCode, phone } = recipient;
      // Ensure the number is in international format
      const phoneIntlFmt = toInternationalFormat(phone, countryCode);

      // Use phone number to get the user's wallet address for the chain type. [This is a user specific feature, not for merchant]
      // Ensure phone number is recognised by the platform
      const recipientUser =
        await this.baseUserService.findOneByPhoneNumber(phoneIntlFmt);
      if (!recipientUser)
        throw new NotFoundException(
          "No platform user was found for the passed phone number.",
        );

      // Find specific wallet chain for user
      const recipientWalletChain =
        await this.baseWalletService.findWalletChainByName(
          { userType: "regular", userId: recipientUser._id as Types.ObjectId },
          chain,
        );
      if (!recipientWalletChain)
        throw new NotFoundException(
          "Cannot find the chain " +
            chain +
            " for the recipient. Cannot complete transfer",
        );

      recipientAddr = recipientWalletChain.address;
      internalTxn = {
        status: true,
        recipient: recipientWalletChain.userId,
      }; // Obviously we checked our database to retrieve the address using the phone number
    } else {
      recipientAddr = recipient.address;

      if (recipient.address === "platform") {
        internalTxn = {
          status: true,
          recipient:
            "userId" in foundWalletChain
              ? foundWalletChain.userId
              : foundWalletChain.merchantId, // Sender Id when plaform is selected
        };
      } else {
        // Search for a chain wallet with this address
        let walletChain: MerchantWalletDocument | UserWalletDocument | null =
          await this.baseWalletService.findWalletChainByNameWithAddress(
            {
              address: recipientAddr,
              userType: userType,
            },
            chain,
          );

        if (walletChain)
          internalTxn = {
            status: true,
            recipient:
              "userId" in walletChain
                ? walletChain.userId
                : walletChain.merchantId,
          };
      }
    }

    // Ensure that the recipient address is not the same with the one sending the request
    const userWalletChain = await (userType === "regular"
      ? this.baseWalletService.findWalletChainByName(
          { userType, userId: params.userId },
          chain,
        )
      : this.baseWalletService.findWalletChainByName(
          { userType, userId: params.userId },
          chain,
        ));

    if (!userWalletChain)
      throw new InternalServerErrorException(
        "Cannot find user wallet address for this chain.",
      );

    if (userWalletChain.address === recipientAddr)
      throw new BadRequestException(
        "Recipient address cannot be user's address.",
      );

    // check fee (if any) and add to transaction
    const gasFee = !internalTxn.status
      ? await this.processAssetWithdrawalFee(
          amount,
          this.validateSelectedChain(chain),
          { recipientAddr, assetCustodialId: asset.custodialId },
          foundChain.custodialId,
        )
      : {};

    let withdrawalGasFee = "0";
    if (internalTxn.status && recipientAddr === "platform") {
      withdrawalGasFee = "0.01";
    } else {
      // Convert fee from custodial processor denominator to the one the user is withdrawing from.
      withdrawalGasFee = processWithdrawalFee();
    }

    const totalToPay = String(Decimal(amount).plus(Decimal(withdrawalGasFee)));

    // create the transaction
    const newTransaction =
      await this.baseTransactionService.initiateP2PTransferTransaction({
        userId,
        from: foundWalletChain.address,
        to: recipientAddr,
        chain,
        internalTxn,
        amount: {
          subAmount: amount,
          fee: withdrawalGasFee,
          total: totalToPay,
        },
        asset: asset.name,
        action: "sent",
        gasFee,
        comment,
        offrampTxnId: params.offrampTxnId,
        userType,
      });

    return {
      message:
        "Asset transaction initiated. This transaction will expire in 15 mins.",
      amount: {
        subAmount: amount,
        fee: withdrawalGasFee,
        total: totalToPay,
      },
      chain: chain,
      assetToWithdraw: asset.name,
      reference: newTransaction.transactionReference,
      ...securityChecks(false),
    };
  }

  async transferAssetToDestinstion(
    userId: Types.ObjectId,
    transaction: string | TransactionDocument,
    userType: UserType,
  ) {
    // Get the initated transaction
    let onGoingTxn: TransactionDocument;

    if (typeof transaction === "string") {
      // Transaction reference passed.
      const result =
        await this.baseTransactionService.retrieveAuthorizedTransaction(
          transaction,
          TransactionType.P2P_TRANSFER,
        );
      if (!result)
        throw new NotFoundException(
          "There is no ongoing transaction for this reference " + transaction,
        );

      onGoingTxn = result;
    } else onGoingTxn = transaction;

    const {
      amount,
      chain,
      metadata,
      asset: foundAsset,
      toAddr: recipientAddr,
      transactionReference,
      _id: ongoingTxnId,
      gasFee,
    } = onGoingTxn;

    // Retrieve actual asset (uses this along with the user's id to verify that the transaction belongs to the user)
    const { chain: senderWalletChain, asset: senderChainAsset } =
      await this.getChainWalletAndAsset(userId, userType, {
        chain,
        assetName: foundAsset,
      });

    if (onGoingTxn.canHandleInternally.status) {
      try {
        if (onGoingTxn.toAddr === "platform") {
          // This is transfer to the platform (most often due to an offramping process)

          // Process amount debit
          await this.syncBalanceToUserWallet(
            chain,
            senderChainAsset,
            {
              amount: amount.total,
              calc: "subtract",
            },
            userId,
          );

          // Record Ledger for the whole event
          await this.baseLedgerService.recordBulkTransactionEntries(
            [
              // Debit -> User A Wallet (by amount of chain asset to send) Reduction in Liability
              {
                type: "debit",
                amount: amount.total,
                accountId: senderWalletChain._id as Types.ObjectId,
                accountOrigin: AccountOrigin.USER,
                accountType: AccountType.LIABILITY,
                representation: "-" + amount.total,
                metadata: {
                  chainAsset: senderChainAsset.name,
                  assetPlatformId: senderChainAsset.id,
                  ...(senderChainAsset.custodialId && {
                    assetCustodialId: senderChainAsset.custodialId,
                  }),
                  type: "internal transfer",
                  note: "User A Wallet debited - Decrease in Liability",
                },
              },

              // Credit -> Master wallet increased due to user transfering asset to us for offramping
              {
                type: "credit",
                amount: amount.total,
                accountId: "nil",
                accountOrigin: AccountOrigin.PLATFORM,
                accountType: AccountType.ASSET,
                representation: "+" + amount.total,
                metadata: {
                  chain,
                  asset: senderChainAsset.name,
                  processedBy: "internal transfer",
                  note: "Master wallet funded for offramping transaction.",
                },
              },

              // Debit -> Increased master wallet by charging a fee that was collected from the user
              {
                type: "debit",
                amount: amount.fee ?? "0", // Fee amount returns amount if exists else 0.
                accountId: "nil",
                accountType: AccountType.ASSET,
                accountOrigin: AccountOrigin.PLATFORM,
                representation: "+" + amount.fee,
                metadata: {
                  amountChargedUser: "",
                  note: "Increased master wallet by charging a fee that was collected from the user",
                  assetSymbolOfCharge: senderChainAsset.name, // We charge the user in the asset they are withdrawing.
                  baseAssetSymbolOfCharge: senderChainAsset.name ?? "No charge", // Original gas fee asset charged by custodial wallet
                  processedBy: "internal transfer",
                },
              },
            ],
            ongoingTxnId as Types.ObjectId,
            "Internal transfer of " +
              senderChainAsset.name +
              " on " +
              senderWalletChain.chain +
              " chain",
          );
        } else {
          const recipient = onGoingTxn.canHandleInternally
            .recipient as Types.ObjectId;

          const { chain: recipientWalletChain, asset: recipientChainAsset } =
            await this.getChainWalletAndAsset(
              recipient,
              onGoingTxn.metadata.userType,
              {
                chain,
                assetName: foundAsset,
              },
            );

          // Process amount swap
          // Swap subamount from user A to user B
          const result =
            await this.baseWalletService.userTopsAnotherUserAssetBalance({
              from: {
                asset: senderChainAsset,
                id:
                  "userId" in senderWalletChain
                    ? senderWalletChain.userId
                    : senderWalletChain.merchantId,
                amount: amount.total,
              },
              to: {
                asset: recipientChainAsset,
                id:
                  "userId" in recipientWalletChain
                    ? recipientWalletChain.userId
                    : recipientWalletChain.merchantId,

                amount: amount.subAmount,
              },
            });

          // Record Ledger for the whole event
          await this.baseLedgerService.recordBulkTransactionEntries(
            [
              // Debit -> User A Wallet (by amount of chain asset to send) Reduction in Liability
              {
                type: "debit",
                amount: amount.total,
                accountId: senderWalletChain._id as Types.ObjectId,
                accountOrigin: AccountOrigin.USER,
                accountType: AccountType.LIABILITY,
                representation: "-" + amount.total,
                metadata: {
                  chainAsset: senderChainAsset.name,
                  assetPlatformId: senderChainAsset.id,
                  ...(senderChainAsset.custodialId && {
                    assetCustodialId: senderChainAsset.custodialId,
                  }),
                  type: "internal transfer",
                  note: "User A Wallet debited - Decrease in Liability",
                },
              },

              // Credit -> User B Wallet (by amount of chain asset sent) Increase in Liability
              {
                type: "credit",
                amount: amount.subAmount,
                accountId: recipientWalletChain._id as Types.ObjectId,
                accountOrigin: AccountOrigin.USER,
                accountType: AccountType.LIABILITY,
                representation: "+" + amount.subAmount,
                metadata: {
                  chain,
                  assetPlatformId: recipientChainAsset.id,
                  ...(recipientChainAsset.custodialId && {
                    assetCustodialId: recipientChainAsset.custodialId,
                  }),
                  processedBy: "internal transfer",
                  note: "User B Wallet credited - Increase in Liability",
                },
              },

              // Debit -> Increased master wallet by charging a fee that was collected from the user
              {
                type: "debit",
                amount: amount.fee ?? "0", // Fee amount returns amount if exists else 0.
                accountId: "nil",
                accountType: AccountType.ASSET,
                accountOrigin: AccountOrigin.PLATFORM,
                representation: "+" + amount.fee,
                metadata: {
                  amountChargedUser: "",
                  note: "Increased master wallet by charging a fee that was collected from the user",
                  assetSymbolOfCharge: senderChainAsset.name, // We charge the user in the asset they are withdrawing.
                  baseAssetSymbolOfCharge: senderChainAsset.name ?? "No charge", // Original gas fee asset charged by custodial wallet
                  processedBy: "internal transfer",
                },
              },
            ],
            ongoingTxnId as Types.ObjectId,
            "Internal transfer of " +
              senderChainAsset.name +
              " on " +
              senderWalletChain.chain +
              " chain",
          );

          // Send event to client
          result.forEach(
            ({ asset: { name, balance, convertedBalance }, id }) => {
              // Send event to subscriber.
              this.baseEventService.emit(events["asset-balance"].change, {
                event: new AssetBalanceChangedEvent(id, [
                  {
                    chain: chain,
                    assets: [{ name, balance, convertedBalance }],
                  },
                ]),
              });
            },
          );
        }

        // Close ledger and update transaction status
        onGoingTxn.status = TransactionStatus.COMPLETED;
        await onGoingTxn.save();

        await this.baseLedgerService.closeLedgerEntry(
          onGoingTxn._id as Types.ObjectId,
        );

        return {
          message:
            "Transfer successful, this may take a few minutes to reflect",
          webhookEvent: false,
          transaction: {
            chain: onGoingTxn.chain,
            asset: onGoingTxn.asset,
            amount: onGoingTxn.amount.total,
          },
        };
      } catch (err) {
        console.log(err);
        throw new InternalServerErrorException(
          "something went wrong while processing your transaction",
        );
      }
    }

    // Processor specific implementation
    const response = await this.processAssetWithdrawal(
      {
        amount: amount.subAmount,
        recipientAddr,
        asset: senderChainAsset,
        reference: onGoingTxn.transactionReference,
        metadata: {
          comment: metadata.custom.comment ?? "",
          reference: transactionReference,
        },
      },
      this.validateSelectedChain(chain),
      senderWalletChain.chain,
    );

    if (!response.success) throw new BadRequestException(response.error);

    // Open Ledger here and record all transactions to this point!!!!!!!
    await this.baseLedgerService.recordBulkTransactionEntries(
      [
        // Debit -> User Wallet (by amount of chain asset to send) Reduction in Liability
        {
          type: "debit",
          amount: amount.total,
          accountId: senderWalletChain._id as Types.ObjectId,
          accountOrigin: AccountOrigin.USER,
          accountType: AccountType.LIABILITY,
          representation: "-" + amount.total,
          metadata: {
            chainAsset: senderChainAsset.name,
            assetPlatformId: senderChainAsset.id,
            ...(senderChainAsset.custodialId && {
              assetCustodialId: senderChainAsset.custodialId,
            }),
            processedBy: response.transaction.processedBy,
            note: "User A Wallet Debited - Decrease in Liability",
          },
        },

        // Debit -> Increased master wallet by charging a fee that was collected from the user
        {
          type: "debit",
          amount: amount.fee ?? "0", // Fee amount returns amount if exists else 0.
          accountId: "nil",
          accountType: AccountType.EXPENSE,
          accountOrigin: AccountOrigin.PLATFORM,
          representation: "+" + amount.fee,
          metadata: {
            amountChargedUser: "",
            assetSymbolOfCharge: senderChainAsset.name, // We charge the user in the asset they are withdrawing.
            baseAssetSymbolOfCharge: senderChainAsset.name ?? "No charge", // Original gas fee asset charged by custodial wallet
            processedBy: response.transaction.processedBy,
            note: "Increase in master wallet asset by collecting a fee from user",
          },
        },

        // Credit -> Platform's Hot wallet (Our crypto asset is reduced by the total amount that ***left your on-chain wallet***) - User Withdrawal amount
        {
          type: "credit",
          amount: amount.total,
          accountId: "nil",
          accountType: AccountType.ASSET,
          accountOrigin: AccountOrigin.PLATFORM,
          representation: "-" + amount.subAmount,
          metadata: {
            chainAsset: senderChainAsset.name,
            assetPlatformId: senderChainAsset.id,
            ...(senderChainAsset.custodialId && {
              assetCustodialId: senderChainAsset.custodialId,
            }),
            processedBy: response.transaction.processedBy,
            note: "Master wallet asset reduced by the total amount sent out to external recipient",
          },
        },
      ],
      ongoingTxnId as Types.ObjectId,
      "Withdrawing " +
        senderChainAsset.name +
        " on " +
        senderWalletChain.chain +
        " chain",
    );

    // Update user balance
    // onGoingTxn.amount.total - user balance
    this.syncBalanceToUserWallet(
      chain,
      senderChainAsset,
      {
        amount: amount.total,
        calc: "subtract",
      },
      userId,
    );

    // Update the ledger status to `posted` after recieving the webhook event of this transaction. If a failed event is given instead then post a failed or an appropriate event in ledger

    // update transaction in database.
    // Edit existing transaction
    const { type, status, custodialTxnId, processedBy, masterWltAddr } =
      response.transaction;

    Object.assign(onGoingTxn, {
      custodialTxnId, // The id of the transaction done by the processor
      masterWltUsed: processedBy,
      status: status ?? TransactionStatus.PENDING,
      type,
    });

    onGoingTxn.metadata.custom.masterWltAddr = masterWltAddr;

    await onGoingTxn.save();

    return {
      message: "Transfer successful, this may take a few minutes to reflect",
      webhookEvent: true,
      transaction: {
        chain: onGoingTxn.chain,
        asset: onGoingTxn.asset,
        amount: onGoingTxn.amount.total,
      },
    };
  }

  async handleWithdrawalWebhookEvent(
    event: Record<string, string>,
    reference: string,
    gasFee: string,
  ) {
    // Look for an asset withdraw transaction using the transaction reference
    const transaction =
      await this.baseTransactionService.retrieveTransactionByReference(
        reference,
        TransactionType.P2P_TRANSFER,
      );

    if (!transaction || transaction.status === TransactionStatus.INITIATED)
      return;

    const response = await this.processWithdrawalWebhookEvent(event);

    if (!response.updateStatus) return;

    // Update the transaction status
    transaction.status = response.status;

    // Record gas fee in ledger
    await this.baseLedgerService.recordTransactionEntry(
      // Credit -> Platform's Hot wallet (Our crypto asset is reduced by the total amount that left your on-chain wallet) - Network Fee
      {
        type: "credit",
        amount: gasFee ?? "0", // Fee amount returns amount if exists else 0.,
        accountId: "nil",
        accountType: AccountType.EXPENSE,
        accountOrigin: AccountOrigin.PLATFORM,
        representation: "-" + (gasFee ?? "0"),
        metadata: {
          note: "Master wallet debited for successful withdrawal (transfer) - gas fee",
          chainAsset: transaction.gasFee.asset,
          processedBy: transaction.processedBy,
        },
      },
      transaction._id as Types.ObjectId,
    );

    // Close the transaction ledger
    await this.baseLedgerService.closeLedgerEntry(
      transaction._id as Types.ObjectId,
    );

    // if transaction status is completed, update ledger status to posted
    if (response.status === TransactionStatus.COMPLETED) {
      transaction.gasFee.amount = gasFee;

      // Check if the withdrawal transaction is attached to an offramp transaction and emit a funded event if it is
      if (transaction.offrampTxnId) {
        const offrampTransaction =
          await this.baseTransactionService.retrieveOfframpTransactionById(
            transaction.offrampTxnId,
          );

        if (!offrampTransaction) return;

        offrampTransaction.status = PaymentTransactionStatus.FUNDED;
        offrampTransaction.fromAddr = response.fromAddress;
        transaction.fromAddr = response.fromAddress;

        await offrampTransaction.save();

        const {
          offramp: {
            transaction: { funded },
          },
        } = events;

        this.baseEventService.emit(funded, {
          event: new OfframTransactionFundedEvent(offrampTransaction),
        });
      }
    } else {
      // Handle Failed event
      // Refund user
      (async () => {
        const { chain, asset } = await this.getChainWalletAndAsset(
          transaction.userId,
          transaction.metadata.userType,
          {
            chain: transaction.chain,
            assetName: transaction.asset,
          },
        );

        this.syncBalanceToUserWallet(
          chain.chain,
          asset,
          {
            amount: transaction.amount.total,
            calc: "add",
          },
          transaction.userId,
        );
      })();
    }

    await transaction.save();

    // Send event for notification purposes??
  }

  async handleDepositWebhookEvent(
    data: AssetDeposit,
    processor: ProcessorType,
    processorTransactionReference: string,
  ) {
    const {
      recipientAddr,
      fromAddr,
      transactionHash,
      amount,
      chain,
      asset,
      blockNo,
      reference,
    } = data;

    // Look for user wallet with that recipient address on a specific blockchain
    let walletChain: MerchantWalletDocument | UserWalletDocument | null =
      await this.baseWalletService.findWalletChainByNameWithAddress(
        {
          address: recipientAddr,
          userType: "regular",
        },
        chain,
      );

    if (!walletChain) {
      // Then it probably is in merchant's collection.
      walletChain =
        await this.baseWalletService.findWalletChainByNameWithAddress(
          {
            address: recipientAddr,
            userType: "merchant",
          },
          chain,
        );

      if (!walletChain) return; // Could not find it in merchant either
    }

    const userId =
      "userId" in walletChain ? walletChain.userId : walletChain.merchantId;

    const userType = "userId" in walletChain ? "regular" : "merchant";

    // Process Deposit actions

    // Enusre this transaction is idempotent and check if this transactionHash exists
    const foundTransaction =
      await this.baseTransactionService.retrieveTransactionByHash(
        transactionHash,
        TransactionType.P2P_TRANSFER,
      );

    if (!foundTransaction) {
      // Create a transaction for the deposit
      const depositTransaction =
        await this.baseTransactionService.recordDepositTransaction({
          userId,
          from: fromAddr,
          to: recipientAddr,
          chain,
          asset,
          hash: transactionHash,
          amount,
          processor,
          blockNo,
          userType,
          custodialTxnId: processorTransactionReference,
          reference,
        });

      // Open ledger and record deposit...
      await this.baseLedgerService.recordBulkTransactionEntries(
        [
          // Credit -> User Wallet (by amount of chain asset deposited) Increase in Liability
          {
            type: "credit",
            amount,
            accountId: walletChain._id as Types.ObjectId,
            accountOrigin: AccountOrigin.USER,
            accountType: AccountType.LIABILITY,
            representation: "+" + amount,
            metadata: {
              chain,
              asset,
              processedBy: processor,
              note: "Deposit for user - Master wallet increased in liability",
            },
          },

          // Debit -> Platform's Hot wallet (Our crypto asset is increased by the total amount that was deposited to the on-chain wallet) - User deposit amount
          {
            type: "debit",
            amount,
            accountId: "nil",
            accountType: AccountType.ASSET,
            representation: "+" + amount,
            accountOrigin: AccountOrigin.PLATFORM,
            metadata: {
              chain,
              asset,
              processedBy: processor,
              note: "Master wallet asset increased due to user's deposit",
            },
          },
        ],
        depositTransaction._id as Types.ObjectId,
      );
      // Ledger will be closed after the swept processing is complete
    }

    // Update user balance
    const userAsset = await this.baseWalletService.retrieveAssetForChainByName(
      walletChain._id as Types.ObjectId,
      "userId" in walletChain ? WalletType.USER : WalletType.MERCHANT,
      asset,
    );

    if (!userAsset) return;

    // Sync wallet asset in the background
    this.syncBalanceToUserWallet(
      walletChain.chain,
      userAsset,
      {
        amount,
        calc: "add",
      },
      userId,
    );

    // Send event for notification purposes?
  }

  async handleDepositSweptEvent(reference: string, gasFeeAmount: string) {
    // Look for a transaction using the transaction reference
    const transaction =
      await this.baseTransactionService.retrieveTransactionByReference(
        reference,
        TransactionType.P2P_TRANSFER,
      );

    if (!transaction) return;

    // Add sweep entry to transaction and close the ledger
    await this.baseLedgerService.recordBulkTransactionEntries(
      [
        {
          type: "nil",
          amount: transaction.amount.total,
          accountId: transaction.userId,
          accountType: AccountType.ASSET,
          representation: "N/A",
          accountOrigin: AccountOrigin.USER,
          metadata: {
            type: "sweep",
            amount: transaction.amount.total,
            processedBy: ProcessorType.NONE,
            asset: transaction.asset,
            note: "Sweep performed on user wallet, moving asset to master wallet",
          },
        },

        // Credit -> Platform's Hot wallet (Our crypto asset is reduced by the total amount that left the on-chain wallet) - Network Fee
        {
          type: "credit",
          amount: gasFeeAmount, // Fee amount returns amount if exists else 0.,
          accountId: "nil",
          accountType: AccountType.ASSET,
          accountOrigin: AccountOrigin.PLATFORM,
          representation: "-" + gasFeeAmount,
          metadata: {
            chainAsset: transaction.chain,
            assetPlatformId: transaction.asset,
            processedBy: ProcessorType.NONE,
            note: "Master wallet in reduced by the gas fee amount for the sweep.",
          },
        },
      ],
      transaction._id as Types.ObjectId,
    );

    await this.baseLedgerService.closeLedgerEntry(
      transaction._id as Types.ObjectId,
    );
  }

  private async getChainWalletAndAsset(
    userId: Types.ObjectId,
    userType: UserType,
    options: {
      chain: AvailableWalletChains;
      assetName: string;
    },
  ) {
    const { assetName, chain } = options;
    // Get sender's wallet
    let foundWalletChain: UserWalletDocument | MerchantWalletDocument;
    if (userType === "regular") {
      const result = await this.baseWalletService.findWalletChainByName(
        { userId, userType },
        chain,
      );
      if (!result)
        throw new NotFoundException(
          "The wallet chain " +
            chain +
            " was not found for this user. Retrieval Unsuccessful.",
        );

      foundWalletChain = result;
    } else {
      const result = await this.baseWalletService.findWalletChainByName(
        { userId, userType },
        chain,
      );
      if (!result)
        throw new NotFoundException(
          "The wallet chain " +
            chain +
            " was not found for this merchant. Retrieval Unsuccessful.",
        );

      foundWalletChain = result;
    }

    // Look for the specified sender's asset name for the selected wallet chain
    const foundAsset = await this.baseWalletService.retrieveAssetForChainByName(
      foundWalletChain._id as Types.ObjectId,
      userType === "regular" ? WalletType.USER : WalletType.MERCHANT,
      assetName,
    );

    if (!foundAsset)
      throw new NotFoundException(
        "The asset " +
          assetName +
          " for the selected chain " +
          chain +
          " was not found.",
      );

    return { asset: foundAsset, chain: foundWalletChain };
  }

  // ARE NOT REQUIRED AS WE NO LONGER MAINTAIN WALLET WITH SUB WALLETS

  // private async refreshChainAssetBalance(
  //   walletChain: UserWalletDocument | MerchantWalletDocument,
  // ) {
  //   // Get fresh balances
  //   const validatedChain = this.validateSelectedChain(walletChain.chain);
  //   const chainAssets = await this.processChainAssetRetrieval(
  //     validatedChain,
  //     walletChain.custodialId,
  //   );

  //   // Update credentials in database
  //   await this.baseWalletService.updateChainBalance(
  //     chainAssets.map((asset) => ({
  //       ...asset,
  //       walletModelType:
  //         "userId" in walletChain ? WalletType.USER : WalletType.MERCHANT,
  //       walletId: walletChain._id as Types.ObjectId,
  //     })),
  //   );

  //   return chainAssets;
  // }

  // private async refreshAllChainsBalances(
  //   userId: Types.ObjectId,
  //   userType: UserType,
  // ) {
  //   // Get all chains
  //   const walletChains = await (userType === "regular"
  //     ? this.baseWalletService.findUserWalletChains(userId, "regular")
  //     : this.baseWalletService.findUserWalletChains(userId, "merchant"));

  //   // Asyncronously call refreshChainAssetBalance
  //   const updatedChainAssetBalances = await Promise.all(
  //     walletChains.map(
  //       async (wallet: UserWalletDocument | MerchantWalletDocument) => {
  //         const assets = await this.refreshChainAssetBalance(wallet);
  //         return {
  //           chain: wallet.chain,
  //           assets,
  //         };
  //       },
  //     ),
  //   );

  //   return updatedChainAssetBalances;
  // }

  private validateSelectedChain(name: AvailableWalletChains) {
    const wallet = this.walletChains.get(name);

    if (!wallet) {
      throw new InternalServerErrorException(
        `Wallet ${name} not found. Add it first using the addWallet () functionality`,
      );
    }

    return wallet;
  }

  private async returnWalletChain(
    chain: AvailableWalletChains,
    userId: Types.ObjectId,
    userType: UserType,
  ) {
    // check if user has wallet chain that is passed
    let chainData: UserWalletDocument | MerchantWalletDocument | null = null;
    if (userType === "regular")
      chainData = await this.baseWalletService.findWalletChainByName(
        { userId, userType },
        chain,
      );
    else
      chainData = await this.baseWalletService.findWalletChainByName(
        { userId, userType },
        chain,
      );

    return chainData;
  }

  private async syncBalanceToUserWallet(
    chain: AvailableWalletChains,
    userAsset: ChainAssetDocument,
    assetDetails: {
      amount: string;
      calc: "add" | "subtract";
    },
    userId: Types.ObjectId,
  ) {
    // Sync Balance of user crypto wallet
    // Refresh and get realtime balances in background. Send an event if there is a change in the data
    // const result = await this.refreshChainAssetBalance(foundChain); - NO LONGER THE MODUS OPERANDI

    const validatedChain = this.validateSelectedChain(chain);
    const { name, balance, convertedBalance } =
      await this.baseWalletService.calculateWalletBalance(
        userAsset,
        assetDetails,
        async (assetSymbol: string, currency: string) =>
          this.processRateRetrieval(validatedChain, assetSymbol, currency),
      );

    // Send event to subscriber.
    this.baseEventService.emit(events["asset-balance"].change, {
      event: new AssetBalanceChangedEvent(userId, [
        {
          chain: chain,
          assets: [{ name, balance, convertedBalance }],
        },
      ]),
    });
  }

  abstract getSupportedWalletChains(): ReturnType<
    WalletCustodialProcessor["getSupportedWalletChains"]
  >;

  protected abstract processChainCreation(
    wallet: WalletConfig,
    metadata: CreateWalletChainParams["metadata"],
    opts: { userType: UserType; chain: AvailableWalletChains },
  ): Promise<CreatedChainResponse>;

  protected abstract processChainAssetRetrieval(
    wallet: WalletConfig,
    custodialId?: string,
  ): Promise<RetrieveAssetResponse[]>;

  protected abstract processAssetWithdrawalFee(
    amountToWithdraw: string,
    wallet: WalletConfig,
    asset: {
      recipientAddr?: string;
      assetCustodialId?: string;
    },
    custodialId?: string,
  ): Promise<{ amount: string; asset: string }>;

  protected abstract processAssetWithdrawal(
    params: CryptoWithdrawalParams,
    wallet: WalletConfig,
    chain?: AvailableWalletChains,
  ): Promise<AssetWithdrawalResponse>;

  protected abstract processWithdrawalWebhookEvent(
    event: any,
  ): Promise<AssetWithdrawalWebhookEvent>;

  protected abstract processRateRetrieval(
    chainConfig: WalletConfig,
    assetSymbol: string,
    currency: string,
  ): Promise<number>;
}
