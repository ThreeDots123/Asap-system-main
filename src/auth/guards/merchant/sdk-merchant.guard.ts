import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { MerchantService } from "src/merchant/merchant.service";

@Injectable()
export class MerchantSDKGuard implements CanActivate {
  constructor(private baseMerchantService: MerchantService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    const secretKey = this.extractKeyFromHeader(request);

    if (!secretKey)
      throw new UnauthorizedException("Missing Authorization header.");

    // Ensure token is live token
    if (!secretKey.startsWith("sec_live_"))
      throw new UnauthorizedException(
        "A live secret key is required to access this resource.",
      );

    // Find merchant with this key..
    const merchant = await this.baseMerchantService.findBySecretKey(secretKey);

    if (!merchant)
      throw new UnauthorizedException(
        "Unrecognised authorization key recieved.",
      );

    // Ensure that this user has a verified account and their settlement account has been set
    if (merchant.status !== "active")
      throw new UnauthorizedException(
        "Not permitted to proceed. Account not authorised. Complete account setup or account has been suspended or blocked.",
      );

    if (
      !merchant.settlementAccount ||
      !merchant.settlementAccount.accountName ||
      !merchant.settlementAccount.accountNumber ||
      !merchant.settlementAccount.bank
    )
      throw new UnauthorizedException(
        "Please setup your settlement account to be able to proceed.",
      );

    request.merchant = merchant;
    return true;
  }

  private extractKeyFromHeader(request: any): string | undefined {
    return request.headers.authorization;
  }
}
