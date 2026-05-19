import mongoose, { Schema, Document } from 'mongoose';

export interface IBehavioralSummary extends Document {
  sessionId: string;
  participantId: string;
  summaryText: string;
  engagementRatio: number;
  postureRatio: number;
  eyeContactRatio: number;
  createdAt: Date;
}

const BehavioralSummarySchema: Schema = new Schema({
  sessionId: {
    type: String,
    required: true,
    index: true,
  },
  participantId: {
    type: String,
    required: true,
    index: true,
  },
  summaryText: {
    type: String,
    required: true,
  },
  engagementRatio: {
    type: Number,
    required: true,
  },
  postureRatio: {
    type: Number,
    required: true,
  },
  eyeContactRatio: {
    type: Number,
    required: true,
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Ensure only one summary exists per participant per session
BehavioralSummarySchema.index({ sessionId: 1, participantId: 1 }, { unique: true });

export const BehavioralSummary = mongoose.model<IBehavioralSummary>('BehavioralSummary', BehavioralSummarySchema);
