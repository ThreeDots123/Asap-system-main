import { Module } from "@nestjs/common";
import { EventService } from "./event.service";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { SmsModule } from "src/sms/sms.module";
import { GatewayModule } from "src/gateway/gateway.module";
import { subscribers } from "./subscribers";
import { LiquidityProviderModule } from "src/liquidity-provider/liquidity-provider.module";
import { EmailModule } from "src/email/email.module";

@Module({
  imports: [
    EventEmitterModule.forRoot({
      // Event emitter options (optional)
      wildcard: false,
      delimiter: ".",
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),
    SmsModule,
    GatewayModule,
    LiquidityProviderModule,
    EmailModule,
  ],
  providers: [EventService, ...subscribers],
  exports: [EventEmitterModule, EventService],
})
export class EventModule {}
