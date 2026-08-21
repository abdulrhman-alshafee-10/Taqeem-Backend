import { Router } from 'express';
import { createReport, getMyReports } from '../controllers/report.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.post('/', createReport);
router.get('/mine', getMyReports);

export { router as reportRoutes };
