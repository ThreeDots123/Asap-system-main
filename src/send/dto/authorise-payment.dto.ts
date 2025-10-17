import { ApiProperty } from "@nestjs/swagger";
import { Expose, Transform } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class AuthorisePaymentDto {
  @Expose()
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: "4 digit transaction pin of the user.",
    example: "1234",
  })
  pin: string;
}
