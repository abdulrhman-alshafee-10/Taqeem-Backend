import { z } from "zod";
import { Request, Response, NextFunction } from "express";

export const CreateBusinessSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  categories: z.array(z.string()).min(1).max(10),
  priceTier: z.enum(["ONE","TWO","THREE","FOUR"]).optional(),
  phone: z.string().max(30).optional(),
  website: z.string().url().optional(),
  email: z.string().email().optional(),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string(),
  region: z.string(),
  country: z.string().length(2),
  postalCode: z.string(),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
});

export const PatchBusinessSchema = CreateBusinessSchema.partial();

export const ClaimSchema = z.object({
  proofUrl: z.string().url().optional(),
});

export const ListQuerySchema = z.object({
  q: z.string().optional(),
  city: z.string().optional(),
  category: z.string().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    }
    req.body = parsed.data;
    next();
  };
}
