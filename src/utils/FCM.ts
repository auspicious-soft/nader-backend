import admin from "firebase-admin";
import { configDotenv } from "dotenv";
import { fcmTokenModel } from "../models/fcmToken.js";
import { notificatonModel } from "../models/notification-schema.js";

configDotenv();

/**
 * Initialize Firebase Admin SDK
 */
export const initializeFirebase = () => {
  try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      throw new Error("Missing Firebase service account credentials");
    }

    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log("serviceAccount: ", serviceAccount);

    // Fix multiline private key issue
    serviceAccount.private_key = serviceAccount.private_key.replace(
      /\\n/g,
      "\n"
    );

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("✅ Firebase Admin initialized");
    }
  } catch (error) {
    console.error("❌ Error initializing Firebase:", error);
    throw error;
  }
};

interface SendNotificationParams {
  adminTitle: string;
  adminDescription: string;
  handle: string;
  handleTitle: string;
}

export const sendNotification = async ({
  adminTitle,
  adminDescription,
  handle,
  handleTitle,
}: SendNotificationParams) => {
  try {
    if (!adminTitle || !adminDescription) {
      throw new Error("Missing adminTitle or adminDescription");
    }

    // For returning saved notification details
    const notifications = [
      {
        title: adminTitle,
        description: adminDescription,
      },
    ];

    // Get all FCM tokens
    const fcmDocs = await fcmTokenModel.find().lean();
    const tokens = fcmDocs.map((doc) => doc.fcmToken);

    if (!tokens.length) {
      console.log("⚠️ No FCM tokens found");
      return notifications;
    }

    // Prepare message payload for multicast
    const message = {
      notification: {
        title: adminTitle,
        body: adminDescription,
      },
      data: {
        handle: handle || "",
        handleTitle: handleTitle || "",
      },
      tokens,
    };

    // Broadcast push to all tokens in one call
    const response = await admin.messaging().sendEachForMulticast(message);

    console.log("📢 Broadcast complete:", {
      successCount: response.successCount,
      failureCount: response.failureCount,
    });

    await notificatonModel.create({
      title: adminTitle,
      description: adminDescription,
      handle,
      handleTitle,
      successfullySent: response.successCount,
      failedToSend: response.failureCount,
    });

    // Clean invalid tokens
    const invalidTokens: string[] = response.responses
      .map((res, idx) => (res.error ? tokens[idx] : null))
      .filter((t): t is string => Boolean(t));

    if (invalidTokens.length) {
      await fcmTokenModel.deleteMany({ fcmToken: { $in: invalidTokens } });
      console.log("🧹 Removed invalid FCM tokens:", invalidTokens.length);
    }

    return notifications;
  } catch (err) {
    console.error("❌ NotificationService error:", err);
    throw err;
  }
};

export interface NotificationMessage {
  notification: {
    title: string;
    body: string;
  };
  token: string;
}

export interface NotificationPayload {
  title: string;
  description: string;
  userIds?: string[];
}
