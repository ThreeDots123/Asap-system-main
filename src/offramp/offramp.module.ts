import { Module } from "@nestjs/common";
import { OfframpService } from "./offramp.service";
import { WalletCustodialModule } from "src/wallet-custodial/wallet-custodial.module";
import { EventModule } from "src/event/event.module";

@Module({
  imports: [WalletCustodialModule, EventModule],
  providers: [OfframpService],
  exports: [OfframpService],
})
export class OfframpModule {}
