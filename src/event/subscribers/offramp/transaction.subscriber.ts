import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import events from "src/event";
import { LiquidityProviderService } from "src/liquidity-provider/liquidity-provider.service";
import { OfframpTransactionDocument } from "src/models/offramp-transaction";

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

  constructor(private liquidityProviderService: LiquidityProviderService) {}

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

    console.log("Processed");
    await offrampTransaction.save();
  }
}
