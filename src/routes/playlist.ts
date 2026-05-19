import express from "express";
import { 
  getPlaylists, 
  addPlaylist, 
  updateProgress, 
  deletePlaylist 
} from "../controllers/playlistController";
import { protect } from "../middleware/auth";

const router = express.Router();

router.use(protect);

router.get("/", getPlaylists);
router.post("/", addPlaylist);
router.put("/:id/progress", updateProgress);
router.delete("/:id", deletePlaylist);

export default router;
