import { Router } from 'express';
import { protect } from '../middleware/auth';
import {
  createSession,
  getUserSessions,
  getSession,
  deleteSession,
  renameSession,
  sendMessage,
  endInterview,
} from '../controllers/chatController';

const router = Router();

// All routes are protected
router.use(protect);

// Session management (ChatGPT-style history)
router.post('/sessions', createSession);           // Create new chat
router.get('/sessions', getUserSessions);          // Get all user's chats (history)
router.get('/sessions/:sessionId', getSession);    // Get full chat with messages
router.delete('/sessions/:sessionId', deleteSession); // Delete a chat
router.patch('/sessions/:sessionId/title', renameSession); // Rename a chat

// Messaging
router.post('/sessions/:sessionId/message', sendMessage); // Send message + stream AI response

// Interview-specific
router.post('/sessions/:sessionId/end-interview', endInterview); // End interview + get feedback

export default router;
