import mongoose, { Schema } from "mongoose";
import { ISidebar } from "./sidebar-schema.js";

const SidebarSchema3: Schema<ISidebar> = new Schema(
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
    handle: {
      type: String,
      default: null,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sidebar2",
    },
    type: {
      type: Number,
      default: 3,
    },
  },
  {
    timestamps: true,
  }
);

export const SidebarModel3 = mongoose.model<ISidebar>(
  "Sidebar3",
  SidebarSchema3
);
