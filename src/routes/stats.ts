import { Router } from 'express';
import * as statsController from '../controllers/statsController';
import { protect } from '../middleware/auth';
import rateLimit from 'express-rate-limit';

const router = Router();

// Light rate limit for stats reads
const statsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many stat requests, slow down.' },
});

// Stricter limit for session completion (can't spam XP)
const sessionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many session completions, please wait.' },
});

router.get('/dashboard', protect, statsLimiter, statsController.getDashboardStats);
router.post('/complete-session', protect, sessionLimiter, statsController.completeSession);
router.post('/onboarding', protect, statsController.completeOnboarding);
router.get('/leaderboard', protect, statsLimiter, statsController.getLeaderboard);

export default router;
