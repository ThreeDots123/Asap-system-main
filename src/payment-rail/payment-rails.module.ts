import { Module } from "@nestjs/common";
import { PaymentRailService } from "./payment-rail.service";
import { TransactionModule } from "src/transaction/transaction.module";
import { AuthModule } from "src/auth/auth.module";
import { OfframpModule } from "src/offramp/offramp.module";
@Module({
  imports: [TransactionModule, OfframpModule],
  providers: [PaymentRailService],
  exports: [PaymentRailService],
})
export class PaymentRailModule {}
