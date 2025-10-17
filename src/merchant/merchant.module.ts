import { Module } from "@nestjs/common";
import { MerchantController } from "./merchant.controller";
import { MerchantService } from "./merchant.service";
import { MongooseModule } from "@nestjs/mongoose";
import MerchantSchema, { Merchant } from "src/models/merchant.entity";
import { MerchantPosModule } from "src/merchant-pos/merchant-pos.module";
import { TokenModule } from "src/token/token.module";

@Module({
  imports: [
    MerchantPosModule,
    TokenModule,
    MongooseModule.forFeature([
      { name: Merchant.name, schema: MerchantSchema },
    ]),
  ],
  controllers: [MerchantController],
  providers: [MerchantService],
  exports: [MerchantService],
})
export class MerchantModule {}
