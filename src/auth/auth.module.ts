import { forwardRef, Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { TokenModule } from "src/token/token.module";
import { MemoryStoreModule } from "src/memory-store/memory-store.module";
import { MongooseModule } from "@nestjs/mongoose";
import InitiatedMFASchema, {
  InitiatedMFA,
} from "src/models/initiated-secrets.entity";
import { EventModule } from "src/event/event.module";
import { UserModule } from "src/user/user.module";
import { SmsModule } from "src/sms/sms.module";
import { MerchantModule } from "src/merchant/merchant.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InitiatedMFA.name, schema: InitiatedMFASchema },
    ]),
    TokenModule,
    MemoryStoreModule,
    EventModule,
    UserModule,
    SmsModule,
    forwardRef(() => MerchantModule),
  ],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
