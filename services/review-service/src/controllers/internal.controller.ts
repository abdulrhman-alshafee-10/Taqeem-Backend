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

export async function getReviewInternal(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const review = await Review.findById(id);
    if (!review) return res.status(404).end();
    res.json(review);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function rebindReviews(req: Request, res: Response) {
  try {
    const { from, to } = req.body;
    await Review.updateMany(
      { businessId: from },
      { $set: { businessId: to } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function getUserCounts(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    // Aggregate over reviews for this user
    const result = await Review.aggregate([
      { $match: { authorId: id, isDeleted: false } },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          verifiedVisits: { $sum: { $cond: [{ $eq: ["$verifiedVisit", true] }, 1, 0] } },
          totalHelpfulVotes: { $sum: "$helpfulVotes" },
          mediaCount: { $sum: { $cond: [{ $isArray: "$media" }, { $size: "$media" }, 0] } }
        }
      }
    ]);
    
    // We could do additional counts (like categories or cities) if we joined with business data
    // For Phase 18, we can approximate or rely on basic counts for now, or just send what we have.
    // If the Badge Awarder needs `countReviewsInCategory`, it will need a way to filter by category.
    // We'll provide standard counts here.
    
    if (result.length === 0) {
      return res.json({ totalReviews: 0, verifiedVisits: 0, totalHelpfulVotes: 0, mediaCount: 0 });
    }
    
    const stats = result[0];
    delete stats._id;
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

