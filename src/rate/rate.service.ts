import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { ExchangeRate, ExchangeRateDocument } from "src/models/rate.entity";
import { CreateExchangeRateDto } from "./dto/adding-rate.dto";

@Injectable()
export class RateService {
  constructor(
    @InjectModel(ExchangeRate.name)
    private rateModel: Model<ExchangeRate>,
  ) {}

  async getCurrentRates(): Promise<ExchangeRateDocument> {
    const rate = await this.rateModel.findOne().sort({ createdAt: -1 });
    if (!rate)
      throw new InternalServerErrorException(
        "Cannot find any rates for transaction processing",
      );

    return rate;
  } // Get the current rates we are buying and selling at

  async convertAssets(amount: string, asset: { from: string; to: string }) {
    const rate = await this.getCurrentRates();
    const fromAsset = rate.rates.get(asset.from.toLowerCase());
    const toAsset = rate.rates.get(asset.to.toLowerCase());

    if (!fromAsset || !toAsset)
      throw new BadRequestException(
        `Cannot find rates for the  asset ${fromAsset ? asset.to : asset.from}`,
      );

    // Get fiat amount from conversion...
    const result = Number(amount) / fromAsset.sell / toAsset.buy;
    const decimalLen = String(result).split(".")[1].length;

    let formattedResult = String(result);

    if (asset.to === "usdc") {
      if (decimalLen > 6) formattedResult = result.toFixed(6);
    } else {
      if (decimalLen > 18) formattedResult = result.toFixed(18);
    }

    return formattedResult;
  }

  async changeRates(dto: CreateExchangeRateDto, adminId: Types.ObjectId) {
    const plainRates = {
      usdc: { buy: dto.rates.USDC.buy, sell: dto.rates.USDC.sell },
      usdt: { buy: dto.rates.USDT.buy, sell: dto.rates.USDT.sell },
      pyusd: { buy: dto.rates.PYUSD.buy, sell: dto.rates.PYUSD.sell },
      ngn: { buy: dto.rates.NGN.buy, sell: dto.rates.NGN.sell },
    };

    const { baseCurrency, provider } = dto;

    const newRate = new this.rateModel({
      baseCurrency,
      provider,
      rates: plainRates,
      setBy: adminId,
    });
    return newRate.save();
  }
}
