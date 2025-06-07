import { Request, Response } from 'express';
import analyticsService from '../services/analyticsService';
import logger from '../utils/logger';
import { AppError } from '../utils/errors';

// Extend Express Request type to include user
interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

class AnalyticsController {
  /**
   * Get productivity summary for the current user
   */
  async getProductivitySummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { period } = req.query;
      
      // Validate period
      const validPeriods = ['day', 'week', 'month'];
      const selectedPeriod = validPeriods.includes(period as string) 
        ? period as 'day' | 'week' | 'month' 
        : 'week';

      const summary = await analyticsService.getProductivitySummary(
        req.user.userId,
        selectedPeriod
      );

      res.status(200).json({
        success: true,
        message: 'Productivity summary retrieved successfully',
        data: summary
      });
    } catch (error) {
      logger.error('Error in getProductivitySummary controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to get productivity summary'
      });
    }
  }

  /**
   * Get performance trends for the current user
   */
  async getPerformanceTrends(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { days } = req.query;
      
      // Parse days parameter, default to 30 if invalid
      const numDays = days ? parseInt(days as string, 10) : 30;
      const daysToAnalyze = isNaN(numDays) || numDays <= 0 || numDays > 90 ? 30 : numDays;

      const trends = await analyticsService.getPerformanceTrends(
        req.user.userId,
        daysToAnalyze
      );

      res.status(200).json({
        success: true,
        message: 'Performance trends retrieved successfully',
        data: trends
      });
    } catch (error) {
      logger.error('Error in getPerformanceTrends controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to get performance trends'
      });
    }
  }

  /**
   * Get productivity recommendations for the current user
   */
  async getProductivityRecommendations(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const recommendations = await analyticsService.getProductivityRecommendations(req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Productivity recommendations retrieved successfully',
        data: recommendations
      });
    } catch (error) {
      logger.error('Error in getProductivityRecommendations controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to get productivity recommendations'
      });
    }
  }

  /**
   * Get integrated dashboard with data from multiple features
   */
  async getIntegratedDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const dashboard = await analyticsService.getIntegratedDashboard(req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Dashboard data retrieved successfully',
        data: dashboard
      });
    } catch (error) {
      logger.error('Error in getIntegratedDashboard controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to get dashboard data'
      });
    }
  }

  /**
   * Get notes summary and analysis
   */
  async getNotesSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const notesSummary = await analyticsService.getNotesSummary(req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Notes summary retrieved successfully',
        data: notesSummary
      });
    } catch (error) {
      logger.error('Error in getNotesSummary controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to get notes summary'
      });
    }
  }

  /**
   * Get goal-task relationship insights
   */
  async getGoalTaskInsights(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const insights = await analyticsService.getGoalTaskInsights(req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Goal-task insights retrieved successfully',
        data: insights
      });
    } catch (error) {
      logger.error('Error in getGoalTaskInsights controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to get goal-task insights'
      });
    }
  }

  /**
   * Get detailed financial insights and analysis
   */
  async getFinanceInsights(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const insights = await analyticsService.getFinanceInsights(req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Financial insights retrieved successfully',
        data: insights
      });
    } catch (error) {
      logger.error('Error in getFinanceInsights controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to get financial insights'
      });
    }
  }
}

export default new AnalyticsController(); 