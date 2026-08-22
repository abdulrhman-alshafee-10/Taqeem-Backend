import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireBusinessOwner } from "../ownership.js";
import { prismaMock } from "../../../../../shared/test-utils/prismaMock.js";
import { Request, Response, NextFunction } from "express";

const mockRes = () => {
  const r: any = { status: vi.fn(), json: vi.fn() };
  r.status.mockReturnValue(r);
  return r;
};

const next = vi.fn();

describe("requireBusinessOwner middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls next() if user is the business owner", async () => {
    const req = { 
      params: { id: "biz-1" }, 
      user: { id: "user-1", role: "OWNER" } 
    } as unknown as Request;
    const res = mockRes();

    prismaMock.business.findUnique.mockResolvedValueOnce({ ownerId: "user-1" } as any);

    await requireBusinessOwner(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("returns 403 if user is not the business owner", async () => {
    const req = { 
      params: { businessId: "biz-1" }, // testing alternate param
      user: { id: "user-2", role: "OWNER" } 
    } as unknown as Request;
    const res = mockRes();

    prismaMock.business.findUnique.mockResolvedValueOnce({ ownerId: "user-1" } as any);

    await requireBusinessOwner(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() if user is an ADMIN", async () => {
    const req = { 
      params: { id: "biz-1" }, 
      user: { id: "admin-1", role: "ADMIN" } 
    } as unknown as Request;
    const res = mockRes();

    await requireBusinessOwner(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    // Admin bypasses the DB check
    expect(prismaMock.business.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 if business does not exist", async () => {
    const req = { 
      params: { id: "biz-404" }, 
      user: { id: "user-1", role: "OWNER" } 
    } as unknown as Request;
    const res = mockRes();

    prismaMock.business.findUnique.mockResolvedValueOnce(null);

    await requireBusinessOwner(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
