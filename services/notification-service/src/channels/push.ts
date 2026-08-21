import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { prisma } from "../prisma.js";

// Init firebase admin only if creds are provided
try {
  const accountStr = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (accountStr && accountStr !== "{}" && getApps().length === 0) {
    initializeApp({
      credential: cert(JSON.parse(accountStr)),
    });
  }
} catch(e) {
  console.warn("FCM mock mode enabled");
}

export async function sendPush(n: any) {
  const tokens = await prisma.pushToken.findMany({ where: { userId: n.userId } });
  if (tokens.length === 0) {
    console.log(`[Push Dummy] No push tokens for user ${n.userId}, skipping`);
    return `dummy-push-${Date.now()}`;
  }

  const message = {
    notification: { title: n.subject ?? "Taqeem", body: n.body },
    data: {
      type: n.type,
      deepLink: n.data?.deepLink ?? "",
      entityId: n.data?.entityId ?? "",
    },
    tokens: tokens.map(t => t.token),
    android: { priority: "high" as const },
    apns: { headers: { "apns-priority": "10" } },
  };

  if (getApps().length === 0) {
    console.log(`[Push Dummy] Multicast push to ${tokens.length} tokens: ${n.subject}`);
    return `dummy-push-${Date.now()}`;
  }

  const res = await getMessaging().sendEachForMulticast(message);

  // Purge invalid tokens
  const dead: string[] = [];
  res.responses.forEach((r: any, i: number) => {
    if (!r.success) {
      const code = r.error?.code;
      if (code === "messaging/registration-token-not-registered") dead.push(tokens[i].token);
    }
  });
  if (dead.length) await prisma.pushToken.deleteMany({ where: { token: { in: dead } } });

  if (res.successCount === 0) throw new Error("All push tokens failed");
  return `fcm:${res.responses.map(r => r.messageId).filter(Boolean).join(",")}`;
}
