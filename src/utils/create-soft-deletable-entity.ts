import { SchemaFactory } from "@nestjs/mongoose";
import mongoose, { Query, Schema } from "mongoose";
import { SoftDeleteModel } from "../common/types/soft-delete-plugin";
import { Type } from "@nestjs/common";

// Implement Plugin to prevent deleted records from being selected exceot if stated otherwise
const softDeletePlugin = (schema: Schema) => {
  // 1. ADD THE DELETED_AT FIELD
  schema.add({ deletedAt: { type: Date, default: null, index: true } });

  // 2. EXCLUDE DELETED DOCUMENTS FROM QUERIES
  const excludeDeleted = function (this: Query<any, any>, next: () => void) {
    // Check for a custom option to include deleted documents
    if (this.getOptions().withDeleted !== true) {
      this.where({ deletedAt: { $eq: null } });
    }
    next();
  };

  // Apply the middleware to all 'find'-like queries
  schema.pre(/^find/, excludeDeleted);
  schema.pre("countDocuments", excludeDeleted); // For countDocuments as well

  // 3. ADD INSTANCE METHODS
  // Method to perform a soft delete
  schema.methods.softDelete = function (this: SoftDeleteModel<any>) {
    this.deletedAt = new Date();
    return this.save();
  };

  // Method to restore a soft-deleted document
  schema.methods.restore = function (this: SoftDeleteModel<any>) {
    this.deletedAt = null;
    return this.save();
  };
};

export default function createSoftDeletableSchema<TClass = any>(
  target: Type<TClass>,
): mongoose.Schema<TClass> {
  const schema = SchemaFactory.createForClass(target);
  schema.plugin(softDeletePlugin);
  return schema;
}

// Example

//   async findAll() {
//     // This will automatically return ONLY non-deleted users.
//     return this.userModel.find().exec();
//   }

//   async findOne(id: string) {
//     // This will return null if the user is soft-deleted.
//     return this.userModel.findById(id).exec();
//   }

//   async findOneIncludingDeleted(id: string) {
//     // This uses the "escape hatch" to find any user, even deleted ones.
//     const options: SoftDeleteQueryOptions = { withDeleted: true };
//     return this.userModel.findById(id, null, options).exec();
//   }

//   async softDeleteUser(id: string) {
//     const user = await this.userModel.findById(id).exec();
//     if (user) {
//       // Use the custom method from our plugin
//       return user.softDelete();
//     }
//     return null;
//   }

//   async restoreUser(id: string) {
//     const user = await this.findOneIncludingDeleted(id);
//     if (user && user.deletedAt) {
//       // Use the custom method from our plugin
//       return user.restore();
//     }
//     return user;
//   }
