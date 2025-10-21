import { Module } from "@nestjs/common";
import { MerchantSdkController } from "./merchant-sdk.controller";
import { MerchantModule } from "src/merchant/merchant.module";
import { MerchantSdkService } from "./merchant-sdk.service";
import { RateModule } from "src/rate/rate.module";
import { TransactionModule } from "src/transaction/transaction.module";
import { PaymentModule } from "src/payment/payment.module";
import { AddressMonitoringModule } from "src/address-monitoring/address-monitoring.module";
import { UtilsModule } from "src/utils/utils.module";

@Module({
  imports: [
    MerchantModule,
    RateModule,
    TransactionModule,
    PaymentModule,
    AddressMonitoringModule,
    UtilsModule,
  ],
  controllers: [MerchantSdkController],
  providers: [MerchantSdkService],
})
export class MerchantSdkModule {}
