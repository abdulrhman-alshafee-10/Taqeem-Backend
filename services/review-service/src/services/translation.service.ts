import axios from "axios";

// TODO: Replace with Redis client (e.g. ioredis) when REDIS_URL is provided to review-service.
const cache = new Map<string, { body: string, expiry: number }>();

const TTL_MS = 30 * 24 * 3600 * 1000;

export async function translateReview(reviewId: string, to: string, body: string, sourceLang: string) {
  if (sourceLang === to) return { body, cached: true, sourceLang, targetLang: to };

  const key = `translation:${reviewId}:${to}`;
  const cached = cache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return { body: cached.body, cached: true, sourceLang, targetLang: to };
  }

  try {
    const { data } = await axios.post(
      `http://agent-service:4006/internal/translate`,
      { text: body, targetLang: to, sourceLang },
      { timeout: 8000 }
    );
    
    cache.set(key, { body: data.text, expiry: Date.now() + TTL_MS });
    return { body: data.text, cached: false, sourceLang, targetLang: to };
  } catch (e: any) {
    console.error("Translation failed:", e.message);
    return { body, cached: false, sourceLang, targetLang: to, error: "Translation failed" };
  }
}
