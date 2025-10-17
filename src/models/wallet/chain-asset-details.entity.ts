import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { ProcessorType } from "src/common/types/wallet-custody";

export enum WalletType {
  USER = "user",
  MERCHANT = "merchant",
}

@Schema({ timestamps: true })
export class ChainAssetDetails {
  @Prop({ type: String, required: true, lowercase: true })
  name: string;

  @Prop({ type: String, required: true })
  balance: string;

  @Prop({ type: String, default: "0" })
  convertedBalance: string;

  @Prop({ type: String, required: true, default: "n/a" })
  custodialId: string; // pass in the custodial Id, if any

  @Prop({ type: String, default: "0" })
  logo: string;

  @Prop({ type: String, enum: Object.values(ProcessorType), required: true })
  processedBy: ProcessorType;

  @Prop({ type: String, required: true, lowercase: true })
  symbol: string;

  // Polymorphic Reference Fields:
  @Prop({ type: Types.ObjectId, required: true })
  walletId: Types.ObjectId; // Stores the _id of either a UserWallet or MerchantWallet

  @Prop({
    type: String,
    enum: Object.values(WalletType), // Use your WalletType enum here
    required: true,
  })
  walletModelType: WalletType; // Specifies which model (collection) walletId refers to
}

const ChainAssetDetailsSchema = SchemaFactory.createForClass(ChainAssetDetails);
export interface ChainAssetDocument extends ChainAssetDetails, Document {}
export default ChainAssetDetailsSchema;
