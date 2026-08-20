import * as amqp from "amqplib";

let connection: any;
let channel: any;

export async function initPublisher() {
  if (!process.env.RABBITMQ_URL) {
    console.warn("RABBITMQ_URL not set, skipping publisher init.");
    return;
  }
  connection = await amqp.connect(process.env.RABBITMQ_URL);
  channel = await connection.createChannel();
  await channel.assertExchange("taqeem.events", "topic", { durable: true });
}

export async function publishEvent(routingKey: string, payload: any) {
  if (!channel) return;
  channel.publish(
    "taqeem.events",
    routingKey,
    Buffer.from(JSON.stringify(payload)),
    { persistent: true, contentType: "application/json" }
  );
}
