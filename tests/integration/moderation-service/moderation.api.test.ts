import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { startPostgres } from "../../../shared/test-utils/containers.js";
import { app } from "../../../services/moderation-service/src/index.js";
import { PrismaClient } from "@prisma/client-moderation";
import { execSync } from "child_process";

let pgContainer: any;
let prisma: PrismaClient;

beforeAll(async () => {
  const pg = await startPostgres();
  pgContainer = pg.container;

  process.env.DATABASE_URL = pg.url;
  execSync("npx prisma db push --accept-data-loss", {
    cwd: "services/moderation-service",
    env: { ...process.env, DATABASE_URL: pg.url },
  });

  prisma = new PrismaClient({ datasources: { db: { url: pg.url } } });
}, 90_000);

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
  if (pgContainer) await pgContainer.stop();
});

beforeEach(async () => {
  if (prisma) await prisma.$executeRaw`TRUNCATE TABLE "reports" CASCADE`;
});

const authHeaders = (userId = "mod-123", role = "ADMIN") => ({
  "x-user-id":   userId,
  "x-user-role": role,
});

describe("POST /api/reports", () => {
  it("creates a report successfully", async () => {
    const res = await request(app)
      .post("/api/reports")
      .set(authHeaders("user-123", "user"))
      .send({
        targetId: "post-1",
        targetType: "REVIEW",
        reason: "SPAM",
        description: "Looks like spam"
      });
    
    expect(res.status).toBe(201);
    expect(res.body.data.targetId).toBe("post-1");
    expect(res.body.data.status).toBe("PENDING");
  });
});

describe("GET /api/moderation/queue", () => {
  it("returns pending reports for admins", async () => {
    await prisma.report.create({
      data: {
        reporterId: "user-123",
        targetId: "post-2",
        targetType: "REVIEW",
        reason: "SPAM"
      }
    });

    const res = await request(app)
      .get("/api/moderation/queue")
      .set(authHeaders());
    
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].targetId).toBe("post-2");
  });

  it("fails for non-admins", async () => {
    const res = await request(app)
      .get("/api/moderation/queue")
      .set(authHeaders("user-123", "user"));
    
    expect(res.status).toBe(403);
  });
});
