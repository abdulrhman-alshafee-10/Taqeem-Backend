import { startConsumer } from "@taqeem/shared/events/consumer.js";
import { GalleryItem } from "../models/gallery.model.js";

export async function startContentConsumers() {
  await startConsumer({
    queue: "content.gallery.queue",
    bindings: ["media.tagged", "short.ready"],
    handler: async (payload, headers) => {
      const type = headers["x-event-type"];

      if (type === "media.tagged") {
        await GalleryItem.findOneAndUpdate(
          { url: payload.url },
          {
            businessId: payload.businessId,
            source: "review",
            refId: payload.reviewId,
            url: payload.url,
            authorId: payload.authorId,
            score: 0.5
          },
          { upsert: true, new: true }
        );
      } else if (type === "short.ready") {
        await GalleryItem.findOneAndUpdate(
          { url: payload.thumbUrl },
          {
            businessId: payload.businessId,
            source: "short",
            refId: payload.shortId,
            url: payload.thumbUrl,
            score: 0.8
          },
          { upsert: true, new: true }
        );
      }
    }
  });
}
