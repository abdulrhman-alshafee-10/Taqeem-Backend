import rateLimit from "express-rate-limit";
import { Request } from "express";

export const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,                // 300 req / min / IP
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests" },
});

export const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,                 // login/register brute-force guard
  keyGenerator: (req: Request) => `${req.ip}:${req.path}`,
});
