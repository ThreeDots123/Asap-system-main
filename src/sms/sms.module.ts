import { Module } from "@nestjs/common";
import { SmsService } from "./sms.service";
import SMS_PROCESSORS from "./processors";

@Module({
  providers: [SmsService, ...SMS_PROCESSORS],
  exports: [SmsService, ...SMS_PROCESSORS],
})
export class SmsModule {}
