import { forwardRef, Module } from "@nestjs/common";
import { MerchantPosService } from "./merchant-pos.service";
import { PaymentModule } from "src/payment/payment.module";
import { TransactionModule } from "src/transaction/transaction.module";
import { UtilsModule } from "src/utils/utils.module";
import { RateModule } from "src/rate/rate.module";
import { AddressMonitoringModule } from "src/address-monitoring/address-monitoring.module";

@Module({
  imports: [
    PaymentModule,
    TransactionModule,
    UtilsModule,
    RateModule,
    forwardRef(() => AddressMonitoringModule),
  ],
  providers: [MerchantPosService],
  exports: [MerchantPosService],
})
export class MerchantPosModule {}
