import { CountryCode } from "libphonenumber-js";
import { Types } from "mongoose";
import {
  AvailableWalletChains,
  UserType,
} from "src/common/types/wallet-custody";

export interface CreateWalletChainParams {
  chain: AvailableWalletChains;
  metadata: { userId: Types.ObjectId; phone?: string; business?: string };
  userType: UserType;
}

export interface RetrieveWalletChainAssetsParams {
  chain: AvailableWalletChains;
  userId: Types.ObjectId;
  userType: UserType;
}

export interface TransferAssetParams {
  recipient:
    | {
        type: "phone";
        phone: string;
        countryCode: CountryCode;
      }
    | {
        type: "address";
        address: "platform" | string;
      };
  amount: string;
  comment?: string;
  chain: AvailableWalletChains;
  assetName: string;
  userId: Types.ObjectId;
  offrampTxnId?: Types.ObjectId;
}

export interface AssetDeposit {
  recipientAddr: string;
  fromAddr: string;
  transactionHash: string;
  amount: string;
  chain: AvailableWalletChains;
  asset: string;
  reference: string;
  blockNo: string;
}
