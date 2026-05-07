import mongoose, { Schema, Document } from 'mongoose';

export interface IFeedback extends Document {
  interviewId: string;
  userId: string;
  totalScore: number;
  categoryScores: any;
  strengths: string[];
  areasForImprovement: string[];
  finalAssessment: string;
  createdAt: Date;
}

const FeedbackSchema: Schema = new Schema({
  interviewId: { type: String, required: true },
  userId: { type: String, required: true },
  totalScore: { type: Number },
  categoryScores: { type: Object },
  strengths: { type: [String] },
  areasForImprovement: { type: [String] },
  finalAssessment: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IFeedback>('Feedback', FeedbackSchema);
