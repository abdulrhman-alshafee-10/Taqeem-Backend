import { Request, Response } from "express";
import { z } from "zod";
import { smartLLM } from "../llm.js";
import axios from "axios";
import crypto from "crypto";

const PlanSchema = z.object({
  title:  z.string(),
  totalBudget: z.number(),
  stops:  z.array(z.object({
    order: z.number().int(),
    kind:  z.enum(["dinner","coffee","dessert","drink","activity"]),
    businessId: z.string().uuid(),
    startsAt: z.string(),
    estimatedSpendPerPerson: z.number(),
    why: z.string().max(160),
  })).min(2).max(4),
  reservationDrafts: z.array(z.object({
    businessId: z.string().uuid(),
    startsAt: z.string(),
    partySize: z.number().int(),
  })),
});

export async function createPlan(req: Request, res: Response) {
  try {
    const { prompt, location, date } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    // For a real planner, we'd use LangGraph to iteratively search, check availability, and refine.
    // Given the constraints, here is a simplified one-shot invocation:
    
    // First, search some businesses near the location matching the prompt
    let searchResults = [];
    try {
      const searchUrl = process.env.SEARCH_SERVICE_URL || "http://search-service:4004";
      const { data } = await axios.get(`${searchUrl}/api/search/nl`, {
        params: { q: prompt, lat: location?.lat, lng: location?.lng }
      });
      searchResults = data.results?.items || [];
    } catch (e) {
      console.error("Search failed during planning", e);
    }

    const context = searchResults.map((b: any) => 
      `ID: ${b.id} | Name: ${b.name} | Price: ${b.priceTier} | Categories: ${b.categories?.join(",")}`
    ).join("\n");

    const SYS = `
You are an AI trip planner. Build an itinerary based on the user's prompt.
Choose from these nearby businesses:
${context}

Rules:
- 2 to 4 stops.
- Starts at times should be logical (e.g. 19:00 for dinner, 21:00 for coffee) on the date ${date || "today"}.
- Create reservation drafts for stops that need them (dinner, etc.).
- Ensure total budget meets the prompt constraints (e.g., totalBudget <= requested).
`;

    const model = smartLLM().withStructuredOutput(PlanSchema, { name: "trip_plan" });
    const plan = await model.invoke([
      { role: "system", content: SYS },
      { role: "user", content: prompt }
    ]);

    // Save to some in-memory or redis store in a real app, returning immediately for now
    res.json({ id: crypto.randomUUID(), ...plan });
  } catch (err: any) {
    console.error("Plan Error:", err);
    res.status(500).json({ error: "Failed to create plan" });
  }
}

export async function bookPlan(req: Request, res: Response) {
  try {
    const planId = req.params.planId;
    const userId = req.headers["x-user-id"] as string;
    const { reservationDrafts } = req.body; // Accepting drafts directly for simplicity

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const booked = [];
    const reservationSvc = process.env.RESERVATION_SERVICE_URL || "http://reservation-service:4005";

    try {
      for (const d of reservationDrafts || []) {
        const { data } = await axios.post(
          `${reservationSvc}/api/reservations`,
          d,
          { headers: { "x-user-id": userId } }
        );
        booked.push(data.id);
      }
      res.json({ planId, reservations: booked });
    } catch (e: any) {
      // Compensating Saga
      console.log(`Failed to book. Rolling back ${booked.length} reservations.`);
      for (const id of booked) {
        await axios.post(
          `${reservationSvc}/api/reservations/${id}/cancel`,
          {},
          { headers: { "x-user-id": userId } }
        ).catch(() => null);
      }
      res.status(500).json({ error: "Failed to book all reservations, rolling back.", details: e.message });
    }
  } catch (err) {
    res.status(500).json({ error: "Internal error" });
  }
}
