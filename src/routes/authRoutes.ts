import express, { Request, Response } from 'express';
import authController from '../controllers/authController';
import authMiddleware from '../middlewares/authMiddleware';
import { resendOTP, resendPhoneVerificationOTP } from '../controllers/resendOtpController';

const router = express.Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', (req: Request, res: Response) => 
  authController.register(req, res)
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login with email and password
 * @access  Public
 */
router.post('/login', (req: Request, res: Response) => 
  authController.login(req, res)
);

/**
 * @route   POST /api/v1/auth/otp/request
 * @desc    Request OTP for login
 * @access  Public
 */
router.post('/otp/request', (req: Request, res: Response) => 
  authController.requestLoginOtp(req, res)
);

/**
 * @route   POST /api/v1/auth/otp/login
 * @desc    Login with email and OTP
 * @access  Public
 */
router.post('/otp/login', (req: Request, res: Response) => 
  authController.loginWithOtp(req, res)
);

/**
 * @route   POST /api/v1/auth/otp/resend
 * @desc    Resend OTP
 * @access  Public
 */
router.post('/otp/resend', (req: Request, res: Response) => 
  resendOTP(req, res)
);

/**
 * @route   POST /api/v1/auth/verify-email
 * @desc    Verify email with OTP
 * @access  Public
 */
router.post('/verify-email', (req: Request, res: Response) => 
  authController.verifyEmail(req, res)
);

/**
 * @route   POST /api/v1/auth/phone/verify-request
 * @desc    Request phone verification OTP
 * @access  Private
 */
router.post('/phone/verify-request', authMiddleware.authenticate, (req: Request, res: Response) => 
  authController.requestPhoneVerificationOTP(req as any, res)
);

/**
 * @route   POST /api/v1/auth/phone/verify
 * @desc    Verify phone number with OTP
 * @access  Private
 */
router.post('/phone/verify', authMiddleware.authenticate, (req: Request, res: Response) => 
  authController.verifyPhoneNumber(req as any, res)
);

/**
 * @route   POST /api/v1/auth/phone/resend-otp
 * @desc    Resend phone verification OTP
 * @access  Private
 */
router.post('/phone/resend-otp', authMiddleware.authenticate, (req: Request, res: Response) => 
  resendPhoneVerificationOTP(req as any, res)
);

/**
 * @route   POST /api/v1/auth/password/reset-request
 * @desc    Request password reset
 * @access  Public
 */
router.post('/password/reset-request', (req: Request, res: Response) => 
  authController.requestPasswordReset(req, res)
);

/**
 * @route   POST /api/v1/auth/password/reset
 * @desc    Reset password with token and OTP
 * @access  Public
 */
router.post('/password/reset', (req: Request, res: Response) => 
  authController.resetPassword(req, res)
);

/**
 * @route   POST /api/v1/auth/refresh-token
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh-token', (req: Request, res: Response) => 
  authController.refreshToken(req, res)
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user and invalidate refresh token
 * @access  Private
 */
router.post('/logout', authMiddleware.authenticate, (req: Request, res: Response) => 
  authController.logout(req as any, res)
);

export default router; 