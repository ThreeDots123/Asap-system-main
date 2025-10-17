export type KycDocumentType = "passport" | "license" | "national_id";

export type KycStatus = "pending" | "verified" | "rejected" | "not_started";

export type UserStatus = "active" | "suspended" | "blocked" | "pending";

export interface KycDocument {
  type: KycDocumentType;
  documentUrl: string;
  // This property may not exist until a document is actually verified,
  // so we mark it as optional.
  verifiedAt?: Date;
}

export interface Verification {
  emailVerified: boolean;
  phoneVerified: boolean;
  kycStatus: KycStatus;
  kycDocuments: KycDocument[];
}

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
}

export interface Profile {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  dateOfBirth?: Date;
  address?: Address;
}

export interface TwoFactorSecret {
  base32: string;
  totpUrl: string;
}

interface BaseSecurity {
  password: string;
  pin: string;
  loginAttempts: number;
  lastLogin?: Date;
  lockedUntil?: Date;
}

type TwoFactorDisabled = {
  twoFactorEnabled: false;
  twoFactorSecret?: never; // `never` explicitly forbids this property from being present
};

type TwoFactorEnabled = {
  twoFactorEnabled: true;
  twoFactorSecret: TwoFactorSecret; // Required
};

export type Security = BaseSecurity & (TwoFactorDisabled | TwoFactorEnabled);
