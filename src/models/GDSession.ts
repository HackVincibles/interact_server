import mongoose, { Schema, Document } from 'mongoose';

export interface IGDTurn {
  userId: string;
  userName: string;
  transcript: string;
  startTime: Date;
  endTime: Date;
  durationSeconds: number;
  aiFeedback: string;
  scores: {
    communication: number;
    relevance: number;
    leadership: number;
    clarity: number;
    total: number;
  };
}

export interface IGDParticipant {
  userId: string;
  name: string;
  avatar?: string;
  joinTime: Date;
  leaveTime?: Date;
  isAI?: boolean;
}

export interface IGDSession extends Document {
  topic: string;
  description?: string;
  durationMinutes: number;
  status: 'waiting' | 'active' | 'completed' | 'cancelled';
  sessionState: 'waiting' | 'ready' | 'active' | 'paused' | 'final_minute' | 'conclusion' | 'ended' | 'archived';
  roomId: string;
  roomCode: string;
  hostId: string;
  participants: (IGDParticipant & {
    speakingDuration: number;
    turnCount: number;
    avgTurnLength: number;
    interruptionCount: number;
    fillerCount: number;
    relevanceScore: number;
    leadershipScore: number;
    communicationScore: number;
    collaborationScore: number;
    confidenceScore: number;
    criticalThinkingScore: number;
    transcript: string;
    personalCoaching?: {
      strengths: string[];
      weaknesses: string[];
      betterPhrasing: { original: string; suggested: string }[];
      roadmap: string;
    };
  })[];
  transcripts: {
    userId: string;
    userName: string;
    text: string;
    timestamp: Date;
  }[];
  recruiterSummary?: {
    overview: string;
    strengths: string[];
    weaknesses: string[];
    recommendations: {
      userId: string;
      decision: 'Shortlist' | 'Hold' | 'Reject';
      reason: string;
    }[];
  };
  analytics: {
    groupSynergy: number;
    topicCoherence: number;
    dominanceBalance: number;
    totalSpeakingTime: number;
    participationEquality: number;
    topicDrift: number;
    silenceDeadZones: number;
  };
  leaderboard: {
    userId: string;
    userName: string;
    totalScore: number;
    rank: number;
  }[];
  createdAt: Date;
}




const GDTurnSchema = new Schema({
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  transcript: { type: String, default: '' },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  durationSeconds: { type: Number, default: 0 },
  aiFeedback: { type: String },
  scores: {
    communication: { type: Number, default: 0 },
    relevance: { type: Number, default: 0 },
    leadership: { type: Number, default: 0 },
    clarity: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
});

const GDParticipantSchema = new Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  avatar: { type: String },
  joinTime: { type: Date, default: Date.now },
  leaveTime: { type: Date },
  isAI: { type: Boolean, default: false },
});

const GDSessionSchema = new Schema({
  topic: { type: String, required: true },
  description: { type: String },
  durationMinutes: { type: Number, required: true },
  status: { type: String, enum: ['waiting', 'active', 'completed', 'cancelled'], default: 'waiting' },
  sessionState: { 
    type: String, 
    enum: ['waiting', 'ready', 'active', 'paused', 'final_minute', 'conclusion', 'ended', 'archived'], 
    default: 'waiting' 
  },
  hostId: { type: String, required: true },
  roomId: { type: String, required: true },
  roomCode: { type: String, unique: true },
  participants: [{
    userId: { type: String, required: true },
    name: { type: String, required: true },
    joinTime: { type: Date, default: Date.now },
    leaveTime: { type: Date },
    speakingDuration: { type: Number, default: 0 }, // seconds
    turnCount: { type: Number, default: 0 },
    avgTurnLength: { type: Number, default: 0 },
    interruptionCount: { type: Number, default: 0 },
    fillerCount: { type: Number, default: 0 },
    relevanceScore: { type: Number, default: 0 },
    leadershipScore: { type: Number, default: 0 },
    communicationScore: { type: Number, default: 0 },
    collaborationScore: { type: Number, default: 0 },
    confidenceScore: { type: Number, default: 0 },
    criticalThinkingScore: { type: Number, default: 0 },
    transcript: { type: String, default: "" },
    personalCoaching: {
      strengths: [String],
      weaknesses: [String],
      betterPhrasing: [{
        original: String,
        suggested: String
      }],
      roadmap: String
    }
  }],
  analytics: {
    groupSynergy: { type: Number, default: 0 },
    topicCoherence: { type: Number, default: 0 },
    dominanceBalance: { type: Number, default: 0 },
    totalSpeakingTime: { type: Number, default: 0 },
    participationEquality: { type: Number, default: 0 },
    topicDrift: { type: Number, default: 0 },
    silenceDeadZones: { type: Number, default: 0 }
  },
  recruiterSummary: {
    overview: { type: String },
    strengths: [String],
    weaknesses: [String],
    recommendations: [{
      userId: String,
      decision: { type: String, enum: ['Shortlist', 'Hold', 'Reject'] },
      reason: String
    }]
  },
  leaderboard: [{
    userId: String,
    userName: String,
    totalScore: Number,
    rank: Number
  }],
  transcripts: [{
    userId: String,
    userName: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
  }],

  createdAt: { type: Date, default: Date.now }
}, {
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});


GDSessionSchema.index({ roomId: 1 });
GDSessionSchema.index({ hostId: 1 });

export default mongoose.model<IGDSession>('GDSession', GDSessionSchema);
