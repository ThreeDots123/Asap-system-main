import { CountryCode } from "libphonenumber-js";
import { Types } from "mongoose";
import { ChannelStatus } from "src/liquidity-provider/providers/yellow-card/types";
import { PaymentTransactionStatus } from "src/models/offramp-transaction";

// The different processors we support
export enum LiquidityProviderProcessorType {
  YC = "Yellow-card",
  NONE = "No-Processor", // For cases where no processor has been assigned yet
}

export enum CryptoAsset {
  ETH_USDC = "ethereum.usdc",
  ETH_USDT = "ethereum.usdt",
  ETH_PYUSD = "ethereum.pyusd",
  POLYGON_USDT = "polygon.usdt",
  POLYGON_USDC = "polygon.usdc",
  SOLANA_USDC = "solana.usdc",
  SOLANA_USDT = "solana.usdt",
  BASE_USDC = "base.usdc",
  TRON_USDT = "tron.usdt",
}

export enum CryptoAssetCode {
  ETH_USDC = "usdc",
  ETH_USDT = "usdt",
  ETH_PYUSD = "pyusd",
  POLYGON_USDT = "usdt",
  POLYGON_USDC = "usdc",
  SOLANA_USDC = "usdc",
  SOLANA_USDT = "usdt",
  BASE_USDC = "usdc",
  TRON_USDT = "usdt",
}

export enum ApplicationSupportedAssets {
  USDC = "USDC",
  USDT = "USDT",
  PYUSD = "PYUSD",
}

export enum FiatCurrency {
  NGN = "NGN",
  GHC = "GHC",
}

export interface ProviderCapabilities {
  supportedAssets: CryptoAsset[];
  supportedFiatCurrencies: FiatCurrency[];
  minAmount: Record<FiatCurrency, number>;
  maxAmount: Record<FiatCurrency, number>;
  avgProcessingTime: string;
}

export interface ProviderQuote {
  processorType: LiquidityProviderProcessorType;
  exchangeRate: Array<{ buy: number; sell: number; code: string }>;
  fiatAmount: number;
  assetReturned: string;
  fees: number;
  expiresAt?: Date;
}

export type PayoutResult =
  | {
      success: true;
      result: {
        transactionId: string;
        status: PaymentTransactionStatus;
        processorType: LiquidityProviderProcessorType;
      };
    }
  | {
      success: false;
      error: string;
    };

export type PayoutWebhookEvent =
  | {
      updateStatus: true;
      status: PaymentTransactionStatus;
    }
  | { updateStatus: false };

export interface PayoutParams {
  amount: string;
  comment?: string;
  userId: Types.ObjectId; // Get Kyc and everything stored on the database inside the processor
  recipient: {
    accountNumber: string;
    accountName: string;
    country: CountryCode;
    bankCode: string;
  };
  transactionReference: string;
}
