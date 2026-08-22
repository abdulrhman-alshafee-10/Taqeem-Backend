import { describe, it, expect, vi } from "vitest";
import { computeVerification } from "../verification.service.js";
import axios from "axios";

vi.mock("axios");

describe("computeVerification", () => {
  it("returns none if no reference ids are provided", async () => {
    const res = await computeVerification({ authorId: "user-1", businessId: "biz-1" });
    expect(res).toEqual({ source: "none", weight: 0 });
  });

  it("verifies via reservation if valid", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: { userId: "user-1", businessId: "biz-1", status: "COMPLETED" }
    });

    const res = await computeVerification({ 
      authorId: "user-1", businessId: "biz-1", reservationId: "res-1" 
    });

    expect(res).toMatchObject({ source: "reservation", refId: "res-1", weight: 2 });
    expect(res.verifiedAt).toBeInstanceOf(Date);
  });

  it("falls back to none if reservation verification fails", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: { userId: "user-2", businessId: "biz-1", status: "COMPLETED" } // wrong user
    });

    const res = await computeVerification({ 
      authorId: "user-1", businessId: "biz-1", reservationId: "res-1" 
    });

    expect(res).toEqual({ source: "none", weight: 0 });
  });
});
