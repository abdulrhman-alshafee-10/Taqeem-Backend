import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { serviceClient } from "./http.js";
import { getRunConfig } from "./run-context.js";

export const getBusinessDetailsTool = tool(
  async ({ businessId }, runConfig) => {
    const { userId, role } = getRunConfig(runConfig);
    const c = serviceClient(process.env.BUSINESS_SERVICE_URL!, userId, role);
    const { data } = await c.get(`/api/businesses/${businessId}`);
    return {
      id:          data.id,
      name:        data.name,
      description: data.description,
      rating:      data.avgRating,
      reviewCount: data.reviewCount,
      categories:  data.categories,
      priceTier:   data.priceTier,
      address:     `${data.addressLine1}, ${data.city}, ${data.country}`,
      phone:       data.phone,
      website:     data.website,
      hours:       data.hours,
    };
  },
  {
    name: "get_business_details",
    description: "Fetch full details of one business given its UUID.",
    schema: z.object({ businessId: z.string().uuid() }),
  }
);
