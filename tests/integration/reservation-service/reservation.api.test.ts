import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { startPostgres } from "../../../shared/test-utils/containers.js";
import { app } from "../../../services/reservation-service/src/index.js";
import { PrismaClient } from "@prisma/client-reservation";
import { execSync } from "child_process";

let pgContainer: any;
let prisma: PrismaClient;

beforeAll(async () => {
  const pg = await startPostgres();
  pgContainer = pg.container;
  process.env.DATABASE_URL = pg.url;
  
  execSync("npx prisma db push --accept-data-loss", {
    cwd: "services/reservation-service",
    env: { ...process.env, DATABASE_URL: pg.url },
  });

  prisma = new PrismaClient({ datasources: { db: { url: pg.url } } });
}, 90_000);

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
  if (pgContainer) await pgContainer.stop();
});

beforeEach(async () => {
  if (prisma) await prisma.$executeRaw`TRUNCATE TABLE "Reservation" CASCADE`;
});

const authHeaders = (userId = "user-123", role = "user") => ({
  "x-user-id":   userId,
  "x-user-role": role,
});

describe("POST /api/reservations", () => {
  it("fails if unauthorized", async () => {
    const res = await request(app).post("/api/reservations").send({
      businessId: "biz-1",
      partySize: 2,
      reservationTime: new Date().toISOString()
    });
    expect(res.status).toBe(401);
  });

  it("creates a pending reservation when authorized", async () => {
    const res = await request(app)
      .post("/api/reservations")
      .set(authHeaders())
      .send({
        businessId: "biz-1",
        partySize: 4,
        reservationTime: new Date(Date.now() + 86400 * 1000).toISOString()
      });
      
    // Expected 201 Created
    expect(res.status).toBe(201);
    expect(res.body.businessId).toBe("biz-1");
    expect(res.body.partySize).toBe(4);
    expect(res.body.status).toBe("PENDING");
  });
});

describe("GET /api/reservations", () => {
  it("returns user reservations", async () => {
    await prisma.reservation.create({
      data: {
        userId: "user-123",
        businessId: "biz-2",
        partySize: 2,
        reservationTime: new Date(),
        status: "CONFIRMED"
      }
    });

    const res = await request(app)
      .get("/api/reservations")
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].businessId).toBe("biz-2");
    expect(res.body.data[0].status).toBe("CONFIRMED");
  });
});
