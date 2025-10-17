import {
  avalanche,
  base,
  eth,
} from "src/interface/wallet-custody/available-wallet-chains";
import { ChainAssetDocument } from "src/models/wallet/chain-asset-details.entity";
import { Types } from "mongoose";
import {
  TransactionStatus,
  TransactionType,
} from "src/models/wallet/transaction.entity";

// REMEMBER TO ADD IT TO THE SUPPORTED WALLET CHAIN OF THE CUSTODIAL PROCESSORS THAT SUPPORTS IT.
export enum AvailableWalletChains {
  BASE = base,
  ERC20 = eth,
  AVALANCHE = avalanche,
}

export interface WalletCustodialProcessor {
  type: ProcessorType;
  getSupportedWalletChains(): Array<{
    chain: AvailableWalletChains;
    config: WalletConfig;
  }>;
}

export type UserType = "regular" | "merchant";

export type WalletConfig =
  | BlockRadarCustodialConfig
  | { yes: string; no: string };

// Different Configuration requirements for wallet configs based on the custodial platform (For now we use only blockradar)

export interface BlockRadarCustodialConfig {
  chainId: string;
  secretKey: string;
}

export interface CreatedChainResponse {
  address: string;
  chain: string; // as written out by the platform
  custodialId?: string;
  processedBy: ProcessorType;
}

export interface RetrieveAssetResponse {
  name: string;
  balance: string;
  convertedBalance: string;
  processedBy: ProcessorType;
  logo: string;
  symbol: string;
  custodialId?: string;
}

export interface AssetWithdrawalTransaction {
  fromAddr: string;
  toAddr: string;
  masterWltAddr: string;
  txnHash: string;
  blockNo: string;
  amount: string;
  chain: string;
  asset: string;
  status?: TransactionStatus;
  type: TransactionType;
  processedBy: ProcessorType;
  custodialTxnId: string;
  userId?: Types.ObjectId;
}

// The different processors we support
export enum ProcessorType {
  BLOCKRADAR = "BlockradarProcessor",
  NONE = "No-Processor", // For cases where no processor has been assigned yet
}

export type AssetWithdrawalResponse =
  | {
      success: true;
      message: string;
      transaction: AssetWithdrawalTransaction;
    }
  | {
      success: false;
      error: string;
    };

export interface CryptoWithdrawalParams {
  amount: string;
  recipientAddr: string;
  asset: ChainAssetDocument;
  metadata?: Record<string, string>;
  reference: string;
}

export type AssetWithdrawalWebhookEvent =
  | {
      updateStatus: true;
      status: TransactionStatus;
      fromAddress: string;
    }
  | { updateStatus: false };
