import admin from "firebase-admin";
import { configDotenv } from "dotenv";
import { fcmTokenModel } from "../models/fcmToken.js";

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
		console.log('serviceAccount: ', serviceAccount);

		// Fix multiline private key issue
		serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

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
  adminTitle: any;
  adminDescription: any;
}

export const sendNotification = async ({
  adminTitle,
  adminDescription,
}: SendNotificationParams) => {
  try {
    const notifications: any[] = [];

    if (!adminTitle || !adminDescription) {
      throw new Error("Missing adminTitle or adminDescription");
    }

    const finalTitle =
      adminTitle;
    const finalDescription =
      adminDescription;

    // Save notification data
    const notificationDoc = {
      title: finalTitle,
      description: finalDescription,
    };

    notifications.push(notificationDoc);

    // ✅ Get FCM tokens document
    const fcmDoc = await fcmTokenModel
      .findOne({ Active: true })
      .select("fcmTokens");

    if (!fcmDoc?.fcmTokens?.length) {
      console.log("⚠️ No FCM tokens found");
      return notifications;
    }

    // ✅ Loop through token array
    for (const token of fcmDoc.fcmTokens) {
      try {
        await admin.messaging().send({
          notification: {
            title: finalTitle,
            body: finalDescription,
          },
          token: token,
        });

        console.log("📲 Push sent successfully");
      } catch (pushErr) {
        console.error("❌ Error sending push notification:", pushErr);
      }
    }

    return notifications;
  } catch (err: any) {
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
