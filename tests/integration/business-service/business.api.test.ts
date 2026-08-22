import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { startPostgres } from "../../../shared/test-utils/containers.js";
import { PrismaClient } from "@prisma/client";
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

beforeEach(async () => {
  if (prisma) await prisma.$executeRaw`TRUNCATE TABLE "businesses" CASCADE`;
});

const ownerId = crypto.randomUUID();
const authHeaders = (userId = ownerId, role = "OWNER") => ({
  "x-user-id":   userId,
  "x-user-role": role,
});

describe("GET /api/businesses/:id", () => {
  it("returns 404 for unknown business", async () => {
    const res = await request(app).get(`/api/businesses/${crypto.randomUUID()}`);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/businesses", () => {
  it("creates a business if authorized", async () => {
    const res = await request(app)
      .post("/api/businesses")
      .set(authHeaders())
      .send({
        nameAr: "مطعم تجريبي",
        nameEn: "Test Restaurant",
        vertical: "FOOD_DRINK",
        categories: ["restaurant"],
        addressLine1: "King Fahd Rd",
        city: "Riyadh",
        region: "Riyadh",
        country: "SA",
        postalCode: "12345",
        latitude: 24.0,
        longitude: 46.0
      });

    expect(res.status).toBe(201);
    expect(res.body.nameEn).toBe("Test Restaurant");
  });

  it("fails if unauthorized", async () => {
    const res = await request(app)
      .post("/api/businesses")
      .send({
        nameAr: "مطعم تجريبي",
        nameEn: "Test Restaurant",
        vertical: "FOOD_DRINK",
        categories: ["restaurant"],
        addressLine1: "King Fahd Rd",
        city: "Riyadh",
        region: "Riyadh",
        country: "SA",
        postalCode: "12345",
        latitude: 24.0,
        longitude: 46.0
      });

    expect(res.status).toBe(401);
  });
});
