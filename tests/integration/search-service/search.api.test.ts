import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../../services/search-service/src/index.js";
import { client } from "../../../services/search-service/src/es.js";

vi.mock("../../../services/search-service/src/es.js", () => ({
  client: {
    search: vi.fn(),
  },
}));

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 if validation fails", async () => {
    const res = await request(app).get("/api/search").query({ page: "invalid" });
    expect(res.status).toBe(400);
  });

  it("calls Elasticsearch and returns hits", async () => {
    vi.mocked(client.search).mockResolvedValueOnce({
      hits: {
        total: { value: 1 },
        hits: [{ _source: { nameEn: "Test Biz", avgRating: 4 }, _score: 1.0 }],
      },
      aggregations: {},
    } as any);

    const res = await request(app).get("/api/search").query({ q: "pizza" });

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].nameEn).toBe("Test Biz");
    expect(client.search).toHaveBeenCalledOnce();
  });
});
