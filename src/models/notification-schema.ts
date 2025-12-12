import { Schema, model } from "mongoose";

const notificationSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    handle: {
      type: String,
    },
    successfullySent: {
      type: Number,
    },
    failedToSend: {
      type: Number,
    },
  },
  { timestamps: true }
);

export const notificatonModel = model("notifications", notificationSchema);
