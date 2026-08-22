import { startConsumer } from "@taqeem/shared/events/consumer.js";
import { Review } from "../models/review.model.js";

export async function startAltTextConsumer() {
  await startConsumer({
    queue: "review.alttext.queue",
    handler: async (payload, headers) => {
      if (headers["x-event-type"] !== "media.alt_text_generated") return;
      if (payload.source !== "review") return;

      const { mediaId, altText } = payload;
      
      await Review.updateOne(
        { "media.id": mediaId },
        { $set: { "media.$.altTextGenerated": altText } }
      );
    }
  });
}
