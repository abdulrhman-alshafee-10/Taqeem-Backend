import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { publishEvent } from '../events/publisher';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Runs hourly to escalate priorities and alert admins
cron.schedule('0 * * * *', async () => {
  console.log('[SLA Escalator] Running hourly SLA check...');

  try {
    // Escalate 72-hour SLAs (Priority < 30)
    const overdueLow = await escalate(30, 72, 20);
    // Escalate 24-hour SLAs (Priority 30-59)
    const overdueMed = await escalate(60, 24, 20);
    // Escalate 6-hour SLAs (Priority 60-89)
    const overdueHigh = await escalate(90, 6, 20);
    // Escalate 1-hour SLAs (Priority >= 90)
    const overdueCrit = await escalate(999, 1, 20); // 999 as upper bound to match >= 90

    // Also auto-publish ambiguous reviews pending > 48h
    await autoPublishReviews();
  } catch (err) {
    console.error('[SLA Escalator] Failed:', err);
  }
});

async function escalate(maxPriority: number, hours: number, bump: number) {
  const minPriority = maxPriority === 30 ? 0 : 
                      maxPriority === 60 ? 30 :
                      maxPriority === 90 ? 60 : 90;

  const threshold = new Date(Date.now() - hours * 60 * 60 * 1000);

  // In Prisma, we have to fetch and update, or use $executeRaw
  const result = await prisma.$executeRaw`
    UPDATE "QueueEntry"
    SET priority = priority + ${bump}, status = 'PENDING'
    WHERE status = 'PENDING'
      AND priority >= ${minPriority} AND priority < ${maxPriority}
      AND "createdAt" < ${threshold}
  `;

  return result;
}

async function autoPublishReviews() {
  const threshold = new Date(Date.now() - 48 * 60 * 60 * 1000);
  
  const autoApproved = await prisma.$queryRaw<any[]>`
    UPDATE "QueueEntry"
    SET status = 'AUTO_APPROVED', "updatedAt" = NOW()
    WHERE "contentKind" = 'REVIEW'
      AND status = 'PENDING'
      AND "ai_score" < 0.85
      AND "createdAt" < ${threshold}
    RETURNING id, "content_id", "author_id"
  `;

  for (const entry of autoApproved) {
    await publishEvent("moderation.decided", {
      id: crypto.randomUUID(),
      entryId: entry.id,
      contentKind: 'REVIEW',
      contentId: entry.content_id,
      authorId: entry.author_id,
      action: 'APPROVE',
      note: 'auto_timeout',
    });
  }
}
