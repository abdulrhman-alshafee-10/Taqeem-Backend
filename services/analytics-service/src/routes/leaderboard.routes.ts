import { Router, Request, Response } from "express";
import { redis } from "../redis.js";

const r = Router();

function monthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

r.get("/city/:city", async (req: Request, res: Response) => {
  const { city } = req.params;
  const key = `leaderboard:city:${city}:${monthKey()}`;
  
  try {
    // Return top 50
    const top = await redis.zRangeWithScores(key, 0, 49, { REV: true });
    
    // In real app, we would hydrate user metadata by calling user-service.
    // For now, we return userId and score.
    const hydrated = top.map(t => ({
      userId: t.value,
      score: t.score
    }));
    
    res.json(hydrated);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

export default r;
