import { startConsumer } from "@taqeem/shared/events/consumer.js";
import { Review } from "../models/review.model.js";

export async function startReviewConsumer() {
  await startConsumer({
    queue: "review.media.queue",
    handler: async (payload: any, headers: any) => {
      const type = headers["x-event-type"];
      if (type === "media.tagged") {
        const { mediaId, tags, altText, reviewId } = payload;
        if (!reviewId) return;

        await Review.updateOne(
          { _id: reviewId, "media.url": { $regex: mediaId } }, // Match by substring in URL as mediaId is random S3 key
          { 
            $set: { 
              hasMedia: true,
              "media.$.tags": tags,
              "media.$.altText": altText
            }
          }
        );
      }
    },
  });
}
