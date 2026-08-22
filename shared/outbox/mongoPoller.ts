import { publishEvent } from "../events/publisher.js";
import { Model } from "mongoose";
import { createLogger } from "../logger/logger.js";
const logger = createLogger("mongo-poller");
import { withRetry } from "../http/retry.js";

const POLL_INTERVAL_MS = 1_000;
const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 5;

export function startMongoOutboxPoller(serviceName: string, OutboxEventModel: any) {
  const log = logger.child({ component: "outbox-poller", service: serviceName });
  let running = true;

  async function poll() {
    if (!running) return;

    try {
      const events = await OutboxEventModel.find({
        publishedAt: null,
        attempts: { $lt: MAX_ATTEMPTS },
      }).sort({ createdAt: 1 }).limit(BATCH_SIZE);

      for (const event of events) {
        try {
          await withRetry(() => publishEvent(event.routingKey, event.payload), {
            retries: 3,
            minTimeout: 200,
            maxTimeout: 5000,
            onRetry: (err) => log.warn({ err }, "publish retry in poller"),
          });
          
          event.publishedAt = new Date();
          event.attempts += 1;
          await event.save();
          log.debug({ routingKey: event.routingKey, eventId: event.id }, "event published");
        } catch (err) {
          log.warn({ err, eventId: event.id }, "publish failed — will retry later");
          event.attempts += 1;
          await event.save();
        }
      }
    } catch (err) {
      log.error({ err }, "mongo outbox poll cycle failed");
    }

    setTimeout(poll, POLL_INTERVAL_MS);
  }

  poll();
  log.info("mongo outbox poller started");
  
  return { stop: () => { running = false; } };
}
