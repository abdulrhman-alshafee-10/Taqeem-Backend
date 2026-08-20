import { createClient } from "redis";

export const redis = createClient({ url: process.env.REDIS_URL || "redis://redis:6379" });

redis.on("error", (e: any) => console.error("redis error", e));

let isConnected = false;
export async function connectRedis() {
  if (!isConnected) {
    await redis.connect();
    isConnected = true;
  }
}
