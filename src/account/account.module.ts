import { Module } from "@nestjs/common";
import { AccountService } from "./account.service";
import { AccountController } from "./account.controller";
import { AuthModule } from "src/auth/auth.module";
import { UserModule } from "src/user/user.module";
import { TokenModule } from "src/token/token.module";
import { WalletCustodialModule } from "src/wallet-custodial/wallet-custodial.module";
import { MerchantModule } from "src/merchant/merchant.module";

@Module({
  imports: [
    AuthModule,
    UserModule,
    TokenModule,
    WalletCustodialModule,
    MerchantModule,
  ],
  providers: [AccountService],
  controllers: [AccountController],
})
export class AccountModule {}
