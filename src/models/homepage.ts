import mongoose, { Schema, Document } from "mongoose";
import { title } from "process";

export interface IHomepage extends Document {
  banners: object[];
  styles: object[];
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const HomepageSchema: Schema<IHomepage> = new Schema(
  {
    title: { type: String, default: "Default Title" },
    description: { type: String, default: "Default Description" },
    banners: [
      {
        image: { type: String, required: true },
        title: { type: String, required: true },
        description: { type: String, required: true },
        handle: { type: String, required: true },
      },
    ],
    styles: [
      {
        image: { type: String, required: true },
        title: { type: String, required: true },
        handle: { type: String, required: true },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const HomepageModel = mongoose.model<IHomepage>(
  "Homepage",
  HomepageSchema
);
