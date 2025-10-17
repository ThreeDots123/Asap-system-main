import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import {
  AvailableWalletChains,
  UserType,
} from "src/common/types/wallet-custody";

export enum ExternalWalletStatus {
  CREATED = "created",
  SETTLED = "settled",
}

@Schema({ timestamps: true })
export class ExternalWallet {
  @Prop({
    type: String,
    enum: Object.values(AvailableWalletChains),
    required: true,
    lowercase: true,
  })
  chain: AvailableWalletChains;

  @Prop({ type: String, required: true })
  asset: string;

  @Prop({
    enum: ["regular", "merchant"],
    default: "regular",
  })
  usedFor: UserType;

  @Prop({ type: String, required: true })
  amount: string;

  @Prop({ required: true, lowercase: true })
  address: string;

  @Prop({ required: true })
  pubKey: string;

  @Prop({ required: true })
  secKey: string;

  @Prop({ required: true })
  mnemonic: string;

  @Prop({
    type: String,
    enum: Object.values(ExternalWalletStatus),
    default: ExternalWalletStatus.CREATED,
  })
  status: ExternalWalletStatus;
}

export interface ExternalWalletDocument extends ExternalWallet, Document {}

export const ExternalWalletSchema =
  SchemaFactory.createForClass(ExternalWallet);
