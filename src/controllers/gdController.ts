import { Request, Response } from 'express';
import GDSession from '../models/GDSession';
import { createVideoSDKRoom, generateVideoSDKToken } from '../services/videoSDKService';
import { calculateGDAnalytics, generateRecruiterSummary } from '../services/gdScoringService';
import { recordActivity, XP_REWARDS } from '../utils/gamification';


export const createRoom = async (req: Request, res: Response) => {
  try {
    const { topic, durationMinutes } = req.body;
    const hostId = (req as any).user?.id;
    const hostName = (req as any).user?.name || 'Host';


    if (!hostId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // 1. Create room in VideoSDK
    const roomId = await createVideoSDKRoom();

    // 2. Generate unique room code
    const roomCode = 'GD' + Math.floor(1000 + Math.random() * 9000);

    // 3. Create session in DB
    const session = new GDSession({
      topic,
      durationMinutes: durationMinutes || 15,
      roomId,
      roomCode,
      hostId,
      participants: [{
        userId: hostId,
        name: hostName,
        joinTime: new Date(),
      }],
      status: 'waiting',
      sessionState: 'waiting'
    });

    await session.save();
    console.log(`[GD] Room created: ${roomCode} for host: ${hostId}`);

    res.status(201).json({
      success: true,
      roomId,
      roomCode,
      sessionId: session._id,
      topic: session.topic
    });
  } catch (error: any) {
    console.error(`[GD] Error in createRoom:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getToken = async (req: Request, res: Response) => {
  try {
    const token = generateVideoSDKToken();
    res.json({ token });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getSession = async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const session = await GDSession.findOne({ roomId });
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    console.log(`[GD] Fetched session ${roomId}. Host ID: ${session.hostId}`);
    res.json({ success: true, session });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const joinRoom = async (req: Request, res: Response) => {
  try {
    const { roomId, roomCode } = req.body;
    const userId = (req as any).user?.id;
    const name = (req as any).user?.name || 'Guest';


    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Find by either roomId or roomCode
    const session = await GDSession.findOne({ 
      $or: [{ roomId }, { roomCode }] 
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (session.status === 'completed' || session.sessionState === 'archived' || session.sessionState === 'ended') {
      return res.status(400).json({ success: false, error: 'Session already completed or archived' });
    }

    // Add participant if not already there (strict identity mapping)
    const exists = session.participants.find(p => p.userId === userId.toString());
    if (!exists) {
      session.participants.push({
        userId: userId.toString(),
        name,
        joinTime: new Date(),
      });
      await session.save();
    }

    res.json({ success: true, session });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};


export const getActiveSessions = async (req: Request, res: Response) => {
  try {
    // Only show sessions that are not completed/archived
    const sessions = await GDSession.find({ 
      status: { $in: ['waiting', 'active'] },
      sessionState: { $nin: ['archived', 'ended'] },
      hostId: { $ne: 'anonymous' }
    }).sort({ createdAt: -1 });
    res.json({ success: true, sessions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getPastSessions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    console.log(`[GD] Fetching past sessions for user: ${userId}`);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User ID not found in session' });
    }

    const userIdStr = userId.toString();
    console.log(`[GD] Querying with userIdStr: ${userIdStr}`);

    // Show sessions where the user was either host or participant
    const sessions = await GDSession.find({ 
      $or: [
        { hostId: userIdStr },
        { "participants.userId": userIdStr }
      ],
      status: 'completed'
    }).sort({ createdAt: -1 });
    
    console.log(`[GD] Found ${sessions.length} past sessions`);
    res.json({ success: true, sessions });
  } catch (error: any) {
    console.error(`[GD] Error in getPastSessions: ${error.message}`);
    console.error(error.stack);
    res.status(500).json({ success: false, error: error.message });
  }
};


export const getSessionResults = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await GDSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    res.json({ success: true, session });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const completeSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    console.log(`[GD] Completing session: ${sessionId}`);
    
    const session = await GDSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    session.status = 'completed';
    session.sessionState = 'archived';
    
    try {
      // 1. Calculate Group and Participant Analytics
      session.analytics = calculateGDAnalytics(session);
      const summary = generateRecruiterSummary(session);
      session.recruiterSummary = summary;
      
      // 2. Generate detailed leaderboard based on weighted scores
      session.leaderboard = session.participants.map((p: any) => {
        // Calculate weighted score (matching service logic)
        const weightedScore = Math.round(
          (p.relevanceScore || 60) * 0.25 +
          (p.communicationScore || 60) * 0.2 +
          (p.leadershipScore || 55) * 0.15 +
          (p.collaborationScore || 65) * 0.15 +
          (p.confidenceScore || 60) * 0.15 +
          (p.criticalThinkingScore || 55) * 0.1
        );
        
        return {
          userId: p.userId,
          userName: p.name,
          totalScore: weightedScore,
          rank: 0
        };
      }).sort((a: any, b: any) => b.totalScore - a.totalScore)
         .map((s: any, i: number) => ({ ...s, rank: i + 1 }));

      await session.save();

      // 3. Award XP to all participants
      try {
        const xpGain = XP_REWARDS.GD_SESSION;
        await Promise.all(session.participants.map(async (p: any) => {
          // Find weighted score for this participant
          const pScore = session.leaderboard.find((l: any) => l.userId === p.userId)?.totalScore || 60;
          await recordActivity(p.userId, 'gd', xpGain, [pScore]);
        }));
      } catch (xpError) {
        console.error(`[GD] Failed to award XP:`, xpError);
      }

      console.log(`[GD] Session ${sessionId} archived successfully`);
      res.json({ success: true, session });
    } catch (calcError: any) {
      console.error(`[GD] Analytics calculation failed: ${calcError.message}`);
      session.status = 'completed';
      session.sessionState = 'ended';
      await session.save();
      res.json({ success: true, session, warning: 'Analytics failed during archival' });
    }

  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};


export const updateSessionState = async (req: Request, res: Response) => {
  try {
    const { sessionId, sessionState } = req.body;
    const userId = (req as any).user?.id;

    const session = await GDSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    // Only host can change session state
    if (session.hostId !== userId.toString()) {
      return res.status(403).json({ success: false, error: 'Only host can change session state' });
    }

    session.sessionState = sessionState;
    
    // Map internal sessionState to top-level status
    if (sessionState === 'active' || sessionState === 'final_minute') {
      session.status = 'active';
    } else if (sessionState === 'waiting' || sessionState === 'paused') {
      session.status = 'waiting';
    } else if (sessionState === 'ended' || sessionState === 'archived') {
      session.status = 'completed';
    }

    await session.save();
    console.log(`[GD] Session ${sessionId} state updated to: ${sessionState}`);
    res.json({ success: true, session });

  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
export const updateParticipantMetrics = async (req: Request, res: Response) => {
  try {
    const { sessionId, userId, userName, metrics, transcript } = req.body;
    const session = await GDSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const participant = session.participants.find(p => p.userId === userId);
    if (!participant) {
      return res.status(404).json({ success: false, error: 'Participant not found in session' });
    }

    if (metrics?.speakingDuration) participant.speakingDuration = metrics.speakingDuration;
    if (metrics?.turnCount) participant.turnCount = metrics.turnCount;
    if (metrics?.fillerCount) participant.fillerCount = metrics.fillerCount;
    if (metrics?.interruptionCount) participant.interruptionCount = metrics.interruptionCount;
    if (metrics?.relevanceScore) participant.relevanceScore = metrics.relevanceScore;
    if (metrics?.communicationScore) participant.communicationScore = metrics.communicationScore;
    if (metrics?.leadershipScore) participant.leadershipScore = metrics.leadershipScore;
    if (metrics?.collaborationScore) participant.collaborationScore = metrics.collaborationScore;
    if (metrics?.confidenceScore) participant.confidenceScore = metrics.confidenceScore;
    if (metrics?.criticalThinkingScore) participant.criticalThinkingScore = metrics.criticalThinkingScore;
    
    if (transcript) {
      participant.transcript = (participant.transcript || "") + (participant.transcript ? " " : "") + transcript;
      session.transcripts.push({
        userId,
        userName: userName || participant.name,
        text: transcript,
        timestamp: new Date()
      });
    }

    await session.save();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

