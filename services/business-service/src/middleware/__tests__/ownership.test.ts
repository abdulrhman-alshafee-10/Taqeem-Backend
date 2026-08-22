import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireBusinessOwner } from "../ownership.js";
import { Request, Response, NextFunction } from "express";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    business: { findUnique: vi.fn() },
  },
}));
vi.mock("@prisma/client", () => ({ PrismaClient: vi.fn(() => prismaMock) }));

const mockRes = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const next = vi.fn();

function createReq(userId: string, userRole: string, businessId = "biz-1") {
  const headers: Record<string, string> = {
    "x-user-id": userId,
    "x-user-role": userRole
  };
  return {
    params: { id: businessId, businessId: businessId },
    header: (name: string) => headers[name.toLowerCase()]
  } as unknown as Request;
}

describe("requireBusinessOwner middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls next() if user is the business owner", async () => {
    const req = createReq("user-1", "OWNER", "biz-1");
    const res = mockRes();
    prismaMock.business.findUnique.mockResolvedValueOnce({ ownerId: "user-1" } as any);

    await requireBusinessOwner(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.business).toBeDefined();
  });

  it("returns 403 if user is not the business owner", async () => {
    const req = createReq("user-2", "USER", "biz-1");
    const res = mockRes();
    prismaMock.business.findUnique.mockResolvedValueOnce({ ownerId: "user-1" } as any);

    await requireBusinessOwner(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() if user is an ADMIN", async () => {
    const req = createReq("user-3", "ADMIN", "biz-1");
    const res = mockRes();
    prismaMock.business.findUnique.mockResolvedValueOnce({ ownerId: "user-1" } as any);

    await requireBusinessOwner(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("returns 404 if business does not exist", async () => {
    const req = createReq("user-1", "OWNER", "biz-1");
    const res = mockRes();
    prismaMock.business.findUnique.mockResolvedValueOnce(null);

    await requireBusinessOwner(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });
});
