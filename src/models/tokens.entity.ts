import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { Document } from "mongoose";
import * as bcrypt from "bcrypt";

export enum TokenType {
  REFRESH = "refresh",
  PASSWORD_RESET = "password_reset",
  EMAIL_VERIFY = "email_verify",
}

@Schema({ timestamps: true })
export class Token {
  @Prop({
    required: true,
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // Reference to the User model
  })
  userId: mongoose.Schema.Types.ObjectId;

  // We store a HASH of the token, not the token itself for security.
  @Prop({ required: true })
  token: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({
    required: true,
    enum: Object.values(TokenType), // Use enum for token types
  })
  type: TokenType;

  @Prop({ type: Date, default: null })
  revokedAt: Date | null;
}

const TokenSchema = SchemaFactory.createForClass(Token);

// ########################################################################################
// --- Indexes for Performance ---
// ########################################################################################

// 1. Index for fast lookups by userId to find all tokens for a user.
TokenSchema.index({ userId: 1 });

// 2. TTL (Time-To-Live) Index to automatically delete expired tokens from the database.
// This is incredibly efficient for cleanup.
TokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ########################################################################################
// --- MIDDLEWARES ---
// ########################################################################################

// Before saving a token, hash it if it has been modified.
// This is a CRITICAL security measure. Never store tokens in plaintext.
TokenSchema.pre<TokenDocument>("save", async function (next) {
  if (this.isModified("token")) {
    this.token = await bcrypt.hash(this.token, 10);
  }
  next();
});

// ########################################################################################
// --- Instance Method for Comparison ---
// ########################################################################################

// Optional but highly recommended: Add a method to the schema to compare a plaintext
// token with the stored hash. This keeps the logic encapsulated.
TokenSchema.methods.compareToken = async function (plaintextToken: string) {
  return bcrypt.compare(plaintextToken, this.token);
};

TokenSchema.methods.isExpired = function () {
  return new Date() > new Date(this.expiredAt);
};

export interface TokenDocument extends Token, Document {
  compareToken(plaintextToken: string): Promise<boolean>;
  isExpired(): boolean;
}
export default TokenSchema;
