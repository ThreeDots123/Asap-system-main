import { forwardRef, Module } from "@nestjs/common";
import { PaymentService } from "./payment.service";
import { OfframpModule } from "src/offramp/offramp.module";
import { RateModule } from "src/rate/rate.module";
import { TransactionModule } from "src/transaction/transaction.module";
import { AuthModule } from "src/auth/auth.module";
import { LiquidityProviderModule } from "src/liquidity-provider/liquidity-provider.module";
import { PaymentRailModule } from "src/payment-rail/payment-rails.module";
import { WalletCustodialModule } from "src/wallet-custodial/wallet-custodial.module";
import { PaymentController } from "./payment.controller";
import { TokenModule } from "src/token/token.module";
import { UserModule } from "src/user/user.module";

@Module({
  imports: [
    OfframpModule,
    RateModule,
    TransactionModule,
    forwardRef(() => AuthModule),
    LiquidityProviderModule,
    PaymentRailModule,
    WalletCustodialModule,
    TokenModule,
    UserModule,
  ],
  providers: [PaymentService],
  controllers: [PaymentController],
  exports: [PaymentService],
})
export class PaymentModule {}
