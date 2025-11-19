import { BadRequestException, Injectable } from "@nestjs/common";
import { CountryCode } from "libphonenumber-js";
import { Types } from "mongoose";
import {
  LiquidityProviderProcessorType,
  PayoutParams,
  ProviderQuote,
  PayoutResult,
  ProviderCapabilities,
  CryptoAsset,
  PayoutWebhookEvent,
} from "src/common/types/liquidity-provider";
import { UserType } from "src/common/types/wallet-custody";
import { emittedEvents } from "src/gateway/events";
import { SocketGateway } from "src/gateway/socket.gateway";
import { LedgerService } from "src/ledger/ledger.service";
import { AccountOrigin, AccountType } from "src/models/ledger/entry.entity";
import { MerchantTransactionStatus } from "src/models/merchant-transaction.entitiy";
import { PaymentTransactionStatus } from "src/models/offramp-transaction";
import { TransactionService } from "src/transaction/transaction.service";

@Injectable()
export abstract class AbstractLiquidityProvider {
  protected abstract readonly providerId: LiquidityProviderProcessorType;

  constructor(
    private baseTransactionService: TransactionService,
    private baseSocketGateway: SocketGateway,
    private baseLedgerService: LedgerService,
  ) {}

  /**
   * Provider-specific implementation to get provider ID
   */
  public getProviderId() {
    return this.providerId;
  }

  async payoutToCustomer(
    userId: Types.ObjectId,
    details: {
      amount: string;
      accountNumber: string;
      accountName: string;
      country: CountryCode;
      bankCode: string;
      comment?: string;
      reference: string;
    },
    userType: UserType,
  ) {
    const result = await this.processPayout(
      {
        amount: details.amount,
        comment: details.comment,
        userId,
        recipient: {
          accountName: details.accountName,
          accountNumber: details.accountNumber,
          country: details.country,
          bankCode: details.bankCode,
        },
        transactionReference: details.reference,
      },
      userType,
    );

    if (!result.success) throw new BadRequestException(result.error);
    return result.result;
  }

  async handlePayoutWebhookEvent(
    event: Record<string, string>,
    transactionReference: string,
  ) {
    // Find the transaction based on the transaction reference
    const transaction =
      await this.baseTransactionService.retrieveOfframpTransactionByReference(
        transactionReference,
      );

    if (!transaction) return;

    const response = await this.processPayoutWebhookEvent(event);

    if (!response.updateStatus) return;

    // Update the transaction status
    transaction.status = response.status;

    // Check if this offramp transaction is attached to a merchant's payment transaction
    const merchantTxn =
      await this.baseTransactionService.retrieveMerchantTransactionByOfframId(
        transaction._id as Types.ObjectId,
      );

    if (merchantTxn) {
      // Update the transaction status based on the offramp flow state
      switch (response.status) {
        case PaymentTransactionStatus.PENDING:
          merchantTxn.status = MerchantTransactionStatus.PROCESSING;
          break;

        case PaymentTransactionStatus.COMPLETED: {
          merchantTxn.status = MerchantTransactionStatus.COMPLETED;

          const {
            amount,
            currency,
            coinAsset: { asset, chain, amount: coinAmount },
          } = merchantTxn;

          // Flow state is completed and send socket event to merchant
          const room = this.baseSocketGateway.createRoomName(
            merchantTxn.merchantId.toString(),
          );

          this.baseSocketGateway.server
            .to(room)
            .emit(emittedEvents.completedMerchantPayment, {
              message: "Payment Recieved!!",
              transaction: {
                amount,
                currency,
                chain,
                chainAsset: asset,
                coinAmount,
                fromAddr: transaction.fromAddr,
              },
            });

          // Record ledger entry for merchant transaction completion
          await this.baseLedgerService.recordBulkTransactionEntries(
            [
              // Debit -> Merchant liability (Reduce liability - merchant has been paid)
              {
                type: "debit",
                amount: merchantTxn.amount,
                accountId: merchantTxn.merchantId as Types.ObjectId,
                accountOrigin: AccountOrigin.MERCHANT,
                accountType: AccountType.LIABILITY,
                representation: "-" + merchantTxn.amount,
                metadata: {
                  currency: merchantTxn.currency,
                  chain: chain,
                  asset: asset,
                  coinAmount: coinAmount,
                  note: "Merchant liability reduced - settlement completed, user paid",
                  transactionReference: merchantTxn.reference,
                  payoutReference: transaction.transactionReference,
                },
              },
              // Credit -> Platform fiat account (Fiat sent to merchant's bank account)
              {
                type: "credit",
                amount: merchantTxn.amount,
                accountId: "nil",
                accountOrigin: AccountOrigin.PLATFORM,
                accountType: AccountType.ASSET,
                representation: "-" + merchantTxn.amount,
                metadata: {
                  currency: merchantTxn.currency,
                  processedBy: this.providerId,
                  note: "Platform fiat account debited - user settlement completed",
                  transactionReference: merchantTxn.reference,
                },
              },
            ],
            transaction._id as Types.ObjectId,
            `Merchant transaction settlement completed - ${merchantTxn.reference}`,
          );

          // Close the ledger entry
          await this.baseLedgerService.closeLedgerEntry(
            transaction._id as Types.ObjectId,
          );

          break;
        }
        case PaymentTransactionStatus.FAILED:
          merchantTxn.status = MerchantTransactionStatus.FAILED;
          // Send event too?

          // Record ledger entry for merchant transaction failure
          // Record reversal entries for failed payout
          await this.baseLedgerService.recordBulkTransactionEntries(
            [
              // Credit -> Platform hot wallet (Reverse the debit - refund fiat back)
              {
                type: "credit",
                amount: transaction.sentAmount.amount,
                accountId: "nil",
                accountOrigin: AccountOrigin.PLATFORM,
                accountType: AccountType.ASSET,
                representation: "+" + transaction.sentAmount.amount,
                metadata: {
                  currency: transaction.sentAmount.currency,
                  processedBy: this.providerId,
                  note: "Platform hot wallet credited - payout failed, funds returned",
                  transactionReference: transactionReference,
                },
              },
              // Debit -> Platform liability (Reverse the credit - customer still owed)
              {
                type: "debit",
                amount: transaction.sentAmount.amount,
                accountId: "nil",
                accountOrigin: AccountOrigin.PLATFORM,
                accountType: AccountType.LIABILITY,
                representation: "+" + transaction.sentAmount.amount,
                metadata: {
                  currency: transaction.sentAmount.currency,
                  processedBy: this.providerId,
                  note: "Platform liability increased - payout failed, customer still owed",
                  transactionReference: transactionReference,
                },
              },
            ],
            transaction._id as Types.ObjectId,
            `Payout failure reversal - ${transactionReference}`,
          );

          // Close the ledger entry
          await this.baseLedgerService.closeLedgerEntry(
            transaction._id as Types.ObjectId,
          );
          break;

        default:
          break;
      }

      // Other events will be updated wherever they are used
      merchantTxn.save();
    }

    await transaction.save();
  }

  async getProviderQuotes(amount: string, asset: { from: string; to: string }) {
    // ensure they are all lowercased
    const quotes = await this.processQuotes({
      amount: Number(amount),
      toAsset: asset.to.toLowerCase(),
      fromAsset: asset.from.toLowerCase(),
    });

    return quotes;
  }

  async getRate(assets: Array<string>) {
    // transform them to lowercase.
    assets = assets.map((asset) => asset.toLowerCase());
    const rates = await this.processRate(assets);
    return rates;
  }

  public abstract isAssetSupported(asset: CryptoAsset): boolean;

  protected abstract getCapabilities(): ProviderCapabilities;
  protected abstract processRate(
    params: Array<string>, // Usually an array of currency code or crypto asset code
  ): Promise<ProviderQuote["exchangeRate"]>;
  protected abstract processQuotes(request: {
    amount: number;
    fromAsset: string;
    toAsset: string;
  }): Promise<ProviderQuote>;
  protected abstract processPayout(
    params: PayoutParams,
    userType: UserType,
    liquidityProviderSpecifics?: Record<string, string>,
  ): Promise<PayoutResult>;
  protected abstract processPayoutWebhookEvent(
    event: any,
  ): Promise<PayoutWebhookEvent>;
}
