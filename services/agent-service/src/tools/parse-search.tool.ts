import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { smartLLM } from "../llm.js";

const OUT = z.object({
  text:         z.string().max(80).optional(),
  categories:   z.array(z.string()).max(5).optional(),
  atmosphere:   z.array(z.string()).max(5).optional(),
  features:     z.array(z.string()).max(10).optional(),
  dietary:      z.array(z.string()).max(5).optional(),
  priceTierMax: z.enum(["ONE","TWO","THREE","FOUR"]).optional(),
  priceTierMin: z.enum(["ONE","TWO","THREE","FOUR"]).optional(),
  minRating:    z.number().min(0).max(5).optional(),
  openNow:      z.boolean().optional(),
  radiusKm:     z.number().min(0.1).max(50).optional(),
  minAspect:    z.record(z.number().min(1).max(5)).optional(),  // { ambience: 4 }
  sort:         z.enum(["relevance","rating","distance"]).optional(),
  reasonEn:     z.string().max(200).optional(),
});

const SYS = `
You translate a user's natural-language business-search sentence into a strict JSON filter.

Rules:
- Only use keys from the schema. Never invent keys.
- "under X EGP", "cheap" → priceTierMax="TWO"; "fancy", "high-end" → priceTierMin="THREE".
- "cozy", "romantic", "quiet", "lively" → atmosphere entries in that set.
- "outdoor", "wifi", "wheelchair", "prayer room" → features.
- "vegan", "halal", "vegetarian" → dietary.
- "near me", "close by" (no explicit radius) → radiusKm=3.
- "great ambience" or "best food" → minAspect: { ambience: 4 } or { food: 4 }.
- "open now" / "right now" → openNow=true.
- Otherwise, put unstructured concept in "text" (short, keyword-only).
- Return reasonEn explaining any non-obvious mapping (max 1 sentence).
`;

export const parseSearchTool = tool(
  async ({ sentence, cityHint }) => {
    const model = smartLLM().withStructuredOutput(OUT, { name: "search_filters" });
    const out = await model.invoke([
      { role: "system", content: SYS },
      { role: "user",   content: `Sentence: ${sentence}\nCityHint: ${cityHint ?? "unknown"}` },
    ]);
    return out;
  },
  {
    name: "parse_search",
    description: "Parse a natural-language business-search sentence into structured filters.",
    schema: z.object({ sentence: z.string().min(1).max(300), cityHint: z.string().optional() }),
  }
);
