import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsNumber, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

class RateDto {
  @ApiProperty({ example: 1615 })
  @IsNumber()
  @IsNotEmpty()
  buy: number;

  @ApiProperty({ example: 1580 })
  @IsNumber()
  @IsNotEmpty()
  sell: number;
}

class RatesWrapperDto {
  @ApiProperty({ type: RateDto, description: "USDC rate" })
  @ValidateNested()
  @Type(() => RateDto)
  USDC: RateDto;

  @ApiProperty({ type: RateDto, description: "USDT rate" })
  @ValidateNested()
  @Type(() => RateDto)
  USDT: RateDto;

  @ApiProperty({ type: RateDto, description: "PYUSD rate" })
  @ValidateNested()
  @Type(() => RateDto)
  PYUSD: RateDto;

  @ApiProperty({ type: RateDto, description: "NGN rate" })
  @ValidateNested()
  @Type(() => RateDto)
  NGN: RateDto;
}

export class CreateExchangeRateDto {
  @ApiProperty({ example: "USD" })
  @IsNotEmpty()
  baseCurrency: string;

  @ApiProperty({ example: "binance" })
  @IsNotEmpty()
  provider: string;

  @ApiProperty({ type: RatesWrapperDto })
  @ValidateNested()
  @Type(() => RatesWrapperDto)
  rates: RatesWrapperDto;
}
