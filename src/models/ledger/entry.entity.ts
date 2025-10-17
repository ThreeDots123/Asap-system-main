import { Prop, raw, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";

export enum LedgerStatus {
  ONGOING = "ongoing", // The Entries in that TRANSACTION are not completed It has not reached the last stage)
  POSTED = "posted",
}

export enum AccountType {
  LIABILITY = "liability",
  ASSET = "asset",
  EXPENSE = "expense",
  EQUITY = "equity",
  REVENUE = "revenue",
}

export enum AccountOrigin {
  USER = "user", // User "ASSET (e.g ETH)" Wallet
  MERCHANT = "merchant", // Merchant "ASSET (e.g ETH)" Wallet
  PLATFORM = "platform", // Platform's Hot wallet (Yellow card and custodial wallets too)
  fees = "fees", // The network fees inccured
}

export interface Entries {
  accountId: Types.ObjectId; // Refers to all accounts and sub accounts that we have on the platform (e.g user-waller, hot-wallet[main wallet for plaform e.t.c])
  debit: Types.Decimal128; // The amount to debit. Use 0 if it's a credit.
  credit: Types.Decimal128; // The amount to credit. Use 0 if it's a debit.
  accountOrigin: AccountOrigin;
  type: AccountType;
  metadata?: Record<string, string>;
}

// Each document in the collection represents a transaction
@Schema({ timestamps: true })
export class LedgerEntry {
  @Prop({ type: String, required: true, unique: true })
  idempotencyKey: string;

  @Prop({ type: String })
  memo: string; // Human-readable description of the transaction

  @Prop({ type: Types.ObjectId, required: true })
  transactionId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(LedgerStatus),
    required: true,
    default: LedgerStatus.ONGOING,
  })
  status: LedgerStatus;

  @Prop(
    raw([
      {
        entryKey: { type: String, required: true }, // e.g. `${origin}:${eventType}:${accountId}:${amount}`
        accountId: { type: String, required: true, default: "Nil" },
        debit: { type: Boolean, required: true },
        credit: { type: Boolean, required: true },
        representation: { type: String, required: true },
        accountOrigin: {
          type: String,
          enum: Object.values(AccountOrigin),
          required: true,
        },
        type: {
          type: String,
          enum: Object.values(AccountType),
          required: true,
        },
        amount: { type: String, required: true },
        metadata: {
          type: Map,
          of: String,
          default: {},
        },
      },
    ]),
  )
  entries: Array<Entries>;
}

const LedgerEntrySchema = SchemaFactory.createForClass(LedgerEntry);
export default LedgerEntrySchema;
