import { IsNotEmpty, IsString, Length, MinLength } from "class-validator";
import { Expose } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

export class CompleteAccountVerificationDto {
  @Expose()
  @IsNotEmpty()
  @IsString()
  @Length(6, 6, {
    message: "otp must be exactly 6 digits long.",
  })
  @ApiProperty({
    description: "The otp code required to complete your account verification",
    example: "443876",
  })
  verificationCode: string;
}
