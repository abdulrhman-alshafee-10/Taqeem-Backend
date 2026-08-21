import { Request, Response } from "express";
import axios from "axios";
import { smartLLM } from "../llm.js";

export async function generateReviewScaffold(req: Request, res: Response) {
  try {
    const { businessId, checkinId } = req.body;
    if (!businessId) return res.status(400).json({ error: "businessId required" });

    const bizSvc = process.env.BUSINESS_SERVICE_URL || "http://business-service:4001";
    
    // Fetch menu for item chips
    const [menuRes, summaryRes] = await Promise.allSettled([
      axios.get(`${bizSvc}/internal/businesses/${businessId}/menu`),
      axios.get(`${bizSvc}/api/businesses/${businessId}/summary`)
    ]);

    const menu = menuRes.status === "fulfilled" ? menuRes.value.data : null;
    const summary = summaryRes.status === "fulfilled" ? summaryRes.value.data : null;

    // Build Item Chips
    const itemChips: { id: string, labelEn: string }[] = [];
    if (menu?.sections) {
      for (const sec of menu.sections) {
        for (const item of sec.items) {
          itemChips.push({ id: item.id, labelEn: item.name });
          if (itemChips.length >= 20) break;
        }
        if (itemChips.length >= 20) break;
      }
    }

    // Build snippets using LLM based on summary
    let snippets: { id: string, text: string }[] = [];
    if (summary?.data) {
      const SYS = `
Generate 3 short, distinct review snippets (e.g. "Loved the vibes.", "Service was slow.")
based on this business summary. Return JSON: { "snippets": ["..."] }
Summary: ${JSON.stringify(summary.data)}
      `;
      const model = smartLLM().withStructuredOutput({
        name: "snippets",
        schema: {
          type: "object",
          properties: {
            snippets: { type: "array", items: { type: "string" } }
          }
        }
      } as any);

      const out = await model.invoke(SYS) as any;
      snippets = (out.snippets || []).map((s: string, i: number) => ({ id: `s${i}`, text: s }));
    }

    const moods = [
      { id: "loved",   labelEn: "Loved it",       starRange: [4, 5] },
      { id: "good",    labelEn: "Solid",          starRange: [3, 4] },
      { id: "meh",     labelEn: "Just okay",      starRange: [2, 3] },
      { id: "avoid",   labelEn: "Would skip",     starRange: [1, 2] }
    ];

    res.json({
      moods,
      itemChips,
      snippets
    });
  } catch (err: any) {
    console.error("Review Helper error:", err);
    res.status(500).json({ error: "Failed to generate scaffold" });
  }
}
