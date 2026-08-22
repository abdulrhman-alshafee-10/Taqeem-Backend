import amqp from "amqplib";

let conn, ch;

export async function connect() {
  conn = await amqp.connect(process.env.RABBITMQ_URL || "amqp://taqeem:taqeem_pw@localhost:5672");
  ch   = await conn.createChannel();
  return ch;
}

export async function close() {
  await ch?.close();
  await conn?.close();
}

export { ch };
