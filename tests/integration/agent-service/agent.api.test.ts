import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../../services/agent-service/src/index.js";
import { askBusiness } from "../../../services/agent-service/src/rag/ask-business.js";

vi.mock("../../../services/agent-service/src/rag/ask-business.js", () => ({
  askBusiness: vi.fn(),
}));

describe("POST /api/agent/business/:businessId/ask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 if question is missing", async () => {
    const res = await request(app).post("/api/agent/business/biz-1/ask").send({});
    expect(res.status).toBe(400);
  });

  it("returns answer from askBusiness", async () => {
    vi.mocked(askBusiness).mockResolvedValueOnce({
      answer: "Mocked AI answer.",
      citations: [],
    });

    const res = await request(app)
      .post("/api/agent/business/biz-1/ask")
      .send({ question: "Is this place good?" });

    expect(res.status).toBe(200);
    expect(res.body.answer).toBe("Mocked AI answer.");
    expect(askBusiness).toHaveBeenCalledWith("biz-1", "Is this place good?");
  });
});
