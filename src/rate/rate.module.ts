import { Module } from "@nestjs/common";
import { RateService } from "./rate.service";
import { MongooseModule } from "@nestjs/mongoose";
import ExchangeRateSchema, { ExchangeRate } from "src/models/rate.entity";
import { RateController } from './rate.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExchangeRate.name, schema: ExchangeRateSchema },
    ]),
  ],
  providers: [RateService],
  exports: [RateService],
  controllers: [RateController],
})
export class RateModule {}
