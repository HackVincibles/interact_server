import { Request, Response } from 'express';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

const codeReviewSchema = z.object({
  overallScore: z.number().min(0).max(10),
  verdict: z.enum(['excellent', 'good', 'needs_improvement', 'poor']),
  timeComplexity: z.string(),
  spaceComplexity: z.string(),
  correctness: z.number().min(0).max(10),
  codeQuality: z.number().min(0).max(10),
  efficiency: z.number().min(0).max(10),
  readability: z.number().min(0).max(10),
  strengths: z.array(z.string()),
  issues: z.array(z.object({
    severity: z.enum(['critical', 'warning', 'suggestion']),
    description: z.string(),
    fix: z.string(),
  })),
  optimizedApproach: z.string(),
  interviewTip: z.string(),
});

export const reviewCode = async (req: any, res: Response) => {
  try {
    const { code, language, problem } = req.body as {
      code: string;
      language: string;
      problem?: string;
    };

    if (!code || !language || typeof code !== 'string' || typeof language !== 'string') {
      return res.status(400).json({ success: false, message: 'code and language must be provided as strings' });
    }

    if (code.length > 10000) {
      return res.status(400).json({ success: false, message: 'Code too long. Max 10,000 characters.' });
    }

    const problemContext = problem
      ? `The problem statement is:\n${problem}\n\n`
      : '';

    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: codeReviewSchema,
      prompt: `
You are an expert technical interviewer reviewing code for a software engineering interview.
${problemContext}
The candidate wrote this ${language} code:

\`\`\`${language}
${code}
\`\`\`

Analyze the code thoroughly:
1. Score overall quality (0–10)
2. Determine time and space complexity in Big-O notation
3. Identify issues by severity (critical, warning, suggestion)
4. Score correctness, code quality, efficiency, and readability (0–10 each)
5. List strengths
6. Describe a more optimal approach if one exists
7. Give an interview-specific tip for this type of problem

Be direct, specific, and constructive. Focus on what matters in a real technical interview.
      `,
    });

    return res.status(200).json({ success: true, data: object });
  } catch (error: any) {
    if (error.statusCode === 429) {
      return res.status(429).json({ 
        success: false, 
        message: 'AI quota exceeded. Please wait a moment and try again.' 
      });
    }
    console.error('Code review error:', error);
    res.status(500).json({ success: false, message: error.message || 'Code review failed' });
  }
};
