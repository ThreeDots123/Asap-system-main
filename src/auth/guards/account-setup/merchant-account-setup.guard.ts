import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { Observable } from "rxjs";
import { MerchantService } from "src/merchant/merchant.service";
import { TokenService } from "src/token/token.service";

@Injectable()
export class MerchantAccountVerificationAuthGuard implements CanActivate {
  constructor(
    private tokenService: TokenService,
    private merchantService: MerchantService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException("Bearer token not found.");
    }

    try {
      const payload = this.tokenService.decodeToken(token);

      if (payload.role !== "merchant")
        throw new UnauthorizedException(
          "Merchant not permitted to access this route.",
        ); // Stop intruder, they may have an altered token

      const merchant = await this.merchantService.findById(payload.sub);
      if (!merchant) throw new UnauthorizedException("User not found");

      // Ensure that this merchant has not completed their account setup
      if (merchant.status !== "pending")
        throw new UnauthorizedException(
          "Already completed this step or has been suspended or blocked.",
        );

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
