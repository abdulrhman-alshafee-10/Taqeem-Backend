import { Router } from 'express';
import { getReviewInternal, rebindReviews } from '../controllers/internal.controller.js';

const router = Router();

router.get('/reviews/:id', getReviewInternal);
router.post('/businesses/rebind-reviews', rebindReviews);

export { router as internalRoutes };
