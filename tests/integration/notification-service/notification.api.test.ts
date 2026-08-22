import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { startRedis } from "../../../shared/test-utils/containers.js";
import { app } from "../../../services/notification-service/src/index.js";
import { redis } from "../../../services/notification-service/src/redis.js";

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

describe("GET /api/notifications", () => {
  it("returns notifications for user", async () => {
    // Seed notification in redis
    await redis.lPush("notifications:user-123", JSON.stringify({
      id: "notif-1",
      type: "badge_earned",
      messageAr: "مبروك",
      messageEn: "Congrats",
      read: false,
      createdAt: new Date().toISOString()
    }));

    const res = await request(app)
      .get("/api/notifications")
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe("notif-1");
  });

  it("fails if unauthorized", async () => {
    const res = await request(app).get("/api/notifications");
    expect(res.status).toBe(401);
  });
});
