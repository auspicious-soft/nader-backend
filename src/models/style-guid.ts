import mongoose, { Schema, Document } from "mongoose";

export interface IStyleGuid extends Document {
  title: string;
  pointers: string[];
  image: string | null;
  lengths: {
    image: string;
    title: string;
    description: string;
    pointers: string[];
    handle: string | null;
  }[];
  styles: {
    image: string;
    title: string;
    handle: string;
  }[];
  youtube: {
    image: string | null;
    link: string | null;
  };
  paring: {
    image: string;
    title: string;
    handle: string | null;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const StyleGuidSchema: Schema<IStyleGuid> = new Schema(
  {
    title: { type: String, default: "Default Title" },
    pointers: [{ type: String }],
    image: { type: String, default: null },
    lengths: [
      {
        image: { type: String, required: true },
        title: { type: String, required: true },
        description: { type: String, required: true },
        pointers: [{ type: String }],
        handle: { type: String, default: null },
      },
    ],
    youtube: {
      image: { type: String, default: null },
      link: { type: String, default: null },
    },
    paring: [
      {
        image: { type: String, required: true },
        title: { type: String, required: true },
        handle: { type: String, default: null },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const StyleGuidModel = mongoose.model<IStyleGuid>(
  "StyleGuid",
  StyleGuidSchema
);
