import { createClient } from "redis";

export const redis = createClient({ url: process.env.REDIS_URL || "redis://redis:6379" });
redis.on("error", (e: any) => console.error("redis error", e));

export const BUFFER_KEY = "analytics:buffer";
