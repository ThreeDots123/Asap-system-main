import { Module } from "@nestjs/common";
import { SendService } from "./send.service";
import { PaymentModule } from "src/payment/payment.module";
import { AuthModule } from "src/auth/auth.module";
import { TransactionModule } from "src/transaction/transaction.module";
import { SendController } from "./send.controller";
import { TokenModule } from "src/token/token.module";
import { UserModule } from "src/user/user.module";

@Module({
  imports: [
    PaymentModule,
    AuthModule,
    TransactionModule,
    TokenModule,
    UserModule,
  ],
  providers: [SendService],
  controllers: [SendController],
})
export class SendModule {}
