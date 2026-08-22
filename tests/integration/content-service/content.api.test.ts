import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { startMongo, startRedis } from "../../../shared/test-utils/containers.js";
import { app } from "../../../services/content-service/src/index.js";
import mongoose from "mongoose";
import { redis } from "../../../services/content-service/src/redis.js";

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
});

describe("GET /api/tips/business/:businessId", () => {
  it("returns paginated tips", async () => {
    const res = await request(app).get("/api/tips/business/biz-1").query({ page: 1, limit: 10 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe("POST /api/checkins", () => {
  it("creates a checkin if authorized", async () => {
    const res = await request(app)
      .post("/api/checkins")
      .set(authHeaders())
      .send({ businessId: "biz-1", location: { lat: 24, lng: 46 } });
    
    expect(res.status).toBe(201);
    expect(res.body.businessId).toBe("biz-1");
  });

  it("fails if no auth headers", async () => {
    const res = await request(app).post("/api/checkins").send({ businessId: "biz-1" });
    expect(res.status).toBe(401);
  });
});
