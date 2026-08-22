import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { startPostgres } from "../../../shared/test-utils/containers.js";
import { execSync } from "child_process";
import crypto from "crypto";

vi.mock("../../../shared/events/publisher.js", () => ({ initPublisher: vi.fn(), publishEvent: vi.fn() }));
vi.mock("../../../shared/events/consumer.js", () => ({ initConsumer: vi.fn(), startConsumer: vi.fn() }));
vi.mock("../../../services/business-service/src/events/publisher.js", () => ({ initPublisher: vi.fn(), publishEvent: vi.fn() }));
vi.mock("../../../services/business-service/src/events/consumer.js", () => ({ initConsumer: vi.fn() }));
vi.mock("../../../services/business-service/src/workers/business-badge-awarder.js", () => ({ startBadgeConsumers: vi.fn() }));
vi.mock("redis", () => ({ createClient: vi.fn(() => ({ connect: vi.fn().mockResolvedValue(true), on: vi.fn(), get: vi.fn(), set: vi.fn() })) }));

let pgContainer: any;
let prisma: PrismaClient;
let app: any;

beforeAll(async () => {
  const pg = await startPostgres();
  pgContainer = pg.container;
  process.env.DATABASE_URL = pg.url;
  process.env.REDIS_URL = "redis://mock";
  process.env.RABBITMQ_URL = "amqp://mock";
  
  execSync("npx prisma db push --accept-data-loss", {
    cwd: "services/business-service",
    env: { ...process.env, DATABASE_URL: pg.url },
  });

  app = (await import("../../../services/business-service/src/index.js")).app;
  prisma = new PrismaClient({ datasources: { db: { url: pg.url } } });
}, 90_000);

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
  if (pgContainer) await pgContainer.stop();
});

describe("Verticals & Gating API", () => {
  let foodBizId: string;
  let bookBizId: string;
  const ownerId = crypto.randomUUID();

  beforeAll(async () => {
    // Create a food business
    const food = await prisma.business.create({
      data: {
        nameEn: "Test Cafe",
        addressLine1: "123 Main St",
        city: "Cairo",
        region: "Cairo",
        country: "EG",
        postalCode: "12345",
        latitude: 30.0444,
        longitude: 31.2357,
        slug: "test-cafe-123",
        ownerId,
        vertical: "FOOD_DRINK",
        subVertical: "RESTAURANT",
      }
    });
    foodBizId = food.id;

    // Create a non-food business
    const book = await prisma.business.create({
      data: {
        nameEn: "Test Bookstore",
        addressLine1: "123 Main St",
        city: "Cairo",
        region: "Cairo",
        country: "EG",
        postalCode: "12345",
        latitude: 30.0444,
        longitude: 31.2357,
        slug: "test-bookstore-123",
        ownerId,
        vertical: "CULTURE",
        subVertical: "MUSEUM",
      }
    });
    bookBizId = book.id;
  });

  it("allows menu creation for FOOD_DRINK vertical", async () => {
    const res = await request(app)
      .post(`/api/owner/businesses/${foodBizId}/menu`)
      .set("x-user-id", ownerId)
      .set("x-user-role", "OWNER")
      .send({ name: "Lunch Menu", description: "Lunch items" });

    // Ensure it doesn't fail due to feature gating (409)
    expect(res.status).not.toBe(409);
  });

  it("blocks menu creation for CULTURE vertical with 409", async () => {
    const res = await request(app)
      .post(`/api/owner/businesses/${bookBizId}/menu`)
      .set("x-user-id", ownerId)
      .set("x-user-role", "OWNER")
      .send({ name: "Lunch Menu" });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("FEATURE_NOT_APPLICABLE");
    expect(res.body.feature).toBe("menu");
    expect(res.body.vertical).toBe("CULTURE");
  });

  it("blocks menu retrieval for CULTURE vertical with 409", async () => {
    const res = await request(app)
      .get(`/api/businesses/${bookBizId}/menu`);
      
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("FEATURE_NOT_APPLICABLE");
  });
});
