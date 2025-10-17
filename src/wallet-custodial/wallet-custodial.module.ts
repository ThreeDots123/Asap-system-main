import { forwardRef, Module } from "@nestjs/common";
import { WalletCustodialService } from "./wallet-custodial.service";
import { WalletModule } from "src/wallet/wallet.module";
import WALLET_CUSTODIAL_PROCESSORS from "./processors";
import { EventModule } from "src/event/event.module";
import { UserModule } from "src/user/user.module";
import { TransactionModule } from "src/transaction/transaction.module";
import { LedgerModule } from "src/ledger/ledger.module";

@Module({
  imports: [
    forwardRef(() => WalletModule),
    EventModule,
    UserModule,
    TransactionModule,
    LedgerModule,
  ],
  providers: [WalletCustodialService, ...WALLET_CUSTODIAL_PROCESSORS],
  exports: [WalletCustodialService, ...WALLET_CUSTODIAL_PROCESSORS],
})
export class WalletCustodialModule {}
