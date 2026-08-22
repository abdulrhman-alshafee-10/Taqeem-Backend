import OpenAI from "openai";
import { startConsumer } from "@taqeem/shared/events/consumer.js";
import { publishEvent } from "@taqeem/shared/events/publisher.js";
import crypto from "node:crypto";

const openai = new OpenAI(); // requires OPENAI_API_KEY env

const SYS = `
Write a short, factual alt text (≤ 140 characters) describing what is visible in this photo.
Rules:
- Focus on the depicted subject (food, venue, people) — no interpretation.
- Preserve language of caption when possible; default to English if unclear.
- Do NOT include marketing language or emotional adjectives.
- Do NOT identify specific individuals; describe generically ("a person", "diners").
`;

export async function startAltTextWorker() {
  await startConsumer({
    queue: "agent.alttext.queue",
    prefetch: 10,
    handler: async (payload, headers) => {
      if (headers["x-event-type"] !== "media.uploaded") return;
      if (payload.hasUserAltText) return;             // producer set this true if user supplied it
      if (payload.kind !== "image") return;

      try {
        const res = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYS },
            { role: "user", content: [
              { type: "text",      text: `Caption: ${payload.caption ?? ""}. Return only the alt text.` },
              { type: "image_url", image_url: { url: payload.url } },
            ] },
          ],
          max_tokens: 80,
        });
        
        const raw = res.choices[0].message.content?.trim() ?? "";
        const altText = raw.slice(0, 140).replace(/^"|"$/g, "");

        await publishEvent("media.alt_text_generated", {
          id: crypto.randomUUID(),
          mediaId: payload.mediaId,
          source:  payload.source, // "review" | "owner" | "tip"
          altText,
        });
      } catch (err: any) {
        console.error("Failed to generate alt text for media", payload.mediaId, err.message);
      }
    },
  });
}
