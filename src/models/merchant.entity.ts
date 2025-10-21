import { Prop, raw, Schema } from "@nestjs/mongoose";
import * as bcrypt from "bcrypt";
import { Document } from "mongoose";
import createSoftDeletableSchema from "src/utils/create-soft-deletable-entity";

export type Security = {
  password: string;
  loginAttempts: number;
  lastLogin?: Date;
  lockedUntil?: Date;
};

export type MerchantStatus = "active" | "suspended" | "blocked" | "pending";

interface MerchantSettlementAccount {
  bank: string;
  accountName: string;
  accountNumber: string;
}

@Schema()
export class Merchant {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  businessName: string;

  @Prop({ type: Boolean, required: true, default: true })
  isLive: boolean;

  @Prop({ required: true })
  fullname: string;

  @Prop()
  contactNumber: string;

  @Prop()
  websiteUrl: string;

  @Prop(
    raw({
      password: { type: String, required: true, default: "n/a" },
      lastLogin: {
        type: Date,
      },
      loginAttempts: { default: 0, type: Number },
      lockedUntil: {
        type: Date,
      },
    }),
  )
  security: Security;

  @Prop(
    raw({
      bank: { type: String },
      accountNumber: { type: String },
      accountName: { type: String },
    }),
  )
  settlementAccount: MerchantSettlementAccount;

  @Prop({
    enum: ["pending", "verified", "suspended", "blocked"],
    default: "pending",
  })
  status: MerchantStatus;

  @Prop({ type: String })
  apiKey: string; // public API key

  @Prop({ type: String })
  secretKey: string; // secret API key

  @Prop({ type: String })
  webhookUrl?: string;
}

const MerchantSchema = createSoftDeletableSchema(Merchant);

// ########################################################################################
// SCHEMA METHODS
// ########################################################################################

/**
 * Compares a candidate password with the user's stored hashed password.
 * @param candidatePswrd The plaintext password to compare.
 * @returns A promise that resolves to true if the passwords match, otherwise false.
 */
MerchantSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.security.password);
};

// ########################################################################################
// SCHEMA MIDDLEWARES
// ########################################################################################

// Hash password before saving
MerchantSchema.pre("save", async function (next) {
  if (!this.isModified("security.password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.security.password = await bcrypt.hash(this.security.password, salt);
  next();
});

export interface MerchantDocument extends Merchant, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export default MerchantSchema;
