import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import User, { IUser } from '../models/User';
import crypto from 'crypto';

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL
);

export const generateToken = (userId: string) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

export const getGoogleUserInfo = async (code: string) => {
  const { tokens } = await client.getToken(code);
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token!,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
};

export const findOrCreateGoogleUser = async (payload: any) => {
  const { sub, name, email, picture } = payload;
  let user = await User.findOne({ email });

  if (!user) {
    user = await User.create({
      googleId: sub,
      name: name,
      email: email,
      avatar: picture,
    });
  } else if (!user.googleId) {
    user.googleId = sub;
    if (!user.avatar) user.avatar = picture;
    await user.save();
  }
  return user;
};

export const hashToken = (token: string) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};
