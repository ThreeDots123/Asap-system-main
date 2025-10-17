import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ProviderRegistryService } from "./registry.service";
import {
  CryptoAsset,
  LiquidityProviderProcessorType,
  ProviderQuote,
} from "src/common/types/liquidity-provider";
import { Types } from "mongoose";
import { CountryCode } from "libphonenumber-js";
import { UserType } from "src/common/types/wallet-custody";

export interface OrchestrationOptions {
  preferredProvider?: string;
  sortBy?: "bestRate" | "lowestFee";
  excludeProviders?: string[];
}

@Injectable()
export class LiquidityProviderService {
  private readonly logger = new Logger(LiquidityProviderService.name);

  constructor(private readonly providerRegistry: ProviderRegistryService) {}

  async getproviderQuotes(
    request: {
      amount: string;
      asset: {
        to: string;
        from: {
          asset: string;
          chain: string;
        };
      };
    },
    options?: OrchestrationOptions,
  ) {
    const availableProviders = this.providerRegistry.getProvidersForAsset(
      (request.asset.from.chain +
        "." +
        request.asset.from.asset) as CryptoAsset,
    );

    if (availableProviders.length === 0) {
      throw new BadRequestException(
        `No providers support asset: ${request.asset.from} or ${request.asset.to}`,
      );
    }

    // Filter out excluded providers
    const eligibleProviders =
      options && options.excludeProviders
        ? availableProviders.filter(
            // @ts-ignore
            (p) => !options.excludeProviders.includes(p.getProviderId()),
          )
        : availableProviders;

    // Get quotes from all eligible providers
    const quotePromises = await Promise.all(
      eligibleProviders.map(async (provider) => {
        try {
          return await provider.getProviderQuotes(request.amount, {
            to: request.asset.to,
            from: request.asset.from.asset,
          });
        } catch (error) {
          this.logger.error(
            `Failed to get quote from ${provider.getProviderId()}: ${error.message}`,
          );
          return null;
        }
      }),
    );

    const quotes = quotePromises.filter((q) => q !== null) as ProviderQuote[];

    // Sort quotes based on preference
    return this.sortQuotes(quotes, options?.sortBy || "bestRate");
  }

  supportAsset(asset: string) {
    const availableProviders = this.providerRegistry.getProvidersForAsset(
      asset as any,
    );

    if (availableProviders.length === 0) return false;
    return true;
  }

  async processPayoutToCustomer(
    providerId: LiquidityProviderProcessorType,
    data: {
      userId: Types.ObjectId;
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
    // ProviderId was required here because the client is supposed to get the provider quotes to know the one to choose before requesting a payout
    const selectedProvider = this.providerRegistry.getProvider(providerId);

    const {
      userId,
      amount,
      accountName,
      accountNumber,
      country,
      bankCode,
      comment,
      reference,
    } = data;

    const response = await selectedProvider.payoutToCustomer(
      userId,
      {
        amount,
        accountName,
        accountNumber,
        country,
        comment,
        bankCode,
        reference,
      },
      userType,
    );

    return response;
  }

  async handlePayoutWebhook(
    providerId: LiquidityProviderProcessorType,
    event: any,
    transactionReference: string,
  ) {
    const selectedProvider = this.providerRegistry.getProvider(providerId);
    await selectedProvider.handlePayoutWebhookEvent(
      event,
      transactionReference,
    );
  }

  private sortQuotes(quotes: ProviderQuote[], sortBy: string): ProviderQuote[] {
    switch (sortBy) {
      case "bestRate":
        return quotes.sort((a, b) => b.fiatAmount - a.fiatAmount);
      case "lowestFee":
        return quotes.sort((a, b) => a.fees - b.fees);
      //   case 'fastestTime':
      //     // Simple heuristic based on processing time string
      //     return quotes.sort((a, b) => {
      //       const aTime = this.parseProcessingTime(a.processingTime);
      //       const bTime = this.parseProcessingTime(b.processingTime);
      //       return aTime - bTime;
      //     });
      default:
        return quotes.sort((a, b) => b.fiatAmount - a.fiatAmount);
    }
  }

  async payoutFiatToCustomer() {}
}
