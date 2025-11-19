import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import events from "src/event";
import { LiquidityProviderService } from "src/liquidity-provider/liquidity-provider.service";
import { AccountOrigin, AccountType } from "src/models/ledger/entry.entity";
import { OfframpTransactionDocument } from "src/models/offramp-transaction";
import { Types } from "mongoose";
import { LedgerService } from "src/ledger/ledger.service";

export class OfframTransactionFundedEvent {
  constructor(public readonly offrampTransaction: OfframpTransactionDocument) {}
}

const {
  offramp: {
    transaction: { funded },
  },
} = events;

@Injectable()
export class OfframpTransactionSubscriber {
  private readonly logger = new Logger(OfframpTransactionSubscriber.name);

  constructor(
    private liquidityProviderService: LiquidityProviderService,
    private baseLedgerService: LedgerService,
  ) {}

  @OnEvent(funded)
  async handleOfframpFunded(data: { event: OfframTransactionFundedEvent }) {
    const {
      event: { offrampTransaction },
    } = data;

    const {
      assetSent: { amount, asset, chain },
      sentAmount: { currency, amount: amountToSend },
      transactionReference,
      recipient: { bankCode, acctName, acctNo, countryCode, type },
      userId,
    } = offrampTransaction;

    this.logger.log("Offramp transaction funded for, ", transactionReference);

    // Get the liquidity provider with the cheapest rate
    const providerQuotes =
      await this.liquidityProviderService.getproviderQuotes({
        amount,
        asset: {
          from: {
            chain,
            asset,
          },
          to: currency,
        },
      });

    const [bestRateProvider] = providerQuotes;

    offrampTransaction.exchangeRate.provider = {
      name: bestRateProvider.processorType,
      rates: bestRateProvider.exchangeRate.map((rate) => ({
        [rate.code]: rate,
      })),
    };

    // Process payout to customer
    await this.liquidityProviderService.processPayoutToCustomer(
      bestRateProvider.processorType,
      {
        userId, // This will be used for any extra metadata, so, no need for
        amount: amountToSend,
        accountName: acctName,
        accountNumber: acctNo,
        bankCode,
        country: countryCode,
        reference: transactionReference,
      },
      type === "external" ? "regular" : "merchant",
    );

    offrampTransaction.processedBy = bestRateProvider.processorType;

    // Record ledger entry for funded status
    await this.baseLedgerService.recordTransactionEntry(
      {
        type: "nil", // Status update, no balance change
        amount: amount,
        accountId: "nil",
        accountOrigin: AccountOrigin.PLATFORM,
        accountType: AccountType.ASSET,
        representation: "N/A",
        metadata: {
          chain,
          asset,
          note: "Offramp transaction funded - crypto received and ready for fiat payout",
          transactionReference,
          status: "FUNDED",
        },
      },
      offrampTransaction._id as Types.ObjectId,
    );

    this.logger.log("Starting payout to customer, ", transactionReference);
    await offrampTransaction.save();
  }
}
