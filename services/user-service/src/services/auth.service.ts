import { redis } from "@taqeem/shared/lib/redis.js";

const LOCKOUT_THRESHOLDS = [
  { attempts: 5,  lockMinutes: 5   },
  { attempts: 10, lockMinutes: 30  },
  { attempts: 20, lockMinutes: 720 },   // 12 h
];

export async function recordFailedLogin(email: string) {
  const key      = `login:fail:${email}`;
  const attempts = await redis.incr(key);
  await redis.expire(key, 24 * 60 * 60);   // reset counter after 24 h

  // Use reverse() to find the largest matching threshold, wait, array is ordered, 
  // so we can use findLast, but since TS target might not support findLast natively depending on config,
  // we can iterate backwards.
  let lockMinutes = 0;
  for (let i = LOCKOUT_THRESHOLDS.length - 1; i >= 0; i--) {
    if (attempts >= LOCKOUT_THRESHOLDS[i].attempts) {
      lockMinutes = LOCKOUT_THRESHOLDS[i].lockMinutes;
      break;
    }
  }

  if (lockMinutes > 0) {
    const lockKey = `login:locked:${email}`;
    await redis.set(lockKey, "1", { EX: lockMinutes * 60 });
    const err = new Error("Account temporarily locked");
    (err as any).status = 429;
    (err as any).lockMinutes = lockMinutes;
    throw err;
  }
}

export async function clearFailedLogins(email: string) {
  await redis.del(`login:fail:${email}`);
  await redis.del(`login:locked:${email}`);
}

export async function isLocked(email: string) {
  return (await redis.exists(`login:locked:${email}`)) === 1;
}
