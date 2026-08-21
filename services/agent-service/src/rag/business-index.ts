import { RedisVectorStore } from "@langchain/redis";
import { OpenAIEmbeddings } from "@langchain/openai";
import axios from "axios";
import { getRedisClient } from "../memory.js";

const embeddings = new OpenAIEmbeddings({ model: "text-embedding-3-small" });

export async function rebuildBusinessIndex(businessId: string) {
  try {
    const bizSvc = process.env.BUSINESS_SERVICE_URL || "http://business-service:4001";
    const revSvc = process.env.REVIEW_SERVICE_URL || "http://review-service:4002";

    const [biz, reviews, menu, posts, qna] = await Promise.all([
      axios.get(`${bizSvc}/internal/businesses/${businessId}`).then(r => r.data).catch(() => null),
      axios.get(`${revSvc}/internal/businesses/${businessId}/recent?limit=100`).then(r => r.data?.items || []).catch(() => []),
      axios.get(`${bizSvc}/internal/businesses/${businessId}/menu`).then(r => r.data).catch(() => null),
      axios.get(`${bizSvc}/internal/businesses/${businessId}/posts`).then(r => r.data?.items || []).catch(() => []),
      axios.get(`${bizSvc}/internal/businesses/${businessId}/qna`).then(r => r.data?.items || []).catch(() => []),
    ]);

    if (!biz) return;

    const docs: any[] = [];
    
    for (const r of reviews) {
      docs.push({
        pageContent: `${r.title ?? ""}\n${r.body}`,
        metadata: { kind: "review", reviewId: r._id, rating: r.rating, at: r.createdAt },
      });
    }

    if (menu && menu.sections) {
      for (const s of menu.sections) {
        for (const i of s.items) {
          docs.push({
            pageContent: `${i.name}${i.description ? " — " + i.description : ""} (${i.dietary?.join(", ") ?? ""})`,
            metadata: { kind: "menu", itemId: i.id, price: i.basePrice },
          });
        }
      }
    }

    for (const p of posts) {
      docs.push({ 
        pageContent: `${p.title}\n${p.body ?? ""}`, 
        metadata: { kind: "post", postId: p.id } 
      });
    }

    for (const q of qna) {
      docs.push({ pageContent: q.body, metadata: { kind: "question", questionId: q.id } });
      for (const a of q.answers || []) {
        docs.push({ pageContent: a.body, metadata: { kind: "answer", answerId: a.id, isOwner: a.isOwner } });
      }
    }

    docs.push({
      pageContent: `Business facts: name=${biz.name}, city=${biz.city}, features=${(biz.features || []).join(",")}, priceTier=${biz.priceTier}, hours=${JSON.stringify(biz.hours || [])}`,
      metadata: { kind: "facts" },
    });

    const indexName = `biz_${businessId.replace(/-/g, "")}`;
    const client = await getRedisClient();
    
    // Attempt to drop old index if it exists, ignore errors if it doesn't
    try {
      await client.ft.dropIndex(indexName);
    } catch (e: any) {
      // Index might not exist yet
    }
    
    await RedisVectorStore.fromDocuments(docs, embeddings, { redisClient: client as any, indexName });
  } catch (error: any) {
    console.error(`Failed to rebuild index for business ${businessId}:`, error.message);
  }
}
