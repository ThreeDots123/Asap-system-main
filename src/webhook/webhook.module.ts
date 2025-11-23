import { Module } from "@nestjs/common";
import { WebhookController } from "./webhook.controller";
import { LiquidityProviderModule } from "src/liquidity-provider/liquidity-provider.module";
import { WalletCustodialModule } from "src/wallet-custodial/wallet-custodial.module";
import { AddressMonitoringModule } from "src/address-monitoring/address-monitoring.module";
import { WaBotModule } from "src/wa-bot/wa-bot.module";

@Module({
  imports: [
    LiquidityProviderModule,
    WalletCustodialModule,
    AddressMonitoringModule,
    WaBotModule,
  ],
  controllers: [WebhookController],
})
export class WebhookModule {}
