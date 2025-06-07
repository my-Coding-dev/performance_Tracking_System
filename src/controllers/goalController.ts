import { Request, Response } from 'express';
import goalService from '../services/goalService';
import logger from '../utils/logger';
import { AppError, ValidationError } from '../utils/errors';

// Extend Express Request type to include user
interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

class GoalController {
  /**
   * Create a new goal
   */
  async createGoal(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { title, description, teamId, category, targetValue, startDate, endDate, parentGoalId, isPublic, metadata } = req.body;

      // Validate required fields
      if (!title || !category) {
        throw new ValidationError('Missing required fields', {
          title: !title ? 'Title is required' : '',
          category: !category ? 'Category is required' : ''
        });
      }

      // Create goal
      const goal = await goalService.createGoal({
        title,
        description,
        userId: req.user.userId,
        teamId,
        category,
        targetValue: targetValue ? parseFloat(targetValue) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        parentGoalId,
        isPublic,
        metadata
      });

      res.status(201).json({
        success: true,
        message: 'Goal created successfully',
        data: goal
      });
    } catch (error) {
      logger.error('Error in createGoal controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
          errors: error instanceof ValidationError ? error.errors : undefined
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to create goal'
      });
    }
  }

  /**
   * Get a goal by ID
   */
  async getGoal(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const goal = await goalService.getGoalById(id, req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Goal retrieved successfully',
        data: goal
      });
    } catch (error) {
      logger.error('Error in getGoal controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to get goal'
      });
    }
  }

  /**
   * Update a goal
   */
  async updateGoal(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { title, description, teamId, category, targetValue, currentValue, startDate, endDate, status, parentGoalId, isPublic, metadata } = req.body;

      // Validate status if provided
      if (status) {
        const validStatuses = ['active', 'completed', 'abandoned'];
        if (!validStatuses.includes(status)) {
          throw new ValidationError('Invalid status', {
            status: `Status must be one of: ${validStatuses.join(', ')}`
          });
        }
      }

      // Update goal
      const goal = await goalService.updateGoal(id, req.user.userId, {
        title,
        description,
        teamId,
        category,
        targetValue: targetValue !== undefined ? parseFloat(targetValue) : undefined,
        currentValue: currentValue !== undefined ? parseFloat(currentValue) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : null,
        status,
        parentGoalId,
        isPublic,
        metadata
      });

      res.status(200).json({
        success: true,
        message: 'Goal updated successfully',
        data: goal
      });
    } catch (error) {
      logger.error('Error in updateGoal controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
          errors: error instanceof ValidationError ? error.errors : undefined
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to update goal'
      });
    }
  }

  /**
   * Delete a goal
   */
  async deleteGoal(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await goalService.deleteGoal(id, req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Goal deleted successfully'
      });
    } catch (error) {
      logger.error('Error in deleteGoal controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to delete goal'
      });
    }
  }

  /**
   * Get goals for current user with filtering and pagination
   */
  async getGoals(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        category,
        status,
        parentGoalId,
        teamId,
        search,
        isPublic,
        dateRangeFrom,
        dateRangeTo,
        sortBy,
        sortOrder,
        page,
        limit
      } = req.query;

      // Build filter options
      const filterOptions: any = {
        category: category,
        status: status,
        parentGoalId: parentGoalId === 'null' ? null : parentGoalId as string,
        teamId: teamId as string,
        search: search as string,
        isPublic: isPublic === 'true' ? true : isPublic === 'false' ? false : undefined,
        dateRange: (dateRangeFrom || dateRangeTo) ? {
          from: dateRangeFrom ? new Date(dateRangeFrom as string) : undefined,
          to: dateRangeTo ? new Date(dateRangeTo as string) : undefined
        } : undefined,
        sortBy: sortBy as string,
        sortOrder: sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : undefined,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined
      };

      // Get goals
      const { goals, total } = await goalService.getGoals(req.user.userId, filterOptions);

      res.status(200).json({
        success: true,
        message: 'Goals retrieved successfully',
        data: {
          goals,
          total,
          page: filterOptions.page || 1,
          limit: filterOptions.limit || 10,
          totalPages: Math.ceil(total / (filterOptions.limit || 10))
        }
      });
    } catch (error) {
      logger.error('Error in getGoals controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to get goals'
      });
    }
  }

  /**
   * Get progress for a goal
   */
  async getGoalProgress(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const progress = await goalService.getGoalProgress(id, req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Goal progress retrieved successfully',
        data: progress
      });
    } catch (error) {
      logger.error('Error in getGoalProgress controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to get goal progress'
      });
    }
  }

  /**
   * Create a milestone for a goal
   */
  async createMilestone(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { goalId } = req.params;
      const { title, description, targetValue, dueDate } = req.body;

      // Validate required fields
      if (!title) {
        throw new ValidationError('Missing required fields', {
          title: 'Title is required'
        });
      }

      // Create milestone
      const milestone = await goalService.createMilestone({
        goalId,
        title,
        description,
        targetValue: targetValue ? parseFloat(targetValue) : undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined
      }, req.user.userId);

      res.status(201).json({
        success: true,
        message: 'Milestone created successfully',
        data: milestone
      });
    } catch (error) {
      logger.error('Error in createMilestone controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
          errors: error instanceof ValidationError ? error.errors : undefined
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to create milestone'
      });
    }
  }

  /**
   * Update a milestone
   */
  async updateMilestone(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { goalId, milestoneId } = req.params;
      const { title, description, targetValue, isCompleted, dueDate } = req.body;

      // Update milestone
      const milestone = await goalService.updateMilestone(milestoneId, req.user.userId, {
        title,
        description,
        targetValue: targetValue !== undefined ? parseFloat(targetValue) : undefined,
        isCompleted: isCompleted === 'true' || isCompleted === true ? true : undefined,
        dueDate: dueDate ? new Date(dueDate) : null
      });

      res.status(200).json({
        success: true,
        message: 'Milestone updated successfully',
        data: milestone
      });
    } catch (error) {
      logger.error('Error in updateMilestone controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to update milestone'
      });
    }
  }

  /**
   * Delete a milestone
   */
  async deleteMilestone(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { milestoneId } = req.params;

      await goalService.deleteMilestone(milestoneId, req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Milestone deleted successfully'
      });
    } catch (error) {
      logger.error('Error in deleteMilestone controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to delete milestone'
      });
    }
  }
}

export default new GoalController(); 