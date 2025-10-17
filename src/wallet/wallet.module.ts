import { forwardRef, Module } from "@nestjs/common";
import { WalletService } from "./wallet.service";
import { MongooseModule } from "@nestjs/mongoose";
import UserWalletSchena, {
  UserWallet,
} from "src/models/wallet/user-wallet.entity";
import MerchantWalletSchema, {
  MerchantWallet,
} from "src/models/wallet/merchant-wallet.entity";
import { WalletController } from "./wallet.controller";
import { TokenModule } from "src/token/token.module";
import { UserModule } from "src/user/user.module";
import { WalletCustodialModule } from "src/wallet-custodial/wallet-custodial.module";
import ChainAssetDetailsSchema, {
  ChainAssetDetails,
} from "src/models/wallet/chain-asset-details.entity";
import { TransactionModule } from "src/transaction/transaction.module";
import {
  ExternalWallet,
  ExternalWalletSchema,
} from "src/models/wallet/external-wallet.entity";

@Module({
  imports: [
    UserModule,
    TokenModule,
    MongooseModule.forFeature([
      { name: UserWallet.name, schema: UserWalletSchena },
      { name: MerchantWallet.name, schema: MerchantWalletSchema },
      { name: ChainAssetDetails.name, schema: ChainAssetDetailsSchema },
      { name: ExternalWallet.name, schema: ExternalWalletSchema },
    ]),
    forwardRef(() => WalletCustodialModule),
    TransactionModule,
  ],
  providers: [WalletService],
  exports: [WalletService],
  controllers: [WalletController],
})
export class WalletModule {}
