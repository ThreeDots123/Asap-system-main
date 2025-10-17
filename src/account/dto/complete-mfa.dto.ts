import { IsNotEmpty, IsString } from "class-validator";
import { Expose } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

export class VerifyMFADto {
  @Expose()
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: "The mfa code gotten from your authenticator.",
    example: "876098",
  })
  code: string;
}
