import { IsNotEmpty, IsString, Length } from "class-validator";
import { Expose } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

export class SetTransactionPin {
  @Expose()
  @IsNotEmpty()
  @IsString()
  @Length(4, 4, {
    message: "Pin must be 4 digits long.",
  })
  @ApiProperty({
    description: "The pin to be used for transactions",
    example: "1234",
  })
  pin: string;
}
