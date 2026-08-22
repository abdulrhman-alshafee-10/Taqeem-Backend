import { startConsumer } from "@taqeem/shared/events/consumer.js";
import { PrismaClient } from "@prisma/client";
import { publishEvent } from "@taqeem/shared/events/publisher.js";

const prisma = new PrismaClient();

// Helper to get ISO week string "YYYY-WW"
function getIsoWeek(date: Date) {
  const t = new Date(date.valueOf());
  const dayn = (date.getDay() + 6) % 7;
  t.setDate(t.getDate() - dayn + 3);
  const firstThursday = t.valueOf();
  t.setMonth(0, 1);
  if (t.getDay() !== 4) {
    t.setMonth(0, 1 + ((4 - t.getDay()) + 7) % 7);
  }
  const weekNumber = 1 + Math.ceil((firstThursday - t.valueOf()) / 604800000);
  return `${t.getFullYear()}-${weekNumber.toString().padStart(2, '0')}`;
}

// Helper to shift ISO week
function shiftIsoWeek(weekStr: string, offset: number) {
  const [y, w] = weekStr.split("-").map(Number);
  // Rough approximation for +1 / -1
  let nextW = w + offset;
  let nextY = y;
  if (nextW < 1) { nextW = 52; nextY--; }
  if (nextW > 52) { nextW = 1; nextY++; }
  return `${nextY}-${nextW.toString().padStart(2, '0')}`;
}

export async function startStreakUpdater() {
  await startConsumer({
    queue: "user.streaks.queue",
    handler: async (payload, headers) => {
      const type = headers["x-event-type"];
      if (type !== "review.created") return;
      
      const userId = payload.authorId;
      if (!userId) return;

      const week = getIsoWeek(new Date());
      const prevWeek = shiftIsoWeek(week, -1);

      const s = await prisma.streak.upsert({
        where:  { userId_kind: { userId, kind: "REVIEWER" } },
        create: { userId, kind: "REVIEWER", currentWeeks: 1, bestWeeks: 1, lastActiveWeek: week },
        update: {}, 
      });

      if (s.lastActiveWeek === week) {
        // Same week — no change
      } else if (s.lastActiveWeek === prevWeek) {
        const c = s.currentWeeks + 1;
        await prisma.streak.update({
          where: { userId_kind: { userId, kind: "REVIEWER" } },
          data: { currentWeeks: c, bestWeeks: Math.max(c, s.bestWeeks), lastActiveWeek: week },
        });
        
        if ([4, 12, 26, 52].includes(c)) {
          await publishEvent("streak.extended", { userId, kind: "REVIEWER", weeks: c });
        }
      } else {
        // Gap — reset
        await prisma.streak.update({
          where: { userId_kind: { userId, kind: "REVIEWER" } },
          data: { currentWeeks: 1, lastActiveWeek: week },
        });
      }
    }
  });
}
