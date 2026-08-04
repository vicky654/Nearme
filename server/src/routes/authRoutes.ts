import { Router } from 'express';
import { validate } from '../middleware/validate';
import { authRateLimiter } from '../middleware/rateLimiters';
import {
  registerSchema,
  verifyEmailSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendVerificationSchema,
  googleLoginSchema,
} from '../validators/authValidators';
import {
  register,
  verifyEmail,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  resendVerification,
  googleLogin,
} from '../controllers/authController';

const router = Router();

router.post('/register', authRateLimiter, validate(registerSchema), register);
router.post('/verify-email', validate(verifyEmailSchema), verifyEmail);
router.post('/login', authRateLimiter, validate(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/forgot-password', authRateLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);
router.post(
  '/resend-verification',
  authRateLimiter,
  validate(resendVerificationSchema),
  resendVerification
);
router.post('/google', validate(googleLoginSchema), googleLogin);

export default router;
