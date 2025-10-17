import { IsIn, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

export class PaymentSessionHeaderDto {
  @ApiProperty({
    description: "The payment session for proceeding with a payment.",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  @IsNotEmpty({ message: "x-payment-session header is required" })
  @Expose({ name: "x-payment-session" }) // ensures mapping from headers
  "x-payment-session": string;
}
