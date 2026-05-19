import { Request, Response } from 'express';
import User from '../models/User';
import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';
import sendEmail from '../utils/sendEmail';

// Configure Cloudinary with validation
const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
};

// Log warning if keys are missing (professional debugging)
if (!cloudinaryConfig.cloud_name || !cloudinaryConfig.api_key || !cloudinaryConfig.api_secret) {
  console.warn('⚠️  Cloudinary configuration is incomplete. Check your server/.env file.');
}

cloudinary.config(cloudinaryConfig);

export const updateProfile = async (req: any, res: Response) => {
  try {
    const { name, age, bio, phone, github, linkedin, twitter, skills } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        name,
        age,
        bio,
        phone,
        github,
        linkedin,
        twitter,
        skills
      },
      { new: true }
    );

    res.status(200).json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAvatar = async (req: any, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an image' });
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'interactai/avatars',
      resource_type: 'auto',
      width: 150,
      crop: 'scale'
    });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { avatar: result.secure_url },
      { new: true }
    );

    res.status(200).json({ success: true, avatar: result.secure_url, user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAvatar = async (req: any, res: Response) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $unset: { avatar: "" } },
      { new: true }
    );

    res.status(200).json({ success: true, message: 'Avatar deleted successfully', user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- Secure Deletion Logic ---

export const requestDeleteOTP = async (req: any, res: Response) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    user.resetPasswordOTP = crypto.createHash('sha256').update(otp).digest('hex');
    user.resetPasswordOTPExpire = otpExpire;
    await user.save();

    const message = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border: 1px solid #f0f0f0;">
        <div style="background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Interact.ai</h1>
        </div>
        <div style="padding: 40px 32px; text-align: center;">
          <h2 style="color: #1f2937; margin: 0 0 16px; font-size: 22px; font-weight: 700;">Confirm Account Deletion</h2>
          <p style="color: #4b5563; margin: 0 0 32px; line-height: 1.6; font-size: 16px;">You have requested to permanently delete your account. This action is <b>irreversible</b>. Use the security code below to confirm this action. Valid for <b>10 minutes</b>.</p>
          
          <div style="background-color: #fff1f2; border: 2px dashed #fecdd3; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
            <div style="font-size: 36px; font-weight: 800; color: #e11d48; letter-spacing: 8px; margin: 0;">${otp}</div>
          </div>
          
          <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 0;">If you didn't request this, please secure your account immediately by changing your password.</p>
        </div>
        <div style="background-color: #f3f4f6; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px; margin: 0;">&copy; 2026 Interact.ai. All rights reserved.</p>
        </div>
      </div>
    `;

    await sendEmail({
      email: user.email,
      subject: 'Action Required: Delete Your Account',
      message
    });

    res.status(200).json({ success: true, message: 'Deletion OTP sent to email' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const confirmDeleteAccount = async (req: any, res: Response) => {
  try {
    const { otp } = req.body;
    const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');

    const user = await User.findOne({
      _id: req.user.id,
      resetPasswordOTP: hashedOTP,
      resetPasswordOTPExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Permanently delete user
    await User.findByIdAndDelete(req.user.id);

    // Clear cookies
    res.cookie('session', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true
    });

    res.status(200).json({ success: true, message: 'Account permanently deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateResume = async (req: any, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a resume' });
    }

    // Upload to Cloudinary with 'raw' type. 
    // We must use 'raw' because 'image' blocks PDF delivery and throws "Failed to load PDF document"
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'interactai/resumes',
      resource_type: 'raw', 
      access_mode: "public"
    });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { 
        resume: result.secure_url,
        resumeName: req.file.originalname 
      },
      { new: true }
    );

    res.status(200).json({ success: true, resume: result.secure_url, user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteResume = async (req: any, res: Response) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $unset: { resume: "" } },
      { new: true }
    );

    res.status(200).json({ success: true, message: 'Resume deleted successfully', user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
