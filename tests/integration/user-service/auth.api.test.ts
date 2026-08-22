import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { startPostgres } from "../../../shared/test-utils/containers.js";
import { app } from "../../../services/user-service/src/index.js";
import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

let pgContainer: any;
let prisma: PrismaClient;

beforeAll(async () => {
  const pg = await startPostgres();
  pgContainer = pg.container;

  process.env.DATABASE_URL = pg.url;
  // Run Prisma migrations against the test container
  execSync("npx prisma db push --accept-data-loss", {
    cwd: "services/user-service",
    env: { ...process.env, DATABASE_URL: pg.url },
  });

  prisma = new PrismaClient({ datasources: { db: { url: pg.url } } });
}, 90_000);

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
  if (pgContainer) await pgContainer.stop();
});

beforeEach(async () => {
  if (prisma) await prisma.$executeRaw`TRUNCATE TABLE "User" CASCADE`;
});

describe("POST /api/auth/register", () => {
  it("registers a new user", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "test@example.com", password: "P@ssw0rd!", name: "Test" });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user.email).toBe("test@example.com");
  });

  it("returns 409 on duplicate email", async () => {
    const body = { email: "dup@example.com", password: "P@ssw0rd!", name: "Dup" };
    await request(app).post("/api/auth/register").send(body);
    const res = await request(app).post("/api/auth/register").send(body);
    
    expect(res.status).toBe(409);
  });
});
