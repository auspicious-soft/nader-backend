import mongoose, { Schema, Document } from "mongoose";

export interface ISidebar extends Document {
  order: number;
  title: string;
  image: string | null;
  wantImage: boolean;
  handle: string | null;
  isPrime: boolean;
  child: mongoose.Types.ObjectId[];
  parent: mongoose.Types.ObjectId;
  type: number;
  createdAt: Date;
  updatedAt: Date;
}

const SidebarSchema: Schema<ISidebar> = new Schema(
  {
    order: {
      type: Number,
      default: 0,
    },
    title: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      default: null,
    },
    wantImage: {
      type: Boolean,
      default: false,
    },
    handle: {
      type: String,
      default: null,
    },
    isPrime: {
      type: Boolean,
      default: false,
    },
    child: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Sidebar",
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const SidebarModel = mongoose.model<ISidebar>("Sidebar", SidebarSchema);
