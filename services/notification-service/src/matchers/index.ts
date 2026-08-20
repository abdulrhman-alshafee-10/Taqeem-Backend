import { startConsumer } from "@taqeem/shared/events/consumer.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MATCHERS: Record<string, Function> = {
  "business.created": matchNewBusiness,
  "member.invited": handleMemberInvited,
};

async function handleMemberInvited(payload: any) {
  const { email, businessId, role, token } = payload;
  const inviteUrl = `https://taqeem.app/invite/${token}`;
  
  // Real world: Use an email provider like SendGrid or SES.
  // We simulate sending an email for Phase 9 testing.
  console.log(`[EMAIL DISPATCH] To: ${email}`);
  console.log(`[EMAIL DISPATCH] Subject: You've been invited to join a business on Taqeem!`);
  console.log(`[EMAIL DISPATCH] Body: You have been invited to join business ${businessId} as a ${role}.`);
  console.log(`[EMAIL DISPATCH] Link: ${inviteUrl}`);
}

export async function startAlertMatcher() {
  await startConsumer({
    queue: "notification.alerts.queue",
    handler: async (payload: any, headers: any) => {
      const type = headers["x-event-type"];
      const m = MATCHERS[type];
      if (!m) return;
      await m(payload);
    },
  });
}

// Haversine distance in km
function haversineKm(p1: { lat: number, lng: number }, p2: { lat: number, lng: number }) {
  const R = 6371;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function rankPriceTier(tier?: string | null) {
  if (tier === "FOUR") return 4;
  if (tier === "THREE") return 3;
  if (tier === "TWO") return 2;
  return 1;
}

async function matchNewBusiness(payload: any) {
  const b = payload.business || payload; // depending on event payload shape

  const candidates = await prisma.alertRule.findMany({
    where: {
      kind: "NEW_BUSINESS_IN_RADIUS",
      status: "ACTIVE",
    },
    take: 5000,
  });

  for (const r of candidates) {
    const p = r.params as any;
    
    // Category intersection
    if (p.categories?.length) {
      const intersect = p.categories.filter((c: string) => b.categories?.includes(c));
      if (!intersect.length) continue;
    }

    // Price tier constraint
    if (p.priceTierMax && rankPriceTier(b.priceTier) > rankPriceTier(p.priceTierMax)) {
      continue;
    }

    // Radius constraint
    if (p.lat != null && p.lng != null && b.latitude != null && b.longitude != null) {
      const d = haversineKm({ lat: p.lat, lng: p.lng }, { lat: b.latitude, lng: b.longitude });
      if (d > (p.radiusKm || 5)) continue;
      
      console.log(`[ALERT] Matched NEW_BUSINESS_IN_RADIUS rule ${r.id} for user ${r.userId} (distance: ${d.toFixed(1)}km)`);
      // Here we would call fireAlert() to push notification
    }
  }
}
