import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { RedisVectorStore } from "@langchain/redis";
import { OpenAIEmbeddings } from "@langchain/openai";
import { createClient } from "redis";

let store: RedisVectorStore | null = null;

async function getStore() {
  if (store) return store;
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  store = new RedisVectorStore(
    new OpenAIEmbeddings({ model: "text-embedding-3-small" }),
    { redisClient: client, indexName: "taqeem_help_docs" }
  );
  return store;
}

export const retrieveHelpDocsTool = tool(
  async ({ query, k }) => {
    const s = await getStore();
    const hits = await s.similaritySearchWithScore(query, k);
    return hits.map(([doc, score]) => ({
      title:   doc.metadata.title,
      source:  doc.metadata.source,
      snippet: doc.pageContent,
      score,
    }));
  },
  {
    name: "retrieve_help_docs",
    description:
      "Look up Taqeem product help documentation for questions about adding businesses, " +
      "claiming, replying to reviews, moderation, and general platform usage.",
    schema: z.object({
      query: z.string().min(3),
      k:     z.number().int().min(1).max(6).default(4),
    }),
  }
);
