import mongoose, { Schema, Document } from 'mongoose';

export interface IBehavioralAnalytics extends Document {
  sessionId: string;
  participantId: string;
  timestamp: Date;
  eyeContactState: string;
  postureState: string;
  engagementState: string;
  tipsGenerated: string[];
}

const BehavioralAnalyticsSchema: Schema = new Schema({
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
  timestamp: {
    type: Date,
    default: Date.now,
  },
  eyeContactState: {
    type: String,
    required: true,
    enum: ['Good', 'Needs Improvement', 'Unknown'],
    default: 'Unknown'
  },
  postureState: {
    type: String,
    required: true,
    enum: ['Stable', 'Leaning', 'Unknown'],
    default: 'Unknown'
  },
  engagementState: {
    type: String,
    required: true,
    enum: ['Focused', 'Engaged', 'Slightly Distracted', 'Unknown'],
    default: 'Unknown'
  },
  tipsGenerated: {
    type: [String],
    default: [],
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Compound index for quick retrieval of a specific participant's metrics in a session
BehavioralAnalyticsSchema.index({ sessionId: 1, participantId: 1 });

export const BehavioralAnalytics = mongoose.model<IBehavioralAnalytics>('BehavioralAnalytics', BehavioralAnalyticsSchema);
