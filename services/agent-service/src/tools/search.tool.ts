import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { serviceClient } from "./http.js";
import { getRunConfig } from "./run-context.js";

const SearchArgs = z.object({
  query:      z.string().min(1).max(120).describe("Free-text query, e.g. 'milk store', 'sushi'"),
  lat:        z.number().gte(-90).lte(90).optional().describe("User latitude"),
  lng:        z.number().gte(-180).lte(180).optional().describe("User longitude"),
  radiusKm:   z.number().min(0.1).max(50).default(5),
  categories: z.array(z.string()).max(5).optional(),
  minRating:  z.number().min(0).max(5).optional(),
  sort:       z.enum(["relevance","rating","distance"]).default("rating"),
  size:       z.number().int().min(1).max(10).default(5),
});

export const searchBusinessesTool = tool(
  async (args, runConfig) => {
    const { userId, role } = getRunConfig(runConfig);
    const c = serviceClient(process.env.SEARCH_SERVICE_URL!, userId, role);
    const params: any = {
      q:          args.query,
      lat:        args.lat,
      lng:        args.lng,
      radiusKm:   args.radiusKm,
      categories: args.categories?.join(","),
      minRating:  args.minRating,
      sort:       args.sort,
      size:       args.size,
    };
    const { data } = await c.get("/api/search", { params });

    // Return a compact projection for the LLM (token budget!)
    return {
      total: data.total,
      items: data.items.map((b: any) => ({
        id:          b.id,
        name:        b.name,
        rating:      b.avgRating,
        reviewCount: b.reviewCount,
        categories:  b.categories,
        priceTier:   b.priceTier,
        city:        b.city,
        distanceKm:  b.distanceKm,
      })),
    };
  },
  {
    name: "search_businesses",
    description:
      "Search Taqeem for businesses by keyword, category, rating, and proximity. " +
      "Prefer this over any other tool for 'find', 'near me', 'best', 'recommend' questions.",
    schema: SearchArgs,
  }
);
