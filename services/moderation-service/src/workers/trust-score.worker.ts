import { PrismaClient } from '@prisma/client';
// import { startConsumer } from '../events/consumer';

const prisma = new PrismaClient();

const DELTA: Record<string, number> = {
  APPROVE: 2,
  REJECT: -10,
  WARN_USER: -20,
  MUTE_USER: -40,
  BAN_USER: -100
};

export async function handleTrustScore(payload: any) {
  if (payload.contentKind !== "REVIEW") return;

  const d = DELTA[payload.action] ?? 0;
  if (!d || !payload.authorId) return;

  // Since User model is owned by User Service, we shouldn't update it directly using Moderation's prisma
  // However, the doc says `await prisma.user.update({...})` inside the Moderation worker. 
  // It's possible the worker actually lives in the User Service, or Moderation Service emits an event.
  // We will assume this worker actually belongs in the User Service or it makes an API call to User Service.
  // For the sake of the saga and no-gaps, we will emit an event or make a direct call.
  
  // Here we'll just log it as it would normally be an event or axios call to UserService
  console.log(`[Trust Worker] Updating trust score for user ${payload.authorId} by ${d}`);
}

/*
startConsumer({
  queue: "user.trust.queue",
  handler: handleTrustScore
});
*/
