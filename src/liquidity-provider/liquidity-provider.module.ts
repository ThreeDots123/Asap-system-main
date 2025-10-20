import { Module } from "@nestjs/common";
import { LiquidityProviderService } from "./liquidity-provider.service";
import LIQUIDITY_PROVIDER_PROCESSORS from ".";
import { ProviderRegistryService } from "./registry.service";
import { TransactionModule } from "src/transaction/transaction.module";
import { GatewayModule } from "src/gateway/gateway.module";

@Module({
  imports: [TransactionModule, GatewayModule],
  providers: [
    LiquidityProviderService,
    ProviderRegistryService,
    ...LIQUIDITY_PROVIDER_PROCESSORS,
  ],
  exports: [
    LiquidityProviderService,
    ProviderRegistryService,
    ...LIQUIDITY_PROVIDER_PROCESSORS,
  ],
})
export class LiquidityProviderModule {}
