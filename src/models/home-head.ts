import mongoose, { Schema, Document } from "mongoose";

export interface IHomeHead extends Document {
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const HomeHeadSchema: Schema<IHomeHead> = new Schema(
  {
    title: { type: String, default: "Default Title" },
    description: { type: String, default: "Default Description" },
  },
  {
    timestamps: true,
  }
);

export const HomeHeadModel = mongoose.model<IHomeHead>(
  "HomeHead",
  HomeHeadSchema
);
