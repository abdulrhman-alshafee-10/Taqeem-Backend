import { Request, Response, NextFunction } from "express";
import { redis } from "@taqeem/shared/lib/redis.js";

export async function checkTokenBlocklist(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.jti) {
    return next();
  }

  try {
    const blocked = await redis.exists(`blocklist:jti:${req.user.jti}`);
    if (blocked) {
      return res.status(401).json({ error: "Token has been revoked" });
    }
  } catch (err) {
    console.error("Redis blocklist check failed", err);
  }

  next();
}
