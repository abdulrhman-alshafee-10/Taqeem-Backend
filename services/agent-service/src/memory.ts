import { RedisSaver } from "@langchain/langgraph-checkpoint-redis";
import { createClient } from "redis";

let saver: RedisSaver | null = null;

export async function getCheckpointer() {
  if (saver) return saver;
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  saver = new RedisSaver(client);
  return saver;
}
