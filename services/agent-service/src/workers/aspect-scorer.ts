import { z } from "zod";
import axios from "axios";
import crypto from "crypto";
import { startConsumer } from "@taqeem/shared/events/consumer.js";
import { publishEvent } from "../events/publisher.js";
import { fastLLM } from "../llm.js";

const ASPECTS = z.object({
  food:        z.number().min(0).max(5).optional(),
  service:     z.number().min(0).max(5).optional(),
  ambience:    z.number().min(0).max(5).optional(),
  value:       z.number().min(0).max(5).optional(),
  cleanliness: z.number().min(0).max(5).optional(),
  overall:     z.number().min(0).max(5),
  confidence:  z.number().min(0).max(1),
});

const SYS = `
Score this restaurant/venue review on aspects. Rules:
- Only score aspects the reviewer clearly discussed. Omit aspects they didn't mention.
- Score 1..5 in half-points if the text supports it.
- confidence is 0..1 — lower for very short reviews.
- Do NOT invent scores. Missing keys are better than made-up ones.
`;

export async function scoreReviewAspects(review: any) {
  const model = fastLLM().withStructuredOutput(ASPECTS, { name: "aspects" });
  const res = await model.invoke([
    { role: "system", content: SYS },
    { role: "user",   content: [
      `Rating: ${review.rating}/5`,
      `Language: ${review.language || "en"}`,
      `Title: ${review.title ?? ""}`,
      `Body: ${review.body}`,
    ].join("\n") },
  ]);
  return res;
}

export async function startAspectScorer() {
  await startConsumer({
    queue: "agent.aspects.queue",
    prefetch: 10,
    handler: async (payload: any, headers: any) => {
      const type = headers["x-event-type"];
      if (!["review.created","review.updated"].includes(type)) return;
      if (payload.aspects) return; // already structured

      const reviewServiceUrl = process.env.REVIEW_SERVICE_URL || "http://review-service:4002";
      const review = await axios.get(
        `${reviewServiceUrl}/internal/reviews/${payload.reviewId}`
      ).then(r => r.data).catch(() => null);

      if (!review || review.body.length < 20) return;

      const aspects = await scoreReviewAspects(review);
      if (aspects.confidence < 0.5) return;

      await publishEvent("review.aspect_scored", {
        id: crypto.randomUUID(),
        reviewId: payload.reviewId,
        businessId: payload.businessId || review.businessId,
        aspects,
        source: "llm",
      });
    },
  });
  console.log("Aspect scorer worker started");
}
