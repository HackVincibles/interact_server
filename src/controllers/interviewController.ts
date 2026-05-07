import { Request, Response } from 'express';
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from 'zod';
import Interview from '../models/Interview';
import Feedback from '../models/Feedback';
import { recordActivity, XP_REWARDS } from '../utils/gamification';

const feedbackSchema = z.object({
  totalScore: z.number(),
  categoryScores: z.object({
    communicationSkills: z.number(),
    technicalKnowledge: z.number(),
    problemSolving: z.number(),
    culturalFit: z.number(),
    confidenceClarity: z.number(),
  }),
  strengths: z.array(z.string()),
  areasForImprovement: z.array(z.string()),
  finalAssessment: z.string(),
});

export const createFeedback = async (req: any, res: Response) => {
  const { interviewId, userId, transcript, feedbackId } = req.body;

  try {
    if (!Array.isArray(transcript)) {
      return res.status(400).json({ success: false, message: 'transcript must be an array' });
    }

    const formattedTranscript = transcript
      .map((sentence: any) => `- ${sentence.role}: ${sentence.content}\n`)
      .join("");

    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: feedbackSchema,
      prompt: `
        Analyze this mock interview. Score from 0 to 100.
        Transcript:
        ${formattedTranscript}
      `,
    });

    const feedbackData = {
      interviewId,
      userId,
      ...object,
    };

    let feedback;
    if (feedbackId) {
      feedback = await Feedback.findByIdAndUpdate(feedbackId, feedbackData, { new: true, upsert: true });
    } else {
      feedback = await Feedback.create(feedbackData);
    }

    // Award XP and update gamification stats
    try {
      const recentFeedbacks = await Feedback.find({ userId }).sort({ createdAt: -1 }).limit(5);
      const recentScores = recentFeedbacks.map((f: any) => f.totalScore || 0);
      const xpGain =
        XP_REWARDS.INTERVIEW_COMPLETED +
        (object.totalScore >= 90 ? XP_REWARDS.PERFECT_SCORE : 0);
      await recordActivity(userId, 'interview', xpGain, recentScores);
    } catch (xpErr) {
      console.warn('XP update failed (non-critical):', xpErr);
    }

    res.status(200).json({ success: true, data: feedback });
  } catch (error: any) {
    if (error.statusCode === 429) {
      return res.status(429).json({ 
        success: false, 
        message: 'AI quota exceeded. Please wait a moment and try again.' 
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getInterviewsByUser = async (req: any, res: Response) => {
  try {
    const interviews = await Interview.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: interviews });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getInterviewById = async (req: Request, res: Response) => {
  try {
    const interview = await Interview.findById(req.params.id);
    res.status(200).json({ success: true, data: interview });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getFeedbackByInterviewId = async (req: Request, res: Response) => {
  try {
    const feedback = await Feedback.findOne({ interviewId: req.params.interviewId });
    res.status(200).json({ success: true, data: feedback });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
