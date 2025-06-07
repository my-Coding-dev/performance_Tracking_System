import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import crypto from 'crypto';
import { PrismaClient, User } from '@prisma/client';
import db from '../utils/database';
import cacheClient, { CacheStrategy } from '../utils/cache';
import logger from '../utils/logger';
import emailService from './emailService';
import config from '../config/config';

interface RegisterUserData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneNumber?: string;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface OtpLoginCredentials {
  email: string;
  otp: string;
}

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

class AuthService {
  private prisma: PrismaClient;
  private readonly saltRounds = 10;
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly jwtRefreshExpiresIn: string;
  private readonly otpExpiresInMinutes: number;
  private readonly passwordResetExpiresInHours: number;
  private readonly otpCacheTTL: number; // in seconds

  constructor() {
    this.prisma = db.getPrisma();
    
    // Ensure we have a JWT secret, with strong default if not provided
    if (!process.env.JWT_SECRET) {
      logger.warn('JWT_SECRET environment variable not set. Using fallback secret. THIS IS NOT SECURE FOR PRODUCTION.');
    }
    this.jwtSecret = process.env.JWT_SECRET || 'zK9L$Y7f@2pNdR4x#8sG!hT5vQ1jE6aM3bW0cX';
    
    // Ensure we have a JWT refresh secret, with strong default if not provided
    if (!process.env.JWT_REFRESH_SECRET) {
      logger.warn('JWT_REFRESH_SECRET environment variable not set. Using fallback secret. THIS IS NOT SECURE FOR PRODUCTION.');
    }
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'Rf7$P2jQ9sX4@kL5zM1hG8vB3nT6yA0wE';
    
    // Set JWT expiration with reasonable default
    if (!process.env.JWT_EXPIRES_IN) {
      logger.warn('JWT_EXPIRES_IN environment variable not set. Using default (1 hour).');
    }
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1h';
    
    // Set JWT refresh expiration with reasonable default
    if (!process.env.JWT_REFRESH_EXPIRES_IN) {
      logger.warn('JWT_REFRESH_EXPIRES_IN environment variable not set. Using default (7 days).');
    }
    this.jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    
    this.otpExpiresInMinutes = parseInt(process.env.OTP_EXPIRES_IN_MINUTES || '15', 10);
    this.passwordResetExpiresInHours = parseInt(process.env.PASSWORD_RESET_EXPIRES_IN_HOURS || '24', 10);
    this.otpCacheTTL = this.otpExpiresInMinutes * 60; // Convert minutes to seconds
  }

  /**
   * Register a new user
   */
  async register(userData: RegisterUserData): Promise<{ user: Partial<User>; verificationToken: string }> {
    try {
      // Check if user already exists with the same email
      const existingUserByEmail = await this.prisma.user.findUnique({
        where: { email: userData.email.toLowerCase() },
      });

      if (existingUserByEmail) {
        throw new Error('User with this email already exists');
      }

      // Check if phone number is provided and if a user already exists with the same phone number
      if (userData.phoneNumber) {
        const existingUserByPhone = await this.prisma.user.findFirst({
          where: { 
            phoneNumber: userData.phoneNumber,
            isPhoneVerified: true // Only consider verified phone numbers
          },
        });

        if (existingUserByPhone) {
          throw new Error('A user with this phone number already exists');
        }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, this.saltRounds);
      
      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationExpires = new Date(Date.now() + this.otpExpiresInMinutes * 60 * 1000);
      
      // Create user
      const user = await this.prisma.user.create({
        data: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email.toLowerCase(),
          password: hashedPassword,
          phoneNumber: userData.phoneNumber,
          verificationToken,
          verificationExpires,
        },
      });

      // Generate OTP for email verification
      const { token: otp } = await this.generateOTP(user.id, 'email_verification');

      // Send verification email with OTP
      await this.sendVerificationEmail(user.email, user.firstName, otp);

      // Return user without sensitive fields and the verification token
      const { password, ...userWithoutPassword } = user;
      return { user: userWithoutPassword, verificationToken };
    } catch (error) {
      logger.error('Error registering user', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Login user with email and password
   */
  async login(credentials: LoginCredentials): Promise<{ token: string; refreshToken: string; user: Partial<User> }> {
    try {
      // Find user
      const user = await this.prisma.user.findUnique({
        where: { email: credentials.email.toLowerCase() },
      });

      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Check if user is locked
      if (user.isLocked && user.lockedUntil && user.lockedUntil > new Date()) {
        throw new Error(`Account is locked. Try again after ${user.lockedUntil.toLocaleString()}`);
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

      if (!isPasswordValid) {
        // Increment failed login attempts
        const failedAttempts = user.failedLoginAttempts + 1;
        const updateData: any = { failedLoginAttempts: failedAttempts };
        
        // Lock account after 5 failed attempts
        if (failedAttempts >= 5) {
          const lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
          updateData.isLocked = true;
          updateData.lockedUntil = lockedUntil;
        }
        
        await this.prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
        
        throw new Error('Invalid email or password');
      }

      // Generate refresh token
      const refreshToken = crypto.randomBytes(40).toString('hex');
      const refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      // Reset failed login attempts, update last login and store refresh token
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          isLocked: false,
          lockedUntil: null,
          lastLogin: new Date(),
          refreshToken,
          refreshTokenExpires
        },
      });

      // Generate JWT token
      const token = this.generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      // Return token and user without sensitive fields
      const { password, ...userWithoutPassword } = user;
      return { token, refreshToken, user: userWithoutPassword };
    } catch (error) {
      logger.error('Error logging in user', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Login user with email and OTP
   */
  async loginWithOtp(credentials: OtpLoginCredentials): Promise<{ token: string; refreshToken: string; user: Partial<User> }> {
    try {
      // Find user
      const user = await this.prisma.user.findUnique({
        where: { email: credentials.email.toLowerCase() },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Verify OTP
      const isOtpValid = await this.verifyOTP(user.id, credentials.otp, 'login');

      if (!isOtpValid) {
        throw new Error('Invalid OTP');
      }

      // Generate refresh token
      const refreshToken = crypto.randomBytes(40).toString('hex');
      const refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      // Update last login and store refresh token
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          lastLogin: new Date(),
          refreshToken,
          refreshTokenExpires
        },
      });

      // Generate JWT token
      const token = this.generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      // Return token and user without sensitive fields
      const { password, ...userWithoutPassword } = user;
      return { token, refreshToken, user: userWithoutPassword };
    } catch (error) {
      logger.error('Error logging in with OTP', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    try {
      // Find user with valid refresh token
      const user = await this.prisma.user.findFirst({
        where: {
          refreshToken,
          refreshTokenExpires: { gt: new Date() }, // Not expired
        },
      });

      if (!user) {
        throw new Error('Invalid or expired refresh token');
      }

      // Generate new refresh token
      const newRefreshToken = crypto.randomBytes(40).toString('hex');
      const refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      // Update refresh token
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          refreshToken: newRefreshToken,
          refreshTokenExpires
        },
      });

      // Generate new JWT token
      const token = this.generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      return { token, refreshToken: newRefreshToken };
    } catch (error) {
      logger.error('Error refreshing token', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(userId: string): Promise<boolean> {
    try {
      // Clear refresh token
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          refreshToken: null,
          refreshTokenExpires: null
        },
      });

      return true;
    } catch (error) {
      logger.error('Error logging out user', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Generate OTP for a user
   */
  async generateOTP(userId: string, type: string): Promise<{ token: string; expiresAt: Date }> {
    try {
      // Generate 6-digit OTP
      const token = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + this.otpExpiresInMinutes * 60 * 1000);
      
      // Encrypt the OTP before storing
      const encryptedOTP = this.encryptOTP(token);
      
      // Create a cache key for this OTP
      const cacheKey = `otp:${userId}:${type}`;
      
      // Store in cache with appropriate TTL
      await cacheClient.set(
        cacheKey,
        encryptedOTP, // String, not an object that would need JSON serialization
        this.otpCacheTTL
      );

      return { token, expiresAt };
    } catch (error) {
      logger.error('Error generating OTP', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Verify OTP for a user
   */
  async verifyOTP(userId: string, token: string, type: string): Promise<boolean> {
    try {
      // Get OTP from cache
      const cacheKey = `otp:${userId}:${type}`;
      const encryptedOTP = await cacheClient.get<string>(cacheKey);
      
      if (!encryptedOTP) {
        return false; // OTP not found or expired
      }
      
      // Decrypt and verify the OTP
      const isValid = this.verifyEncryptedOTP(encryptedOTP, token);
      
      if (!isValid) {
        return false;
      }
      
      // If OTP is valid, delete it from cache to prevent reuse
      await cacheClient.delete(cacheKey);
      
      // If it's email verification, update user's email verification status
      if (type === 'email_verification') {
        await this.prisma.user.update({
          where: { id: userId },
          data: { isEmailVerified: true },
        });
      }

      return true;
    } catch (error) {
      logger.error('Error verifying OTP', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Encrypt OTP
   */
  private encryptOTP(otp: string): string {
    // Use the JWT secret as encryption key
    const encryptionKey = crypto.createHash('sha256').update(this.jwtSecret).digest('hex').substring(0, 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encryptionKey), iv);
    let encrypted = cipher.update(otp, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV and encrypted data as a single string
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Verify encrypted OTP
   */
  private verifyEncryptedOTP(encryptedOTP: string, plainOTP: string): boolean {
    try {
      // Use the JWT secret as encryption key
      const encryptionKey = crypto.createHash('sha256').update(this.jwtSecret).digest('hex').substring(0, 32);
      
      // Split IV and encrypted data
      const parts = encryptedOTP.split(':');
      if (parts.length !== 2) {
        return false;
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedData = parts[1];
      
      // Decrypt the OTP
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(encryptionKey), iv);
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      // Compare with the provided OTP
      return decrypted === plainOTP;
    } catch (error) {
      logger.error('Error verifying encrypted OTP', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Send verification email with OTP
   */
  private async sendVerificationEmail(email: string, firstName: string, otp: string): Promise<boolean> {
    try {
      return await emailService.sendEmail({
        to: email,
        subject: 'Verify Your Email Address',
        template: 'email-verification',
        templateData: {
          firstName,
          otp,
          expiresIn: this.otpExpiresInMinutes,
        },
      });
    } catch (error) {
      logger.error('Error sending verification email', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Request a password reset
   */
  async requestPasswordReset(email: string): Promise<boolean> {
    try {
      // Find user
      const user = await this.prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        // Don't reveal user existence, just return success
        return true;
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + this.passwordResetExpiresInHours * 60 * 60 * 1000);
      
      // Save token to database
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: resetToken,
          passwordResetExpires: resetExpires,
        },
      });

      // Generate OTP for password reset
      const { token: otp } = await this.generateOTP(user.id, 'password_reset');

      // Send password reset email
      await this.sendPasswordResetEmail(user.email, user.firstName, otp, resetToken);

      return true;
    } catch (error) {
      logger.error('Error requesting password reset', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Reset password with token and OTP
   */
  async resetPassword(token: string, otp: string, newPassword: string): Promise<boolean> {
    try {
      // Find user with valid reset token
      const user = await this.prisma.user.findFirst({
        where: {
          passwordResetToken: token,
          passwordResetExpires: { gt: new Date() }, // Not expired
        },
      });

      if (!user) {
        throw new Error('Invalid or expired reset token');
      }

      // Verify OTP
      const isOtpValid = await this.verifyOTP(user.id, otp, 'password_reset');

      if (!isOtpValid) {
        throw new Error('Invalid OTP');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, this.saltRounds);
      
      // Update password and clear reset token
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null,
          failedLoginAttempts: 0,
          isLocked: false,
          lockedUntil: null,
        },
      });

      return true;
    } catch (error) {
      logger.error('Error resetting password', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  private async sendPasswordResetEmail(email: string, firstName: string, otp: string, resetToken: string): Promise<boolean> {
    try {
      return await emailService.sendEmail({
        to: email,
        subject: 'Reset Your Password',
        template: 'password-reset',
        templateData: {
          firstName,
          otp,
          resetToken,
          expiresIn: this.passwordResetExpiresInHours,
        },
      });
    } catch (error) {
      logger.error('Error sending password reset email', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Generate JWT token
   */
  private generateToken(payload: TokenPayload): string {
    try {
      // We need to cast jwt to any because of the type definitions
      const token = (jwt as any).sign(payload, this.jwtSecret, { 
        expiresIn: this.jwtExpiresIn 
      });
      
      if (!token) {
        logger.error('Failed to generate JWT token');
        throw new Error('Failed to generate authentication token');
      }
      
      return token;
    } catch (error) {
      logger.error('Error generating JWT token', error instanceof Error ? error : new Error(String(error)));
      throw new Error('Failed to generate authentication token');
    }
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): TokenPayload {
    try {
      // Use any to bypass type checking until we fix the JWT typings
      return (jwt as any).verify(token, this.jwtSecret) as TokenPayload;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Find user by email
   */
  async findUserByEmail(email: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });
    } catch (error) {
      logger.error('Error finding user by email', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Request phone verification OTP
   */
  async requestPhoneVerificationOTP(userId: string, phoneNumber: string): Promise<{ token: string; expiresAt: Date }> {
    try {
      // Update phone number if needed
      await this.prisma.user.update({
        where: { id: userId },
        data: { phoneNumber },
      });
      
      // Generate OTP for phone verification
      return await this.generateOTP(userId, 'phone_verification');
    } catch (error) {
      logger.error('Error requesting phone verification OTP', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Verify phone number with OTP
   */
  async verifyPhoneNumber(userId: string, otp: string): Promise<boolean> {
    try {
      // Verify OTP
      const isOtpValid = await this.verifyOTP(userId, otp, 'phone_verification');
      
      if (!isOtpValid) {
        return false;
      }
      
      // Mark phone as verified
      await this.prisma.user.update({
        where: { id: userId },
        data: { isPhoneVerified: true },
      });
      
      return true;
    } catch (error) {
      logger.error('Error verifying phone number', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Resend OTP for verification
   */
  async resendOTP(userId: string, type: string): Promise<{ token: string; expiresAt: Date }> {
    try {
      // Check if user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Check the type and validate
      if (type === 'email_verification' && user.isEmailVerified) {
        throw new Error('Email is already verified');
      }
      
      if (type === 'phone_verification' && user.isPhoneVerified) {
        throw new Error('Phone number is already verified');
      }

      // Delete any existing OTP for this user and type
      const cacheKey = `otp:${userId}:${type}`;
      await cacheClient.delete(cacheKey);
      
      // Generate new OTP
      const { token, expiresAt } = await this.generateOTP(userId, type);
      
      // Send OTP based on type
      if (type === 'email_verification') {
        await this.sendVerificationEmail(user.email, user.firstName, token);
      } else if (type === 'login') {
        await this.sendVerificationEmail(user.email, user.firstName, token);
      } else if (type === 'password_reset') {
        // For password reset, we need the token too
        const resetToken = user.passwordResetToken || crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + this.passwordResetExpiresInHours * 60 * 60 * 1000);
        
        // Update reset token if needed
        if (!user.passwordResetToken) {
          await this.prisma.user.update({
            where: { id: user.id },
            data: {
              passwordResetToken: resetToken,
              passwordResetExpires: resetExpires,
            },
          });
        }
        
        await this.sendPasswordResetEmail(user.email, user.firstName, token, resetToken);
      }
      // Phone verification OTPs would typically be sent via SMS (not implemented)
      
      return { token, expiresAt };
    } catch (error) {
      logger.error('Error resending OTP', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}

export default new AuthService(); 