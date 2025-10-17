import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { Merchant } from "../merchant.entity";
import {
  AvailableWalletChains,
  ProcessorType,
} from "src/common/types/wallet-custody";

@Schema({ timestamps: true })
export class MerchantWallet {
  @Prop({ type: Types.ObjectId, ref: Merchant.name, required: true })
  merchantId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(AvailableWalletChains),
    required: true,
    lowercase: true,
  })
  chain: AvailableWalletChains;

  @Prop({ type: String, required: true })
  address: string;

  @Prop({ type: String, required: true, default: "n/a" })
  custodialId: string; // pass in the custodial Id, if any

  @Prop({ type: String, enum: Object.values(ProcessorType), required: true })
  processedBy: ProcessorType;

  // @Prop({
  //   type: Map,
  //   of: Number, // { "ETH": "1.23", "USDT": "50" }
  //   default: {},
  // })
  // balance: Map<string, string>;

  // @Prop({ type: String, default: "0" })
  // convertedBalance: string;
}

const MerchantWalletSchema = SchemaFactory.createForClass(MerchantWallet);
export interface MerchantWalletDocument extends MerchantWallet, Document {}
export default MerchantWalletSchema;
