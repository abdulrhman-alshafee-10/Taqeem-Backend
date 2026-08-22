import { z } from "zod";
import { Request, Response } from "express";
import { client } from "../es.js";
import { buildSearchQuery } from "../query/build-search-query.js";
import { injectPromoted } from "../ads/inject.js";

const QuerySchema = z.object({
  q:          z.string().max(200).optional(),
  lat:        z.coerce.number().gte(-90).lte(90).optional(),
  lng:        z.coerce.number().gte(-180).lte(180).optional(),
  radiusKm:   z.coerce.number().min(0.1).max(50).default(10),
  categories: z.string().optional().transform(v => v?.split(",").filter(Boolean) ?? []),
  priceTier:  z.string().optional().transform(v => v?.split(",").filter(Boolean) ?? []),
  features:   z.string().optional().transform(v => v?.split(",").filter(Boolean) ?? []),
  dietary:    z.string().optional().transform(v => v?.split(",").filter(Boolean) ?? []),
  atmosphere: z.string().optional().transform(v => v?.split(",").filter(Boolean) ?? []),
  minRating:  z.coerce.number().min(0).max(5).optional(),
  minAspect_food: z.coerce.number().min(1).max(5).optional(),
  minAspect_service: z.coerce.number().min(1).max(5).optional(),
  minAspect_ambience: z.coerce.number().min(1).max(5).optional(),
  minAspect_value: z.coerce.number().min(1).max(5).optional(),
  minAspect_cleanliness: z.coerce.number().min(1).max(5).optional(),
  city:       z.string().optional(),
  sort:       z.string().default("relevance"),
  page:       z.coerce.number().int().min(1).default(1),
  size:       z.coerce.number().int().min(1).max(50).default(20),
  personalize: z.string().optional().transform(v => v === "true"),
  accessibility: z.string().optional().transform(v => v?.split(",").filter(Boolean) ?? []),
});

export async function search(req: Request, res: Response) {
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Bad query", issues: parsed.error.issues });

  const params = parsed.data as any;
  const userId = (req as any).user?.id;

  if (params.personalize && userId) {
    try {
      // Fetch preferences from user-service (In reality, could use internal API or Redis cache)
      const fetchReq = await fetch(`http://user-service:4001/api/users/me/preferences`, {
        headers: { Authorization: req.headers.authorization || "" }
      });
      if (fetchReq.ok) {
        params.preferences = await fetchReq.json();
      }
    } catch (e) {
      console.warn("Could not fetch user preferences for personalization", e);
    }
  }

  const body = buildSearchQuery(params);

  try {
    const result = await client.search({ index: "businesses", ...body });

    let items = result.hits.hits.map((h: any) => ({
      ...h._source,
      score: h._score,
      distanceKm: h.fields?.distanceKm?.[0] ?? null,
    }));

    items = await injectPromoted(items, params, { userId });

    res.json({
      total: typeof result.hits.total === "object" ? result.hits.total.value : result.hits.total,
      page: params.page,
      size: params.size,
      items,
      facets: parseFacets(result.aggregations),
    });
  } catch (err: any) {
    console.error("Elasticsearch error:", err);
    res.status(500).json({ error: "Search failed" });
  }
}

function parseFacets(aggs: any) {
  if (!aggs) return {};
  const facets: any = {};
  for (const [key, value] of Object.entries(aggs)) {
    facets[key] = (value as any).buckets.map((b: any) => ({
      key: b.key,
      count: b.doc_count,
    }));
  }
  return facets;
}
