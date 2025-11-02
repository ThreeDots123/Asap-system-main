import { IsNotEmpty, IsString, Length } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ValidateBankDto {
  @ApiProperty({
    example: "058",
    description: "Bank code (e.g., GTBank = 058)",
  })
  @IsString()
  @IsNotEmpty()
  bank_code: string;

  @ApiProperty({
    example: "0123456789",
    description: "10-digit NUBAN account number",
  })
  @IsString()
  @Length(10, 10, { message: "Account number must be exactly 10 digits" })
  account_number: string;
}
