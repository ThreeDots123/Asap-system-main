import { MerchantAccountSubscriber } from "./account/merchant.subscriber";
import { UserAccountSubscriber } from "./account/user.subscriber";
import { OfframpTransactionSubscriber } from "./offramp/transaction.subscriber";
import { AssetBalanceChangeSubscriber } from "./wallet-chain/asset/balance.subscriber";

export const subscribers = [
  UserAccountSubscriber,
  MerchantAccountSubscriber,
  AssetBalanceChangeSubscriber,
  OfframpTransactionSubscriber,
];
