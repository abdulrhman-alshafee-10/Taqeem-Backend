import { ch } from "./amqp.js";

const DLQ = process.env.DLQ_QUEUE || "dlq.events.queue";

/**
 * Peek at up to `limit` messages in the DLQ without consuming them.
 */
export async function inspectDLQ(limit = 100) {
  const messages = [];

  for (let i = 0; i < limit; i++) {
    const msg = await ch.get(DLQ, { noAck: false });
    if (!msg) break;

    const death    = msg.properties.headers?.["x-death"]?.[0] ?? {};
    let parsedPayload;
    try {
      parsedPayload = JSON.parse(msg.content.toString());
    } catch {
      parsedPayload = msg.content.toString();
    }

    messages.push({
      messageId:   msg.properties.messageId,
      routingKey:  death.routingKey ?? msg.fields.routingKey,
      queue:       death.queue,
      reason:      death.reason,
      count:       death.count,
      time:        death.time,
      payload:     parsedPayload,
      _raw:        msg,
    });
  }

  // Re-queue them so they don't get lost, since we used get with noAck: false
  // Actually, wait: ch.get with noAck: false leaves them unacked. 
  // We need to nack them with requeue=true so they stay in the queue in the same order.
  for (const m of messages) {
    ch.nack(m._raw, false, true);
  }

  return messages;
}
