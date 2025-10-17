export interface ApiResponse<T = any> {
  data: T;
}

export type ChannelStatus = "active" | "inactive";
export type ChannelType = "momo" | "eft" | "bank" | "p2p" | "spenn";
export type RampType = "deposit" | "withdraw";
export type SettlementType = "instant" | "manual";
export type ApiStatus = "active" | "inactive";
export type WidgetStatus = "active";

export interface SubmitedPayment {
  channelId: string;
  sequenceId: string;
  reason: string;
  sender: {
    name: string;
    phone: string;
    email: string;
    country: string;
    address: string;
    dob: string;
    idNumber: string;
    idType: string;
    additionalIdType: string;
    additionalIdNumber: string;
  };
  destination: {
    accountNumber: string;
    accountType: string;
    accountName: string;
    networkId: string;
    networkName: string;
  };
  forceAccept: boolean;
  customerUID: string;
  partnerId: string;
  requestSource: string;
  id: string;
  attempt: number;
  status: string;
  currency: string;
  country: string;
  amount: number;
  convertedAmount: number;
  rate: number;
  expiresAt: string;
  settlementInfo: Record<string, any>;
  tier0Active: boolean;
  createdAt: string;
  updatedAt: string;
  directSettlement: boolean;
}

export type CurrencyCode =
  | "USDT"
  | "BTC"
  | "ADA"
  | "XAF"
  | "LSL"
  | "USDC"
  | "MWK"
  | "ZAR"
  | "CDF"
  | "TZS"
  | "KES"
  | "RWF"
  | "TRX"
  | "NGN"
  | "ETH"
  | "XAUT"
  | "UGX"
  | "BWP"
  | "GHS"
  | "SOL"
  | "XRP"
  | "ZMW"
  | "XOF";

// Common locales that appear in the data
export type RateLocale =
  | "crypto"
  | "CM"
  | "LS"
  | "MW"
  | "ZA"
  | "CD"
  | "TZ"
  | "KE"
  | "RW"
  | "NG"
  | "UG"
  | "Bw"
  | "GH"
  | "ZM"
  | "CI";

// Stricter rate interface using union types
export interface Rate {
  buy: number;
  sell: number;
  locale: RateLocale;
  rateId: string;
  code: CurrencyCode;
  updatedAt: string;
}

export interface RatesResponse {
  rates: Rate[];
}

export interface Channel {
  id: string;
  max: number;
  currency: string;
  countryCurrency: string;
  status: ChannelStatus;
  feeLocal: number;
  createdAt: string;
  vendorId: string;
  country: string;
  feeUSD: number;
  min: number;
  channelType: ChannelType;
  rampType: RampType;
  updatedAt: string;
  apiStatus: ApiStatus;
  settlementType: SettlementType;
  estimatedSettlementTime: number;
  successThreshold?: number;
  widgetStatus?: WidgetStatus;
  widgetMin?: number;
  widgetMax?: number;
}

export interface ChannelsResponse {
  channels: Channel[];
}

type NetworkCode = string | Record<string, string>;
type AccountNumberType = "phone" | "bank";
type NetworkStatus = "active" | "inactive";
type CountryCode = "CI" | "KE" | "ZA" | "CD" | "ZM" | "MW" | "GH" | "NG" | "TZ";
type CountryAccountNumberType =
  | "CIPHONE"
  | "KEBANK"
  | "ZABANK"
  | "CDBANK"
  | "ZMPHONE"
  | "MWPHONE"
  | "GHBANK"
  | "NGBANK"
  | "TZPHONE";

// Main Network interface
interface Network {
  id: string;
  name: string;
  code: NetworkCode;
  status: NetworkStatus;
  country: CountryCode;
  accountNumberType: AccountNumberType;
  countryAccountNumberType: CountryAccountNumberType;
  channelIds: string[];
  createdAt?: string; // ISO date string
  updatedAt?: string; // ISO date string
  tempDisabledFor?: string[]; // Array of IDs or reasons
  featureFlagEnabled?: string[]; // Array of feature flag IDss
}

export interface NetworksResponse {
  networks: Network[];
}

export enum PayoutEvents {
  created = "PAYMENT.CREATED",
  pendingApproval = "PAYMENT.PENDING_APPROVAL",
  pending = "PAYMENT.PENDING",
  complete = "PAYMENT.COMPLETE",
  failed = "PAYMENT.FAILED",
}

export interface SubmittedPayoutEvent {
  id: string;
  sequenceId: string;
  status: string;
  apiKey: string;
  settlementInfo: Record<string, any>;
  event: PayoutEvents;
  executedAt: number;
}
