import { Router } from 'express';
import { createOutpass, createOuting, getHistory, approveOutpass, rejectOutpass, getAllOutings, getAllOutpasses } from '../controllers/request.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

// Student Routes
router.post('/outpass', createOutpass);
router.post('/outing', createOuting);
router.get('/history', getHistory);
router.get('/history/:id', getHistory);
router.get('/outing/all', getAllOutings);
router.get('/outpass/all', getAllOutpasses);

// Approval Routes
router.post('/:id/approve', approveOutpass);
router.post('/:id/reject', rejectOutpass);

export default router;
