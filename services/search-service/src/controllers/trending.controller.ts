import { Request, Response } from "express";
import { createClient } from "redis";
import { client as esClient } from "../es.js";

// Dedicated redis client for search-service (assumes redis is at redis:6379)
const redis = createClient({ url: process.env.REDIS_URL || "redis://redis:6379" });
redis.connect().catch(console.error);

export async function trending(req: Request, res: Response) {
  const { city } = req.query;
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

  const key = city ? `trending:city:${(city as string).toLowerCase()}` : "trending:global";
  
  try {
    const ids = await redis.zRange(key, 0, limit - 1, { REV: true });
    if (!ids.length) return res.json({ items: [] });

    const { docs } = await esClient.mget({ index: "businesses", _source: true, docs: ids.map(id => ({ _id: id })) });
    
    // Fetch metas in parallel
    const metas = await Promise.all(ids.map(id => redis.hGetAll(`trending:meta:${id}`)));

    const items = docs
      .filter((d: any) => d.found)
      .map((d: any, i) => {
        const meta = metas[i];
        const newReviews = parseInt(meta.newReviews) || 0;
        return {
          ...d._source,
          trending: {
            views: parseInt(meta.views) || 0,
            newReviews,
            badge: newReviews >= 10 ? "🔥 Hot" : "📈 Trending",
          }
        };
      });

    res.json({ items });
  } catch (err) {
    console.error("Trending error:", err);
    res.status(500).json({ error: "Failed to fetch trending" });
  }
}

export async function hiddenGems(req: Request, res: Response) {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  const radiusKm = parseFloat(req.query.radiusKm as string) || 5;
  const limit = parseInt(req.query.limit as string) || 10;

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: "lat and lng required" });
  }

  const query = {
    bool: {
      filter: [
        { term: { isActive: true } },
        { range: { avgRating: { gte: 4.5 } } },
        { range: { reviewCount: { gte: 10, lte: 60 } } },
        { geo_distance: { distance: `${radiusKm}km`, location: { lat, lon: lng } } },
      ],
    },
  };

  try {
    const esReq = {
      index: "businesses",
      size: limit,
      query,
      sort: [
        { avgRating: "desc" },
        { _geo_distance: { location: { lat, lon: lng }, order: "asc", unit: "km" } },
      ],
    };
    
    const result = await esClient.search(esReq);
    res.json({
      items: result.hits.hits.map((h: any) => ({
        ...h._source,
        badge: "💎 Hidden Gem"
      })),
    });
  } catch (err) {
    console.error("Hidden gems error:", err);
    res.status(500).json({ error: "Failed to fetch hidden gems" });
  }
}
