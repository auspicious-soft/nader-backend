import mongoose, { Schema, Document } from "mongoose";

export interface ICollection extends Document {
  title: string;
  handle: string;
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

const CollectionSchema: Schema<ICollection> = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    handle: {
      type: String,
      unique: true,
      required: true,
    },
    id: {
      type: String,
      unique: true,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const CollectionModel = mongoose.model<ICollection>(
  "Collection",
  CollectionSchema
);
