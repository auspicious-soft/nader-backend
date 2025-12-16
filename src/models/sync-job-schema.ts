import mongoose, { Schema, Document } from "mongoose";

export interface ISyncJob extends Document {
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

const SyncJobSchema = new Schema(
  {
    status: { type: String, default: "PENDING" },
    startedAt: Date,
    completedAt: Date,
    error: String,
  },
  { timestamps: true }
);

export const SyncJobModel = mongoose.model<ISyncJob>("SyncJob", SyncJobSchema);
