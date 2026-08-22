import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { startRedis } from "../../../shared/test-utils/containers.js";
import { app } from "../../../services/feed-service/src/index.js";
import { redis } from "../../../services/feed-service/src/redis.js";

let redisContainer: any;

beforeAll(async () => {
  const redisCont = await startRedis();
  redisContainer = redisCont.container;
  process.env.REDIS_URL = redisCont.url;
  
  await redis.connect();
}, 60_000);

afterAll(async () => {
  await redis.quit();
  if (redisContainer) await redisContainer.stop();
});

const authHeaders = (userId = "user-123", role = "user") => ({
  "x-user-id":   userId,
  "x-user-role": role,
});

describe("GET /api/feed", () => {
  it("returns paginated feed items for a user", async () => {
    // Seed redis with a feed item
    await redis.zAdd("feed:user-123", { score: Date.now(), value: "post-1" });
    await redis.hSet("feed_item:post-1", {
      type: "review",
      id: "post-1",
      authorId: "user-456",
      timestamp: new Date().toISOString(),
      data: JSON.stringify({ bodyAr: "Great place" })
    });

    const res = await request(app)
      .get("/api/feed")
      .set(authHeaders())
      .query({ page: 1, limit: 10 });
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe("post-1");
  });

  it("fails if no auth headers", async () => {
    const res = await request(app).get("/api/feed");
    expect(res.status).toBe(401);
  });
});
