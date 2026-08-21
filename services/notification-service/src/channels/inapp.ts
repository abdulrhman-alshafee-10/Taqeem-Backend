import { prisma } from "../prisma.js";
import { redis } from "../redis.js";

export async function sendInapp(n: any) {
  const inbox = await prisma.inAppInbox.create({
    data: {
      userId: n.userId,
      type:   n.type,
      title:  n.subject ?? "",
      body:   n.body,
      deepLink: n.data?.deepLink ?? null,
    },
  });
  await redis.publish(`inapp:${n.userId}`, JSON.stringify({
    id: inbox.id, type: n.type, title: inbox.title, body: inbox.body, deepLink: inbox.deepLink, at: inbox.createdAt,
  }));
  return `inapp:${inbox.id}`;
}
