import { Schema, Prop, raw } from "@nestjs/mongoose";
import * as bcrypt from "bcrypt";
import createSoftDeletableSchema from "src/utils/create-soft-deletable-entity";
import {
  Profile,
  Security,
  UserStatus,
  Verification,
} from "src/common/types/user-model";
import { Document } from "mongoose";

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, index: true })
  username: string;

  @Prop({ required: true, unique: true, index: true })
  phone: string;

  @Prop({ required: true, index: true })
  country: string;

  @Prop({
    lowercase: true,
  })
  email: string;

  @Prop(
    raw({
      password: { type: String, required: true, default: "n/a" },
      pin: { required: true, default: " ", type: String },
      twoFactorEnabled: { type: Boolean, default: false },
      twoFactorSecret: {
        base32: { type: String },
        totpUrl: { type: String },
      },
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
      firstName: {
        type: String,
      },
      lastName: { type: String },
      avatar: { type: String },
      dateOfBirth: { type: Date },
      address: {
        street: { type: String },
        city: { type: String },
        state: { type: String },
        country: { type: String },
        zipCode: { type: String },
      },
    }),
  )
  profile: Profile;

  @Prop(
    raw({
      emailVerified: { type: Boolean, default: false },
      phoneVerified: { type: Boolean, default: false },
      kycStatus: {
        type: String,
        enum: ["pending", "verified", "rejected", "not_started"],
        default: "not_started",
      },
      kycDocuments: [
        {
          type: { type: String, enum: ["passport", "license", "national_id"] },
          documentUrl: String,
          verifiedAt: Date,
        },
      ],
    }),
  )
  verification: Verification;

  @Prop({
    required: true,
    enum: ["active", "suspended", "blocked", "pending"],
    default: "pending",
  })
  status: UserStatus;
}

const UserSchema = createSoftDeletableSchema(User);

// ########################################################################################
// SCHEMA METHODS
// ########################################################################################

/**
 * Compares a candidate password with the user's stored hashed password.
 * @param candidatePswrd The plaintext password to compare.
 * @returns A promise that resolves to true if the passwords match, otherwise false.
 */
UserSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.security.password);
};

/**
 * Compares a candidate PIN with the user's stored hashed PIN.
 * @param candidatePin The plaintext PIN to compare.
 * @returns A promise that resolves to true if the PINs match, otherwise false.
 */
UserSchema.methods.comparePin = async function (
  candidatePin: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePin, this.security.pin);
};

// ########################################################################################
// SCHEMA MIDDLEWARES
// ########################################################################################

UserSchema.pre("save", async function (next) {
  if (this.isModified("security.password")) {
    if (this.security.password) {
      // Hash password
      const salt = await bcrypt.genSalt(10);
      this.security.password = await bcrypt.hash(this.security.password, salt);
    }
  }

  if (this.isModified("security.pin")) {
    if (this.security.pin.trim()) {
      // Hash pin
      const salt = await bcrypt.genSalt(12);
      this.security.pin = await bcrypt.hash(this.security.pin, salt);
    }
  }

  return next();
});

// Add middleware for update operations
UserSchema.pre(
  ["findOneAndUpdate", "updateOne", "updateMany"],
  async function (next) {
    const update: any = this.getUpdate();

    // Handle password hashing
    if (update.$set && update.$set["security.password"]) {
      const salt = await bcrypt.genSalt(10);
      update.$set["security.password"] = await bcrypt.hash(
        update.$set["security.password"],
        salt,
      );
    }

    // Handle PIN hashing
    if (update.$set && update.$set["security.pin"]) {
      if (update.$set["security.pin"].trim()) {
        const salt = await bcrypt.genSalt(12);
        update.$set["security.pin"] = await bcrypt.hash(
          update.$set["security.pin"],
          salt,
        );
      }
    }

    return next();
  },
);

// Encode Security MFA

export interface UserDocument extends User, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
  comparePin(candidatePin: string): Promise<boolean>;
}
export default UserSchema;
