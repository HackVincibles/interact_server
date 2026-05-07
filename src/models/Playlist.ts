import mongoose, { Schema, Document } from "mongoose";

export interface IPlaylist extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  url: string;
  playlistId: string;
  thumbnail: string;
  progress: number;
  watchedIndices: number[];
  videoDurations: Map<string, number>;
  videoIds: string[];
  totalPlaylistDuration: number;
  cumulativeWatchTime: number;
  lastWatchedAt: Date;
}

const PlaylistSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    playlistId: { type: String, required: true },
    thumbnail: { type: String },
    progress: { type: Number, default: 0 },
    watchedIndices: { type: [Number], default: [] },
    videoDurations: { type: Map, of: Number, default: {} },
    videoIds: { type: [String], default: [] },
    totalPlaylistDuration: { type: Number, default: 0 },
    cumulativeWatchTime: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
    lastWatchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model<IPlaylist>("Playlist", PlaylistSchema);
