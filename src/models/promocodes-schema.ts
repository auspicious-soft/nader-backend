import mongoose, { Schema, Document } from "mongoose";

export interface IPromoCode extends Document {
  shopifyRuleId: number;
  shopifyCodeId: number;
  code: string;
  ruleTitle: string;
  startsAt?: Date;
  endsAt?: Date;
  value: string;
  valueType: string;
  usageLimit?: number;
  usageCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const PromoCodeSchema = new Schema(
  {
    shopifyRuleId: { type: Number, index: true },
    shopifyCodeId: { type: Number, unique: true },
    code: { type: String, index: true },
    ruleTitle: String,
    startsAt: Date,
    endsAt: Date,
    value: String,
    valueType: String,
    usageLimit: Number,
    usageCount: Number,
  },
  { timestamps: true }
);

export const PromoCodeModel = mongoose.model<IPromoCode>("PromoCode", PromoCodeSchema);
