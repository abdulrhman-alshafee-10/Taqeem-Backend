import { Request, Response } from "express";
import { z } from "zod";
import { OpenAI } from "openai";

const MenuDraft = z.object({
  currency: z.string().default("EGP"),
  sections: z.array(z.object({
    title: z.string().max(80),
    items: z.array(z.object({
      name: z.string().max(120),
      description: z.string().max(240).optional(),
      basePrice: z.number().min(0),
      dietary: z.array(z.enum(["halal","vegan","vegetarian","gluten_free","kosher"])).default([]),
      variants: z.array(z.object({
        label: z.string().max(60),
        priceDelta: z.number(),
      })).default([]),
    })).min(1),
  })).min(1),
  warnings: z.array(z.string().max(160)).default([]),
});

const SYS = `
You are a menu OCR + structurer.

Rules:
- Extract sections in order. If a photo is a single-section menu, use one section.
- Each item MUST have a base price. Detect currency from symbols/text (EGP, $, ريال, ...).
- Split "Small $5 / Large $7" style pricing into variants (label + priceDelta from base).
- Detect dietary badges (V, VG, GF, حلال). Populate the dietary array accordingly.
- If the price is unreadable or missing for an item, DO NOT invent it — omit the item and add a warning "Missing price for item X".
- Prefer the most literal transcription. Do not rename.
`;

export async function parseMenuOcr(req: Request, res: Response) {
  try {
    const { photoUrl } = req.body;
    if (!photoUrl) return res.status(400).json({ error: "Missing photoUrl" });

    const openai = new OpenAI();
    const result = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYS },
        { role: "user",   content: [
          { type: "text", text: "Parse this menu. Return JSON matching the schema exactly." },
          { type: "image_url", image_url: { url: photoUrl } },
        ] as any},
      ],
    });

    const raw = JSON.parse(result.choices[0].message.content || "{}");
    const draft = MenuDraft.parse(raw);
    
    res.json({ draft });
  } catch (err: any) {
    console.error("OCR parse error:", err);
    res.status(500).json({ error: "Failed to parse menu" });
  }
}
