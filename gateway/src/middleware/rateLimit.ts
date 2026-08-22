import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { Request } from "express";
import { redis } from "@taqeem/shared/lib/redis.js";

export const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,                // 300 req / min / IP
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests" },
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.sendCommand(args),
    prefix: "rl:global:",
  }),
});

export const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,                 // login/register brute-force guard
  keyGenerator: (req: Request) => `${req.ip}:${req.path}`,
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.sendCommand(args),
    prefix: "rl:auth:",
  }),
});
