import { startConsumer } from "@taqeem/shared/events/consumer.js";
import { registry } from "../translators/registry.js";

export async function startConsumers() {
  await startConsumer({
    queue: "notification.events.queue",
    prefetch: 50,
    handler: async (payload: any, headers: any) => {
      const type = headers["x-event-type"];
      if (!type) return;
      const translator = registry[type];
      if (!translator) return; // uninteresting event
      await translator(payload);
    },
  });
  console.log("Notification Consumer started");
}
