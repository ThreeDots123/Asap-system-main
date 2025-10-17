import { Optional } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { Expose, Transform, Type } from "class-transformer";
import {
  IsNotEmpty,
  IsString,
  Matches,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { CountryCode } from "libphonenumber-js";
import IsCountryCode from "src/validators/country-code.validator";
import OnlyOneField from "src/validators/only-one-field.validator";

class RecipientDto {
  @ValidateIf((o) => !o.phone) // Only required if no phone
  @IsString()
  @IsNotEmpty({ message: "Address cannot be empty if phone is not provided" })
  address?: string;

  @ValidateIf((o) => !o.address) // Only required if no address
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: "Phone number must be a valid phone number",
  })
  phone?: string;

  @ValidateIf((o) => o.phone) // Only required if phone is provided
  @Expose()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim().toUpperCase())
  @IsCountryCode({})
  @ApiProperty({
    description: "The corresponding country code of the inputed number",
    example: "NG",
  })
  country?: CountryCode;

  @(OnlyOneField("phone", "address", {})())
  exlusiveCheck!: string;
}

export class TransferAssetDto {
  @Expose()
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: "Amount must be a numeric string",
  })
  @ApiProperty({
    description: "The amount you wish to send to the recipient.",
    example: "20",
  })
  amount: string;

  @Expose()
  @Optional()
  @ApiProperty({
    description: "A message to send alongside the transfer.",
    example: "A gift from me to you.",
  })
  comment?: string;

  @ValidateNested()
  @IsNotEmpty()
  @Type(() => RecipientDto)
  recipient: RecipientDto;
}
