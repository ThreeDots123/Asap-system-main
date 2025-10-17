import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { IsOptional, IsString, ValidateNested } from "class-validator";

class SettlementDto {
  @ApiProperty({ required: false, example: "John doe Emmanuel" })
  @IsOptional()
  @IsString()
  @Expose()
  accountName?: string;

  @ApiProperty({ required: false, example: "11111111111" })
  @IsOptional()
  @IsString()
  @Expose()
  accountNumber?: string;

  @ApiProperty({ required: false, example: "Firstbank" })
  @IsOptional()
  @IsString()
  @Expose()
  bank?: string;
}

export class UpdateMerchantDto {
  @ApiProperty({
    required: false,
    type: () => SettlementDto,
    description: "The settlement account details of the merchant",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SettlementDto)
  @Expose()
  settlementAccount?: SettlementDto;
}
