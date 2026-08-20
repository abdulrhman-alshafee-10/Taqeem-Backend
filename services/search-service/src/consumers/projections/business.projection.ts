import { client } from "../../es.js";

const INDEX = "businesses";

function toDoc(b: any) {
  return {
    id: b.id,
    ownerId: b.ownerId ?? null,
    name: b.name,
    slug: b.slug,
    description: b.description ?? null,
    categories: b.categories ?? [],
    priceTier: b.priceTier ?? null,
    phone: b.phone ?? null,
    website: b.website ?? null,
    addressLine1: b.addressLine1,
    city: b.city,
    region: b.region,
    country: b.country,
    postalCode: b.postalCode,
    location: (b.latitude && b.longitude) ? { lat: b.latitude, lon: b.longitude } : null,
    avgRating: b.avgRating ?? 0,
    reviewCount: b.reviewCount ?? 0,
    recentReviews: [],
    aspects: {
      food: b.aspectAvgFood ?? 0,
      service: b.aspectAvgService ?? 0,
      ambience: b.aspectAvgAmbience ?? 0,
      value: b.aspectAvgValue ?? 0,
      cleanliness: b.aspectAvgCleanliness ?? 0,
    },
    features: b.features ?? [],
    dietary: b.dietary ?? [],
    atmosphere: b.atmosphere ?? [],
    paymentMethods: b.paymentMethods ?? [],
    claimStatus: b.claimStatus ?? "UNCLAIMED",
    isActive: b.isActive ?? true,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

export async function onBusinessCreated(payload: any) {
  const business = payload;
  await client.index({
    index: INDEX,
    id: business.id,
    document: toDoc(business),
    refresh: "wait_for",
  });
}

export async function onBusinessUpdated(payload: any) {
  const business = payload;
  await client.update({
    index: INDEX,
    id: business.id,
    doc: toDoc(business),
    doc_as_upsert: true,
    refresh: "wait_for",
  });
}

export async function onBusinessDeleted(payload: any) {
  const { businessId } = payload;
  await client.update({
    index: INDEX,
    id: businessId,
    doc: { isActive: false },
    refresh: "wait_for",
  });
}
