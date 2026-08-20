import { startConsumer } from "@taqeem/shared/events/consumer.js";
import { publishEvent } from "../events/publisher.js";
import OpenAI from "openai";

const openai = new OpenAI();

export async function tagImage(url: string): Promise<string[]> {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Return 3–8 concise lowercase tags describing food/venue in this image as a JSON array named 'tags'. Also optionally provide an 'altText' field." },
        { role: "user",   content: [{ type: "image_url", image_url: { url } }] },
      ],
      response_format: { type: "json_object" },
    });
    
    if (res.choices[0].message.content) {
      const parsed = JSON.parse(res.choices[0].message.content);
      return parsed.tags ?? [];
    }
    return [];
  } catch (e) {
    console.error("Failed to tag image:", e);
    return [];
  }
}

export async function startMediaTagger() {
  await startConsumer({
    queue: "agent.media.queue",
    handler: async (payload: any, headers: any) => {
      const type = headers["x-event-type"];
      if (type !== "media.uploaded") return;
      
      const { mediaId, url, kind, reviewId } = payload;
      
      let tags: string[] = [];
      if (kind === "image") {
        tags = await tagImage(url);
      }
      
      await publishEvent("media.tagged", {
        mediaId,
        tags,
        altText: tags.join(", "), // fallback alt text
        reviewId
      });
    },
  });
}
