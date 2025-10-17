import {
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { TokenService } from "src/token/token.service";
import { UserService } from "src/user/user.service";

export abstract class UserPreAccountVerificationCompletedAuthGuard
  implements CanActivate
{
  abstract readonly step: "OTP" | "PIN";

  // Only users with an account that has not yet been setup will pass this guard.
  constructor(
    private baseTokenService: TokenService,
    private baseUserService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException("Bearer token not found.");
    }

    try {
      const payload = this.baseTokenService.decodeToken(token);

      if (payload.role !== "user")
        throw new UnauthorizedException(
          "User not permitted to access this route.",
        ); // Stop intruder, they may have an altered token
      const user = await this.baseUserService.findById(payload.sub);
      if (!user) throw new UnauthorizedException("User not found");

      // Ensure that this user has not completed their account setup
      if (
        this.step === "OTP" &&
        (user.status !== "pending" || user.verification.phoneVerified)
      )
        throw new UnauthorizedException(
          "User not authorised to use this route. Already completed this step.",
        );
      else if (
        this.step === "PIN" &&
        (user.status !== "pending" ||
          user.security.pin.trim() ||
          !user.verification.phoneVerified)
      )
        throw new UnauthorizedException(
          "User not authorised to use this route. Already completed account setup or have not yet verified account.",
        );

      request.user = user;
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
