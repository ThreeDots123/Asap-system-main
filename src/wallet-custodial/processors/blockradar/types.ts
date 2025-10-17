export interface ApiResponse<T = any> {
  message: string;
  statusCode: number;
  data: T;
}

export interface AddressResponse {
  address: string;
  name: string;
  type: string;
  derivationPath: string;
  metadata: {
    phone: string;
  };
  configurations: {
    aml: {
      provider: string;
      status: string;
      message: string;
    };
    showPrivateKey: boolean;
    disableAutoSweep: boolean;
    enableGaslessWithdraw: boolean;
  };
  network: string;
  blockchain: {
    id: string;
    name: string;
    symbol: string;
    slug: string;
    derivationPath: string;
    isEvmCompatible: boolean;
    isL2: boolean;
    isActive: boolean;
    tokenStandard: string | null;
    createdAt: string;
    updatedAt: string;
    logoUrl: string;
  };
  id: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Blockchain {
  id: string;
  name: string;
  symbol: string;
  slug: string;
  derivationPath: string;
  isEvmCompatible: boolean;
  isL2: boolean;
  logoUrl: string;
  isActive: boolean;
  tokenStandard: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Asset {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  address: string;
  standard: string | null;
  currency: string;
  isActive: boolean;
  logoUrl: string;
  network: string;
  isNative: boolean;
  createdAt: string;
  updatedAt: string;
  blockchain: Blockchain;
}

interface AssetWrapper {
  id: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  asset: Asset;
}

export interface AssetBalance {
  asset: AssetWrapper;
  balance: string;
  convertedBalance: string;
}

// Transaction status enum
export type TransactionStatus =
  | "PENDING"
  | "CONFIRMED"
  | "FAILED"
  | "CANCELLED";

// Transaction type enum
type TransactionType = "WITHDRAW" | "DEPOSIT" | "TRANSFER" | "SWAP";

// Network type
type Network = "mainnet" | "testnet";

interface Wallet {
  id: string;
}

// Currency type
type Currency = "USD" | "EUR" | "GBP" | "JPY" | string;

export interface TransactionData {
  amlScreening: any | null;
  amount: string;
  amountPaid: string;
  asset: Asset;
  assetSwept: any | null;
  assetSweptAmount: string | null;
  assetSweptAt: string | null;
  assetSweptGasFee: string | null;
  assetSweptHash: string | null;
  assetSweptRecipientAddress: string | null;
  assetSweptResponse: any | null;
  assetSweptSenderAddress: string | null;
  blockHash: string | null;
  blockNumber: number | null;
  blockchain: Blockchain;
  chainId: number | null;
  confirmations: number | null;
  confirmed: boolean;
  createdAt: string;
  currency: Currency;
  fee: string | null;
  feeMetadata: any | null;
  gasFee: string | null;
  gasPrice: string | null;
  gasUsed: string | null;
  hash: string;
  id: string;
  metadata: any | null;
  network: Network;
  note: string | null;
  reason: string | null;
  recipientAddress: string;
  senderAddress: string;
  status: TransactionStatus;
  tokenAddress: string | null;
  type: TransactionType;
  updatedAt: string;
  wallet: Wallet;
}

export interface AssetWithdrawalFee {
  nativeBalance: string;
  networkFee: string;
}

export interface BlockradarWebhookEvent {
  event:
    | "withdraw.success"
    | "withdraw.failed"
    | "deposit.success"
    | "deposit.failed";
  data: TransactionData & { reference: string };
}

export interface WithdrawalWebhookTransactionData {
  event: "withdraw.success" | "withdraw.failed";
  data: TransactionData;
}

export interface AssetRateData {
  Response?: "Error";
  Message?: string;
  data: Record<string, Record<string, number>>;
}
