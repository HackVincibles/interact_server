import { Request, Response } from 'express';
// Removed AI SDK imports
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

    const vapiApiKey = process.env.VAPI_API_KEY || '';
    const systemPrompt = `Analyze this mock interview transcript. Score from 0 to 100.
Transcript:
${formattedTranscript}

INSTRUCTIONS:
Evaluate the candidate dynamically based purely on the provided transcript.
You MUST return ONLY valid JSON matching this exact schema. Do NOT return markdown formatting (do not wrap in \`\`\`json) or extra text.
Replace the placeholders below with the candidate's ACTUAL dynamic evaluation scores:

{
  "totalScore": <evaluate dynamic total score 0-100>,
  "categoryScores": {
    "communicationSkills": <dynamic score 0-100>,
    "technicalKnowledge": <dynamic score 0-100>,
    "problemSolving": <dynamic score 0-100>,
    "culturalFit": <dynamic score 0-100>,
    "confidenceClarity": <dynamic score 0-100>
  },
  "strengths": ["<dynamic strength 1>", "<dynamic strength 2>"],
  "areasForImprovement": ["<dynamic improvement 1>", "<dynamic improvement 2>"],
  "finalAssessment": "<dynamic summary based on the interview>",
  "rating": <dynamic rating 1-5>,
  "sentimentAnalysis": {
    "overallTone": "<dynamic tone e.g. Confident, Enthusiastic, Hesitant>",
    "confidenceLevel": <dynamic percentage 0-100>,
    "professionalism": <dynamic percentage 0-100>,
    "engagement": <dynamic percentage 0-100>,
    "behavioralNotes": ["<dynamic behavioral note 1>", "<dynamic behavioral note 2>"]
  }
}

IMPORTANT: Your response must be the complete JSON object starting with the '{' character and ending with the '}' character. Do not omit the opening brace!`;

    const response = await fetch('https://api.vapi.ai/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assistant: {
          model: {
            provider: 'openai',
            model: 'gpt-4o',
            systemPrompt: systemPrompt,
          },
        },
        input: "Please generate the JSON feedback report.",
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Vapi API error: ${await response.text()}`);
    }

    const data = await response.json();
    let content = data.output?.[0]?.content || '';
    
    // Fallback: If VAPI model omits the opening brace and acts like a continuation
    const trimmed = content.trim();
    if (trimmed.startsWith('"totalScore"')) {
      content = '{\n' + content;
    }
    
    // Robustly extract JSON object using substring
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      console.error("LLM Output:", content);
      throw new Error("Invalid response format from AI: Missing JSON object");
    }
    
    const jsonString = content.substring(jsonStart, jsonEnd + 1);
    const object = JSON.parse(jsonString);

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
    const isQuotaError = 
      error?.statusCode === 429 || 
      error?.status === 429 ||
      (error?.message && typeof error.message === 'string' && (
        error.message.toLowerCase().includes('quota') ||
        error.message.toLowerCase().includes('limit') ||
        error.message.toLowerCase().includes('429') ||
        error.message.toLowerCase().includes('resource_exhausted')
      ));

    if (isQuotaError) {
      console.error('⚠️ Gemini Quota Exceeded during voice interview report generation.');
      return res.status(429).json({ 
        success: false, 
        message: 'AI API Rate Limit Exceeded. Please wait a few moments and try generating the report again.' 
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
