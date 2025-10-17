import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({ timestamps: true })
export class InitiatedMFA {
  @Prop({ required: true })
  base32: string;

  @Prop({ required: true })
  totpUrl: string;
}

const InitiatedMFASchema = SchemaFactory.createForClass(InitiatedMFA);
export default InitiatedMFASchema;
