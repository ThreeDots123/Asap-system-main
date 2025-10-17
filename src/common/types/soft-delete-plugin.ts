import mongoose, { Document } from "mongoose";

export interface SoftDeleteModel<T extends Document> extends Document {
  softDelete(): Promise<T>;
  restore(): Promise<T>;
  deletedAt: Date | null;
}

// Define query options to include deleted documents
export interface SoftDeleteQueryOptions {
  withDeleted?: boolean;
}
