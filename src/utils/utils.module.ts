import { Module } from "@nestjs/common";
import injectables from "./injectables";
import { WalletModule } from "src/wallet/wallet.module";

@Module({
  imports: [WalletModule],
  providers: [...injectables],
  exports: [...injectables],
})
export class UtilsModule {}
