import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CreateExchangeRateDto } from "./dto/adding-rate.dto";
import { Request } from "express";
import { RateService } from "./rate.service";
import { Types } from "mongoose";
import { FiatConversionDto } from "./dto/fiat-conversion.dto";

@Controller("rate")
@ApiTags("exchange-rates")
@ApiBearerAuth()
export class RateController {
  constructor(private readonly exchangeRateService: RateService) {}

  //   @UseGuards() // Admin Auth Guard
  @Post()
  async addExchangeRate(
    @Body() dto: CreateExchangeRateDto,
    @Req() request: Request,
  ) {
    // const { _id } = request.user as UserDocument; // assuming JWT payload has { sub: adminId }
    return this.exchangeRateService.changeRates(
      dto,
      123456 as unknown as Types.ObjectId,
    );
  }

  @Get("current")
  async getCurrentRate() {
    const { baseCurrency, rates } =
      await this.exchangeRateService.getCurrentRates();
    return {
      baseCurrency,
      rates,
    };
  }

  @Post("convert")
  async getCoinConversion(@Body() _body: FiatConversionDto) {
    const { amount, fiatCurrency, coinAsset } = _body;

    return this.exchangeRateService.convertAssets(amount, {
      from: fiatCurrency,
      to: coinAsset,
    });
  }
}
