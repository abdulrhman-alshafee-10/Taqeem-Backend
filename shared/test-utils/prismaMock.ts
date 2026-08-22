import { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { vi } from "vitest";

export const prismaMock = mockDeep<PrismaClient>();

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: prismaMock,
}));
