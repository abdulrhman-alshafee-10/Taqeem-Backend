import { Router } from 'express';
import { getQueue, assignEntry, decideEntry, mergeBusinesses, closeBusiness } from '../controllers/moderation.controller';
import { requireAuth, requireAdminOrMod } from '../middleware/auth';

const router = Router();

router.use(requireAuth);
router.use(requireAdminOrMod);

router.get('/queue', getQueue);
router.post('/queue/:id/assign', assignEntry);
router.post('/queue/:id/decide', decideEntry);
router.post('/businesses/merge', mergeBusinesses);
router.post('/businesses/:id/close', closeBusiness);

export { router as moderationRoutes };
