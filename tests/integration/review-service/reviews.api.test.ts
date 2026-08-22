import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { startMongo, startRedis } from "../../../shared/test-utils/containers.js";
import { app } from "../../../services/review-service/src/index.js";
import mongoose from "mongoose";
import { redis } from "../../../services/review-service/src/redis.js";

let mongoContainer: any;
let redisContainer: any;

beforeAll(async () => {
  const mongo = await startMongo();
  const redisCont = await startRedis();

  mongoContainer = mongo.container;
  redisContainer = redisCont.container;

  process.env.MONGO_URI = mongo.url + "/taqeem_test";
  process.env.REDIS_URL = redisCont.url;

  await mongoose.connect(process.env.MONGO_URI);
  await redis.connect();
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await redis.quit();
  if (mongoContainer) await mongoContainer.stop();
  if (redisContainer) await redisContainer.stop();
});

const authHeaders = (userId = "user-123", role = "user") => ({
  "x-user-id":   userId,
  "x-user-role": role,
  "x-request-id": "req-abc",
});

describe("POST /api/reviews/business/:businessId", () => {
  it("returns 400 when rating is missing", async () => {
    const res = await request(app)
      .post("/api/reviews/business/biz-001")
      .set(authHeaders())
      .send({ bodyAr: "جيد" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/validation failed/i);
  });

  it("returns 401 when no auth headers are present", async () => {
    const res = await request(app)
      .post("/api/reviews/business/biz-001")
      .send({ rating: 3, bodyAr: "عادي" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/reviews/business/:businessId", () => {
  it("returns paginated reviews", async () => {
    const res = await request(app)
      .get("/api/reviews/business/biz-001")
      .set(authHeaders())
      .query({ page: 1, limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
