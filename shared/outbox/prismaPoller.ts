import { publishEvent } from "../events/publisher.js";
import { logger } from "../logger/logger.js";
import { withRetry } from "../http/retry.js";

const POLL_INTERVAL_MS = 1_000;
const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 5;

/**
 * Start the outbox poller for a Prisma-backed service.
 * @param prisma - PrismaClient instance
 * @param serviceName - Name of the service
 */
export function startPrismaOutboxPoller(prisma: any, serviceName: string) {
  const log = logger.child({ component: "outbox-poller", service: serviceName });
  let running = true;

  async function poll() {
    if (!running) return;

    try {
      const events = await prisma.outboxEvent.findMany({
        where: { publishedAt: null, attempts: { lt: MAX_ATTEMPTS } },
        orderBy: { createdAt: "asc" },
        take: BATCH_SIZE,
      });

      for (const event of events) {
        try {
          await withRetry(() => publishEvent(event.routingKey, event.payload), {
            retries: 3,
            minTimeout: 200,
            maxTimeout: 5000,
            onRetry: (err) => log.warn({ err }, "publish retry in poller"),
          });

          await prisma.outboxEvent.update({
            where: { id: event.id },
            data: { publishedAt: new Date(), attempts: { increment: 1 } },
          });
          log.debug({ routingKey: event.routingKey, eventId: event.id }, "event published");
        } catch (err) {
          log.warn({ err, eventId: event.id, attempt: event.attempts + 1 }, "publish failed — will retry later");
          await prisma.outboxEvent.update({
            where: { id: event.id },
            data: { attempts: { increment: 1 } },
          });
        }
      }
    } catch (err) {
      log.error({ err }, "outbox poll cycle failed");
    }

    setTimeout(poll, POLL_INTERVAL_MS);
  }

  poll();
  log.info("outbox poller started");

  return {
    stop: () => { running = false; },
  };
}
