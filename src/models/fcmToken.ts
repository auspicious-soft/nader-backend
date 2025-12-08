import { Schema, model } from "mongoose";

const fcmTokenSchema = new Schema(
  {
    fcmToken: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

export const fcmTokenModel = model("fcmTokens", fcmTokenSchema);
