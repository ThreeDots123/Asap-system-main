export enum UserRole {
  CUSTOMER = "customer",
  MERCHANT = "merchant",
  ADMIN = "admin",
}

export enum AccountKYCStatus {
  PENDING = "pending",
  REJECTED = "rejected",
  VERIFIED = "verified",
  NOT_STARTED = "not_started",
}

export enum KycDocumentType {
  PASSPORT = "passport",
  LICENSE = "drivers_license",
  NATIONAL_ID = "national_id",
  UTILITY_BILL = "utility_bill", // Often used for address proof
}

export enum AccountStatus {
  ACTIVE = "active",
  SUSPENDED = "suspended",
  CLOSED = "closed",
}

export interface SecurityChecks {
  pinVerified?: boolean;
  mfaVerified?: boolean;
}
