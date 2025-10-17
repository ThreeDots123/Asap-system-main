import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { Admin } from "./admin.entity";
import { Document, Schema as MongooseSchema } from "mongoose";

const RateValueSchema = new MongooseSchema(
  {
    buy: { type: Number, required: true },
    sell: { type: Number, required: true },
  },
  { _id: false }, // no _id for nested object
);

@Schema({ timestamps: true })
export class ExchangeRate {
  @Prop({ type: String, required: true })
  baseCurrency: string; // The currency that we compare our assets to e.g. "USD"

  @Prop({ type: String, required: true })
  provider: string; // The source that we got our information from so that we can exchange them later e.g. "binance", "kraken"

  @Prop({
    type: Map,
    of: RateValueSchema,
    required: true,
  })
  rates: Map<
    string,
    {
      buy: number; // How much we will buy for 1 dollar
      sell: number; // How much we will sell for 1 dollar
    }
  >;

  @Prop({ type: Types.ObjectId, ref: Admin.name, required: true })
  setBy: Types.ObjectId;
}

const ExchangeRateSchema = SchemaFactory.createForClass(ExchangeRate);

export interface ExchangeRateDocument extends ExchangeRate, Document {}
export default ExchangeRateSchema;
