import { Request, Response } from "express";
import { redis } from "../redis.js";
import axios from "axios";
import crypto from "crypto";
import { buildSearchQuery } from "../query/build-search-query.js";
import { client } from "../es.js";

function priceTierRange(min?: string, max?: string) {
  const tiers = ["ONE", "TWO", "THREE", "FOUR"];
  const out = [];
  const start = min ? tiers.indexOf(min) : 0;
  const end = max ? tiers.indexOf(max) : tiers.length - 1;
  for (let i = Math.max(0, start); i <= Math.min(tiers.length - 1, end); i++) {
    out.push(tiers[i]);
  }
  return out;
}

export async function nlSearch(req: Request, res: Response) {
  const q = String(req.query.q || "");
  const lat = req.query.lat ? Number(req.query.lat) : undefined;
  const lng = req.query.lng ? Number(req.query.lng) : undefined;
  const cityHint = req.query.cityHint ? String(req.query.cityHint) : undefined;

  if (!q) {
    res.status(400).json({ error: "q required" });
    return;
  }

  // Cache by sentence hash — same phrase within 24 h reuses parsed structure
  const hash = crypto.createHash("sha256").update(q + ":" + (cityHint || "")).digest("hex");
  const cacheKey = `nl:${hash}`;
  
  let parsed: any;
  const cached = await redis.get(cacheKey);
  if (cached) {
    parsed = JSON.parse(cached);
  } else {
    try {
      const agentUrl = process.env.AGENT_SERVICE_URL || "http://agent-service:4006";
      const { data } = await axios.post(
        `${agentUrl}/internal/parse-search`,
        { sentence: q, cityHint }
      );
      parsed = data;
      await redis.setEx(cacheKey, 86400, JSON.stringify(parsed));
    } catch (e: any) {
      console.error("Agent parsing failed:", e.message);
      // Fallback gracefully
      parsed = { text: q, reasonEn: "Fallback to keyword search due to parsing failure" };
    }
  }

  const searchParams: any = {
    q:          parsed.text || "",
    lat, lng,
    radiusKm:   parsed.radiusKm ?? (lat && lng ? 5 : undefined),
    categories: parsed.categories,
    features:   parsed.features,
    dietary:    parsed.dietary,
    atmosphere: parsed.atmosphere,
    priceTier:  priceTierRange(parsed.priceTierMin, parsed.priceTierMax),
    minRating:  parsed.minRating,
    openNow:    parsed.openNow,
    sort:       parsed.sort ?? "relevance",
    size:       20,
  };

  // Map minAspects
  if (parsed.minAspect) {
    for (const [k, v] of Object.entries(parsed.minAspect)) {
      searchParams[`minAspect_${k}`] = v;
    }
  }

  const body = buildSearchQuery(searchParams);
  const result = await client.search({ index: "businesses", ...body });

  const hits = result.hits.hits.map((hit: any) => ({
    id: hit._source.id,
    name: hit._source.name,
    distanceKm: hit.fields?.distanceKm?.[0],
    ...hit._source
  }));

  res.json({
    parsed,
    results: {
      total: typeof result.hits.total === "number" ? result.hits.total : result.hits.total?.value || 0,
      items: hits,
    }
  });
}
