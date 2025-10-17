import { forwardRef, Module } from "@nestjs/common";
import { AddressMonitoringService } from "./address-monitoring.service";
import ADDRESSES_MONITORING_PROCESSORS from "./processors";
import { WalletModule } from "src/wallet/wallet.module";
import { UtilsModule } from "src/utils/utils.module";
import { TransactionModule } from "src/transaction/transaction.module";
import { MerchantModule } from "src/merchant/merchant.module";
import { PaymentModule } from "src/payment/payment.module";

@Module({
  imports: [
    WalletModule,
    UtilsModule,
    TransactionModule,
    forwardRef(() => MerchantModule),
    PaymentModule,
  ],
  providers: [AddressMonitoringService, ...ADDRESSES_MONITORING_PROCESSORS],
  exports: [AddressMonitoringService, ...ADDRESSES_MONITORING_PROCESSORS],
})
export class AddressMonitoringModule {}
