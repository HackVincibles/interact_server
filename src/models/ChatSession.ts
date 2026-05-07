import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface IInterviewConfig {
  role: string;
  techStack: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  totalQuestions: number;
  currentQuestion: number;
}

export interface IFeedback {
  totalScore: number;
  categoryScores: {
    communicationSkills: number;
    technicalKnowledge: number;
    problemSolving: number;
    culturalFit: number;
    confidenceClarity: number;
  };
  strengths: string[];
  areasForImprovement: string[];
  finalAssessment: string;
  rating: number; // 1-5 stars
}

export interface IChatSession extends Document {
  userId: string;
  sessionId: string;
  mode: 'interview' | 'tech-helper';
  title: string;
  messages: IMessage[];
  interviewConfig?: IInterviewConfig;
  status: 'active' | 'completed' | 'abandoned';
  feedback?: IFeedback;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>({
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const InterviewConfigSchema = new Schema<IInterviewConfig>({
  role: { type: String, default: 'Software Engineer' },
  techStack: { type: [String], default: [] },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  totalQuestions: { type: Number, default: 8 },
  currentQuestion: { type: Number, default: 0 },
});

const FeedbackSchema = new Schema<IFeedback>({
  totalScore: { type: Number, default: 0 },
  categoryScores: {
    communicationSkills: { type: Number, default: 0 },
    technicalKnowledge: { type: Number, default: 0 },
    problemSolving: { type: Number, default: 0 },
    culturalFit: { type: Number, default: 0 },
    confidenceClarity: { type: Number, default: 0 },
  },
  strengths: { type: [String], default: [] },
  areasForImprovement: { type: [String], default: [] },
  finalAssessment: { type: String, default: '' },
  rating: { type: Number, default: 0 }, // 1-5 stars
});

const ChatSessionSchema = new Schema<IChatSession>(
  {
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, unique: true },
    mode: { type: String, enum: ['interview', 'tech-helper'], required: true },
    title: { type: String, default: 'New Chat' },
    messages: { type: [MessageSchema], default: [] },
    interviewConfig: { type: InterviewConfigSchema },
    status: { type: String, enum: ['active', 'completed', 'abandoned'], default: 'active' },
    feedback: { type: FeedbackSchema },
  },
  { timestamps: true }
);

ChatSessionSchema.index({ userId: 1, updatedAt: -1 });
ChatSessionSchema.index({ userId: 1, mode: 1 });

export default mongoose.model<IChatSession>('ChatSession', ChatSessionSchema);
