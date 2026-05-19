import { Router } from 'express';
import { createRoom, getToken, getSession, joinRoom, getActiveSessions, getPastSessions, getSessionResults, completeSession, updateSessionState, updateParticipantMetrics } from '../controllers/gdController';




import { protect } from '../middleware/auth';

const router = Router();

// Public/Protected token generation
router.get('/token', protect, getToken);

// Room management
router.post('/create-room', protect, createRoom);
router.post('/join-room', protect, joinRoom);
router.get('/room/:roomId', protect, getSession);
router.get('/sessions', protect, getActiveSessions);
router.get('/past-sessions', protect, getPastSessions);
router.get('/results/:sessionId', protect, getSessionResults);

router.post('/update-metrics', protect, updateParticipantMetrics);
router.post('/complete', protect, completeSession);
router.post('/update-state', protect, updateSessionState);






export default router;
