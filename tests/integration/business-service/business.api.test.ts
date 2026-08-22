import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { startPostgres } from "../../../shared/test-utils/containers.js";
import { app } from "../../../services/business-service/src/index.js";
import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

let pgContainer: any;
let prisma: PrismaClient;

beforeAll(async () => {
  const pg = await startPostgres();
  pgContainer = pg.container;

  process.env.DATABASE_URL = pg.url;
  // Run Prisma db push against the test container
  execSync("npx prisma db push --accept-data-loss", {
    cwd: "services/business-service",
    env: { ...process.env, DATABASE_URL: pg.url },
  });

  prisma = new PrismaClient({ datasources: { db: { url: pg.url } } });
}, 90_000);

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
  if (pgContainer) await pgContainer.stop();
});

beforeEach(async () => {
  if (prisma) await prisma.$executeRaw`TRUNCATE TABLE "businesses" CASCADE`;
});

const authHeaders = (userId = "user-123", role = "OWNER") => ({
  "x-user-id":   userId,
  "x-user-role": role,
});

describe("GET /api/businesses/:id", () => {
  it("returns 404 for unknown business", async () => {
    const res = await request(app).get("/api/businesses/unknown-id");
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
        category: "restaurant",
        city: "Riyadh",
        lat: 24.0,
        lng: 46.0
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
        category: "restaurant"
      });

    expect(res.status).toBe(401);
  });
});
