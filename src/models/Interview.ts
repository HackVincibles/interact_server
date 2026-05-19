import mongoose, { Schema, Document } from 'mongoose';

export interface IInterview extends Document {
  userId: string;
  vapiId?: string;
  finalized: boolean;
  type: string;
  role?: string;
  level?: string;
  techstack: string[];
  questions: string[];
  transcript: any[];
  durationSeconds?: number;
  createdAt: Date;
}

const InterviewSchema: Schema = new Schema({
  userId: { type: String, required: true },
  vapiId: { type: String },
  finalized: { type: Boolean, default: false },
  type: { type: String },
  role: { type: String },
  level: { type: String },
  techstack: { type: [String], default: [] },
  questions: { type: [String], default: [] },
  transcript: { type: Array, default: [] },
  durationSeconds: { type: Number },
  createdAt: { type: Date, default: Date.now },
});

// Index for faster user-specific queries
InterviewSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<IInterview>('Interview', InterviewSchema);
