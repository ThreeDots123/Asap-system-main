import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from "class-validator";
import { Expose, Transform } from "class-transformer";
import { CountryCode } from "libphonenumber-js";
import IsCountryCode from "src/validators/country-code.validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateUserAcctDto {
  @Expose()
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => value?.trim().toLowerCase())
  @ApiProperty({
    description: "Unique username for the user",
    example: "johndoe",
    minLength: 3,
  })
  username: string;

  @Expose()
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => value?.trim().replace(/\s/g, ""))
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: "Phone number must be a valid phone number",
  })
  @ApiProperty({
    description: "Phone number in intl format.",
    example: "+1234567890",
  })
  phone: string;

  @Expose()
  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => value?.trim().toLowerCase())
  @ApiProperty({
    description: "Email address of the user",
    example: "john.doe@example.com",
  })
  email: string;

  @Expose()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim().toUpperCase())
  @IsCountryCode({})
  @ApiProperty({
    description: "The corresponding country code of the inputed number",
    example: "NG",
  })
  country: CountryCode;

  @Expose()
  @IsNotEmpty()
  @IsString()
  @Length(6, 6, {
    message: "Password must be exactly 6 digits long.",
  })
  @Matches(/^\d{6}$/, {
    message: "Password must contain only numbers.",
  })
  @ApiProperty({
    description: "Your 6 digit password for your account.",
    example: "123456",
  })
  password: string;
}
