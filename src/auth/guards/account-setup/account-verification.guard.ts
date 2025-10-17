import { Injectable } from "@nestjs/common";
import { UserPreAccountVerificationCompletedAuthGuard } from "./factory";
import { TokenService } from "src/token/token.service";
import { UserService } from "src/user/user.service";

@Injectable()
export class AccountVerificationAuthGuard extends UserPreAccountVerificationCompletedAuthGuard {
  constructor(
    private tokenService: TokenService,
    private userService: UserService,
  ) {
    super(tokenService, userService);
  }

  step: "OTP" | "PIN" = "OTP";
}
