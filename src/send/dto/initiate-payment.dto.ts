import { ApiProperty } from "@nestjs/swagger";
import { Expose, Transform, Type } from "class-transformer";
import { IsEnum, IsNotEmpty, IsString, ValidateNested } from "class-validator";
import { CountryCode } from "libphonenumber-js";
import { AvailableWalletChains } from "src/common/types/wallet-custody";
import { CurrencyCode } from "src/liquidity-provider/providers/yellow-card/types";
import { PaymentOrigin } from "src/models/offramp-transaction";
import IsCountryCode from "src/validators/country-code.validator";

class BankDetailsDto {
  @ApiProperty({ example: "044", description: "Bank code (e.g., Access Bank)" })
  @Expose()
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: "John Doe", description: "Account owner full name" })
  @Expose()
  @IsString()
  @IsNotEmpty()
  ownerName: string;

  @ApiProperty({ example: "1234567890", description: "Bank account number" })
  @Expose()
  @IsString()
  @IsNotEmpty()
  acctNumber: string;
}

class CoinDetailsDto {
  // @ApiProperty({ example: "0.05", description: "Amount of the coin to sell" })
  // @Expose()
  // @IsString()
  // @IsNotEmpty()
  // amount: string;

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

export class OfframpDetailsDto {
  @Expose()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim().toUpperCase())
  @IsCountryCode({})
  @ApiProperty({
    description: "The corresponding country code of the inputed number",
    example: "NG",
  })
  country: CountryCode;

  @ApiProperty({
    enum: ["internal", "external"],
    example: "internal",
    description: "Wallet type used",
  })
  @Expose()
  @IsEnum(["internal", "external"], {
    message: 'walletUsed must be either "internal" or "external"',
  })
  walletUsed: "internal" | "external";

  @ApiProperty({
    enum: PaymentOrigin,
    example: PaymentOrigin.INTERNAL,
    description: "Transaction origin",
  })
  @Expose()
  @IsEnum(PaymentOrigin)
  origin: PaymentOrigin;

  @ApiProperty({ example: "NGN", description: "Fiat currency to be paid out" })
  @Expose()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim().toLowerCase())
  currency: CurrencyCode;

  @ApiProperty({ example: "2000", description: "Amount of fiat to be sent." })
  @Expose()
  @IsString()
  @IsNotEmpty()
  amount: string;

  @ApiProperty({
    type: () => BankDetailsDto,
    description: "Bank account details for payout",
  })
  @Expose()
  @ValidateNested()
  @Type(() => BankDetailsDto)
  bank: BankDetailsDto;

  @ApiProperty({
    type: () => CoinDetailsDto,
    description: "Coin details for off-ramp",
  })
  @Expose()
  @ValidateNested()
  @IsNotEmpty()
  @Type(() => CoinDetailsDto)
  coin: CoinDetailsDto;
}
