import { Request, Response } from 'express';
import crypto from 'crypto';
import User from '../models/User';
import * as authService from '../services/authService';
import sendEmail from '../utils/sendEmail';
import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL
);

const cookieOptions = {
  expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
};

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ success: false, message: 'User already exists' });

    user = await User.create({ name, email, password });
    const token = authService.generateToken(user._id as string);

    res.status(201).cookie('session', token, cookieOptions).json({
      success: true,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = authService.generateToken(user._id as string);
    res.status(200).cookie('session', token, cookieOptions).json({
      success: true,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const logout = (req: Request, res: Response) => {
  res.cookie('session', 'none', { expires: new Date(Date.now() + 10 * 1000), httpOnly: true });
  res.status(200).json({ success: true, message: 'Logged out' });
};

export const getMe = async (req: any, res: Response) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const googleAuth = (req: Request, res: Response) => {
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email'],
  });
  res.redirect(url);
};

export const googleCallback = async (req: Request, res: Response) => {
  try {
    const payload = await authService.getGoogleUserInfo(req.query.code as string);
    if (!payload) throw new Error('Google Auth Failed');

    const user = await authService.findOrCreateGoogleUser(payload);
    const token = authService.generateToken(user._id as string);

    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/auth-callback?token=${token}`);
  } catch (error: any) {
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/sign-in?error=google-auth-failed`);
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'There is no user with that email' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set hashed OTP and expiration (10 minutes)
    user.resetPasswordOTP = crypto.createHash('sha256').update(otp).digest('hex');
    user.resetPasswordOTPExpire = new Date(Date.now() + 10 * 60 * 1000);

    await user.save({ validateBeforeSave: false });

    const message = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border: 1px solid #f0f0f0;">
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Interact.ai</h1>
        </div>
        <div style="padding: 40px 32px; text-align: center;">
          <h2 style="color: #1f2937; margin: 0 0 16px; font-size: 22px; font-weight: 700;">Password Reset Request</h2>
          <p style="color: #4b5563; margin: 0 0 32px; line-height: 1.6; font-size: 16px;">We received a request to reset your password. Use the verification code below to proceed. This code is valid for <b>10 minutes</b>.</p>
          
          <div style="background-color: #f9fafb; border: 2px dashed #e5e7eb; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
            <div style="font-size: 36px; font-weight: 800; color: #7c3aed; letter-spacing: 8px; margin: 0;">${otp}</div>
          </div>
          
          <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 0;">If you didn't request this change, you can safely ignore this email. Your password will remain unchanged.</p>
        </div>
        <div style="background-color: #f3f4f6; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px; margin: 0;">&copy; 2026 Interact.ai. All rights reserved.</p>
        </div>
      </div>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Password Reset OTP - Interact.ai',
        message,
      });

      res.status(200).json({ success: true, message: 'OTP sent to email' });
    } catch (err) {
      user.resetPasswordOTP = undefined;
      user.resetPasswordOTPExpire = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(500).json({ success: false, message: 'Email could not be sent' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyOTP = async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  try {
    const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');
    const user = await User.findOne({
      email,
      resetPasswordOTP: hashedOTP,
      resetPasswordOTPExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    res.status(200).json({ success: true, message: 'OTP verified' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  const { email, otp, password } = req.body;
  try {
    const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');
    const user = await User.findOne({
      email,
      resetPasswordOTP: hashedOTP,
      resetPasswordOTPExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Set new password
    user.password = password;
    user.resetPasswordOTP = undefined;
    user.resetPasswordOTPExpire = undefined;
    await user.save();

    res.status(200).json({ success: true, message: 'Password reset successful' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
