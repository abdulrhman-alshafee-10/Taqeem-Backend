import { z } from "zod";
import { Request, Response } from "express";
import { client } from "../es.js";
import { buildSearchQuery } from "../query/build-search-query.js";

const QuerySchema = z.object({
  q:          z.string().max(200).optional(),
  lat:        z.coerce.number().gte(-90).lte(90).optional(),
  lng:        z.coerce.number().gte(-180).lte(180).optional(),
  radiusKm:   z.coerce.number().min(0.1).max(50).default(10),
  categories: z.string().optional().transform(v => v?.split(",").filter(Boolean) ?? []),
  priceTier:  z.string().optional().transform(v => v?.split(",").filter(Boolean) ?? []),
  minRating:  z.coerce.number().min(0).max(5).optional(),
  city:       z.string().optional(),
  sort:       z.enum(["relevance","rating","distance"]).default("relevance"),
  page:       z.coerce.number().int().min(1).default(1),
  size:       z.coerce.number().int().min(1).max(50).default(20),
});

export async function search(req: Request, res: Response) {
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Bad query", issues: parsed.error.issues });

  const params = parsed.data;
  const body = buildSearchQuery(params);

  try {
    const result = await client.search({ index: "businesses", ...body });

    const items = result.hits.hits.map((h: any) => ({
      ...h._source,
      score: h._score,
      distanceKm: h.fields?.distanceKm?.[0] ?? null,
    }));

    res.json({
      total: typeof result.hits.total === "object" ? result.hits.total.value : result.hits.total,
      page: params.page,
      size: params.size,
      items,
    });
  } catch (err: any) {
    console.error("Elasticsearch error:", err);
    res.status(500).json({ error: "Search failed" });
  }
}
