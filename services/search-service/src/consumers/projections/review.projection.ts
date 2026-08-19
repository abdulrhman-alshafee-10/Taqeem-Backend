import { client } from "../../es.js";
import axios from "axios";

const INDEX = "businesses";
const MAX_RECENT = 5;

async function fetchAggregates(businessId: string) {
  const { data } = await axios.get(
    `http://review-service:4003/internal/businesses/${businessId}/aggregates`,
    { timeout: 3000 }
  );
  return data;
}

async function refreshBusinessAggregates(businessId: string) {
  const agg = await fetchAggregates(businessId);
  await client.update({
    index: INDEX,
    id: businessId,
    doc: {
      avgRating:   agg.avgRating,
      reviewCount: agg.reviewCount,
      recentReviews: agg.recentReviews.slice(0, MAX_RECENT),
    },
    refresh: "wait_for",
    retry_on_conflict: 3,
  }).catch((err: any) => {
    if (err.meta?.statusCode !== 404) throw err;
    // Business not yet indexed — will be reconciled by next business.updated
  });
}

export async function onReviewCreated({ businessId }: any) {
  await refreshBusinessAggregates(businessId);
}

export async function onReviewUpdated({ businessId }: any) {
  await refreshBusinessAggregates(businessId);
}

export async function onReviewDeleted({ businessId }: any) {
  await refreshBusinessAggregates(businessId);
}
