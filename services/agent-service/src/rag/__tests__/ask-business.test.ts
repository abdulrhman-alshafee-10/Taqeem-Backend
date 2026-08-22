import { describe, it, expect, vi, beforeEach } from "vitest";
import { askBusiness } from "../ask-business.js";
import { RedisVectorStore } from "@langchain/redis";
import { smartLLM } from "../../llm.js";

vi.mock("@langchain/redis", () => ({
  RedisVectorStore: vi.fn().mockImplementation(() => ({
    similaritySearchWithScore: vi.fn(),
  })),
}));

vi.mock("../../llm.js", () => ({
  smartLLM: vi.fn(),
}));

vi.mock("../../memory.js", () => ({
  getRedisClient: vi.fn().mockResolvedValue({}),
}));

describe("askBusiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns fallback answer if no vector store hits or store errors", async () => {
    // Mock the instance method to throw
    vi.mocked(RedisVectorStore).mockImplementationOnce(() => ({
      similaritySearchWithScore: vi.fn().mockRejectedValue(new Error("No index")),
    }) as any);

    const res = await askBusiness("biz-1", "Do they have wifi?");
    
    expect(res.answer).toMatch(/enough information/i);
    expect(res.citations).toHaveLength(0);
  });

  it("queries LLM with context if hits are found", async () => {
    const mockSearch = vi.fn().mockResolvedValue([
      [
        { pageContent: "Yes, free wifi is available.", metadata: { kind: "review", reviewId: "rev-1" } },
        0.95
      ]
    ]);
    vi.mocked(RedisVectorStore).mockImplementationOnce(() => ({
      similaritySearchWithScore: mockSearch,
    }) as any);

    const mockInvoke = vi.fn().mockResolvedValue({ content: "Yes, they have free wifi." });
    vi.mocked(smartLLM).mockReturnValue({ invoke: mockInvoke } as any);

    const res = await askBusiness("biz-1", "Do they have wifi?");

    expect(mockSearch).toHaveBeenCalledWith("Do they have wifi?", 6);
    expect(mockInvoke).toHaveBeenCalled();
    const promptCall = mockInvoke.mock.calls[0][0];
    expect(promptCall[1].content).toContain("Yes, free wifi is available.");
    
    expect(res.answer).toBe("Yes, they have free wifi.");
    expect(res.citations[0].kind).toBe("review");
    expect(res.citations[0].ref).toBe("rev-1");
  });
});
