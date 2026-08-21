import express from "express";
import { redis } from "../redis.js";
import { requireAuth } from "@taqeem/shared/auth/context.js";
import { prisma } from "../prisma.js";

const router = express.Router();

function send(res: express.Response, event: string, data: any) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

router.get("/stream", requireAuth, async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).end();
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Initial snapshot
  const unread = await prisma.inAppInbox.count({ where: { userId, seenAt: null } });
  send(res, "unread", { count: unread });

  // Subscribe to a Redis pub/sub channel this user's dispatcher publishes to
  const sub = redis.duplicate();
  await sub.connect();
  const channel = `inapp:${userId}`;
  await sub.subscribe(channel, (raw) => {
    try { 
      send(res, "notif", JSON.parse(raw)); 
    } catch {}
  });

  // Heartbeat every 20 s so proxies don't drop the connection
  const hb = setInterval(() => res.write(":hb\n\n"), 20_000);

  req.on("close", async () => {
    clearInterval(hb);
    await sub.unsubscribe(channel);
    await sub.quit();
  });
});

export default router;
