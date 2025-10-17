import { Module } from "@nestjs/common";
import { SocketGateway } from "./socket.gateway";
import { TokenModule } from "src/token/token.module";

@Module({
  imports: [TokenModule],
  providers: [SocketGateway],
  exports: [SocketGateway],
})
export class GatewayModule {}
