import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { randomBytes } from "crypto";
import { add } from "date-fns";
import { CountryCode } from "libphonenumber-js";
import { Model } from "mongoose";
import * as speakeasy from "speakeasy";
import events from "src/event";
import { EventService } from "src/event/event.service";
import { MerchantAcctCreatedEvent } from "src/event/subscribers/account/merchant.subscriber";
import { UserAcctCreatedEvent } from "src/event/subscribers/account/user.subscriber";
import { MemoryStoreService } from "src/memory-store/memory-store.service";
import { MerchantService } from "src/merchant/merchant.service";
import { InitiatedMFA } from "src/models/initiated-secrets.entity";
import { TokenType } from "src/models/tokens.entity";
import { SmsService } from "src/sms/sms.service";
import { TokenService } from "src/token/token.service";
import { UserService } from "src/user/user.service";
import toInternationalFormat from "src/utils/to-intl-format";

const {
  account: { created },
} = events;

// =============================================================================
// Auth Service
// =============================================================================
/**
 * @class AuthService
 * @description Handles all authentication and session management logic, including
 * user registration, token creation, OTP/MFA verification, and payment sessions.
 */
@Injectable()
export class AuthService {
  // --- Redis Prefixes for Memory Store ---
  private sessionRevocationPrefix = (key: string) => "revoked_session:" + key;
  private initialMFASecretPrefix = (key: string) => "mfa_init:" + key;
  private otpSavedPrefix = (key: string) => "otp_saved:" + key;

  /**
   * Initializes the AuthService with its required dependencies.
   * @param {TokenService} tokenService - Service for creating and managing JWTs.
   * @param {MemoryStoreService} memoryStore - Service for interacting with Redis or other in-memory stores.
   * @param {EventService} eventService - Service for emitting application-wide events.
   * @param {UserService} userService - Service for user data management.
   * @param {SmsService} smsService - Service for sending SMS messages.
   * @param {Model<InitiatedMFA>} InitiatedMFAModel - Mongoose model for temporary MFA secrets.
   */
  constructor(
    private tokenService: TokenService,
    private memoryStore: MemoryStoreService,
    private eventService: EventService,
    private userService: UserService,
    private smsService: SmsService,
    @InjectModel(InitiatedMFA.name)
    private InitiatedMFAModel: Model<InitiatedMFA>,
    private merchantService: MerchantService,
  ) {}

  // ===========================================================================
  // Public API Methods
  // ===========================================================================

  /**
   * Handles the complete user registration workflow. It validates user details,
   * creates a user record, generates an OTP, fires a 'user created' event,
   * and returns authorization tokens.
   *
   * @param {object} details - The user's registration details.
   * @param {string} details.username - The desired username.
   * @param {string} details.phone - The user's phone number.
   * @param {CountryCode} details.country - The user's country code.
   * @param {string} details.password - The user's plaintext password.
   * @returns {Promise<object>} An object containing the new user's public data and their auth tokens.
   * @throws {BadRequestException} If the username/phone already exists or the phone number is invalid.
   */
  async registerUserDetails(details: {
    username: string;
    phone: string;
    country: CountryCode;
    password: string;
  }) {
    const { username, phone, country, password } = details;

    const existingUser = await this.userService.findOneByUsernameOrPhone(
      username,
      phone,
    );

    if (existingUser) {
      throw new BadRequestException(
        "User already exists with this phone number or username",
      );
    }

    let phoneIntlFmt: string;
    try {
      phoneIntlFmt = toInternationalFormat(phone, country);
    } catch (err) {
      throw new BadRequestException(err.message);
    }

    const newUser = await this.userService.createUser({
      username,
      phone: phoneIntlFmt,
      country,
      verification: {
        phoneVerified: false,
      },
      security: {
        password,
      },
    });

    const { otp: userOtp } = await this.createOtpForAuthentication(newUser.id);

    this.eventService.emit(created.user, {
      event: new UserAcctCreatedEvent(newUser, userOtp),
    });

    const authorizationTokens = await this.createAuthorizationTokens({
      role: "user",
      id: newUser.id,
    });

    return {
      user: {
        id: newUser.id,
        username,
        phone,
        country,
      },
      authorizationTokens,
    };
  }

  // ---------------------------------------------------------------------------

  /**
   * Handles the complete merchant registration workflow. It validates merchant details,
   * creates a merchant record, generates an OTP, fires a 'merchant created' event,
   * and returns authorization tokens.
   *
   * @param {object} data - The merchant's registration details.
   * @param {string} data.email - The desired email.
   * @param {string} data.businessName - The merchant's business name.
   * @param {CountryCode} data.contactNumber - The merchant's contact number.
   * @param {string} data.password - The merchant's plaintext password.
   * @returns {Promise<object>} An object containing the new merchant's public data and their auth tokens.
   * @throws {BadRequestException} If the email already exists or the phone number is invalid.
   */

  async registerMerchantDetails(data: {
    email: string;
    businessName: string;
    password: string;
    contactNumber?: string;
    websiteUrl?: string;
  }) {
    const existing = await this.merchantService.findOneByEmail(data.email);

    if (existing) throw new BadRequestException("Merchant already exists");

    const keys = this.generateMerchantApiKeys();

    const { email, businessName, password, contactNumber, websiteUrl } = data;
    const newMerchant = await this.merchantService.createMerchant({
      email,
      websiteUrl,
      businessName,
      contactNumber,
      security: {
        password,
      },
      ...keys,
    });

    const { otp: merchantOtp } = await this.createOtpForAuthentication(
      newMerchant.id,
    );

    //  Merchant verifies email on signup
    this.eventService.emit(created.merchant, {
      event: new MerchantAcctCreatedEvent(newMerchant, merchantOtp),
    });

    const authorizationTokens = await this.createAuthorizationTokens({
      role: "merchant",
      id: newMerchant.id,
    });

    return {
      merchant: {
        id: newMerchant._id,
        email: newMerchant.email,
      },
      authorizationTokens,
    };
  }

  // ---------------------------------------------------------------------------

  /**
   * Authenticate returning users.
   *
   * @param {string} phone - The phone of the user to verify.
   * @param {string} password - The corresponding password of the user.
   * @param {string} oldRefreshToken - Token to delete on successful login.
   *
   * @throws {BadRequestException} If the user authentication fails.
   */
  async signInUser(phone: string, password: string, oldRefreshToken?: string) {
    const user = await this.userService.findOneByPhoneNumber(phone);

    if (!user || !(await user.comparePassword(password)))
      throw new UnauthorizedException("Invalid phone number or password");

    const authorizationTokens = await this.createAuthorizationTokens({
      role: "user",
      id: user.id,
    });

    if (oldRefreshToken)
      await this.tokenService.deleteTokens(
        [oldRefreshToken],
        TokenType.REFRESH,
      );

    // Update user last logged in date
    this.userService.update(user.id, {
      $set: { "security.lastLogin": new Date() },
    });

    const { id, username, country, profile } = user;
    return {
      user: {
        id,
        username,
        phone,
        country,
        ...(profile && { profile }),
      },
      authorizationTokens,
    };
  }

  // ---------------------------------------------------------------------------

  /**
   * Authenticate returning users.
   *
   * @param {string} email - The email of the user to verify.
   * @param {string} password - The corresponding password of the user.
   * @param {string} oldRefreshToken - Token to delete on successful login.
   *
   * @throws {BadRequestException} If the user authentication fails.
   */
  async signInMerchant(
    email: string,
    password: string,
    oldRefreshToken?: string,
  ) {
    const merchant = await this.merchantService.findOneByEmail(email);

    if (!merchant || !(await merchant.comparePassword(password)))
      throw new UnauthorizedException("Invalid email or password");

    const authorizationTokens = await this.createAuthorizationTokens({
      role: "merchant",
      id: merchant.id,
    });

    if (oldRefreshToken)
      await this.tokenService.deleteTokens(
        [oldRefreshToken],
        TokenType.REFRESH,
      );

    // Update user last logged in date
    this.merchantService.update(merchant.id, {
      $set: { "security.lastLogin": new Date() },
    });

    return {
      merchant: {
        id: merchant._id,
        email: merchant.email,
        businessName: merchant.businessName,
      },
      authorizationTokens,
    };
  }

  // ---------------------------------------------------------------------------

  /**
   * Generate secret keys that will be used to process Multi-factor authentication
   *
   * @param {string} userId - The id of the user that wishes to process their MFA.
   *
   */
  async createMFASecret(userId: string) {
    const mfaSecret = await this.initiateMFARegistration(userId);
    return mfaSecret;
  }

  // ---------------------------------------------------------------------------

  /**
   * Authenticate returning users.
   *
   * @param {string} userId - The id of the user that wishes to process their MFA.
   * @param {string} code - Code gotten from authenticator.
   * @param {string} type - Are they processing a new mfa or are they using their usual secret.
   * @returns {Promise<string>}
   * @throws {BadRequestException} If the Token validation fails.
   */
  async validateUserMFAAuth(
    userId: string,
    code: string,
    type: "initiated" | "returning",
  ) {
    const { isValid, secret } = await this.completeMFA(userId, code, type);

    if (!isValid) throw new BadRequestException("Invalid MFA Code.");

    // store secret to user
    await this.userService.update(userId, {
      $set: {
        "security.twoFactorEnabled": true,
        "security.twoFactorSecret": secret,
      },
    });
  }

  /**
   * Authenticate returning users.
   *
   * @param {string} tokenId - The id of the refresh token we want to generate an access token from.
   * @returns {Promise<string>}
   * @throws {BadRequestException} If the Token validation fails.
   */

  async generateAccessToken(tokenId: string, refreshToken: string) {
    // Check if refresh token exists and is valid in database
    const foundRefreshToken = await this.tokenService.retrieveToken(
      tokenId,
      TokenType.REFRESH,
    );

    if (!foundRefreshToken || foundRefreshToken.isExpired())
      throw new BadRequestException("Invalid or expired refresh token");

    if (!foundRefreshToken.compareToken(refreshToken))
      throw new BadRequestException("Invalid or expired refresh token");

    // we decoded the plain token and not the one from the database, because it has been hashed.
    const payload = this.tokenService.decodeToken(refreshToken, "refresh");

    // Generate new access token
    const { sub, ...metadata } = payload;
    const accessToken = this.tokenService.generateEncodedToken("access", {
      userId: sub,
      metadata,
    });

    return accessToken;
  }

  // ---------------------------------------------------------------------------

  /**
   * Initiates the account verification process by generating an OTP and sending it
   * to the user's phone number.
   *
   * @param {string} userId - The ID of the user to verify.
   * @param {string} phone - The phone of the user to verify.
   * @param {string} country - The country code of the phone number sent.
   * @returns {Promise<void>}
   * @throws {InternalServerErrorException} If the SMS fails to send.
   */
  async initiateAccountVerification(
    userId: string,
    phone: string,
    country: string,
  ) {
    const { otp: userOtp } = await this.createOtpForAuthentication(userId);

    console.log(userOtp);

    try {
      // Example SMS sending logic (currently commented out)
      await this.smsService.smsSingleUser(
        { phone, countryCode: country as CountryCode },
        `Your verification code is ${userOtp}. It expires in 1 minute.`,
      );
    } catch (err) {
      throw new InternalServerErrorException(
        "Unable to send otp sms at this moment.",
      );
    }
  }

  // ---------------------------------------------------------------------------

  /**
   * Completes the account registration by verifying the provided OTP and updating
   * the user's phone verification status.
   *
   * @param {string} userId - The ID of the user.
   * @param {string} otpToken - The OTP token submitted by the user.
   * @returns {Promise<void>}
   * @throws {BadRequestException} If the provided OTP is invalid or expired.
   */
  async completeAccountVerification(userId: string, otpToken: string) {
    const isTokenValid = await this.verifyOtpForAuthentication(
      userId,
      otpToken,
    );
    if (!isTokenValid) {
      throw new BadRequestException("Token is not valid.");
    }
    await this.userService.update(userId, {
      $set: { "verification.phoneVerified": true },
    }); // No need to delete the otp before it expires.. user is not permitted to access this again because account is verified.
  }

  // ---------------------------------------------------------------------------

  /**
   * Initiates the account verification for merchant by generating an OTP and sending it
   * to the merchant's Email account.
   *
   * @param {string} merchantId - The ID of the merchant to verify.
   * @param {string} email - The email of the merchant to verify.
   * @returns {Promise<void>}
   * @throws {InternalServerErrorException} If the SMS fails to send.
   */
  async initiateMerchantAccountVerification(merchantId: string, email: string) {
    const { otp: merchantOtp } =
      await this.createOtpForAuthentication(merchantId);

    console.log(merchantOtp);

    try {
      // Example Email Otp (Not yet implementes)
      throw new InternalServerErrorException("Implement email sending service");
    } catch (err) {
      throw new InternalServerErrorException(
        "Unable to send otp email at this moment.",
      );
    }
  }

  // ---------------------------------------------------------------------------

  /**
   * Completes the account registration by verifying the provided OTP and updating
   * the merchant's account status.
   *
   * @param {string} merchantId - The ID of the merchant.
   * @param {string} otpToken - The OTP token submitted by the user.
   * @returns {Promise<void>}
   * @throws {BadRequestException} If the provided OTP is invalid or expired.
   */
  async completeMerchantAccountVerification(
    merchantId: string,
    otpToken: string,
  ) {
    const isTokenValid = await this.verifyOtpForAuthentication(
      merchantId,
      otpToken,
    );

    if (!isTokenValid) throw new BadRequestException("Token is not valid.");

    await this.merchantService.update(merchantId, {
      $set: { status: "active" },
    });
    // No need to delete the otp before it expires.. user is not permitted to access this again because account is verified.
  }

  // ---------------------------------------------------------------------------

  /**
   * Creates a short-lived, single-purpose JWT for authorizing a payment session.
   *
   * @param {string} accountPin - The user's account pin for verification (logic to be added).
   * @param {object} data - Data to be encoded in the payment token.
   * @param {string} data.userId - The ID of the user initiating the payment.
   * @param {Record<string, string>} [data.metadata] - Optional metadata for the payment.
   * @returns {string} The generated payment session JWT.
   */
  async createPaymentSession(data: {
    userId: string;
    metadata?: Record<string, string>;
  }) {
    const { userId, metadata } = data;
    const paymentToken = this.tokenService.generateEncodedToken("payment", {
      userId,
      metadata: metadata ?? {},
    });
    return paymentToken;
  }

  // ---------------------------------------------------------------------------

  /**
   * Verifies a payment session token to authorize a payment process.
   *
   * @param {string} sessionToken - The JWT received from `createPaymentSession`.
   * @returns {Promise<{ userId: string; }>} The user's ID and whether MFA is required for this transaction.
   * @throws {HttpException} If no session token is provided.
   * @throws {BadRequestException} If the token is invalid, expired, or revoked.
   */
  async verifyPaymentSession(
    sessionToken: string,
  ): Promise<{ userId: string; [key: string]: string }> {
    // NOT COMPLETED!!!!!!

    if (!sessionToken) {
      throw new HttpException(
        "No session token found. Cannot proceed to process payment",
        HttpStatus.FORBIDDEN,
      );
    }

    try {
      const session = this.tokenService.decodeToken(sessionToken, "payment");

      const isRevoked = await this.memoryStore.get(
        this.sessionRevocationPrefix(sessionToken),
      );
      if (isRevoked) throw new Error("Session has been revoked");

      return { userId: session.userId, ...session };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  // ---------------------------------------------------------------------------

  /**
   * Revokes a token by adding it to a denylist in the memory store.
   *
   * @param {string} token - The token to revoke.
   * @param {number} lifetimeInSecs - The remaining lifetime of the token, used as the TTL for the revocation record.
   * @returns {Promise<void>}
   * @throws {InternalServerErrorException} If the lifetime is not a positive number.
   */
  async revokeToken(token: string, lifetimeInSecs: number): Promise<void> {
    if (lifetimeInSecs > 0) {
      await this.memoryStore.save(this.sessionRevocationPrefix(token), "1", {
        isRevoked: true,
        ttlInSecs: lifetimeInSecs,
      });
    } else {
      throw new InternalServerErrorException(
        "Revoke token function expects a lifetime of at least 1 second",
      );
    }
  }

  // ---------------------------------------------------------------------------

  /**
   * Assigns a transactional pin to user's account.
   *
   * @param {string} userId - The id of the user to update.
   * @param {string} pin - The pin the user wishes to assign to his account.
   * @returns {Promise<User>}
   */
  async createUserTransactionPin(userId: string, pin: string) {
    return this.userService.update(userId, {
      $set: { "security.pin": pin, status: "active" },
    });
  }

  // ---------------------------------------------------------------------------

  /**
   * Checks business logic to determine if MFA is required for a specific action.
   * (Currently a mock).
   *
   * @private
   * @param {string} userId - The user's ID to check against.
   * @returns {Promise<"allow" | "challenge" | "block>} True if MFA is required.
   */
  async riskAssessment(): Promise<"allow" | "challenge" | "block"> {
    // Example logic: check for high-risk transactions, user settings, etc.
    return "allow"; // Mocked for now
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================
  /** These methods support the public API and are not intended for external use. */

  /**
   * Generates a new TOTP secret for a user during MFA setup. The secret is
   * persisted temporarily and linked to the user in the memory store.
   *
   * @private
   * @param {string} userId - The ID of the user registering for MFA.
   * @returns {Promise<{ secret: speakeasy.GeneratedSecret; expirationTimeInMin: number }>} The generated secret and its expiration time.
   */
  private async initiateMFARegistration(userId: string) {
    const expirationTimeInMin = 5;
    const initialSecret = speakeasy.generateSecret();

    const record = await new this.InitiatedMFAModel({
      base32: initialSecret.base32,
      totpUrl: initialSecret.otpauth_url,
    }).save();

    await this.memoryStore.save(
      this.initialMFASecretPrefix(userId),
      record.id,
      { expiration: { type: "EX", value: expirationTimeInMin * 60 } },
    );

    return { secret: initialSecret, expirationTimeInMin };
  }

  // ---------------------------------------------------------------------------

  /**
   * Verifies a Time-based One-Time Password (TOTP) to complete Multi-Factor Authentication.
   *
   * @private
   *
   * @param {string} userId - The ID of the user being authenticated.
   * @param {string} code - The 6-digit MFA code from the user's authenticator app.
   * @param {'initiated' | 'returning'} type - The context of the MFA attempt ('initiated' for first-time setup, 'returning' for subsequent logins).
   * @returns {Promise<boolean>} True if the MFA verification is successful.
   * @throws {BadRequestException} If the MFA code is invalid.
   * @throws {InternalServerErrorException} If the temporary MFA secret is not found or has expired.
   */
  private async completeMFA(
    userId: string,
    code: string,
    type: "initiated" | "returning",
  ) {
    let secret: { base32: string; totpUrl: string };

    if (type === "initiated") {
      const secretId = await this.memoryStore.get(
        this.initialMFASecretPrefix(userId),
      );
      if (secretId === null) {
        throw new InternalServerErrorException(
          "User secret for MFA was not found or has expired.",
        );
      }
      const initialMFASecret = await this.InitiatedMFAModel.findById(secretId);
      if (!initialMFASecret) {
        throw new InternalServerErrorException(
          "User secret for MFA was not found or has expired.",
        );
      }
      secret = {
        base32: initialMFASecret.base32,
        totpUrl: initialMFASecret.totpUrl,
      };
    } else {
      // TODO: Fetch user's saved MFA secret from the main User document.
      secret = "N/A" as any;
    }

    const isVerified = this.verifyTOTP(secret.base32, code);
    if (!isVerified) throw new BadRequestException("Invalid MFA code");

    return { isValid: true, ...(type === "initiated" && { secret }) };
  }
  // ---------------------------------------------------------------------------

  /**
   * Creates a 6-digit numeric OTP and saves it to the memory store with a short expiry.
   *
   * @private
   * @param {string} userId - The ID of the user for whom the OTP is being created.
   * @returns {Promise<{ otp: number; expirationTimeInMin: number }>} The generated OTP and its lifetime.
   */
  private async createOtpForAuthentication(userId: string) {
    const expirationTimeInMin = 1;
    const createdOtp = Math.floor(100000 + Math.random() * 900000);

    await this.memoryStore.save(this.otpSavedPrefix(userId), createdOtp, {
      expiration: { type: "EX", value: expirationTimeInMin * 60 },
    });

    return { otp: createdOtp, expirationTimeInMin };
  }

  // ---------------------------------------------------------------------------

  /**
   * Verifies a user-submitted OTP against the one stored in memory.
   *
   * @private
   * @param {string} userId - The user's ID.
   * @param {string} token - The OTP token to verify.
   * @returns {Promise<boolean>} True if the token is valid, otherwise false.
   */
  private async verifyOtpForAuthentication(
    userId: string,
    token: string,
  ): Promise<boolean> {
    const foundToken = await this.memoryStore.get(this.otpSavedPrefix(userId));
    return foundToken !== null && foundToken === token;
  }

  // ---------------------------------------------------------------------------

  /**
   * Generates a pair of access and refresh tokens for an authenticated user
   * and persists the refresh token to the database.
   *
   * @private
   * @param {object} payload - Data to be included in the tokens.
   * @param {string} payload.id - The user's ID.
   * @param {'user' | 'merchant'} payload.role - The user's role.
   * @returns {Promise<{ access: string; refresh: string }>} The generated access and refresh tokens.
   */
  private async createAuthorizationTokens(payload: {
    role: "user" | "merchant";
    id: string;
  }) {
    const { id, role } = payload;
    const tokenData = { userId: id, metadata: { role } };

    const access = this.tokenService.generateEncodedToken("access", tokenData);
    const refresh = this.tokenService.generateEncodedToken(
      "refresh",
      tokenData,
    );

    const expiresAt = add(new Date(), { days: 30 });
    const token = await this.tokenService.saveToken({
      userId: id,
      token: refresh,
      tokenType: TokenType.REFRESH,
      expiresAt,
    });

    // We are saving the refresh token - and we do not store token in plain text.. So we use ID to find our tokens.
    const tokens = {
      access,
      refresh: { id: token.id, token: refresh },
    };

    return tokens;
  }

  // ---------------------------------------------------------------------------

  /**
   * Verifies a TOTP code against a given secret. (Currently a mock).
   *
   * @private
   * @param {string} secret - The base32 encoded secret for the TOTP.
   * @param {string} code - The code to verify.
   * @returns {Promise<boolean>} True if the code is valid.
   */
  private verifyTOTP(secret: string, code: string): boolean {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: "base32",
      token: code,
    });
  }

  // ---------------------------------------------------------------------------

  /**
   * Verifies a TOTP code against a given secret. (Currently a mock).
   *
   * @private
   * @returns {{apiKey: string; secretKey: string}} The ApiKey credentials for a merchant
   */
  private generateMerchantApiKeys() {
    return {
      apiKey: `pub_${randomBytes(32).toString("hex")}`,
      secretKey: `sec_${randomBytes(36).toString("hex")}`,
    };
  }
}
