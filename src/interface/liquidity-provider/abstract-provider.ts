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
import { TransactionService } from "src/transaction/transaction.service";

@Injectable()
export abstract class AbstractLiquidityProvider {
  protected abstract readonly providerId: LiquidityProviderProcessorType;

  constructor(private baseTransactionService: TransactionService) {}

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

    // Save transaction entry to ledger money debited from platform hot wallet (No here tho)

    // Credit - Platform's hot wallet (Liquidity provider balance is reduced by a specified amount we are to send to a user)

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
