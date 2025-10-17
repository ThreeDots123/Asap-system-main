import { ApiProperty } from "@nestjs/swagger";
import { Expose, Transform } from "class-transformer";
import { IsNotEmpty, IsString } from "class-validator";
import { AvailableWalletChains } from "src/common/types/wallet-custody";
import IsAvailableChain from "src/validators/available-chain.validator";

export class AddNewChainDto {
  @Expose()
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsAvailableChain({})
  @ApiProperty({
    description: "The name of an available chain network.",
    example: "Avalanche",
  })
  chainName: AvailableWalletChains;
}
