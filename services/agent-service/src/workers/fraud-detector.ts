import { startConsumer } from "@taqeem/shared/events/consumer.js";
import { publishEvent } from "@taqeem/shared/events/publisher.js";
import axios from "axios";
import crypto from "crypto";
import { smartLLM } from "../llm.js";
import { z } from "zod";

async function fetchReview(reviewId: string) {
  const url = process.env.REVIEW_SERVICE_URL || "http://review-service:4002";
  const { data } = await axios.get(`${url}/internal/reviews/${reviewId}`);
  return data;
}

async function fetchUser(userId: string) {
  const url = process.env.USER_SERVICE_URL || "http://user-service:4000";
  const { data } = await axios.get(`${url}/internal/users/${userId}`);
  return data;
}

async function fetchBusiness(businessId: string) {
  const url = process.env.BUSINESS_SERVICE_URL || "http://business-service:4001";
  const { data } = await axios.get(`${url}/internal/businesses/${businessId}`);
  return data;
}

function heuristicScore(s: any) {
  let score = 0;
  if (s.accountAgeDays < 1)               score += 0.30;
  if (s.isFirstReview && s.ratingExtreme) score += 0.20;
  if (s.burstiness >= 3)                  score += 0.30;
  if (s.ipRepeatCount >= 3)               score += 0.30;
  if (s.similarityToOtherReviewsOfSameBusiness > 0.85) score += 0.35;
  if (s.bodyLength < 30 && s.ratingExtreme) score += 0.10;
  if (s.hasVerification)                  score -= 0.30;
  return Math.max(0, Math.min(1, score));
}

const FakeCheckSchema = z.object({
  looksFake: z.boolean(),
  confidence: z.number().min(0).max(1),
  signals: z.array(z.string().max(80)),
});

async function llmFakeCheck(review: any, biz: any) {
  const SYS = `
You are an expert fraud detection AI for a restaurant review platform.
Review being checked:
Rating: ${review.rating}
Body: ${review.body}
Business: ${biz.name}

Does this look generic, like a template, or blatantly fake?
Return JSON matching the schema.
  `;
  const model = smartLLM().withStructuredOutput(FakeCheckSchema, { name: "fake_check" });
  const result = await model.invoke(SYS);
  return result;
}

export async function startFraudDetector() {
  await startConsumer({
    queue: "moderation.review.queue",
    handler: async (payload: any, headers: any) => {
      const type = headers["x-event-type"];
      if (type !== "review.created") return;

      try {
        const review = await fetchReview(payload.reviewId).catch(() => null);
        if (!review) return;

        const author = await fetchUser(review.authorId).catch(() => ({ createdAt: new Date(), reviewsCount: 1 }));
        const biz    = await fetchBusiness(review.businessId).catch(() => ({ name: "Unknown" }));

        const accountAgeDays = (Date.now() - new Date(author.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        
        const signals = {
          accountAgeDays,
          authorReviewCount: author.reviewsCount,
          burstiness: 1, // Mocked for phase 13
          ipRepeatCount: 1, // Mocked for phase 13
          isFirstReview: author.reviewsCount === 1,
          ratingExtreme: review.rating === 5 || review.rating === 1 ? 1 : 0,
          bodyLength: review.body?.length || 0,
          hasVerification: review.verification?.source !== "none" && !!review.verification?.source,
          similarityToOtherReviewsOfSameBusiness: 0.1 // Mocked for phase 13
        };

        let score = heuristicScore(signals);

        if (score >= 0.35 && score <= 0.75) {
          const llm = await llmFakeCheck(review, biz) as any;
          score = 0.6 * score + 0.4 * (llm.looksFake ? llm.confidence : 1 - llm.confidence);
        }

        await publishEvent("moderation.review_scored", {
          id: crypto.randomUUID(),
          reviewId: review._id || review.id,
          businessId: review.businessId,
          score,
          signals,
        });

      } catch (e: any) {
        console.error("Fraud detector error:", e.message);
      }
    },
  });
  console.log("Fraud detector started on moderation.review.queue");
}
