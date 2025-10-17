import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export enum AdminRoles {
  manageRates = "ADMIN_RATES",
}

@Schema({ timestamps: true })
export class Admin {
  @Prop({ required: true, unique: true, index: true })
  name: string;

  @Prop({ required: true, type: [String] })
  roles: Array<AdminRoles>;
}

const AdminSchema = SchemaFactory.createForClass(Admin);

export interface AdminDocument extends Admin, Document {}
export default AdminSchema;
