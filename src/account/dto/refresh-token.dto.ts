import { IsNotEmpty, IsOptional, IsString, Length } from "class-validator";
import { Expose } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

export class RefreshTokenDto {
  @Expose()
  @IsOptional()
  @IsString()
  @ApiProperty({
    description: "The refresh token",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....",
  })
  refreshToken?: string;

  @Expose()
  @IsOptional()
  @IsString()
  @ApiProperty({
    description: "The refresh token identification.",
    example: "68d7fcad75172ab86c656bec",
  })
  refreshTokenId?: string;
}
