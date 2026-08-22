import { startConsumer } from "@taqeem/shared/events/consumer.js";
import { PrismaClient } from "@prisma/client";
import { publishEvent } from "@taqeem/shared/events/publisher.js";
import axios from "axios";

const prisma = new PrismaClient();

const RULES: Record<string, (stats: any) => boolean> = {
  photo_hunter:       (stats) => (stats.mediaCount || 0) >= 50,
  trusted_voter:      (stats) => (stats.totalHelpfulVotes || 0) >= 100,
  verified_visitor:   (stats) => (stats.verifiedVisits || 0) >= 20,
};

async function tryAward(userId: string, key: string, stats: any) {
  const existing = await prisma.userBadge.findUnique({ 
    where: { userId_badgeKey: { userId, badgeKey: key } } 
  });
  
  if (existing) return;
  
  const eligible = RULES[key]?.(stats);
  if (!eligible) return;
  
  await prisma.userBadge.create({ data: { userId, badgeKey: key } });
  await publishEvent("user.badge_awarded", { userId, badgeKey: key });
}

const EVENT_TO_KEYS: Record<string, string[]> = {
  "review.created": ["photo_hunter"],
  "review.verified_visit": ["verified_visitor"],
  "review.helpful_voted":  ["trusted_voter"],
};

export const badgeAwarderHandler = async (payload: any, headers: any) => {
  const type = headers["x-event-type"] as string;
  const keys = EVENT_TO_KEYS[type];
  if (!keys) return;
  
  const userId = payload.userId ?? payload.authorId ?? payload.voterId;
  if (!userId) return;

  let stats = {};
  try {
    const res = await axios.get(`http://review-service:4003/api/internal/users/${userId}/counts`);
    stats = res.data;
  } catch (err) {
    console.error("Failed to fetch user counts for badges", err);
    return;
  }

  for (const key of keys) {
    await tryAward(userId, key, stats);
  }
};

export async function startBadgeAwarder() {
  await startConsumer({
    queue: "user.badges.queue",
    handler: badgeAwarderHandler,
  });
}
