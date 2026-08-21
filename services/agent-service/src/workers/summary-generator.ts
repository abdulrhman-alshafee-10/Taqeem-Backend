import { z } from "zod";
import axios from "axios";
import { startConsumer } from "@taqeem/shared/events/consumer.js";
import { smartLLM } from "../llm.js";

const SummarySchema = z.object({
  headlineEn: z.string().max(200),
  headlineAr: z.string().max(220),
  pros: z.array(z.string().max(120)).max(4),
  cons: z.array(z.string().max(120)).max(4),
  representativeQuotes: z.array(z.object({
    reviewId: z.string(),
    text:     z.string().max(220),
  })).max(3),
  reviewsAnalyzedCount: z.number().int(),
  updatedAt: z.string(),
});

const SYS = `
Summarize the last 50 reviews of a business for other users. Rules:
- Neutral, factual tone. No marketing language.
- pros/cons must be specific — refer to items, aspects, moments — never generic ("nice place").
- Quotes are verbatim (no paraphrase). Return the reviewId beside each quote.
- Language: produce both English and Arabic headlines.
- If reviews contradict each other, prefer "Some visitors say X, others report Y".
`;

export async function startSummaryGenerator() {
  await startConsumer({
    queue: "agent.summary.queue",
    prefetch: 5,
    handler: async (payload: any, headers: any) => {
      if (headers["x-event-type"] !== "business.summary_requested") return;
      const { businessId } = payload;
      
      const reviewServiceUrl = process.env.REVIEW_SERVICE_URL || "http://review-service:4002";
      const reviews = await axios.get(
        `${reviewServiceUrl}/internal/businesses/${businessId}/recent?limit=50`
      ).then(r => r.data.items).catch(() => []);
      
      if (!reviews || reviews.length < 5) return; // Wait for more reviews

      const promptContext = reviews.map((r: any) => 
        `ID: ${r._id} | Rating: ${r.rating} | Body: ${r.body}`
      ).join("\n---\n");

      const model = smartLLM().withStructuredOutput(SummarySchema, { name: "business_summary" });
      const out = await model.invoke([
        { role: "system", content: SYS },
        { role: "user",   content: `Reviews for business:\n${promptContext}` }
      ]);
      
      out.reviewsAnalyzedCount = reviews.length;
      out.updatedAt = new Date().toISOString();

      // Upsert summary to business-service
      const businessServiceUrl = process.env.BUSINESS_SERVICE_URL || "http://business-service:4001";
      await axios.post(
        `${businessServiceUrl}/internal/businesses/${businessId}/summary`,
        { data: out, reviewsUpTo: reviews[0].createdAt } // reviews sorted desc by createdAt
      );
    },
  });
  console.log("Summary generator worker started");
}
