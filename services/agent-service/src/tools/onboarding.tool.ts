import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { serviceClient } from "./http.js";
import { getRunConfig } from "./run-context.js";

const DraftSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  categories: z.array(z.string()).min(1),
  priceTier: z.enum(["ONE","TWO","THREE","FOUR"]).optional(),
  addressLine1: z.string(),
  city: z.string(),
  region: z.string(),
  country: z.string().length(2),
  postalCode: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  phone: z.string().optional(),
  website: z.string().url().optional(),
});

export const submitBusinessDraftTool = tool(
  async (draft, runConfig) => {
    const { userId, role } = getRunConfig(runConfig);
    if (!userId) {
      return { error: "User must be signed in to create a business." };
    }
    const c = serviceClient(process.env.BUSINESS_SERVICE_URL!, userId, role);
    const { data } = await c.post("/api/businesses", draft);
    return { id: data.id, name: data.name, slug: data.slug, status: "created" };
  },
  {
    name: "submit_business_draft",
    description:
      "Create a new business on Taqeem. Only call this once you have collected every required field. " +
      "Returns { id, name, slug } on success.",
    schema: DraftSchema,
  }
);
