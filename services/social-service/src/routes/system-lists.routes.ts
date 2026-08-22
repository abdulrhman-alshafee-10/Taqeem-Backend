import { Router } from 'express';
import { addToList, removeFromList, getList, createWantAlert, deleteWantAlert } from '../controllers/system-lists.controller.js';
import { requireAuth } from '@taqeem/shared/auth/context.js';

const router = Router();

router.use(requireAuth as any);

router.post('/:list/:businessId', addToList);
router.delete('/:list/:businessId', removeFromList);
router.get('/:list', getList);

router.post('/want/:businessId/alert', createWantAlert);
router.delete('/want/:businessId/alert', deleteWantAlert);

export default router;
