import { Prop, raw, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { SecurityChecks } from "src/common/enum";
import {
  CryptoAsset,
  LiquidityProviderProcessorType,
} from "src/common/types/liquidity-provider";
import { AvailableWalletChains } from "src/common/types/wallet-custody";
import { ExchangeRate } from "./rate.entity";
import { CountryCode } from "libphonenumber-js";

interface RecipientDetails {
  bankCode: string;
  acctName: string;
  acctNo: string;
  type: "merchant" | "external"; // External refers to an outer user receiving from bank account
  countryCode: CountryCode;
}

interface AssetSent {
  chain: AvailableWalletChains;
  asset: CryptoAsset;
  amount: string;
}

interface SentAmount {
  amount: string;
  currency: string;
}

export enum PaymentTransactionStatus {
  INITIATED = "initiated",
  AUTHORIZED = "authorized",
  AWAITING_DEPOSIT = "awaiting_deposit",
  FUNDED = "funded",
  PENDING = "payout.processing",
  TRANSIT = "payout.in-transit",
  COMPLETED = "payout.completed",
  FAILED = "payout.failed",
  CANCELLED = "cancelled",
  REFUNDED = "payout.refunded",
}

export enum PaymentOrigin {
  EXTERNAL = "External_wallet",
  INTERNAL = "Dedicated_wallet",
  SDK = "Merchant_integrated_sdk",
  LINK = "Merchant_payment_link",
}

@Schema({ timestamps: true })
export class OfframpTransaction {
  @Prop(
    raw({
      bankCode: { type: String, required: true },
      acctName: { type: String, required: true },
      acctNo: { type: String, required: true },
      countryCode: { type: String, required: true },
      type: {
        // required: true,
        type: String, // Use enum for transaction status
        default: "external",
      },
    }),
  )
  recipient: RecipientDetails;

  @Prop({ type: String })
  fromAddr: string;

  @Prop(
    raw({
      chain: { type: String, required: true },
      asset: { type: String, required: true },
      amount: { type: String, required: true },
    }),
  )
  assetSent: AssetSent;

  @Prop(
    raw({
      amount: { type: String, required: true },
      currency: { type: String, required: true },
    }),
  )
  sentAmount: SentAmount;

  @Prop({ type: String, required: true, unique: true, index: true })
  transactionReference: string;

  @Prop({
    required: true,
    enum: Object.values(PaymentTransactionStatus), // Use enum for transaction status
    default: PaymentTransactionStatus.INITIATED,
  })
  status: PaymentTransactionStatus;

  @Prop({
    required: true,
    enum: Object.values(PaymentOrigin),
    default: PaymentOrigin.INTERNAL,
  })
  origin: PaymentOrigin;

  @Prop({
    type: String,
    enum: Object.values(LiquidityProviderProcessorType),
    required: true,
  })
  processedBy: LiquidityProviderProcessorType;

  @Prop({
    type: Types.ObjectId,
    required: true,
  })
  userId: Types.ObjectId; // the user or merchant the transaction is attached to.

  @Prop(
    raw({
      pinVerified: { type: Boolean },
      mfaVerified: { type: Boolean },
    }),
  )
  securityChecks?: SecurityChecks;

  @Prop({
    required: true,
    default: () => new Date(Date.now() + 15 * 60 * 1000), // 15 mins in ms
  })
  expiresAt: Date;

  @Prop(
    raw({
      walletUsed: { type: String, required: true },
    }),
  )
  metadata: { walletUsed: "internal" | "external"; [key: string]: string };

  @Prop(
    raw({
      internal: {
        rates: { type: Types.ObjectId, ref: ExchangeRate.name, required: true },
      },
      provider: {
        name: { type: String },
        rates: [
          {
            type: Map,
            of: String, // this makes it behave like Record<string, string>
          },
        ],
      },
    }),
  )
  exchangeRate: {
    internal: { rates: string };
    provider: {
      name: string;
      rates: Record<string, { buy: number; sell: number }>[];
    };
  };
}

const OfframpTransactionSchema =
  SchemaFactory.createForClass(OfframpTransaction);

export interface OfframpTransactionDocument
  extends OfframpTransaction,
    Document {}
export default OfframpTransactionSchema;
