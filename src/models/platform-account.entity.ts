import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

@Schema({ timestamps: true })
export class PlatformAccount {
  @Prop({ required: true, type: String, unique: true })
  name: string;

  @Prop({ required: true, type: String })
  currency: string;

  @Prop({ type: Types.Decimal128 })
  balance: Types.Decimal128;

  @Prop({
    type: {
      type: Map,
      of: String,
      default: {},
    },
    // required: true,
  })
  metadata: Record<string, string>;
}

const PlatformAccountSchema = SchemaFactory.createForClass(PlatformAccount);
export interface PlatformAccountDocument extends PlatformAccount, Document {}
export default PlatformAccountSchema;
