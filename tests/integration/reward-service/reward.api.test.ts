import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { startPostgres } from "../../../shared/test-utils/containers.js";
import { app } from "../../../services/reward-service/src/index.js";
import { PrismaClient } from "@prisma/client-reward";
import { execSync } from "child_process";

let pgContainer: any;
let prisma: PrismaClient;

beforeAll(async () => {
  const pg = await startPostgres();
  pgContainer = pg.container;

  process.env.DATABASE_URL = pg.url;
  execSync("npx prisma db push --accept-data-loss", {
    cwd: "services/reward-service",
    env: { ...process.env, DATABASE_URL: pg.url },
  });

  prisma = new PrismaClient({ datasources: { db: { url: pg.url } } });
}, 90_000);

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
  if (pgContainer) await pgContainer.stop();
});

beforeEach(async () => {
  if (prisma) await prisma.$executeRaw`TRUNCATE TABLE "Voucher" CASCADE`;
});

const authHeaders = (userId = "user-123", role = "user") => ({
  "x-user-id":   userId,
  "x-user-role": role,
});

describe("GET /api/rewards/vouchers", () => {
  it("returns user vouchers", async () => {
    // Seed a voucher
    await prisma.voucher.create({
      data: {
        userId: "user-123",
        code: "VOUCHER-XYZ",
        discountAmount: 10,
        expiresAt: new Date(Date.now() + 86400 * 1000)
      }
    });

    const res = await request(app)
      .get("/api/rewards/vouchers")
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.vouchers).toHaveLength(1);
    expect(res.body.vouchers[0].code).toBe("VOUCHER-XYZ");
  });
});
