import { CountryCode } from "libphonenumber-js";
import { Types } from "mongoose";
import { AvailableWalletChains } from "src/common/types/wallet-custody";
import { MerchantTransactionDocument } from "src/models/merchant-transaction.entitiy";
import { PaymentOrigin } from "src/models/offramp-transaction";

export interface PaymentTxnParams {
  bankDetails: {
    code: string; // refers to the bankCode
    number: string;
    ownerName: string;
  };
  coinToReceive: {
    assetChain: AvailableWalletChains;
    asset: string;
    // amount: string;
  };
  amountToSend: {
    amount: string;
    currency: string;
  };
}

export type InitiateMerchantPMTParams =
  | {
      newTransaction: "true";
      type: "merchant" | "external";
      origin: PaymentOrigin;
      walletUsed: "internal" | "external";
      countryCode: CountryCode;
      bankDetails: {
        code: string; // refers to the bankCode
        number: string;
        ownerName: string;
      };
      coinToReceive: {
        assetChain: AvailableWalletChains;
        asset: string;
        // amount: string;
      };
      amountToSend: {
        amount: string;
        currency: string;
      };
    }
  | {
      newTransaction: "false";
      type: "merchant" | "external";
      origin: PaymentOrigin;
      walletUsed: "internal" | "external";
      countryCode: CountryCode;
      rateId: Types.ObjectId;
      merchantTransaction: MerchantTransactionDocument;
      bankDetails: {
        code: string; // refers to the bankCode
        number: string;
        ownerName: string;
      };
      coinToReceive: {
        assetChain: AvailableWalletChains;
        asset: string;
        amount: string;
      };
      amountToSend: {
        amount: string;
        currency: string;
      };
    };
