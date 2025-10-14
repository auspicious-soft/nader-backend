import dotenv from "dotenv";
import path from "path";

const envFile = process.env.ENV === "DEV" ? ".env.prod" : ".env.dev";

dotenv.config({ path: path.resolve(process.cwd(), envFile) });

export const ENV = {
  ENV: process.env.NODE_ENV || "DEV",
  PORT: process.env.PORT || 8000,
  MONGO: process.env.MONGO_URL || "mongodb://localhost:27017/nader",
  AUTH_SECRET: process.env.AUTH_SECRET || "nader@secret",
  SHOPIFY_ADMIN_API_URL: process.env.SHOPIFY_ADMIN_API_URL || "",
  SHOPIFY_STOREFRONT_API_URL: process.env.SHOPIFY_STOREFRONT_API_URL || "",
  X_SHOPIFY_ACESS_TOKEN: process.env.X_SHOPIFY_ACESS_TOKEN || "",
  X_SHOPIFY_STOREFRONT_ACCESS_TOKEN:
    process.env.X_SHOPIFY_STOREFRONT_ACCESS_TOKEN || "",
  MOBILE_APP_API_SECRET: process.env.MOBILE_APP_API_SECRET || "nader@mobile",
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || "",
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || "",
  AWS_REGION: process.env.AWS_REGION || "",
  AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME || "",
  AWS_BUCKET_URL: process.env.AWS_BUCKET_URL || "",
};
