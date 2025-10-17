import { ApiProperty } from "@nestjs/swagger";
import { Expose, Transform } from "class-transformer";
import { IsOptional, IsString } from "class-validator";

export class AuthoriseTransactionDto {
  @Expose()
  @IsString()
  @IsOptional()
  @ApiProperty({
    description: "4 digit transaction pin of the user.",
    example: "1234",
  })
  pin: string;
}
