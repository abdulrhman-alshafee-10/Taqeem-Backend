import { Router } from 'express';
import { getReviewInternal, rebindReviews, getUserCounts } from '../controllers/internal.controller.js';

const router = Router();

router.get('/reviews/:id', getReviewInternal);
router.post('/businesses/rebind-reviews', rebindReviews);
router.get('/users/:id/counts', getUserCounts);

export { router as internalRoutes };
