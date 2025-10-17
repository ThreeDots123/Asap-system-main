import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
  Session,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { CreateUserAcctDto } from "./dto/create-user-account.dto";
import { AuthService } from "src/auth/auth.service";
import { SessionPayload } from "src/common/types/session-payload";
import { Request } from "express";
import { UserDocument } from "src/models/user.entity";
import { CompleteAccountVerificationDto } from "./dto/complete-account-verification.dto";
import { AccountVerificationAuthGuard } from "src/auth/guards/account-setup/account-verification.guard";
import { SignInUserToAccountDto } from "./dto/sign-in-user.dto";
import { SetTransactionPin } from "./dto/set-pin.dto";
import { AccountPin } from "src/auth/guards/account-setup/setup-pin.guard";
import { VerifyMFADto } from "./dto/complete-mfa.dto";
import { VerifiedUser } from "src/auth/guards/verified-user.guard";
import { WalletCustodialService } from "src/wallet-custodial/wallet-custodial.service";
import { AvailableWalletChains } from "src/common/types/wallet-custody";
import { Types } from "mongoose";
import { ClientTypeHeaderDto } from "./dto/client-type.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import {
  LoginMerchantDto,
  RegisterMerchantDto,
} from "./dto/merchant-authentication.dto";
import { MerchantAccountVerificationAuthGuard } from "src/auth/guards/account-setup/merchant-account-setup.guard";
import { MerchantDocument } from "src/models/merchant.entity";

@Controller("account")
export class AccountController {
  constructor(
    private authService: AuthService,
    private walletCustodialService: WalletCustodialService,
  ) {}

  @Post("user/register")
  async createUserAccount(
    @Body() _body: CreateUserAcctDto,
    // @Session() session: SessionPayload,
  ) {
    const { country, password, phone, username } = _body;
    const { user, authorizationTokens } =
      await this.authService.registerUserDetails({
        username,
        phone,
        country,
        password,
      });

    // Save refresh token to user session if client is web but for now the user section is controlled by a mobile app
    // session.refreshToken = authorizationTokens.refresh.token;
    // session.refreshId = authorizationTokens.refresh.id;

    return {
      message: "User Registered Sucessfully",
      user,
      accessToken: authorizationTokens.access,
      refreshToken: authorizationTokens.refresh.token,
      refreshId: authorizationTokens.refresh.id,
    };
  }

  @Post("user/login")
  @HttpCode(200)
  async signInUserToAccount(
    @Body() _body: SignInUserToAccountDto,
    // @Session() session: SessionPayload,
  ) {
    const { password, phone, refreshTokenId } = _body;

    const { user, authorizationTokens } = await this.authService.signInUser(
      phone,
      password,
      refreshTokenId,
    );

    // Save refresh token to user session if client is web but for now the user section is controlled by a mobile app
    // session.refreshToken = authorizationTokens.refresh.token;
    // session.refreshId = authorizationTokens.refresh.id;

    return {
      message: "Sign in successful.",
      user,
      accessToken: authorizationTokens.access,
      refreshToken: authorizationTokens.refresh.token,
      refreshId: authorizationTokens.refresh.id,
    };
  }

  @Get("user/verify")
  @UseGuards(AccountVerificationAuthGuard)
  async initiateAccountVerification(@Req() request: Request) {
    const { id, phone, country } = request.user as UserDocument;
    await this.authService.initiateAccountVerification(id, phone, country);

    return { message: "Otp has been sent for account verification." };
  }

  @Post("user/verify")
  @UseGuards(AccountVerificationAuthGuard)
  @HttpCode(200)
  async completeAccountVerification(
    @Body() _body: CompleteAccountVerificationDto,
    @Req() request: Request,
  ) {
    const { id } = request.user as UserDocument;
    const { verificationCode } = _body;

    await this.authService.completeAccountVerification(id, verificationCode);
    return { message: "Account has been verified successfully" };
  }

  @Post("user/access-token")
  @HttpCode(200)
  async retrieveNewAccessToken(
    @Session() session: SessionPayload,
    @Headers() header: ClientTypeHeaderDto,
    @Body() _body: RefreshTokenDto,
  ) {
    if (!header["x-client-type"])
      throw new BadRequestException("x-client-type expected in header.");

    let refreshToken: string | undefined;
    let refreshTokenId: string | undefined;

    if (header["x-client-type"] === "web") {
      refreshToken = session.refreshToken;
      refreshTokenId = session.refreshId;

      if (!refreshToken || !refreshTokenId)
        throw new UnauthorizedException(
          "User cannot access this route. No token found. Please log in again.",
        );
    } else {
      refreshToken = _body.refreshToken;
      refreshTokenId = _body.refreshTokenId;

      if (!refreshToken || !refreshTokenId)
        throw new UnauthorizedException(
          "User cannot access this route. No token found. Please log in again.",
        );
    }

    const accessToken = await this.authService.generateAccessToken(
      refreshTokenId,
      refreshToken,
    );

    return { accessToken };
  }

  @Post("user/pin")
  @UseGuards(AccountPin)
  async setupTransactionPin(
    @Body() _body: SetTransactionPin,
    @Req() request: Request,
  ) {
    const { pin } = _body;
    const user = request.user as UserDocument;
    const { id, phone, _id } = user;

    await this.authService.createUserTransactionPin(id, pin);

    // Complete account setup here.. this is the last stage of account setup. [Create default wallet, which is the base chain]
    await this.walletCustodialService.assignWallet({
      chain: AvailableWalletChains.BASE,
      metadata: { userId: _id as Types.ObjectId, phone },
      userType: "regular",
    });

    return {
      message: "Your transaction pin setup is successful.",
    };
  }

  // MFA is required to be setup when user wants to perform transactions.. It may not be used everytime, but sometimes they have to perform it, so they use their secret
  @Get("user/mfa")
  @UseGuards(VerifiedUser)
  async createMFASecret(@Req() request: Request) {
    const { id } = request.user as UserDocument;
    const secret = await this.authService.createMFASecret(id);

    return {
      secret: {
        ...secret.secret, // usually use the url for QR codes
      },
      message:
        "Use secret to register on google authenticator or authy. This secret only lasts for " +
        secret.expirationTimeInMin +
        " mins",
    };
  }

  @Post("user/mfa")
  @UseGuards(VerifiedUser) // Account already completed
  async completeMFASetup(@Req() request: Request, @Body() _body: VerifyMFADto) {
    const { id } = request.user as UserDocument;
    const { code } = _body;

    await this.authService.validateUserMFAAuth(id, code, "initiated");

    return {
      message: "Your MFA has been sucessfully setup.",
    };
  }

  @Post("merchant/register")
  async createMerchantAccount(
    @Body() _body: RegisterMerchantDto,
    @Headers() header: ClientTypeHeaderDto,
    @Session() session: SessionPayload,
  ) {
    const { authorizationTokens, merchant } =
      await this.authService.registerMerchantDetails(_body);

    // Save refresh token to user session if client is web but for now the user section is controlled by a mobile app

    if (header["x-client-type"] !== "mobile") {
      session.refreshToken = authorizationTokens.refresh.token;
      session.refreshId = authorizationTokens.refresh.id;
    }

    return {
      message: "Merchant registered successfully",
      merchant,
      accessToken: authorizationTokens.access,
      ...(header["x-client-type"] === "mobile" && {
        refreshToken: authorizationTokens.refresh.token,
        refreshId: authorizationTokens.refresh.id,
      }),
    };
  }

  @Post("merchant/login")
  @HttpCode(200)
  async signInMerchantToAccount(
    @Body() _body: LoginMerchantDto,
    @Headers() header: ClientTypeHeaderDto,
    @Session() session: SessionPayload,
  ) {
    const { password, email } = _body;
    const refreshTokenId = session.refreshId;

    const { merchant, authorizationTokens } =
      await this.authService.signInMerchant(email, password, refreshTokenId);

    if (header["x-client-type"] !== "mobile") {
      // Save refresh token to user session if client is web but for now the user section is controlled by a mobile app
      session.refreshToken = authorizationTokens.refresh.token;
      session.refreshId = authorizationTokens.refresh.id;
    }

    return {
      message: "Sign in successful.",
      merchant,
      accessToken: authorizationTokens.access,
      ...(header["x-client-type"] === "mobile" && {
        refreshToken: authorizationTokens.refresh.token,
        refreshId: authorizationTokens.refresh.id,
      }),
    };
  }

  @Get("merchant/verify")
  @UseGuards(MerchantAccountVerificationAuthGuard)
  async initiateMerchantAccountVerification(@Req() request: Request) {
    const { id, email } = request.merchant as MerchantDocument;
    await this.authService.initiateMerchantAccountVerification(id, email);

    return { message: "Otp has been emailed for account verification." };
  }

  @Post("merchant/verify")
  @UseGuards(MerchantAccountVerificationAuthGuard)
  @HttpCode(200)
  async completeMerchantAccountVerification(
    @Body() _body: CompleteAccountVerificationDto,
    @Req() request: Request,
  ) {
    const { _id, id, businessName } = request.merchant as MerchantDocument;
    const { verificationCode } = _body;

    await this.authService.completeMerchantAccountVerification(
      id,
      verificationCode,
    );

    // Complete account setup here.. this is the last stage of account setup. [Create default wallet, which is the base chain]
    await this.walletCustodialService.assignWallet({
      chain: AvailableWalletChains.BASE,
      metadata: { userId: _id as Types.ObjectId, business: businessName },
      userType: "merchant",
    });

    return { message: "Account has been verified successfully" };
  }
}
