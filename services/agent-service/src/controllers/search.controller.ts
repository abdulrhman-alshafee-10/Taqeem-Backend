import { Request, Response } from "express";
import { parseSearchTool } from "../tools/parse-search.tool.js";

export async function parseSearch(req: Request, res: Response) {
  try {
    const { sentence, cityHint } = req.body;
    if (!sentence || typeof sentence !== "string" || sentence.length > 300) {
      res.status(400).json({ error: "Invalid sentence" });
      return;
    }

    const result = await parseSearchTool.invoke({ sentence, cityHint });
    res.json(result);
  } catch (err: any) {
    console.error("parseSearch Error:", err);
    res.status(500).json({ error: "Failed to parse search" });
  }
}

import { askBusiness as askBusinessLogic } from "../rag/ask-business.js";

export async function askBusiness(req: Request, res: Response) {
  try {
    const { businessId, question } = req.body;
    if (!businessId || !question) return res.status(400).json({ error: "Missing fields" });
    const result = await askBusinessLogic(businessId, question);
    res.json(result);
  } catch (err: any) {
    console.error("askBusiness Error:", err);
    res.status(500).json({ error: "Failed to answer question" });
  }
}
