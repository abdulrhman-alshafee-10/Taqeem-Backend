import amqp from "amqplib";
import { createClient } from "redis";

const DEDUPE_TTL_SEC = 60 * 60 * 24; // 24 h idempotency window

let redisClient: any = null;

/**
 * Initialise the Redis client for deduplication.
 * Call once at service startup before startConsumer().
 */
export async function initConsumerDedupe() {
  redisClient = createClient({ url: process.env.REDIS_URL || "redis://redis:6379" });
  redisClient.on("error", (e: any) => console.error("redis error", e));
  await redisClient.connect();
}

interface StartConsumerOpts {
  queue: string;
  handler: (msg: any, headers: any) => Promise<void>;
  prefetch?: number;
  bindings?: string[];
}

/**
 * Start a durable consumer.
 */
export async function startConsumer({ queue, handler, prefetch = 20, bindings = [] }: StartConsumerOpts) {
  const conn = await amqp.connect(process.env.RABBITMQ_URL || "amqp://taqeem:taqeem_pw@rabbitmq:5672");
  const ch = await conn.createChannel();
  await ch.prefetch(prefetch);

  await ch.assertExchange("taqeem.events", "topic", { durable: true });
  await ch.assertQueue(queue, { durable: true });

  for (const key of bindings) {
    await ch.bindQueue(queue, "taqeem.events", key);
  }

  ch.consume(queue, async (msg) => {
    if (!msg) return;
    const eventId = msg.properties.messageId;

    try {
      // Idempotency guard
      if (eventId && redisClient) {
        const key = `evt:${queue}:${eventId}`;
        const seen = await redisClient.set(key, "1", { NX: true, EX: DEDUPE_TTL_SEC });
        if (seen === null) { 
          ch.ack(msg); 
          return; 
        } // already processed
      }

      const payload = JSON.parse(msg.content.toString());
      await handler(payload, msg.properties.headers ?? {});
      ch.ack(msg);
    } catch (err) {
      console.error(`[${queue}] handler failed`, err);
      // send to DLX (requeue=false)
      ch.nack(msg, false, false);
    }
  });

  console.log(`consumer listening on ${queue}`);
  return { conn, ch };
}
