import { startConsumer } from "@taqeem/shared/events/consumer.js";
import { rebuildBusinessIndex } from "../rag/business-index.js";

// Basic debouncing (1 rebuild per business per 5 minutes)
const lastRebuilds = new Map<string, number>();

export async function startRagIndexer() {
  await startConsumer({
    queue: "agent.rag.queue",
    prefetch: 5,
    handler: async (payload: any, headers: any) => {
      const type = headers["x-event-type"];
      if (![
        "business.updated",
        "menu.updated",
        "owner.post_published",
        "question.asked",
        "question.answered",
        "review.created",
        "review.deleted"
      ].includes(type)) {
        return;
      }

      const businessId = payload.businessId || payload.business?.id;
      if (!businessId) return;

      const now = Date.now();
      const last = lastRebuilds.get(businessId) || 0;
      // If rebuilt in last 5 minutes, skip
      if (now - last < 5 * 60 * 1000) {
        return;
      }

      lastRebuilds.set(businessId, now);
      
      try {
        await rebuildBusinessIndex(businessId);
        console.log(`Rebuilt RAG index for ${businessId}`);
      } catch (err) {
        lastRebuilds.delete(businessId); // allow retry
        throw err;
      }
    },
  });
  console.log("RAG indexer worker started");
}
