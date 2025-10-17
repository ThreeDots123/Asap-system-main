import { IsIn, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

export class ClientTypeHeaderDto {
  @ApiProperty({
    description: "The client making the request",
    enum: ["web", "mobile"],
    example: "web",
  })
  @IsNotEmpty({ message: "X-Client-Type header is required" })
  @IsIn(["web", "mobile"], {
    message: "x-client-type must be either web or mobile",
  })
  @Expose({ name: "x-client-type" }) // ensures mapping from headers
  "x-client-type": string;
}
