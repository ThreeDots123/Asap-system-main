import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from "class-validator";
import { Expose, Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

export class SignInUserToAccountDto {
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

  @Expose()
  @IsOptional()
  @IsString()
  @ApiProperty({
    description: "The refresh token identification.",
    example: "68d7fcad75172ab86c656bec",
  })
  refreshTokenId?: string;
}
