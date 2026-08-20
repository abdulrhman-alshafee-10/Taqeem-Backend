import { z } from "zod";
import { Request, Response, NextFunction } from "express";

const BaseReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  aspects: z.object({
    food:        z.number().int().min(1).max(5).optional(),
    service:     z.number().int().min(1).max(5).optional(),
    ambience:    z.number().int().min(1).max(5).optional(),
    value:       z.number().int().min(1).max(5).optional(),
    cleanliness: z.number().int().min(1).max(5).optional(),
  }).optional(),
  title:  z.string().max(140).optional(),
  body:   z.string().min(10).max(5000),
  tags:   z.array(z.string().max(30)).max(10).default([]),
  media:  z.array(z.object({
    url: z.string().url(),
    type: z.enum(["image", "video"]),
    width: z.number().int().optional(),
    height: z.number().int().optional(),
    caption: z.string().max(240).optional(),
  })).max(10).default([]),
});

export const CreateReviewSchema = BaseReviewSchema.refine(v => v.rating || v.aspects, { message: "Provide rating or aspects" });
export const UpdateReviewSchema = BaseReviewSchema.partial();

export const ReplySchema = z.object({
  body: z.string().min(1).max(2000),
});

export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const p = schema.safeParse(req.body);
    if (!p.success) {
      return res.status(400).json({ error: "Validation failed", issues: p.error.issues });
    }
    req.body = p.data;
    next();
  };
}
