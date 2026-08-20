import { RedisVectorStore } from "@langchain/redis";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { createClient } from "redis";
import fs from "node:fs/promises";
import path from "node:path";

const INDEX_NAME = "taqeem_help_docs";

export async function buildHelpIndex(knowledgeDir: string) {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();

  const embeddings = new OpenAIEmbeddings({ model: "text-embedding-3-small" });
  const splitter   = new RecursiveCharacterTextSplitter({ chunkSize: 800, chunkOverlap: 100 });

  const files = await fs.readdir(knowledgeDir);
  const docs = [];
  for (const f of files.filter(f => f.endsWith(".md"))) {
    const raw = await fs.readFile(path.join(knowledgeDir, f), "utf8");
    const chunks = await splitter.createDocuments([raw], [{ source: f, title: f.replace(/\.md$/, "") }]);
    docs.push(...chunks);
  }

  await RedisVectorStore.fromDocuments(docs, embeddings, {
    redisClient: client,
    indexName:   INDEX_NAME,
  });
  await client.quit();
  console.log(`Indexed ${docs.length} chunks into ${INDEX_NAME}`);
}
