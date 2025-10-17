// src/merchant/dto/auth.dto.ts
import { Transform } from "class-transformer";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class RegisterMerchantDto {
  @IsEmail()
  @Transform(({ value }) => value?.trim().toLowerCase())
  email: string;

  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => value?.trim().toLowerCase())
  businessName: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  contactNumber?: string;
  websiteUrl?: string;
}

export class LoginMerchantDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}
