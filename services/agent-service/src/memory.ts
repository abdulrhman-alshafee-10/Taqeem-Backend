import { RedisSaver } from "@langchain/langgraph-checkpoint-redis";
import { createClient } from "redis";

let saver: RedisSaver | null = null;
let redisClient: ReturnType<typeof createClient> | null = null;

export async function getRedisClient() {
  if (redisClient) return redisClient;
  redisClient = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
  await redisClient.connect();
  return redisClient;
}

export async function getCheckpointer() {
  if (saver) return saver;
  const client = await getRedisClient();
  saver = new RedisSaver(client);
  return saver;
}
