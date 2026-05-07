import { Request, Response } from 'express';
import { streamText, generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import ChatSession from '../models/ChatSession';

// ─── System Prompts ──────────────────────────────────────────────────────────

const buildInterviewSystemPrompt = (config: {
  role: string;
  techStack: string[];
  difficulty: string;
  totalQuestions: number;
}) => `You are an expert technical interviewer at a top-tier tech company.
You are conducting a mock interview for a ${config.role} position.
Tech stack focus: ${config.techStack.join(', ') || 'General programming'}.
Difficulty level: ${config.difficulty}.
Total questions to ask: ${config.totalQuestions}.

STRICT RULES:
1. Start with a warm greeting and ask the candidate to introduce themselves briefly.
2. Ask exactly ONE question at a time. Keep your questions and responses very brief and concise.
3. Ask follow-up questions to dig deeper when the answer is vague or incomplete, keeping them short.
4. Mix question types: conceptual, behavioral (STAR method), scenario-based, and coding logic.
5. Be conversational but professional — vary your language, don't be robotic.
6. DO NOT give away answers, hints, or correct the candidate during the interview.
7. Track question count internally. After ${config.totalQuestions} main questions, say: "That wraps up our interview! You did [brief comment]. Type 'end interview' to get your detailed feedback and rating."
8. If the candidate says "end interview" or "finish" or "done", respond: "Thanks for the interview! Generating your performance report now..." then stop.
9. Be encouraging but realistic — like a real professional interviewer. Avoid long-winded commentary.`;

const TECH_HELPER_SYSTEM_PROMPT = `You are a brilliant, friendly senior software engineer and mentor at a top tech company.
You help developers with ALL technical questions with deep expertise.

YOUR EXPERTISE INCLUDES:
- All programming languages (JavaScript, TypeScript, Python, Java, C++, Go, Rust, etc.)
- Frontend: React, Next.js, Vue, Angular, CSS, HTML
- Backend: Node.js, Express, Django, Spring, FastAPI
- Databases: SQL, MongoDB, Redis, PostgreSQL
- DSA: Arrays, Trees, Graphs, DP, Sorting, Searching
- System Design: scalability, microservices, caching, load balancing
- DevOps: Docker, Kubernetes, CI/CD, AWS, GCP
- CS Fundamentals: OS, networking, security

COMMUNICATION STYLE:
1. Keep all your answers extremely short, concise, and direct by default. Avoid long-winded paragraphs.
2. ONLY provide deep details, massive elaborations, or long line-by-line breakdowns IF the user explicitly asks for detailed explanations (e.g. "explain in detail", "elaborate", "detailed steps").
3. Always use short, precise code examples with proper syntax when explaining technical concepts.
4. Explain complex topics step-by-step using short bullet points — break them down like teaching a smart colleague quickly.
5. Use markdown formatting: ## headers, bullet points, \`\`\`code blocks\`\`\`, **bold** for key terms.
6. If a question is ambiguous, ask a brief clarifying question before answering.
7. Be warm, encouraging, and mentor-like. Use brief phrases like "Great question!", "Here's the key insight:", etc.
8. After answering, offer to dive deeper or ask if they need examples.
9. Never say "I don't know" — always provide your best concise knowledge or redirect constructively.`;

// ─── Feedback Schema ─────────────────────────────────────────────────────────

const feedbackSchema = z.object({
  totalScore: z.number().min(0).max(100),
  categoryScores: z.object({
    communicationSkills: z.number().min(0).max(100),
    technicalKnowledge: z.number().min(0).max(100),
    problemSolving: z.number().min(0).max(100),
    culturalFit: z.number().min(0).max(100),
    confidenceClarity: z.number().min(0).max(100),
  }),
  strengths: z.array(z.string()).min(2).max(5),
  areasForImprovement: z.array(z.string()).min(2).max(5),
  finalAssessment: z.string(),
  rating: z.number().min(1).max(5), // 1-5 stars
});

// ─── Auto-generate title from first message ──────────────────────────────────

const generateTitle = (content: string): string => {
  const clean = content.trim().replace(/[^\w\s]/g, '').slice(0, 60);
  return clean.length > 3 ? clean : 'New Chat';
};

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /api/chat/sessions
 * Create a new chat session (both modes)
 */
export const createSession = async (req: any, res: Response) => {
  const { mode, interviewConfig } = req.body;
  const userId = req.user?.id || req.user?._id;

  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  if (!['interview', 'tech-helper'].includes(mode)) {
    return res.status(400).json({ success: false, message: 'Invalid mode' });
  }

  try {
    const sessionId = uuidv4();

    const sessionData: any = {
      userId,
      sessionId,
      mode,
      title: mode === 'interview'
        ? `Interview: ${interviewConfig?.role || 'Software Engineer'}`
        : 'New Tech Chat',
      messages: [],
      status: 'active',
    };

    if (mode === 'interview' && interviewConfig) {
      sessionData.interviewConfig = {
        role: interviewConfig.role || 'Software Engineer',
        techStack: interviewConfig.techStack || [],
        difficulty: interviewConfig.difficulty || 'medium',
        totalQuestions: interviewConfig.totalQuestions || 8,
        currentQuestion: 0,
      };
    }

    const session = await ChatSession.create(sessionData);
    res.status(201).json({ success: true, data: session });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/chat/sessions
 * Get all sessions for the authenticated user (history list)
 */
export const getUserSessions = async (req: any, res: Response) => {
  const userId = req.user?.id || req.user?._id;
  const { mode } = req.query;

  try {
    const filter: any = { userId };
    if (mode) filter.mode = mode;

    const sessions = await ChatSession.find(filter)
      .select('sessionId mode title status feedback.totalScore feedback.rating messages updatedAt createdAt interviewConfig')
      .sort({ updatedAt: -1 })
      .lean();

    // Add messageCount to each session
    const sessionsWithCount = sessions.map((s: any) => ({
      ...s,
      messageCount: s.messages?.length || 0,
      messages: undefined, // don't return full messages in list
    }));

    res.status(200).json({ success: true, data: sessionsWithCount });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/chat/sessions/:sessionId
 * Get a single session with FULL message history (to continue a chat)
 */
export const getSession = async (req: any, res: Response) => {
  const userId = req.user?.id || req.user?._id;
  const { sessionId } = req.params;

  try {
    const session = await ChatSession.findOne({ sessionId, userId });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    res.status(200).json({ success: true, data: session });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/chat/sessions/:sessionId
 * Delete a chat session
 */
export const deleteSession = async (req: any, res: Response) => {
  const userId = req.user?.id || req.user?._id;
  const { sessionId } = req.params;

  try {
    const session = await ChatSession.findOneAndDelete({ sessionId, userId });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    res.status(200).json({ success: true, message: 'Session deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/chat/sessions/:sessionId/title
 * Rename a session
 */
export const renameSession = async (req: any, res: Response) => {
  const userId = req.user?.id || req.user?._id;
  const { sessionId } = req.params;
  const { title } = req.body;

  if (!title?.trim()) {
    return res.status(400).json({ success: false, message: 'Title is required' });
  }

  try {
    const session = await ChatSession.findOneAndUpdate(
      { sessionId, userId },
      { title: title.trim() },
      { new: true }
    );
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    res.status(200).json({ success: true, data: session });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/chat/sessions/:sessionId/message
 * Send a message and stream back AI response (works for both modes)
 */
export const sendMessage = async (req: any, res: Response) => {
  const userId = req.user?.id || req.user?._id;
  const { sessionId } = req.params;
  const { content } = req.body;

  if (!content?.trim()) {
    return res.status(400).json({ success: false, message: 'Message content is required' });
  }

  try {
    const session = await ChatSession.findOne({ sessionId, userId });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    if (session.status === 'completed') {
      return res.status(400).json({ success: false, message: 'This session is completed. Start a new chat.' });
    }

    // Auto-generate title from first user message
    if (session.messages.length === 0) {
      session.title = generateTitle(content);
    }

    // Save user message
    session.messages.push({ role: 'user', content: content.trim(), timestamp: new Date() });

    // Build messages array for Gemini (exclude system messages)
    const geminiMessages = session.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // Build system prompt based on mode
    const systemPrompt = session.mode === 'interview'
      ? buildInterviewSystemPrompt({
          role: session.interviewConfig?.role || 'Software Engineer',
          techStack: session.interviewConfig?.techStack || [],
          difficulty: session.interviewConfig?.difficulty || 'medium',
          totalQuestions: session.interviewConfig?.totalQuestions || 8,
        })
      : TECH_HELPER_SYSTEM_PROMPT;

    // Set up SSE headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_URL || 'http://localhost:3000');

    let fullResponse = '';

    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      messages: geminiMessages,
    });

    for await (const chunk of result.textStream) {
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }

    // Save AI response to DB
    session.messages.push({ role: 'assistant', content: fullResponse, timestamp: new Date() });

    // Track interview question count
    if (session.mode === 'interview' && session.interviewConfig) {
      session.interviewConfig.currentQuestion = Math.min(
        (session.interviewConfig.currentQuestion || 0) + 1,
        session.interviewConfig.totalQuestions
      );
    }

    await session.save();

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error('Chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
};

/**
 * POST /api/chat/sessions/:sessionId/end-interview
 * End an interview session and generate detailed feedback + rating
 */
export const endInterview = async (req: any, res: Response) => {
  const userId = req.user?.id || req.user?._id;
  const { sessionId } = req.params;

  try {
    const session = await ChatSession.findOne({ sessionId, userId });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    if (session.mode !== 'interview') {
      return res.status(400).json({ success: false, message: 'Only interview sessions can be ended' });
    }

    const transcript = session.messages
      .filter((m) => m.role !== 'system')
      .map((m) => `${m.role === 'user' ? 'Candidate' : 'Interviewer'}: ${m.content}`)
      .join('\n\n');

    if (!transcript.trim()) {
      return res.status(400).json({ success: false, message: 'No conversation to evaluate' });
    }

    const { object: feedback } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: feedbackSchema,
      prompt: `You are an expert HR evaluator. Analyze this mock interview transcript and provide detailed feedback.

Interview Role: ${session.interviewConfig?.role || 'Software Engineer'}
Tech Stack: ${session.interviewConfig?.techStack?.join(', ') || 'General'}
Difficulty: ${session.interviewConfig?.difficulty || 'medium'}

TRANSCRIPT:
${transcript}

INSTRUCTIONS:
- Score each category 0-100 based on the candidate's actual performance in the transcript
- totalScore = weighted average of all category scores
- rating = 1-5 stars (1=poor, 2=below average, 3=average, 4=good, 5=excellent)
- strengths: 2-4 specific things the candidate did well (with examples from transcript)
- areasForImprovement: 2-4 specific areas to work on (with actionable advice)
- finalAssessment: 2-3 sentences summary of overall performance and hiring recommendation`,
    });

    // Save feedback and mark as completed
    session.feedback = feedback as any;
    session.status = 'completed';
    await session.save();

    res.status(200).json({ success: true, data: { feedback, sessionId } });
  } catch (error: any) {
    if (error.statusCode === 429) {
      return res.status(429).json({ success: false, message: 'AI quota exceeded. Please try again.' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};
