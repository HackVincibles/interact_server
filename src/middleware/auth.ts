import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const protect = async (req: any, res: Response, next: NextFunction) => {
  let token;

  if (req.cookies.session) {
    token = req.cookies.session;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Not authorized' });
  }
};
