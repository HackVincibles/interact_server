import { Router } from 'express';
import * as userController from '../controllers/userController';
import { protect } from '../middleware/auth';
import multer from 'multer';
import path from 'path';

const router = Router();

// Multer setup for temporary file storage before Cloudinary upload
const storage = multer.diskStorage({});
const upload = multer({ 
  storage,
  limits: { fileSize: 6 * 1024 * 1024 }, // 6MB limit
  fileFilter: (req, file, cb) => {
    let ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".jpg" && ext !== ".jpeg" && ext !== ".png" && ext !== ".pdf") {
      cb(new Error("File type is not supported") as any, false);
      return;
    }
    cb(null, true);
  },
});

router.put('/profile', protect, userController.updateProfile);
router.put('/avatar', protect, (req, res, next) => {
  upload.single('avatar')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'Image too large. Max 6MB allowed.' });
      }
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
}, userController.updateAvatar);

router.delete('/avatar', protect, userController.deleteAvatar);

router.put('/resume', protect, (req, res, next) => {
  upload.single('resume')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'Resume too large. Max 6MB allowed.' });
      }
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
}, userController.updateResume);
router.delete('/resume', protect, userController.deleteResume);
router.post('/request-delete', protect, userController.requestDeleteOTP);
router.post('/confirm-delete', protect, userController.confirmDeleteAccount);

export default router;
