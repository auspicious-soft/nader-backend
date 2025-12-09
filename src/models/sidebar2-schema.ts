import mongoose, { Schema } from "mongoose";
import { ISidebar } from "./sidebar-schema.js";

const SidebarSchema2: Schema<ISidebar> = new Schema(
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
    type: {
      type: Number,
      default: 2
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sidebar1",
    },
  },
  {
    timestamps: true,
  }
);

export const SidebarModel2 = mongoose.model<ISidebar>(
  "Sidebar2",
  SidebarSchema2
);
