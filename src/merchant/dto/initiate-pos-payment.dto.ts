import { ApiProperty } from "@nestjs/swagger";
import { Expose, Transform, Type } from "class-transformer";
import { IsEnum, IsNotEmpty, IsString, ValidateNested } from "class-validator";
import { AvailableWalletChains } from "src/common/types/wallet-custody";
import { CurrencyCode } from "src/liquidity-provider/providers/yellow-card/types";

class CoinDetailsDto {
  @ApiProperty({ example: "BTC", description: "Coin symbol" })
  @Expose()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim().toLowerCase())
  asset: string;

  @ApiProperty({
    enum: AvailableWalletChains,
    description: "Blockchain network used",
  })
  @Expose()
  @IsEnum(AvailableWalletChains)
  @Transform(({ value }) => value?.trim().toLowerCase())
  chain: AvailableWalletChains;
}

export class InitiatePaymentDto {
  @ApiProperty({ example: "2000", description: "Amount of fiat to be sent." })
  @Expose()
  @IsString()
  @IsNotEmpty()
  amount: string;

  @ApiProperty({ example: "NGN", description: "Fiat currency to be paid out" })
  @Expose()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim().toLowerCase())
  currency: CurrencyCode;

  @ApiProperty({
    type: () => CoinDetailsDto,
    description: "Coin details for POS Payment",
  })
  @Expose()
  @ValidateNested()
  @IsNotEmpty()
  @Type(() => CoinDetailsDto)
  coin: CoinDetailsDto;
}
