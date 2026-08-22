import { z } from "zod";
import { Request, Response, NextFunction } from "express";

/**
 * Express middleware factory for Zod schema validation.
 */
export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        issues: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }
    req.body = result.data; // replace with parsed + coerced data
    next();
  };
}
