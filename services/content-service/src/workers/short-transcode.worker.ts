import { startConsumer } from "@taqeem/shared/events/consumer.js";
import { publishEvent } from "@taqeem/shared/events/publisher.js";
import { Short } from "../models/short.model.js";
import crypto from "crypto";

export async function startShortTranscoder() {
  await startConsumer({
    queue: "content.short.transcode.queue",
    bindings: ["short.uploaded"],
    prefetch: 2,
    handler: async (payload, headers) => {
      if (headers["x-event-type"] !== "short.uploaded") return;
      
      try {
        const { shortId, businessId } = payload;
        
        // Mock transcoding delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const videoUrl = `http://localhost:9000/taqeem-content/shorts/${shortId}/index.m3u8`;
        const thumbUrl = `http://localhost:9000/taqeem-content/shorts/${shortId}/thumb.jpg`;
        const durationSec = Math.floor(Math.random() * 45) + 10;
        
        await Short.updateOne({ _id: shortId }, {
          status: "ready", thumbUrl, videoUrl, durationSec,
        });
        
        await publishEvent("short.ready", {
          id: crypto.randomUUID(),
          shortId, businessId, videoUrl, thumbUrl, durationSec,
        });
      } catch (e) {
        await Short.updateOne({ _id: payload.shortId }, { status: "failed" });
        console.error("Transcode failed", e);
      }
    },
  });
}
