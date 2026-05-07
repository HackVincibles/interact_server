import dotenv from 'dotenv';

// Load environment variables immediately
dotenv.config();

// ─── Startup env validation ─────────────────────────────────────────────────
const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET'];
const OPTIONAL_ENV_WARNINGS: Record<string, string> = {
  GOOGLE_GENERATIVE_AI_API_KEY: 'AI features (code review, interview feedback) will fail.',
  VAPI_API_KEY: 'Voice interview features will not work.',
  CLOUDINARY_CLOUD_NAME: 'Avatar & resume uploads will not work.',
};

let missingRequired = false;
REQUIRED_ENV.forEach(key => {
  if (!process.env[key]) {
    console.error(`❌ FATAL: Missing required env var: ${key}`);
    missingRequired = true;
  }
});
if (missingRequired) {
  console.error('Fix your server/.env file and restart.');
  process.exit(1);
}

Object.entries(OPTIONAL_ENV_WARNINGS).forEach(([key, warning]) => {
  if (!process.env[key]) {
    console.warn(`⚠️  Missing optional env var: ${key} → ${warning}`);
  }
});

import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import codeExecutionRoutes from './routes/codeExecution';
import authRoutes from './routes/auth';
import gdRoutes from './routes/gd';
import uploadRoutes from './routes/upload';
import interviewRoutes from './routes/interview';
import userRoutes from './routes/user';
import statsRoutes from './routes/stats';
import playlistRoutes from './routes/playlist';
import chatRoutes from './routes/chat';
import analyticsRoutes from './routes/analytics';
import path from 'path';
import { Router } from 'express';
import { reviewCode } from './controllers/codeReviewController';
import { protect } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Security middleware ─────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
}));

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// ─── Global rate limiter (generous fallback) ─────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// ─── Per-route strict limiters ────────────────────────────────────────────────
const codeExecutionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 20,
  message: { error: 'Code execution rate limit exceeded. Max 20 executions/min.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many auth attempts. Please try again in 15 minutes.' },
});

const codeReviewLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: { error: 'Code review rate limit exceeded. Max 15 per minute.' },
});

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ─── Logging ──────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'interactai-server',
    version: '2.0.0',
  });
});

// ─── API routes ───────────────────────────────────────────────────────────────
app.use('/api/execute', codeExecutionLimiter, codeExecutionRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/gd', gdRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/analytics', analyticsRoutes);

// AI Code Review route
const codeReviewRouter = Router();
codeReviewRouter.post('/review', protect, codeReviewLimiter, reviewCode);
app.use('/api/code', codeReviewRouter);

// ─── Static files ─────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ─── MongoDB + start ──────────────────────────────────────────────────────────
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI!);
    console.log(`📡 MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1);
  }
};

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 InteractAI Server v2.0 running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Piston API: ${process.env.PISTON_API_URL || 'https://emkc.org/api/v2/piston'}`);
    console.log(`🤖 Gemini AI: ${process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'Configured ✅' : 'Not configured ⚠️'}`);
  });
});

export default app;
