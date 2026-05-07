import { Response } from "express";
import Playlist from "../models/Playlist";

export const getPlaylists = async (req: any, res: Response) => {
  try {
    const playlists = await Playlist.find({ userId: req.user.id }).sort({ updatedAt: -1 });
    
    // Data Migration & Refresh logic
    for (const p of playlists) {
      if (p.totalPlaylistDuration > 0 && (!p.cumulativeWatchTime || p.cumulativeWatchTime === 0)) {
        p.cumulativeWatchTime = p.totalPlaylistDuration;
        await p.save();
      }
    }
    
    res.status(200).json({ success: true, playlists });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addPlaylist = async (req: any, res: Response) => {
  try {
    const { name, url, playlistId, thumbnail } = req.body;
    
    // Check if playlist already exists for this user
    const existing = await Playlist.findOne({ userId: req.user.id, playlistId, isDeleted: false });
    if (existing) {
      return res.status(400).json({ success: false, message: "Playlist already added" });
    }

    const playlist = await Playlist.create({
      userId: req.user.id,
      name,
      url,
      playlistId,
      thumbnail,
      progress: 0,
    });

    res.status(201).json({ success: true, playlist });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProgress = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { progress, watchedIndices, videoDurations, totalPlaylistDuration, videoIds, cumulativeWatchTime } = req.body;

    const playlist = await Playlist.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { progress, watchedIndices, videoDurations, totalPlaylistDuration, videoIds, cumulativeWatchTime, lastWatchedAt: new Date() },
      { returnDocument: 'after' }
    );

    if (!playlist) {
      return res.status(404).json({ success: false, message: "Playlist not found" });
    }

    res.status(200).json({ success: true, playlist });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deletePlaylist = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    // Perform soft delete
    const playlist = await Playlist.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { isDeleted: true },
      { returnDocument: 'after' }
    );

    if (!playlist) {
      return res.status(404).json({ success: false, message: "Playlist not found" });
    }

    res.status(200).json({ success: true, message: "Playlist removed from active list" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
