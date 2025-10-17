export interface ApiResponse<T = any> {
  message: string;
  statusCode: number;
  data?: T;
}

export type WebhookType = "GRAPHQL" | "ADDRESS_ACTIVITY" | "NFT_ACTIVITY";

export interface WebhookEventPayload {
  webhookId: string;
  id: string;
  createdAt: string; // ISO timestamp
  type: "ADDRESS_ACTIVITY";
  event: AddressActivityEvent;
}

export interface AddressActivityEvent {
  network: string; // e.g., "ETH_MAINNET"
  activity: AddressActivity[];
}

export interface AddressActivity {
  blockNum: string; // e.g., "0xdf34a3"
  hash: string;
  fromAddress: string;
  toAddress: string;
  value: number;
  erc721TokenId: string | null;
  erc1155Metadata: any | null;
  asset: string; // e.g., "USDC"
  category: "token" | "native" | "erc721" | "erc1155" | string;
  rawContract: RawContract;
  typeTraceAddress: string | null;
  log: BlockchainLog;
}

export interface RawContract {
  rawValue: string;
  address: string;
  decimals: number;
}

export interface BlockchainLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  transactionIndex: string;
  blockHash: string;
  logIndex: string;
  removed: boolean;
}
