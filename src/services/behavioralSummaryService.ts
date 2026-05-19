import { BehavioralAnalytics } from '../models/BehavioralAnalytics';
import { BehavioralSummary } from '../models/BehavioralSummary';
import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
});

/**
 * Asynchronously generates and caches the behavioral summary to the database.
 * Designed to be fired-and-forgotten to avoid blocking.
 */
export const generateBehavioralSummaryAsync = async (sessionId: string, participantId: string) => {
  try {
    // 1. Check if summary already exists (idempotent)
    const existing = await BehavioralSummary.findOne({ sessionId, participantId });
    if (existing) return existing;

    // 2. Fetch all metrics for this user in this session
    const metrics = await BehavioralAnalytics.find({ sessionId, participantId }).sort({ timestamp: 1 });

    if (!metrics || metrics.length === 0) {
      console.warn(`[AI Coach] No behavioral data recorded for session ${sessionId}, participant ${participantId}`);
      return null;
    }

    // 3. Aggregate qualitative metrics
    const totalSnapshots = metrics.length;
    let engagedCount = 0;
    let stablePostureCount = 0;
    let goodEyeContactCount = 0;

    metrics.forEach(m => {
      if (m.engagementState === 'Focused' || m.engagementState === 'Engaged') engagedCount++;
      if (m.postureState === 'Stable') stablePostureCount++;
      if (m.eyeContactState === 'Good') goodEyeContactCount++;
    });

    const engagementRatio = engagedCount / totalSnapshots;
    const postureRatio = stablePostureCount / totalSnapshots;
    const eyeContactRatio = goodEyeContactCount / totalSnapshots;

    // 4. Prepare strict, non-psychological context for the LLM
    const promptContext = `
      You are an expert HR behavioral analyst. 
      Review the following automated behavioral coaching metrics for a candidate during a video interview.
      
      METRICS:
      - Engagement Consistency: ${(engagementRatio * 100).toFixed(0)}% of the time they were engaged or focused.
      - Posture Stability: ${(postureRatio * 100).toFixed(0)}% of the time they maintained stable posture.
      - Eye Contact: ${(eyeContactRatio * 100).toFixed(0)}% of the time they maintained good eye contact with the camera.

      RULES:
      1. Write a brief, 2-3 sentence summary of their physical presence.
      2. Do NOT diagnose them psychologically (e.g., do not say they were "nervous" or "lying").
      3. Use professional, objective language (e.g., "Maintained strong camera focus", "Posture was generally stable").
      4. Provide actionable, supportive feedback if scores are low.
    `;

    let summaryText = `Candidate maintained engagement ${Math.round(engagementRatio * 100)}% of the time. Posture was stable ${Math.round(postureRatio * 100)}% of the time.`;

    // 5. Generate AI Summary if API key is present
    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      try {
        const { text } = await generateText({
          model: google('gemini-2.5-flash'),
          prompt: promptContext,
          temperature: 0.3, // Keep it objective and consistent
        });
        summaryText = text;
      } catch (llmError) {
        console.error('[AI Coach] LLM generation failed, falling back to basic summary:', llmError);
      }
    }

    // 6. Cache result to Database
    const newSummary = await BehavioralSummary.create({
      sessionId,
      participantId,
      summaryText,
      engagementRatio,
      postureRatio,
      eyeContactRatio
    });

    return newSummary;
  } catch (error) {
    console.error('[AI Coach] Background summary generation failed:', error);
    return null;
  }
};

