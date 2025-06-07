import { Request, Response } from 'express';
import taskService from '../services/taskService';
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

class TaskController {
  /**
   * Create a new task
   */
  async createTask(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { 
        title, description, status, priority, teamId, dueDate, estimatedHours, 
        tags, parentTaskId, startDate, recurringType, recurringInterval, goalId, notes 
      } = req.body;

      // Validate required fields
      if (!title || !status || !priority) {
        throw new ValidationError('Missing required fields', {
          title: !title ? 'Title is required' : '',
          status: !status ? 'Status is required' : '',
          priority: !priority ? 'Priority is required' : ''
        });
      }

      // Validate status
      const validStatuses = ['todo', 'in_progress', 'completed', 'archived'];
      if (!validStatuses.includes(status)) {
        throw new ValidationError('Invalid status', {
          status: `Status must be one of: ${validStatuses.join(', ')}`
        });
      }

      // Validate priority
      const validPriorities = ['low', 'medium', 'high', 'urgent'];
      if (!validPriorities.includes(priority)) {
        throw new ValidationError('Invalid priority', {
          priority: `Priority must be one of: ${validPriorities.join(', ')}`
        });
      }

      // Process notes field if it's an array
      let processedNotes = notes;
      if (Array.isArray(notes)) {
        // Add timestamps to notes that don't have them
        processedNotes = notes.map(note => {
          if (!note.timestamp) {
            return { ...note, timestamp: new Date() };
          }
          return { ...note, timestamp: new Date(note.timestamp) };
        });
      }

      // Create task
      const task = await taskService.createTask({
        title,
        description,
        status,
        priority,
        userId: req.user.userId,
        teamId,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        estimatedHours,
        tags,
        parentTaskId,
        startDate: startDate ? new Date(startDate) : undefined,
        recurringType,
        recurringInterval,
        goalId,
        notes: processedNotes
      });

      res.status(201).json({
        success: true,
        message: 'Task created successfully',
        data: task
      });
    } catch (error) {
      logger.error('Error in createTask controller', error instanceof Error ? error : new Error(String(error)));
      
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
        message: 'Failed to create task'
      });
    }
  }

  /**
   * Get a task by ID
   */
  async getTask(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const task = await taskService.getTaskById(id, req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Task retrieved successfully',
        data: task
      });
    } catch (error) {
      logger.error('Error in getTask controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to get task'
      });
    }
  }

  /**
   * Update a task
   */
  async updateTask(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { 
        title, description, status, priority, teamId, dueDate, estimatedHours, actualHours, 
        completedAt, startDate, recurringType, recurringInterval, tags, parentTaskId, goalId, notes 
      } = req.body;

      // Validate status if provided
      if (status) {
        const validStatuses = ['todo', 'in_progress', 'completed', 'archived'];
        if (!validStatuses.includes(status)) {
          throw new ValidationError('Invalid status', {
            status: `Status must be one of: ${validStatuses.join(', ')}`
          });
        }
      }

      // Validate priority if provided
      if (priority) {
        const validPriorities = ['low', 'medium', 'high', 'urgent'];
        if (!validPriorities.includes(priority)) {
          throw new ValidationError('Invalid priority', {
            priority: `Priority must be one of: ${validPriorities.join(', ')}`
          });
        }
      }

      // Process notes field if it's an array
      let processedNotes = notes;
      if (notes !== undefined && Array.isArray(notes)) {
        // Add timestamps to notes that don't have them
        processedNotes = notes.map(note => {
          if (!note.timestamp) {
            return { ...note, timestamp: new Date() };
          }
          return { ...note, timestamp: new Date(note.timestamp) };
        });
      }

      // Update task
      const task = await taskService.updateTask(id, req.user.userId, {
        title,
        description,
        status,
        priority,
        teamId,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        estimatedHours,
        actualHours,
        completedAt: completedAt ? new Date(completedAt) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        recurringType,
        recurringInterval,
        tags,
        parentTaskId,
        goalId,
        notes: processedNotes
      });

      res.status(200).json({
        success: true,
        message: 'Task updated successfully',
        data: task
      });
    } catch (error) {
      logger.error('Error in updateTask controller', error instanceof Error ? error : new Error(String(error)));
      
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
        message: 'Failed to update task'
      });
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await taskService.deleteTask(id, req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Task deleted successfully'
      });
    } catch (error) {
      logger.error('Error in deleteTask controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to delete task'
      });
    }
  }

  /**
   * Get tasks for current user with filtering and pagination
   */
  async getTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        status,
        priority,
        dueDateFrom,
        dueDateTo,
        tags,
        search,
        parentTaskId,
        teamId,
        goalId,
        isCompleted,
        isOverdue,
        sortBy,
        sortOrder,
        page,
        limit
      } = req.query;

      // Build filter options
      const filterOptions: any = {
        status: status,
        priority: priority,
        dueDate: (dueDateFrom || dueDateTo) ? {
          from: dueDateFrom ? new Date(dueDateFrom as string) : undefined,
          to: dueDateTo ? new Date(dueDateTo as string) : undefined
        } : undefined,
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) as string[] : undefined,
        search: search as string,
        parentTaskId: parentTaskId === 'null' ? null : parentTaskId as string,
        teamId: teamId as string,
        goalId: goalId as string,
        isCompleted: isCompleted === 'true' ? true : isCompleted === 'false' ? false : undefined,
        isOverdue: isOverdue === 'true',
        sortBy: sortBy as string,
        sortOrder: sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : undefined,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined
      };

      // Get tasks
      const { tasks, total } = await taskService.getTasks(req.user.userId, filterOptions);

      res.status(200).json({
        success: true,
        message: 'Tasks retrieved successfully',
        data: {
          tasks,
          total,
          page: filterOptions.page || 1,
          limit: filterOptions.limit || 10,
          totalPages: Math.ceil(total / (filterOptions.limit || 10))
        }
      });
    } catch (error) {
      logger.error('Error in getTasks controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to get tasks'
      });
    }
  }

  /**
   * Create a time entry for a task
   */
  async createTimeEntry(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { taskId } = req.params;
      const { startTime, endTime, duration, description, focusSessionId } = req.body;

      // Validate required fields
      if (!startTime) {
        throw new ValidationError('Start time is required', {
          startTime: 'Start time is required'
        });
      }

      // Create time entry
      const timeEntry = await taskService.createTimeEntry({
        taskId,
        userId: req.user.userId,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : undefined,
        duration,
        description,
        focusSessionId
      });

      res.status(201).json({
        success: true,
        message: 'Time entry created successfully',
        data: timeEntry
      });
    } catch (error) {
      logger.error('Error in createTimeEntry controller', error instanceof Error ? error : new Error(String(error)));
      
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
        message: 'Failed to create time entry'
      });
    }
  }

  /**
   * Update a time entry
   */
  async updateTimeEntry(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { taskId, timeEntryId } = req.params;
      const { startTime, endTime, duration, description, focusSessionId } = req.body;

      // Update time entry
      const timeEntry = await taskService.updateTimeEntry(timeEntryId, req.user.userId, {
        taskId,
        userId: req.user.userId,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        duration,
        description,
        focusSessionId
      });

      res.status(200).json({
        success: true,
        message: 'Time entry updated successfully',
        data: timeEntry
      });
    } catch (error) {
      logger.error('Error in updateTimeEntry controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to update time entry'
      });
    }
  }

  /**
   * Get time entries for a task
   */
  async getTimeEntries(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { taskId } = req.params;

      const timeEntries = await taskService.getTimeEntriesForTask(taskId, req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Time entries retrieved successfully',
        data: timeEntries
      });
    } catch (error) {
      logger.error('Error in getTimeEntries controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to get time entries'
      });
    }
  }

  /**
   * Get task statistics for the current user
   */
  async getTaskStatistics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const stats = await taskService.getTaskStatistics(req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Task statistics retrieved successfully',
        data: stats
      });
    } catch (error) {
      logger.error('Error in getTaskStatistics controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to get task statistics'
      });
    }
  }
}

export default new TaskController(); 