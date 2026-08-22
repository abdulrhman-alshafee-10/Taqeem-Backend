import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { redis } from '../redis.js';
import { Client } from '@elastic/elasticsearch';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const esClient = new Client({ node: process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200' });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'sk-mock' });

const WEIGHTS: any = {
  FOLLOWED: 0.25,
  TRENDING: 0.20,
  PERSONAL: 0.20,
  OWNER: 0.10,
  EDITORIAL: 0.10,
  GEMS: 0.10,
};

async function getTrending(city: string, limit: number) {
  const items = await prisma.feedItem.findMany({
    where: { kind: 'BUSINESS_HIGHLIGHT', city, expiresAt: { gt: new Date() } },
    take: limit,
  });
  return items.map(i => ({ ...i, stream: 'TRENDING' }));
}

async function getPersonalizedBusinesses(userId: string, city: string, limit: number) {
  try {
    // 1. Get user preferences from user-service DB (or cache)
    // For simplicity here, we assume a mock short profile, as we don't have direct access to user DB.
    const userProfileText = "loves specialty coffee, vegan brunch";

    // 2. Embed user profile
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: userProfileText,
    });
    const embedding = response.data[0].embedding;
    
    // 3. Search Redis vector index
    // Note: Assuming `businesses_v1` is created with FT.CREATE businesses_v1 SCHEMA v VECTOR FLAT 6 1536
    const embeddingBytes = Buffer.from(new Float32Array(embedding).buffer);
    const results = await redis.sendCommand([
      'FT.SEARCH', 'businesses_v1', 
      `@city:{${city}}=>[KNN ${limit} @v $B AS score]`,
      'PARAMS', '2', 'B', embeddingBytes,
      'DIALECT', '2'
    ]);
    
    // Parse results (mock mapping for now if index not present)
    return []; 
  } catch (err) {
    // Fallback if vector index missing or OpenAI fails
    return [];
  }
}

export async function getFeed(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    const city = (req.query.city as string) || "Cairo";
    
    // Simple Pull Path
    const trending = await getTrending(city, 20);
    const personal = userId ? await getPersonalizedBusinesses(userId, city, 20) : [];
    
    const allItems = [...trending, ...personal];

    // Rerank
    const reranked = allItems.map((i: any) => ({
      ...i,
      finalScore: (i.score || 0.5) * (WEIGHTS[i.stream] || 0.1)
    })).sort((a, b) => b.finalScore - a.finalScore).slice(0, 30);

    res.json({ items: reranked });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function getRecent(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.json({ items: [] });
    const limit = parseInt(req.query.limit as string) || 10;

    const ids = await redis.lRange(`recent:business:${userId}`, 0, limit - 1);
    if (!ids.length) return res.json({ items: [] });

    // Hydrate
    const { docs } = await esClient.mget({ index: 'businesses', body: { ids } });
    const items = ids
      .map(id => docs.find((d: any) => d._id === id))
      .filter((d: any) => d?.found)
      .map((d: any) => d._source);

    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function purgeRecent(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthenticated' });

    const key = `recent:business:${userId}`;
    const ids = await redis.lRange(key, 0, -1);
    
    const pipe = redis.multi();
    pipe.del(key);
    for (const id of ids) {
      pipe.del(`recent:business:meta:${userId}:${id}`);
    }
    await pipe.exec();

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function hydrateRecent(req: Request, res: Response) {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.json({ items: [] });

    const { docs } = await esClient.mget({ index: 'businesses', body: { ids } });
    const items = ids
      .map(id => docs.find((d: any) => d._id === id))
      .filter((d: any) => d?.found)
      .map((d: any) => d._source);

    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
