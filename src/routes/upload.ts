import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Configure multer for local storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads/resumes';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDFs are allowed') as any, false);
    }
  },
});

// @desc    Upload resume
// @route   POST /api/upload/resume
router.post('/resume', upload.single('resume'), (req: any, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const fileUrl = `${process.env.SERVER_URL || 'http://localhost:5000'}/uploads/resumes/${req.file.filename}`;
  
  res.status(200).json({
    success: true,
    url: fileUrl,
    name: req.file.originalname,
  });
});

export default router;
