import amqp from "amqplib";

const EXCHANGE = "taqeem.events";
let channel: any = null;
let connection: any = null;

export async function initPublisher() {
  const url = process.env.RABBITMQ_URL || "amqp://taqeem:taqeem_pw@rabbitmq:5672";
  connection = await amqp.connect(url);
  connection.on("error", (e: any) => console.error("amqp connection error", e));
  connection.on("close", () => setTimeout(initPublisher, 2000));

  channel = await connection.createConfirmChannel();
  await channel.assertExchange(EXCHANGE, "topic", { durable: true });
  console.log("publisher ready");
}

export function publishEvent(routingKey: string, payload: any, opts: any = {}): Promise<void> {
  if (!channel) throw new Error("publisher not initialized");
  const buf = Buffer.from(JSON.stringify(payload));

  return new Promise((resolve, reject) => {
    channel!.publish(EXCHANGE, routingKey, buf, {
      contentType: "application/json",
      persistent: true,
      messageId: payload.id,
      timestamp: Date.now(),
      headers: {
        "x-source": opts.source ?? process.env.SERVICE_NAME ?? "unknown",
        "x-schema-version": opts.version ?? "1",
        "x-event-type": routingKey, // Embedding event type as a standard
      },
    }, (err: any) => err ? reject(err) : resolve());
  });
}

export async function closePublisher() {
  await channel?.close();
  await connection?.close();
}
