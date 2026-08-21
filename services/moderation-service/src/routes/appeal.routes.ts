import { Router } from 'express';
import { appealReview } from '../controllers/appeal.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.post('/:reviewId/appeal', appealReview);

export { router as appealRoutes };
