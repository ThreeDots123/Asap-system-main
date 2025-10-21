import { IsNotEmpty, IsString } from "class-validator";

export class FiatConversionDto {
  @IsNotEmpty()
  @IsString()
  coinAsset: string;

  @IsString()
  @IsNotEmpty()
  fiatCurrency: string;

  @IsString()
  @IsNotEmpty()
  amount: string;
}
