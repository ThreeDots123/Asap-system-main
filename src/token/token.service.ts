import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Model } from "mongoose";
import { TokenPayload } from "src/common/types/token-service";
import { JWT_PAYMENT_SECRET, JWT_REFRESH_SECRET } from "src/config/env/list";
import { Token, TokenDocument, TokenType } from "src/models/tokens.entity";
import { InjectModel } from "@nestjs/mongoose";

const refreshTokenDuration = {
  jwtFormat: "30d",
  numFormat: 60 * 60 * 24 * 30, // 30 days
};

const paymentTokenDuration = {
  jwtFormat: "10m",
  numFormat: 60 * 10, // 600 seconds
};

@Injectable()
export class TokenService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectModel(Token.name) private TokenModel: Model<Token>,
  ) {}

  generateEncodedToken(
    tokenType: "refresh" | "access" | "payment",
    data: { userId: string; metadata?: Record<string, string> },
  ) {
    const { userId, metadata } = data;
    const payload: TokenPayload = {
      sub: userId,
      ...this.extractCustomClaims(metadata),
    };
    // Encode a token with the sub property

    if (tokenType === "payment")
      return this.jwtService.sign(payload, {
        secret: this.configService.getOrThrow<string>(JWT_PAYMENT_SECRET),
        expiresIn: paymentTokenDuration.jwtFormat as any,
      });
    else if (tokenType === "refresh")
      return this.jwtService.sign(payload, {
        secret: this.configService.getOrThrow<string>(JWT_REFRESH_SECRET),
        expiresIn: refreshTokenDuration.jwtFormat as any,
      });
    else return this.jwtService.sign(payload);
  }

  decodeToken(
    token: string,
    tokenType: "refresh" | "access" | "payment" = "access",
  ) {
    try {
      if (tokenType === "payment")
        return this.jwtService.verify<TokenPayload>(token, {
          secret: this.configService.getOrThrow<string>(JWT_PAYMENT_SECRET),
        });
      else if (tokenType === "refresh")
        return this.jwtService.verify<TokenPayload>(token, {
          secret: this.configService.getOrThrow<string>(JWT_REFRESH_SECRET),
        });
      else return this.jwtService.verify<TokenPayload>(token);
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  async saveToken(data: {
    userId: string;
    token: string;
    tokenType: TokenType;
    expiresAt: Date;
  }) {
    const { userId, token, tokenType, expiresAt } = data;
    return new this.TokenModel({
      token,
      type: tokenType,
      expiresAt,
      userId,
    }).save();
  }

  async deleteTokens(tokenIds: string[], tokenType: TokenType) {
    return this.TokenModel.deleteMany({
      _id: { $in: tokenIds },
      type: tokenType,
    }).exec();
  }

  async retrieveToken(
    tokenId: string,
    tokenType: TokenType,
  ): Promise<TokenDocument | null> {
    return this.TokenModel.findOne({
      _id: tokenId,
      type: tokenType,
      revokedAt: null,
    });
  }

  private extractCustomClaims(tokenPayload: any) {
    // Ignore claims that are going to cause clashes if added to custom claims
    const { exp, iat, nbf, iss, aud, jti, sub, ...customClaims } = tokenPayload;
    return customClaims;
  }
}
