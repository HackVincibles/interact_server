import { Router } from 'express';
import * as authController from '../controllers/authController';
import { protect } from '../middleware/auth';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/logout', authController.logout);
router.get('/me', protect, authController.getMe);
router.get('/google', authController.googleAuth);
router.get('/google/callback', authController.googleCallback);
router.post('/forgotpassword', authController.forgotPassword);
router.post('/verifyotp', authController.verifyOTP);
router.post('/resetpassword', authController.resetPassword);

export default router;
