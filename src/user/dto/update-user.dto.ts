import { ApiProperty, PartialType } from "@nestjs/swagger";
import { Type, Expose } from "class-transformer";
import {
  IsOptional,
  IsString,
  MaxLength,
  IsDateString,
  ValidateNested,
} from "class-validator";

class AddressDto {
  @ApiProperty({ required: false, example: "123 Main St" })
  @IsOptional()
  @IsString()
  @Expose()
  street?: string;

  @ApiProperty({ required: false, example: "Lagos" })
  @IsOptional()
  @IsString()
  @Expose()
  city?: string;

  @ApiProperty({ required: false, example: "Lagos State" })
  @IsOptional()
  @IsString()
  @Expose()
  state?: string;

  @ApiProperty({ required: false, example: "Nigeria" })
  @IsOptional()
  @IsString()
  @Expose()
  country?: string;

  @ApiProperty({ required: false, example: "100001" })
  @IsOptional()
  @IsString()
  @Expose()
  zipCode?: string;
}

class ProfileDto {
  @ApiProperty({ required: false, example: "John" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Expose()
  firstName?: string;

  @ApiProperty({ required: false, example: "Doe" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Expose()
  lastName?: string;

  @ApiProperty({ required: false, example: "https://example.com/avatar.png" })
  @IsOptional()
  @IsString()
  @Expose()
  avatar?: string;

  @ApiProperty({ required: false, example: "1995-05-20" })
  @IsOptional()
  @IsDateString()
  @Expose()
  dateOfBirth?: string;

  @ApiProperty({ required: false, type: () => AddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  @Expose()
  address?: AddressDto;
}

export class UpdateUserDto {
  @ApiProperty({
    required: false,
    example: "john_doe",
    description: "Unique username for the user",
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Expose()
  username?: string;

  @ApiProperty({
    required: false,
    type: () => ProfileDto,
    description: "User profile details",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProfileDto)
  @Expose()
  profile?: ProfileDto;
}
