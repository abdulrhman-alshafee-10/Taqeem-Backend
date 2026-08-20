import { Request, Response } from "express";
import { Review } from "../models/review.model.js";

export async function getBusinessAggregates(req: Request, res: Response) {
  const { businessId } = req.params;

  const result = await Review.aggregate([
    { $match: { businessId, isDeleted: false } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: "$rating" },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  const recentReviews = await Review.find({ businessId, isDeleted: false })
    .sort({ createdAt: -1 })
    .limit(5)
    .select("_id authorId rating body createdAt media")
    .lean();

  const mappedReviews = recentReviews.map(r => ({
    reviewId: r._id.toString(),
    authorId: r.authorId,
    rating: r.rating,
    body: r.body,
    createdAt: r.createdAt,
    mediaTags: r.media?.flatMap((m: any) => m.tags || []) || []
  }));

  if (result.length === 0) {
    return res.json({ avgRating: 0, reviewCount: 0, recentReviews: [] });
  }

  res.json({
    avgRating: result[0].avgRating,
    reviewCount: result[0].reviewCount,
    recentReviews: mappedReviews,
  });
}
