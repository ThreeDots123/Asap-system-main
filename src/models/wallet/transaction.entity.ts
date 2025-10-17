import { Prop, raw, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { User } from "../user.entity";
import {
  AvailableWalletChains,
  ProcessorType,
  UserType,
} from "src/common/types/wallet-custody";
import { SecurityChecks } from "src/common/enum";
import { OfframpTransaction } from "../offramp-transaction";

export enum TransactionStatus {
  INITIATED = "initiated",
  AUTHORIZED = "authorized",
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  REFUNDED = "refunded",
}

export enum TransactionType {
  P2P_TRANSFER = "p2p_transfer", // User to User transfer
  MERCHANT_PAYMENT = "merchant_payment", // Payment to a business (using a payment link and they want to recieve money in coin)
  DEPOSIT = "deposit", // Topping up a wallet
  WITHDRAWAL = "withdrawal", // Cashing out
  FEE = "fee", // Platform fee
  REFUND = "refund", // Refunding a transaction
}

interface Metadata {
  createdBy: string;
  updatedBy: string;
  userType: UserType;
  custom: Record<string, string>;
}

interface TransactionAmount {
  subAmount: string;
  fee: string; // Gas fee equivalent in asset being transfered to the fee from the custodial processor (Like ETH gas fee gotten from blockradar)
  total: string;
}

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ type: String, required: true })
  fromAddr: string;

  @Prop({ type: String, required: true })
  toAddr: string;

  @Prop({ type: String, enum: Object.values(ProcessorType) })
  masterWltUsed: ProcessorType;

  @Prop(
    raw({
      status: { type: Boolean, required: true },
      recipient: { type: Types.ObjectId },
    }),
  )
  canHandleInternally: {
    status: boolean;
    recipient?: Types.ObjectId;
  };

  @Prop({ type: String, required: true })
  txnHash: string;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId: Types.ObjectId;

  @Prop({ type: String })
  blockNo: string;

  @Prop(
    raw({
      subAmount: { type: String, required: true },
      fee: { type: String, required: true },
      total: { type: String, required: true },
    }),
  )
  amount: TransactionAmount;

  @Prop({
    type: Map,
    of: String,
    default: {},
  })
  gasFee: Record<string, string>;

  @Prop({ type: String, required: true })
  chain: AvailableWalletChains;

  @Prop({ type: String, required: true })
  asset: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  transactionReference: string;

  @Prop(
    raw({
      pinVerified: { type: Boolean },
      mfaVerified: { type: Boolean },
    }),
  )
  securityChecks?: SecurityChecks;

  @Prop({ type: Types.ObjectId, ref: OfframpTransaction.name })
  offrampTxnId: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(ProcessorType), required: true })
  processedBy: ProcessorType;

  @Prop({ type: String })
  custodialTxnId: string; // pass in the transaction id of the custodial processor

  @Prop({
    required: true,
    default: () => new Date(Date.now() + 15 * 60 * 1000), // 15 mins in ms
  })
  expiresAt: Date;

  @Prop({
    required: true,
    enum: Object.values(TransactionStatus), // Use enum for transaction status
    default: TransactionStatus.INITIATED,
  })
  status: TransactionStatus;

  @Prop({
    required: true,
    enum: Object.values(TransactionType), // Use enum for transaction type
  })
  type: TransactionType;

  @Prop(
    raw({
      createdBy: { type: String },
      updatedBy: { type: String },
      userType: { type: String },
      custom: {
        type: Map,
        of: String,
        default: {},
      },
    }),
  )
  metadata: Metadata;
}

const TransactionSchema = SchemaFactory.createForClass(Transaction);

export interface TransactionDocument extends Transaction, Document {}
export default TransactionSchema;
