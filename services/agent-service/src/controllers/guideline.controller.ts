import { Request, Response } from "express";
import { z } from "zod";
import { smartLLM } from "../llm.js";
import crypto from "crypto";

const CheckSchema = z.object({
  passes: z.boolean(),
  violations: z.array(z.object({
    category: z.string(),
    severity: z.enum(["soft","hard"]),
    reasonEn: z.string().max(200),
    highlightedText: z.string().max(240).optional(),
  })).default([]),
  suggestedRewrite: z.string().max(1200).optional(),
});

const SYS = `
You are Taqeem's review guidelines checker. Categorize any violations. Return JSON.

Rules:
- Be conservative on 'hard' severity. Only for personal attacks with names, hate speech, or illegal-activity claims.
- 'soft' warnings are hints — the reviewer can still submit.
- suggestedRewrite is only offered when passes === false AND the underlying critique is legitimate.
- Respect the language of the review. Do not translate.
`;

const cache = new Map<string, any>();

export async function checkReviewGuidelines(req: Request, res: Response) {
  try {
    const { body } = req.body;
    if (!body) return res.status(400).json({ error: "Missing review body" });

    const hash = crypto.createHash("sha256").update(body).digest("hex");
    if (cache.has(hash)) {
      return res.json(cache.get(hash));
    }

    const model = smartLLM().withStructuredOutput(CheckSchema, { name: "guideline_check" });
    const result = await model.invoke([
      { role: "system", content: SYS },
      { role: "user", content: body }
    ]);

    cache.set(hash, result);
    // basic cleanup
    if (cache.size > 1000) {
      const first = cache.keys().next().value;
      if (first) cache.delete(first);
    }

    res.json(result);
  } catch (err: any) {
    console.error("Guideline check error:", err);
    res.status(500).json({ error: "Failed to check guidelines" });
  }
}
