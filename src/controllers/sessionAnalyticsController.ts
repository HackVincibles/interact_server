import { Request, Response } from 'express';
import { BehavioralAnalytics } from '../models/BehavioralAnalytics';
import { BehavioralSummary } from '../models/BehavioralSummary';
import { generateBehavioralSummaryAsync } from '../services/behavioralSummaryService';

/**
 * Receives batched analytics from the client's AI Coach (every 10s)
 */
export const syncCoachMetrics = async (req: Request, res: Response) => {
  try {
    const { sessionId, participantId, timestamp, eyeContactState, postureState, engagementState } = req.body;

    if (!sessionId || !participantId) {
      return res.status(400).json({ error: 'Missing sessionId or participantId' });
    }

    // Save the snapshot
    await BehavioralAnalytics.create({
      sessionId,
      participantId,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      eyeContactState,
      postureState,
      engagementState
    });

    // Return a 204 No Content to keep it extremely lightweight on the network
    return res.status(204).send();
  } catch (error) {
    console.error('Failed to sync coach metrics:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Retrieves the AI-generated behavioral summary post-session.
 * Non-blocking: if not cached, it triggers generation and returns 202.
 */
export const getBehavioralSummary = async (req: Request, res: Response) => {
  try {
    const { sessionId, participantId } = req.params;

    if (!sessionId || !participantId) {
      return res.status(400).json({ error: 'Missing sessionId or participantId' });
    }

    // 1. Check if summary is already cached
    const cachedSummary = await BehavioralSummary.findOne({ sessionId, participantId });
    
    if (cachedSummary) {
      return res.status(200).json({
        status: 'completed',
        summary: cachedSummary.summaryText,
        rawStats: {
          engagementRatio: cachedSummary.engagementRatio,
          postureRatio: cachedSummary.postureRatio,
          eyeContactRatio: cachedSummary.eyeContactRatio
        }
      });
    }

    // 2. If not cached, trigger the generation asynchronously (fire-and-forget)
    generateBehavioralSummaryAsync(sessionId, participantId).catch(err => {
      console.error('[AI Coach] Background task failed:', err);
    });

    // 3. Immediately return to prevent blocking the recruiter dashboard
    return res.status(202).json({
      status: 'processing',
      message: 'Summary is currently being generated. Please poll again shortly.'
    });

  } catch (error) {
    console.error('Failed to get behavioral summary:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

