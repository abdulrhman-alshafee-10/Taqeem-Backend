import { z } from "zod";
import { Request, Response } from "express";
import { client } from "../es.js";

const MapQuerySchema = z.object({
  bbox: z.string(), // "minLat,minLng,maxLat,maxLng"
  zoom: z.coerce.number().int().min(1).max(20),
  q: z.string().optional(),
  features: z.string().optional().transform(v => v?.split(",").filter(Boolean) ?? []),
  limit: z.coerce.number().int().max(1000).default(200),
});

function zoomToPrecision(zoom: number): number {
  if (zoom <= 6) return 3;
  if (zoom <= 9) return 4;
  if (zoom <= 11) return 5;
  if (zoom <= 13) return 6;
  if (zoom <= 15) return 7;
  return 8;
}

export async function map(req: Request, res: Response) {
  const parsed = MapQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Bad query", issues: parsed.error.issues });

  const { bbox, zoom, q, features, limit } = parsed.data;
  const [minLat, minLng, maxLat, maxLng] = bbox.split(",").map(Number);
  
  if ([minLat, minLng, maxLat, maxLng].some(isNaN)) {
    return res.status(400).json({ error: "Invalid bbox coordinates" });
  }

  const precision = zoomToPrecision(zoom);

  const filter: any[] = [
    { term: { isActive: true } },
    {
      geo_bounding_box: {
        location: {
          top_left:     { lat: maxLat, lon: minLng },
          bottom_right: { lat: minLat, lon: maxLng },
        },
      },
    },
  ];

  if (features.length) {
    filter.push({
      terms_set: {
        features: {
          terms: features,
          minimum_should_match_script: { source: `${features.length}` }
        }
      }
    });
  }

  const must: any[] = [];
  if (q && q.trim()) {
    must.push({
      multi_match: {
        query: q,
        fields: ["name^3", "categories^2", "description"],
      }
    });
  }

  const query = { bool: { filter, must: must.length ? must : undefined } };

  try {
    if (precision >= 8) {
      // High zoom — return individual pins
      const esReq = {
        index: "businesses",
        size: limit,
        query,
        _source: ["id", "name", "avgRating", "location", "priceTier", "categories"],
      };
      const result = await client.search(esReq);
      
      return res.json({
        mode: "pins",
        pins: result.hits.hits.map((h: any) => ({
          id: h._source.id,
          lat: h._source.location.lat,
          lng: h._source.location.lon,
          name: h._source.name,
          avgRating: h._source.avgRating,
          priceTier: h._source.priceTier,
          categories: h._source.categories,
        })),
      });
    }

    // Clusters
    const esReq = {
      index: "businesses",
      size: 0,
      query,
      aggs: {
        grid: {
          geohash_grid: { field: "location", precision },
          aggs: {
            avg_rating: { avg: { field: "avgRating" } },
            top_hit: {
              top_hits: {
                size: 1,
                sort: [{ avgRating: "desc" }],
                _source: ["id", "name", "avgRating", "location"],
              }
            },
          }
        }
      }
    };
    
    const result = await client.search(esReq);
    const buckets = (result.aggregations?.grid as any)?.buckets || [];

    // Note: We'd typically use ngeohash to decode geohash to lat/lng.
    // For simplicity, we can use the top_hit's location as the cluster center.
    res.json({
      mode: "clusters",
      clusters: buckets.map((b: any) => {
        const hit = b.top_hit.hits.hits[0]._source;
        return {
          key: b.key,
          count: b.doc_count,
          lat: hit.location.lat, // approximation for cluster center
          lng: hit.location.lon,
          avgRating: b.avg_rating.value,
          topHit: { id: hit.id, name: hit.name }
        };
      })
    });
  } catch (err) {
    console.error("Map query error:", err);
    res.status(500).json({ error: "Map query failed" });
  }
}
