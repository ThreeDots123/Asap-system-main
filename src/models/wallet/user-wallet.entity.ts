import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { User } from "../user.entity";
import {
  AvailableWalletChains,
  ProcessorType,
} from "src/common/types/wallet-custody";

@Schema({ timestamps: true })
export class UserWallet {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId: Types.ObjectId;

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
}

const UserWalletSchena = SchemaFactory.createForClass(UserWallet);
export interface UserWalletDocument extends UserWallet, Document {}
export default UserWalletSchena;
