import { Router } from 'express';
import * as interviewController from '../controllers/interviewController';
import { protect } from '../middleware/auth';

const router = Router();

router.post('/feedback', protect, interviewController.createFeedback);
router.get('/user/:userId', protect, interviewController.getInterviewsByUser);
router.get('/:id', protect, interviewController.getInterviewById);
router.get('/:interviewId/feedback', protect, interviewController.getFeedbackByInterviewId);

export default router;
