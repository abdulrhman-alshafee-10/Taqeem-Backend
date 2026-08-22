import { startConsumer } from "@taqeem/shared/events/consumer.js";
import { query } from "../db/pg.js";
import crypto from "crypto";

export async function startRevenueConsumers() {
  await startConsumer({
    queue: "analytics.revenue.queue",
    bindings: ["ledger.entry_written", "subscription.activated", "subscription.past_due", "subscription.cancelled"],
    handler: async (payload: any, headers: any) => {
      const type = headers["x-event-type"];

      if (type === "ledger.entry_written") {
        const { id, account, side, amount, currency, businessId, userId, metadata, createdAt } = payload;
        
        if (!account.startsWith("revenue:") || side !== "CREDIT") return;
        
        // Mock USD conversion
        const usd = amount / 50; 
        
        await query(
          `INSERT INTO revenue_facts (id, ts, stream, business_id, user_id, vertical, city, currency, amount_native, amount_usd, meta)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
          [
            id, createdAt || new Date().toISOString(), account.replace("revenue:", ""),
            businessId || null, userId || null,
            metadata?.vertical || null, metadata?.city || null,
            currency, amount, usd, metadata || {}
          ]
        );
      } 
      else if (type.startsWith("subscription.")) {
        const { id, subscriptionId, businessId, userId, tier } = payload;
        const ts = new Date().toISOString();
        let mrrDelta = 0;
        
        // Very simplified MRR delta
        if (type === "subscription.activated") {
          mrrDelta = tier === "PRO" ? 49 : tier === "CHAIN" ? 199 : tier === "BASIC" ? 19 : 0;
        } else if (type === "subscription.cancelled") {
          mrrDelta = tier === "PRO" ? -49 : tier === "CHAIN" ? -199 : tier === "BASIC" ? -19 : 0;
        }
        
        await query(
          `INSERT INTO subscription_events (id, ts, subscription_id, business_id, user_id, tier, event, mrr_delta_usd)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
          [
            id || crypto.randomUUID(), ts, subscriptionId, businessId || null, userId || null,
            tier, type.split('.')[1].toUpperCase(), mrrDelta
          ]
        );
      }
    },
  });
}
