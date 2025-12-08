import mongoose, { Schema, Document } from "mongoose";

export interface ISidebar1 extends Document {
  order: number;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

const SidebarSchema1: Schema<ISidebar1> = new Schema(
  {
    order: {
      type: Number,
      default: 0,
    },
    title: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);


export const SidebarModel1 = mongoose.model<ISidebar1>("Sidebar1", SidebarSchema1);
