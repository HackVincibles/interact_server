import { Router } from 'express';
import { syncCoachMetrics, getBehavioralSummary } from '../controllers/sessionAnalyticsController';
import { protect } from '../middleware/auth';

const router = Router();

// Route for the client AI Coach to passively batch sync metrics every 10s.
// We might not want to heavily protect this with strict JWT limits if it disrupts the background nature,
// but for enterprise security, it's good to keep it behind basic auth.
router.post('/coach-sync', syncCoachMetrics);

// Route for the recruiter dashboard to pull the AI-generated behavioral summary post-session.
router.get('/summary/:sessionId/:participantId', protect, getBehavioralSummary);

export default router;
