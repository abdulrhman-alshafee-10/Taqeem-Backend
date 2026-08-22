import { publishEvent } from "@taqeem/shared/events/publisher.js";
import crypto from "crypto";

export async function injectPromoted(organicResults: any[], params: any, ctx: { userId?: string }) {
  // Fetch eligible campaigns from payment-service (or from a Redis cache maintained by it)
  let campaigns: any[] = [];
  try {
    const qs = new URLSearchParams();
    qs.set("kind", "PROMOTED_SEARCH");
    if (params.q) qs.set("q", params.q);
    if (params.city) qs.set("city", params.city);
    if (params.vertical) qs.set("vertical", params.vertical);
    
    const res = await fetch(`http://payment-service:4009/api/internal/ads/eligible?${qs.toString()}`);
    if (res.ok) {
      campaigns = await res.json();
    }
  } catch (e) {
    console.error("Failed to fetch promoted campaigns", e);
    return organicResults;
  }

  if (!campaigns.length) return organicResults;

  // Compute eCPM = cpcBidCents * pCTR * relevanceScore
  // In a real system, relevanceScore uses the organic query score.
  const ranked = campaigns
    .map(c => {
      const pCTR = 0.02; // simplified
      const relevance = 1.0; // simplified
      return { campaign: c, eCPM: (c.cpcBidCents || 0) * pCTR * relevance };
    })
    .filter(x => x.eCPM > 0)
    .sort((a,b) => b.eCPM - a.eCPM);

  const slots = Math.min(2, Math.floor(organicResults.length * 0.2));
  const picks = ranked.slice(0, slots);

  if (!picks.length) return organicResults;

  const promotedBizIds = new Set(picks.map(p => p.campaign.businessId));
  const filteredOrganic = organicResults.filter(r => !promotedBizIds.has(r.id || r._id));

  const merged = [...filteredOrganic];
  const insertAt = [0, 4].slice(0, picks.length);
  
  picks.forEach((p, i) => {
    // In a real setup, we'd hydrate the business document from ES or cache.
    // We assume the ad campaign payload includes minimal business info or we fetch it.
    // For now, we inject a placeholder that the frontend recognizes.
    merged.splice(insertAt[i] + i, 0, {
      id: p.campaign.businessId,
      _id: p.campaign.businessId,
      nameEn: "Promoted Business", // Placeholder
      sponsored: true,
      campaignId: p.campaign.id,
      score: 99999,
    });
  });

  // Log impressions via event bus to analytics
  for (const p of picks) {
    publishEvent("ad.impression", {
      id: crypto.randomUUID(),
      campaignId: p.campaign.id,
      businessId: p.campaign.businessId,
      userId: ctx.userId,
      surface: "search",
      query: params.q,
    }).catch(console.error);
  }

  return merged;
}
