import { RedisVectorStore } from "@langchain/redis";
import { OpenAIEmbeddings } from "@langchain/openai";
import { smartLLM } from "../llm.js";
import { getRedisClient } from "../memory.js";

const embeddings = new OpenAIEmbeddings({ model: "text-embedding-3-small" });

export async function askBusiness(businessId: string, question: string) {
  const indexName = `biz_${businessId.replace(/-/g, "")}`;
  const store = new RedisVectorStore(embeddings, { redisClient: await getRedisClient() as any, indexName });
  
  let hits: [any, number][] = [];
  try {
    hits = await store.similaritySearchWithScore(question, 6);
  } catch (e) {
    // If index doesn't exist or is empty
    return {
      answer: "I don't have enough information about this business yet.",
      citations: []
    };
  }

  const context = hits.map(([d]) => 
    `[${d.metadata.kind}${d.metadata.reviewId ? " " + d.metadata.reviewId : ""}] ${d.pageContent}`
  ).join("\n---\n");

  const SYS = `
You answer questions about a specific business grounded ONLY in the provided context.

Rules:
- Answer in 2 short sentences maximum.
- Cite kinds explicitly: "3 reviews mention...", "Menu lists...", "Owner replied that..."
- If context does not support a confident answer, say so and suggest asking the owner (link to Q&A).
- Never invent facts. Never mention "the context".
- Preserve the question's language (Arabic or English).
`;

  const model = smartLLM();
  const res = await model.invoke([
    { role: "system", content: SYS },
    { role: "user",   content: `Question: ${question}\n\nContext:\n${context}` },
  ]);

  return {
    answer: res.content.toString(),
    citations: hits.map(([d, s]) => ({ 
      kind: d.metadata.kind, 
      ref: d.metadata.reviewId ?? d.metadata.itemId ?? d.metadata.postId ?? d.metadata.answerId, 
      score: s 
    })),
  };
}
