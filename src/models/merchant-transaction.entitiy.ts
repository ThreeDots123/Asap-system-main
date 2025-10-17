// src/pos/schemas/pos-transaction.schema.ts
import { Prop, raw, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { Merchant } from "./merchant.entity";
import { AvailableWalletChains } from "src/common/types/wallet-custody";
import { ExchangeRate } from "./rate.entity";
import { OfframpTransaction } from "./offramp-transaction";

export enum MerchantTransactionStatus {
  INITIATED = "initiated", // Created but not yet confirmed
  AUTHORIZED = "authorized", // Payment method verified (e.g., wallet approved)
  COMPLETED = "completed", // Funds successfully captured
  FAILED = "failed", // Declined or error
  REFUNDED = "refunded", // Reversed by merchant
  CANCELLED = "cancelled", // Cancelled before completion
}

export enum MerchantPaymentType {
  POS = "pos", // Created but not yet confirmed,
  SDK_INTERNAL = "sdk.internal_wallet",
}

export interface MerchantPaymentMethod {
  internal?: string;
  external?: string;
}

interface CoinAsset {
  chain: AvailableWalletChains;
  asset: string;
  amount: string;
}

@Schema({ timestamps: true })
export class MerchantTransaction extends Document {
  @Prop({ type: Types.ObjectId, ref: Merchant.name, required: true })
  merchantId: Types.ObjectId;

  @Prop({ type: String, required: true, unique: true })
  reference: string; // Unique transaction reference

  @Prop({ type: String, required: true })
  amount: string;

  @Prop({ type: String, required: true })
  currency: string;

  @Prop(
    raw({
      chain: { type: String, required: true },
      asset: { type: String, required: true },
      amount: { type: String, required: true },
    }),
  )
  coinAsset: CoinAsset;

  @Prop(
    raw({
      internal: { type: String },
      external: { type: String },
    }),
  )
  paymentMethod: MerchantPaymentMethod;

  @Prop({ type: Types.ObjectId, ref: ExchangeRate.name })
  exchangeRate: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: OfframpTransaction.name })
  offrampId: Types.ObjectId;

  @Prop({ type: String })
  terminalId?: string; // Merchant device ID

  @Prop({ type: String })
  location?: string; // Store or physical location identifier

  @Prop({
    required: true,
    enum: MerchantTransactionStatus,
    default: MerchantTransactionStatus.INITIATED,
  })
  status: MerchantTransactionStatus;

  @Prop({
    required: true,
    enum: MerchantPaymentType,
    default: MerchantPaymentType.SDK_INTERNAL,
  })
  paymentType: MerchantPaymentType;

  @Prop({ type: String })
  externalReference?: string; // e.g. processor ref (for card acquirer)

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

const MerchantTransactionSchema =
  SchemaFactory.createForClass(MerchantTransaction);

export interface MerchantTransactionDocument
  extends MerchantTransaction,
    Document {}
export default MerchantTransactionSchema;
