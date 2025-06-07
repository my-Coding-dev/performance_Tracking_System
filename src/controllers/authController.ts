import { Request, Response } from 'express';
import authService from '../services/authService';
import logger from '../utils/logger';

class AuthController {
  /**
   * Register a new user
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { firstName, lastName, email, password, phoneNumber } = req.body;
      
      // Validate required fields
      if (!firstName || !lastName || !email || !password) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields',
        });
        return;
      }

      // Validate phone number (if provided)
      if (phoneNumber && !/^\d{10,15}$/.test(phoneNumber)) {
        res.status(400).json({
          success: false,
          message: 'Invalid phone number format. Please provide a valid phone number with 10-15 digits.',
        });
        return;
      }

      // Register user
      const { user } = await authService.register({
        firstName,
        lastName,
        email,
        password,
        phoneNumber,
      });

      // Create a sanitized user object without sensitive information
      const sanitizedUser = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        role: user.role,
        createdAt: user.createdAt
      };

      res.status(201).json({
        success: true,
        message: 'User registered successfully. Please check your email for verification.',
        data: sanitizedUser,
      });
    } catch (error) {
      logger.error('Error in register controller', error instanceof Error ? error : new Error(String(error)));
      
      // Handle specific errors
      if (error instanceof Error && error.message.includes('already exists')) {
        res.status(409).json({
          success: false,
          message: error.message,
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to register user',
      });
    }
  }

  /**
   * Login with email and password
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      
      // Validate required fields
      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: 'Email and password are required',
        });
        return;
      }

      // Login user
      const { token, refreshToken, user } = await authService.login({ email, password });

      // Create a sanitized user object without sensitive information
      const sanitizedUser = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        role: user.role,
        lastLogin: user.lastLogin
      };

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: { token, refreshToken, user: sanitizedUser },
      });
    } catch (error) {
      logger.error('Error in login controller', error instanceof Error ? error : new Error(String(error)));
      
      // Handle specific errors
      if (error instanceof Error && 
          (error.message.includes('Invalid email or password') || 
           error.message.includes('Account is locked'))) {
        res.status(401).json({
          success: false,
          message: error.message,
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to login',
      });
    }
  }

  /**
   * Request OTP for login
   */
  async requestLoginOtp(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;
      
      // Validate required fields
      if (!email) {
        res.status(400).json({
          success: false,
          message: 'Email is required',
        });
        return;
      }

      // Find user by email
      const user = await authService.findUserByEmail(email);
      
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      // Generate OTP for login
      await authService.generateOTP(user.id, 'login');

      res.status(200).json({
        success: true,
        message: 'OTP sent to your email',
      });
    } catch (error) {
      logger.error('Error in requestLoginOtp controller', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({
        success: false,
        message: 'Failed to send OTP',
      });
    }
  }

  /**
   * Login with email and OTP
   */
  async loginWithOtp(req: Request, res: Response): Promise<void> {
    try {
      const { email, otp } = req.body;
      
      // Validate required fields
      if (!email || !otp) {
        res.status(400).json({
          success: false,
          message: 'Email and OTP are required',
        });
        return;
      }

      // Login user with OTP
      const { token, refreshToken, user } = await authService.loginWithOtp({ email, otp });

      // Create a sanitized user object without sensitive information
      const sanitizedUser = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        role: user.role,
        lastLogin: user.lastLogin
      };

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: { token, refreshToken, user: sanitizedUser },
      });
    } catch (error) {
      logger.error('Error in loginWithOtp controller', error instanceof Error ? error : new Error(String(error)));
      
      // Handle specific errors
      if (error instanceof Error && 
          (error.message.includes('User not found') || 
           error.message.includes('Invalid OTP'))) {
        res.status(401).json({
          success: false,
          message: error.message,
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to login with OTP',
      });
    }
  }

  /**
   * Verify email with OTP
   */
  async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { email, otp } = req.body;
      
      // Validate required fields
      if (!email || !otp) {
        res.status(400).json({
          success: false,
          message: 'Email and OTP are required',
        });
        return;
      }

      // Find user by email
      const user = await authService.findUserByEmail(email);
      
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      // Verify OTP
      const isVerified = await authService.verifyOTP(user.id, otp, 'email_verification');
      
      if (!isVerified) {
        res.status(400).json({
          success: false,
          message: 'Invalid or expired OTP',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Email verified successfully',
      });
    } catch (error) {
      logger.error('Error in verifyEmail controller', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({
        success: false,
        message: 'Failed to verify email',
      });
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;
      
      // Validate required fields
      if (!email) {
        res.status(400).json({
          success: false,
          message: 'Email is required',
        });
        return;
      }

      // Request password reset
      await authService.requestPasswordReset(email);

      res.status(200).json({
        success: true,
        message: 'If your email is registered, you will receive a password reset link',
      });
    } catch (error) {
      logger.error('Error in requestPasswordReset controller', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({
        success: false,
        message: 'Failed to request password reset',
      });
    }
  }

  /**
   * Reset password with token and OTP
   */
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, otp, newPassword } = req.body;
      
      // Validate required fields
      if (!token || !otp || !newPassword) {
        res.status(400).json({
          success: false,
          message: 'Token, OTP, and new password are required',
        });
        return;
      }

      // Reset password
      const isReset = await authService.resetPassword(token, otp, newPassword);
      
      if (!isReset) {
        res.status(400).json({
          success: false,
          message: 'Failed to reset password',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Password reset successfully',
      });
    } catch (error) {
      logger.error('Error in resetPassword controller', error instanceof Error ? error : new Error(String(error)));
      
      // Handle specific errors
      if (error instanceof Error && 
          (error.message.includes('Invalid or expired reset token') || 
           error.message.includes('Invalid OTP'))) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to reset password',
      });
    }
  }

  /**
   * Request phone verification OTP
   */
  async requestPhoneVerificationOTP(req: Request, res: Response): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.user || !req.user.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { phoneNumber } = req.body;
      
      // Validate required fields
      if (!phoneNumber) {
        res.status(400).json({
          success: false,
          message: 'Phone number is required',
        });
        return;
      }

      // Validate phone number format
      if (!/^\d{10,15}$/.test(phoneNumber)) {
        res.status(400).json({
          success: false,
          message: 'Invalid phone number format. Please provide a valid phone number with 10-15 digits.',
        });
        return;
      }

      // Generate OTP for phone verification
      await authService.requestPhoneVerificationOTP(req.user.userId, phoneNumber);

      res.status(200).json({
        success: true,
        message: 'OTP sent for phone verification',
      });
    } catch (error) {
      logger.error('Error in requestPhoneVerificationOTP controller', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({
        success: false,
        message: 'Failed to send OTP for phone verification',
      });
    }
  }

  /**
   * Verify phone number with OTP
   */
  async verifyPhoneNumber(req: Request, res: Response): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.user || !req.user.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { otp } = req.body;
      
      // Validate required fields
      if (!otp) {
        res.status(400).json({
          success: false,
          message: 'OTP is required',
        });
        return;
      }

      // Verify phone number with OTP
      const isVerified = await authService.verifyPhoneNumber(req.user.userId, otp);
      
      if (!isVerified) {
        res.status(400).json({
          success: false,
          message: 'Invalid or expired OTP',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Phone number verified successfully',
      });
    } catch (error) {
      logger.error('Error in verifyPhoneNumber controller', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({
        success: false,
        message: 'Failed to verify phone number',
      });
    }
  }

  /**
   * Resend OTP
   */
  async resendOTP(req: Request, res: Response): Promise<void> {
    try {
      const { email, type } = req.body;
      
      // Validate required fields
      if (!email || !type) {
        res.status(400).json({
          success: false,
          message: 'Email and OTP type are required',
        });
        return;
      }
      
      // Validate OTP type
      const validTypes = ['email_verification', 'login', 'password_reset'];
      if (!validTypes.includes(type)) {
        res.status(400).json({
          success: false,
          message: 'Invalid OTP type. Valid types are: ' + validTypes.join(', '),
        });
        return;
      }

      // Find user by email
      const user = await authService.findUserByEmail(email);
      
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      // Resend OTP
      await authService.resendOTP(user.id, type);

      res.status(200).json({
        success: true,
        message: 'OTP resent successfully',
      });
    } catch (error) {
      logger.error('Error in resendOTP controller', error instanceof Error ? error : new Error(String(error)));
      
      // Handle specific errors
      if (error instanceof Error) {
        if (error.message.includes('already verified')) {
          res.status(400).json({
            success: false,
            message: error.message,
          });
          return;
        }
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to resend OTP',
      });
    }
  }

  /**
   * Resend phone verification OTP
   */
  async resendPhoneVerificationOTP(req: Request, res: Response): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.user || !req.user.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      // Resend OTP
      await authService.resendOTP(req.user.userId, 'phone_verification');

      res.status(200).json({
        success: true,
        message: 'Phone verification OTP resent successfully',
      });
    } catch (error) {
      logger.error('Error in resendPhoneVerificationOTP controller', error instanceof Error ? error : new Error(String(error)));
      
      // Handle specific errors
      if (error instanceof Error) {
        if (error.message.includes('already verified')) {
          res.status(400).json({
            success: false,
            message: error.message,
          });
          return;
        }
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to resend phone verification OTP',
      });
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      
      // Validate required fields
      if (!refreshToken) {
        res.status(400).json({
          success: false,
          message: 'Refresh token is required',
        });
        return;
      }

      // Refresh token
      const { token, refreshToken: newRefreshToken } = await authService.refreshToken(refreshToken);

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: { token, refreshToken: newRefreshToken },
      });
    } catch (error) {
      logger.error('Error in refreshToken controller', error instanceof Error ? error : new Error(String(error)));
      
      // Handle specific errors
      if (error instanceof Error && error.message.includes('Invalid or expired refresh token')) {
        res.status(401).json({
          success: false,
          message: error.message,
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to refresh token',
      });
    }
  }

  /**
   * Logout user
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.user || !req.user.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      // Logout user
      await authService.logout(req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      logger.error('Error in logout controller', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({
        success: false,
        message: 'Failed to logout',
      });
    }
  }
}

export default new AuthController(); 