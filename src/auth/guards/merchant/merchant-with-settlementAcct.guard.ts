import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { VerifiedMerchant } from "./verified-merchant.guard";
import { TokenService } from "src/token/token.service";
import { MerchantService } from "src/merchant/merchant.service";
import { Request } from "express";
import { MerchantDocument } from "src/models/merchant.entity";

@Injectable()
export class MerchantWithSettlementAccountGuard extends VerifiedMerchant {
  constructor(
    private tokenService: TokenService,
    private merchantService: MerchantService,
  ) {
    super(tokenService, merchantService);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);

    const request: Request = context.switchToHttp().getRequest();

    const merchant = request.merchant as MerchantDocument;

    if (
      !merchant.settlementAccount ||
      !merchant.settlementAccount.accountName ||
      !merchant.settlementAccount.accountNumber ||
      !merchant.settlementAccount.bank
    )
      throw new UnauthorizedException(
        "Merchant not allowed to access this route. Settlement account not yet set up.",
      );

    return true;
  }
}
