import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { MerchantService } from "src/merchant/merchant.service";
import { TokenService } from "src/token/token.service";

@Injectable()
export class IsMerchant implements CanActivate {
  constructor(
    private baseTokenService: TokenService,
    private baseMerchantService: MerchantService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) throw new UnauthorizedException("Bearer token not found.");

    try {
      const payload = this.baseTokenService.decodeToken(token);

      if (payload.role !== "merchant")
        throw new UnauthorizedException(
          "User not permitted to access this route.",
        ); // Stop intruder, they may have an altered token

      const merchant = await this.baseMerchantService.findById(payload.sub);
      if (!merchant) throw new UnauthorizedException("Merchant not found");

      request.merchant = merchant;
      return true;
    } catch (err) {
      throw new UnauthorizedException(err.message);
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    return type === "Bearer" ? token : undefined;
  }
}
