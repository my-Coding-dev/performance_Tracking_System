import { Request, Response } from 'express';
import authService from '../services/authService';
import logger from '../utils/logger';

/**
 * Resend OTP
 */
export const resendOTP = async (req: Request, res: Response): Promise<void> => {
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
};

/**
 * Resend phone verification OTP
 */
export const resendPhoneVerificationOTP = async (req: Request, res: Response): Promise<void> => {
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
}; 