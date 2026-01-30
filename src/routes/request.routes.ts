import { Router } from 'express';
import { createOutpass, createOuting, getHistory, approveOutpass, rejectOutpass } from '../controllers/request.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

// Student Routes
router.post('/outpass', createOutpass);
router.post('/outing', createOuting);
router.get('/history', getHistory);

// Approval Routes
router.post('/:id/approve', approveOutpass);
router.post('/:id/reject', rejectOutpass);

export default router;
