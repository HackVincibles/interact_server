import { Request, Response } from 'express';
// Removed AI SDK imports
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

  let session: any = null;
  try {
    session = await ChatSession.findOne({ sessionId, userId });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    if (session.status === 'completed') {
      return res.status(400).json({ success: false, message: 'This session is completed. Start a new chat.' });
    }

    // Auto-generate title from first user message ONLY for tech-helper mode
    if (session.messages.length === 0 && session.mode === 'tech-helper') {
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

    let fullResponse = '';

    const vapiApiKey = process.env.VAPI_API_KEY || '';
    const vapiAssistantId = session.mode === 'interview'
      ? (process.env.VAPI_INTERVIEW_ASSISTANT_ID || process.env.VAPI_ASSISTANT_ID || '')
      : (process.env.VAPI_TECH_HELPER_ASSISTANT_ID || process.env.VAPI_ASSISTANT_ID || '');

    // Build full conversation history as formatted text for Vapi context
    const historyText = session.messages
      .filter((m: any) => m.role !== 'system')
      .map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    // Inject history into the input so Vapi LLM has full context
    const vapiInput = historyText
      ? `[CONVERSATION SO FAR:\n${historyText}\n]\n\nContinue naturally from the above conversation. Do NOT re-introduce yourself. The user's latest message is: "${content}"`
      : content;

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
            model: 'gpt-4o-mini',
            systemPrompt: systemPrompt,
          },
        },
        input: vapiInput,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vapi API error: ${errorText}`);
    }

    const reader = response.body;
    if (!reader) {
      throw new Error('Vapi response body is null');
    }

    const decoder = new TextDecoder();
    // @ts-ignore
    for await (const chunk of reader) {
      const text = decoder.decode(chunk);
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (!dataStr) continue;
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.delta) {
              fullResponse += parsed.delta;
              res.write(`data: ${JSON.stringify({ text: parsed.delta })}\n\n`);
            }
          } catch (e) {
            // Ignore incomplete chunks
          }
        }
      }
    }

    // Save AI response to DB if it's not empty
    if (fullResponse.trim()) {
      session.messages.push({ role: 'assistant', content: fullResponse.trim(), timestamp: new Date() });

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
    } else {
      throw new Error('Received empty response from Gemini AI. Your API quota might be exceeded.');
    }
  } catch (error: any) {
    console.error('Chat error:', error);
    const isQuotaError = 
      error?.statusCode === 429 || 
      error?.status === 429 ||
      (error?.message && typeof error.message === 'string' && (
        error.message.toLowerCase().includes('quota') ||
        error.message.toLowerCase().includes('limit') ||
        error.message.toLowerCase().includes('429') ||
        error.message.toLowerCase().includes('resource_exhausted')
      ));

    if (isQuotaError && session) {
      console.warn('⚠️ Gemini Quota Exceeded. Activating word-by-word Mock AI fallback stream!');
      
      let fallbackResponse = '';
      if (session.mode === 'interview') {
        const mockReplies = [
          "That's a very solid explanation. Can you elaborate on how you would optimize that for scale and performance?",
          "Interesting approach! How would you handle potential edge cases, error boundaries, and unexpected inputs in this scenario?",
          "Excellent. Let's move to the next question: how do you manage global state and asynchronous side-effects in a large-scale application?",
          "Understood. How do you ensure high performance, indexing, and low latency when querying large databases?",
          "That wraps up our interview questions! You did a wonderful job explaining your technical decisions. Type 'end interview' to get your detailed feedback and rating."
        ];
        const userMsgCount = session.messages.filter((m: any) => m.role === 'user').length;
        const qIndex = Math.max(0, userMsgCount - 1) % mockReplies.length;
        fallbackResponse = mockReplies[qIndex];
      } else {
        const lastUserMsg = content?.toLowerCase() || '';
        if (lastUserMsg.includes('react') || lastUserMsg.includes('hook') || lastUserMsg.includes('state') || lastUserMsg.includes('effect')) {
          fallbackResponse = "That's a great React question! Since my Gemini API quota is temporarily exceeded, here is a quick tip: remember that hooks must be called at the top level of your functional component and never inside loops or conditions. Always list all dependencies in your dependency arrays to avoid stale closures. Let me know if you would like me to review your specific hook implementation once the quota resets!";
        } else if (lastUserMsg.includes('docker') || lastUserMsg.includes('container') || lastUserMsg.includes('kubernetes')) {
          fallbackResponse = "Docker is highly essential for modern deployment! Since my Gemini API quota is temporarily exceeded, here's a mentor tip: always use multi-stage builds to minimize your final image size. This keeps your production images secure and fast to download. Feel free to share your Dockerfile or compose configuration once the quota resets and we can optimize it together!";
        } else if (lastUserMsg.includes('database') || lastUserMsg.includes('sql') || lastUserMsg.includes('mongodb') || lastUserMsg.includes('query')) {
          fallbackResponse = "Database optimization is key for scale! Since my Gemini API quota is temporarily exceeded, here's a quick tip: ensure your frequently-queried fields are properly indexed, and always explain your query execution plan to spot bottlenecks early. Let's optimize your schemas and query patterns as soon as my API quota resets!";
        } else if (lastUserMsg.includes('error') || lastUserMsg.includes('bug') || lastUserMsg.includes('debug') || lastUserMsg.includes('fix')) {
          fallbackResponse = "Debugging is where real learning happens! Since my Gemini API quota is temporarily exceeded, here is a pro-tip: start by isolating the issue. Log the inputs, outputs, and intermediate states. Check your try-catch blocks and network tabs. Share the error stack trace once the quota resets, and we'll track down the bug together!";
        } else {
          fallbackResponse = "That is an excellent technical question! Since my Gemini API quota is temporarily exceeded, here is a senior-level perspective: always prioritize clean, modular code design, write descriptive variable names, and keep error handling robust. Let me know if you would like me to dive deeper into your question as soon as my API quota resets!";
        }
      }

      if (!res.headersSent) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_URL || 'http://localhost:3000');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      // Stream the fallback response word-by-word with typing delay
      const words = fallbackResponse.split(' ');
      for (const word of words) {
        res.write(`data: ${JSON.stringify({ text: word + ' ' })}\n\n`);
        await new Promise(resolve => setTimeout(resolve, 80)); // 80ms typing delay
      }

      // Save mock response to DB
      session.messages.push({ role: 'assistant', content: fallbackResponse, timestamp: new Date() });
      await session.save();

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    }

    const msg = error.message;
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: msg });
    } else {
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
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

  let session: any = null;
  try {
    session = await ChatSession.findOne({ sessionId, userId });
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

    const vapiApiKey = process.env.VAPI_API_KEY || '';
    const systemPrompt = `You are an expert HR evaluator. Analyze this mock interview transcript and provide detailed feedback.

Interview Role: ${session.interviewConfig?.role || 'Software Engineer'}
Tech Stack: ${session.interviewConfig?.techStack?.join(', ') || 'General'}
Difficulty: ${session.interviewConfig?.difficulty || 'medium'}

TRANSCRIPT:
${transcript}

INSTRUCTIONS:
Evaluate the candidate dynamically based purely on the provided transcript.
You MUST return ONLY valid JSON matching this exact schema. Do NOT return markdown formatting (do not wrap in \`\`\`json) or extra text.
Replace the example numbers and placeholder strings below with the candidate's ACTUAL dynamic evaluation scores:

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
    const feedback = JSON.parse(jsonString);

    // Save feedback and mark as completed
    session.feedback = feedback as any;
    session.status = 'completed';
    await session.save();

    res.status(200).json({ success: true, data: { feedback, sessionId } });
  } catch (error: any) {
    console.error('End interview error:', error);
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
      console.error('⚠️ Gemini Quota Exceeded during report generation.');
      return res.status(429).json({ 
        success: false, 
        message: 'AI API Rate Limit Exceeded. Please wait a few moments and try generating the report again.' 
      });
    }

    res.status(500).json({ success: false, message: error.message });
  }
};
