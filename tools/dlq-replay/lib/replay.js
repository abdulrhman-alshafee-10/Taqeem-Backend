import { ch } from "./amqp.js";
import { writeAuditLog } from "./audit.js";

const EXCHANGE = process.env.TARGET_EXCHANGE || "taqeem.events";
const DLQ      = process.env.DLQ_QUEUE || "dlq.events.queue";

export async function replayMessage(message, dryRun = false) {
  const { routingKey, payload, messageId, _raw } = message;

  if (dryRun) {
    console.log(`[DRY-RUN] would replay ${routingKey} (${messageId})`);
    return;
  }

  await new Promise((resolve, reject) => {
    ch.publish(
      EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      {
        contentType: "application/json",
        persistent:  true,
        messageId,
        headers:     {
          "x-replayed-at":  new Date().toISOString(),
          "x-replay-count": ((_raw.properties.headers?.["x-replay-count"] ?? 0) + 1),
        },
      },
      (err) => err ? reject(err) : resolve()
    );
  });

  // Acknowledge from DLQ
  // We cannot ack if we already nacked it in inspectDLQ.
  // Wait, in a real tool, inspect and replay are separate commands.
  // If we run replay, we must get() and ack() immediately.
  const msg = await ch.get(DLQ, { noAck: false });
  if (msg) {
    ch.ack(msg);
  }

  await writeAuditLog({
    action:     "replay",
    routingKey,
    messageId,
    replayedAt: new Date().toISOString(),
    operator:   process.env.USER ?? "unknown",
  });

  console.log(`✓ Replayed ${routingKey} (${messageId})`);
}

export async function replayBatch(messages, dryRun = false) {
  for (const msg of messages) {
    await replayMessage(msg, dryRun);
  }
}
