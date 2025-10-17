import { Module } from "@nestjs/common";
import { TokenService } from "./token.service";
import { JwtModule, JwtModuleOptions } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { JWT_ACCESS_SECRET, JWT_EXPIRATION } from "src/config/env/list";
import { MongooseModule } from "@nestjs/mongoose";
import TokenSchema, { Token } from "src/models/tokens.entity";

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        ({
          secret: configService.getOrThrow<string>(JWT_ACCESS_SECRET),
          signOptions: {
            expiresIn: configService.getOrThrow<string>(JWT_EXPIRATION),
          },
        }) as JwtModuleOptions,
    }),
    MongooseModule.forFeature([{ name: Token.name, schema: TokenSchema }]),
  ],
  providers: [TokenService],
  exports: [TokenService],
})
export class TokenModule {}
