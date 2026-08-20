import { initConsumerDedupe, startConsumer } from "@taqeem/shared/events/consumer.js";
import { onBusinessCreated, onBusinessUpdated, onBusinessDeleted } from "./projections/business.projection.js";
import { onReviewCreated, onReviewUpdated, onReviewDeleted } from "./projections/review.projection.js";
import { onMenuItemCreated, onMenuItemUnavailable } from "./menu.consumer.js";

const routes: Record<string, Function> = {
  "business.created": onBusinessCreated,
  "business.updated": onBusinessUpdated,
  "business.deleted": onBusinessDeleted,
  "review.created":   onReviewCreated,
  "review.updated":   onReviewUpdated,
  "review.deleted":   onReviewDeleted,
  "menu.item_created": onMenuItemCreated,
  "menu.item_updated": onMenuItemCreated, // Reuse same logic for updates
  "menu.item_unavailable": onMenuItemUnavailable,
};

export async function startConsumers() {
  await initConsumerDedupe();
  await startConsumer({
    queue: "search.events.queue",
    prefetch: 20,
    bindings: [
      "business.created", "business.updated", "business.deleted",
      "review.created", "review.updated", "review.deleted",
      "menu.item_created", "menu.item_updated", "menu.item_unavailable"
    ],
    handler: async (payload: any, headers: any) => {
      const type = headers["x-event-type"];
      const fn = routes[type];
      if (!fn) return; // unknown — ignore
      await fn(payload);
    },
  });
}
