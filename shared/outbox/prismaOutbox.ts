import { randomUUID } from "crypto";

/**
 * Write a domain event to the outbox within an existing Prisma transaction.
 * @param tx - Prisma interactive transaction client
 * @param routingKey - RabbitMQ routing key
 * @param payload - The payload of the event
 */
export async function writeOutboxEvent(tx: any, routingKey: string, payload: any) {
  return tx.outboxEvent.create({
    data: {
      id:         payload.id ?? randomUUID(),
      routingKey,
      payload,
    },
  });
}
