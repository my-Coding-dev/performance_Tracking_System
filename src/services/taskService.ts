import { PrismaClient, Task, TimeEntry } from '@prisma/client';
import db from '../utils/database';
import logger from '../utils/logger';
import cacheClient from '../utils/cache';
import { NotFoundError, BadRequestError } from '../utils/errors';

interface CreateTaskData {
  title: string;
  description?: string;
  status: string;
  priority: string;
  userId: string;
  teamId?: string;
  dueDate?: Date;
  estimatedHours?: number;
  tags?: string[];
  parentTaskId?: string;
  startDate?: Date;
  recurringType?: string;
  recurringInterval?: number;
  goalId?: string;
  notes?: string | NoteItem[];
}

interface NoteItem {
  content: string;
  type?: string;
  timestamp?: Date;
  resolved?: boolean;
}

interface UpdateTaskData {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  teamId?: string;
  dueDate?: Date | null;
  estimatedHours?: number | null;
  actualHours?: number | null;
  completedAt?: Date | null;
  startDate?: Date | null;
  recurringType?: string | null;
  recurringInterval?: number | null;
  tags?: string[];
  parentTaskId?: string | null;
  goalId?: string | null;
  notes?: string | NoteItem[];
}

interface TimeEntryData {
  taskId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  description?: string;
  focusSessionId?: string;
}

interface TaskFilterOptions {
  status?: string | string[];
  priority?: string | string[];
  dueDate?: { from?: Date; to?: Date };
  tags?: string[];
  search?: string;
  parentTaskId?: string;
  teamId?: string;
  goalId?: string;
  isCompleted?: boolean;
  isOverdue?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

interface TaskStatistics {
  total: number;
  completed: number;
  inProgress: number;
  todo: number;
  overdue: number;
  completionRate: number;
  averageCompletionTime: number | null;
  upcomingDeadlines: Task[];
}

class TaskService {
  private prisma: PrismaClient;
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor() {
    this.prisma = db.getPrisma();
  }

  /**
   * Create a new task
   */
  async createTask(data: CreateTaskData): Promise<Task> {
    try {
      // Validate parent task if provided
      if (data.parentTaskId) {
        const parentTask = await this.prisma.task.findUnique({ 
          where: { id: data.parentTaskId } 
        });
        
        if (!parentTask) {
          throw new NotFoundError('Parent task not found');
        }
      }

      // Validate goal if provided
      if (data.goalId) {
        const goal = await this.prisma.goal.findUnique({
          where: { id: data.goalId }
        });
        
        if (!goal) {
          throw new NotFoundError('Goal not found');
        }
      }

      // Prepare metadata with notes if provided
      let metadata: any = {};
      if (data.notes) {
        metadata.notes = data.notes;
      }

      // Create task
      const task = await this.prisma.task.create({
        data: {
          title: data.title,
          description: data.description,
          status: data.status,
          priority: data.priority,
          userId: data.userId,
          teamId: data.teamId,
          dueDate: data.dueDate,
          estimatedHours: data.estimatedHours,
          tags: data.tags || [],
          parentTaskId: data.parentTaskId,
          startDate: data.startDate,
          recurringType: data.recurringType,
          recurringInterval: data.recurringInterval,
          goalId: data.goalId,
          metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : undefined
        }
      });

      // Invalidate cache
      await this.invalidateTaskCache(data.userId);

      return task;
    } catch (error) {
      logger.error('Error creating task', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get a task by ID
   */
  async getTaskById(taskId: string, userId: string): Promise<Task> {
    try {
      // Try to get from cache first
      const cacheKey = `task:${taskId}`;
      const cachedTask = await cacheClient.get<Task>(cacheKey);
      
      if (cachedTask) {
        return cachedTask;
      }

      // Get from database
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        include: {
          subtasks: true,
          timeEntries: true
        }
      });

      if (!task) {
        throw new NotFoundError('Task not found');
      }

      // Check permission
      if (task.userId !== userId && !task.teamId) {
        throw new NotFoundError('Task not found');
      }

      // Cache the result
      await cacheClient.set(cacheKey, task, this.CACHE_TTL);

      return task;
    } catch (error) {
      logger.error('Error getting task', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Update a task
   */
  async updateTask(taskId: string, userId: string, data: UpdateTaskData): Promise<Task> {
    try {
      // Get task
      const task = await this.prisma.task.findUnique({
        where: { id: taskId }
      });

      if (!task) {
        throw new NotFoundError('Task not found');
      }

      // Check permission
      if (task.userId !== userId) {
        throw new NotFoundError('Task not found');
      }

      // Validate parent task if provided
      if (data.parentTaskId) {
        const parentTask = await this.prisma.task.findUnique({ 
          where: { id: data.parentTaskId } 
        });
        
        if (!parentTask) {
          throw new NotFoundError('Parent task not found');
        }

        // Prevent circular reference
        if (data.parentTaskId === taskId) {
          throw new BadRequestError('Task cannot be its own parent');
        }
      }

      // Validate goal if provided
      if (data.goalId) {
        const goal = await this.prisma.goal.findUnique({
          where: { id: data.goalId }
        });
        
        if (!goal) {
          throw new NotFoundError('Goal not found');
        }
      }

      // Check if status is changing to completed
      if (data.status === 'completed' && task.status !== 'completed') {
        data.completedAt = new Date();
      }

      // Prepare metadata with notes if provided
      let metadata: any = task.metadata ? JSON.parse(String(task.metadata)) : {};
      if (data.notes !== undefined) {
        metadata.notes = data.notes;
      }

      // Update task
      const updatedTask = await this.prisma.task.update({
        where: { id: taskId },
        data: {
          title: data.title,
          description: data.description,
          status: data.status,
          priority: data.priority,
          teamId: data.teamId,
          dueDate: data.dueDate,
          estimatedHours: data.estimatedHours,
          actualHours: data.actualHours,
          completedAt: data.completedAt,
          startDate: data.startDate,
          recurringType: data.recurringType,
          recurringInterval: data.recurringInterval,
          tags: data.tags,
          parentTaskId: data.parentTaskId,
          goalId: data.goalId,
          metadata: JSON.stringify(metadata)
        }
      });

      // If task status is changed to completed and has a goal, update goal progress
      if (data.status === 'completed' && task.status !== 'completed' && updatedTask.goalId) {
        await this.updateGoalProgress(updatedTask.goalId);
      }

      // Invalidate cache
      await this.invalidateTaskCache(userId);
      await cacheClient.delete(`task:${taskId}`);

      return updatedTask;
    } catch (error) {
      logger.error('Error updating task', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string, userId: string): Promise<boolean> {
    try {
      // Get task
      const task = await this.prisma.task.findUnique({
        where: { id: taskId }
      });

      if (!task) {
        throw new NotFoundError('Task not found');
      }

      // Check permission
      if (task.userId !== userId) {
        throw new NotFoundError('Task not found');
      }

      // Check if task has subtasks
      const subtasks = await this.prisma.task.count({
        where: { parentTaskId: taskId }
      });

      if (subtasks > 0) {
        throw new BadRequestError('Cannot delete task with subtasks');
      }

      // Delete task
      await this.prisma.task.delete({
        where: { id: taskId }
      });

      // Invalidate cache
      await this.invalidateTaskCache(userId);
      await cacheClient.delete(`task:${taskId}`);

      return true;
    } catch (error) {
      logger.error('Error deleting task', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get tasks for a user with filtering and pagination
   */
  async getTasks(userId: string, options: TaskFilterOptions = {}): Promise<{ tasks: Task[]; total: number }> {
    try {
      const { 
        status, 
        priority, 
        dueDate, 
        tags, 
        search, 
        parentTaskId, 
        teamId, 
        goalId, 
        isCompleted, 
        isOverdue, 
        sortBy = 'createdAt', 
        sortOrder = 'desc',
        page = 1, 
        limit = 10 
      } = options;

      // Build filter conditions
      const where: any = { userId };

      // Team filter
      if (teamId) {
        where.teamId = teamId;
      }

      // Status filter
      if (status) {
        if (Array.isArray(status)) {
          where.status = { in: status };
        } else {
          where.status = status;
        }
      }

      // Priority filter
      if (priority) {
        if (Array.isArray(priority)) {
          where.priority = { in: priority };
        } else {
          where.priority = priority;
        }
      }

      // Due date filter
      if (dueDate) {
        where.dueDate = {};
        if (dueDate.from) {
          where.dueDate.gte = dueDate.from;
        }
        if (dueDate.to) {
          where.dueDate.lte = dueDate.to;
        }
      }

      // Tags filter
      if (tags && tags.length > 0) {
        where.tags = { hasSome: tags };
      }

      // Search filter
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ];
      }

      // Parent task filter
      if (parentTaskId) {
        where.parentTaskId = parentTaskId;
      } else if (parentTaskId === null) {
        where.parentTaskId = null; // Only top-level tasks
      }

      // Goal filter
      if (goalId) {
        where.goalId = goalId;
      }

      // Completion status
      if (isCompleted !== undefined) {
        where.status = isCompleted ? 'completed' : { not: 'completed' };
      }

      // Overdue filter
      if (isOverdue) {
        where.dueDate = { lt: new Date() };
        where.status = { not: 'completed' };
      }

      // Determine sort field and direction
      const orderBy: any = {};
      orderBy[sortBy] = sortOrder;

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Cache key based on query parameters
      const cacheKey = `tasks:${userId}:${JSON.stringify({ where, orderBy, skip, limit })}`;
      const cachedResult = await cacheClient.get<{ tasks: Task[], total: number }>(cacheKey);

      if (cachedResult) {
        return cachedResult;
      }

      // Get tasks from database
      const [tasks, total] = await this.prisma.$transaction([
        this.prisma.task.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: {
            subtasks: {
              select: {
                id: true,
                title: true,
                status: true
              }
            },
            timeEntries: {
              select: {
                id: true,
                startTime: true,
                endTime: true,
                duration: true
              },
              orderBy: {
                startTime: 'desc'
              },
              take: 5
            }
          }
        }),
        this.prisma.task.count({ where })
      ]);

      const result = { tasks, total };

      // Cache the result
      await cacheClient.set(cacheKey, result, this.CACHE_TTL);

      return result;
    } catch (error) {
      logger.error('Error getting tasks', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Create a time entry for a task
   */
  async createTimeEntry(data: TimeEntryData): Promise<TimeEntry> {
    try {
      // Validate task
      const task = await this.prisma.task.findUnique({
        where: { id: data.taskId }
      });

      if (!task) {
        throw new NotFoundError('Task not found');
      }

      // Calculate duration if start and end times are provided
      let duration = data.duration;
      if (data.startTime && data.endTime && !duration) {
        duration = Math.round((data.endTime.getTime() - data.startTime.getTime()) / 1000);
      }

      // Create time entry
      const timeEntry = await this.prisma.timeEntry.create({
        data: {
          taskId: data.taskId,
          userId: data.userId,
          startTime: data.startTime,
          endTime: data.endTime,
          duration,
          description: data.description,
          focusSessionId: data.focusSessionId
        }
      });

      // Invalidate task cache
      await cacheClient.delete(`task:${data.taskId}`);
      await this.invalidateTaskCache(data.userId);

      return timeEntry;
    } catch (error) {
      logger.error('Error creating time entry', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Update a time entry
   */
  async updateTimeEntry(timeEntryId: string, userId: string, data: Partial<TimeEntryData>): Promise<TimeEntry> {
    try {
      // Get time entry
      const timeEntry = await this.prisma.timeEntry.findUnique({
        where: { id: timeEntryId }
      });

      if (!timeEntry) {
        throw new NotFoundError('Time entry not found');
      }

      // Check permission
      if (timeEntry.userId !== userId) {
        throw new NotFoundError('Time entry not found');
      }

      // Calculate duration if start and end times are provided
      let duration = data.duration;
      if (data.startTime && data.endTime && !duration) {
        duration = Math.round((data.endTime.getTime() - data.startTime.getTime()) / 1000);
      }

      // Update time entry
      const updatedTimeEntry = await this.prisma.timeEntry.update({
        where: { id: timeEntryId },
        data: {
          startTime: data.startTime,
          endTime: data.endTime,
          duration,
          description: data.description,
          focusSessionId: data.focusSessionId
        }
      });

      // Invalidate task cache
      await cacheClient.delete(`task:${timeEntry.taskId}`);
      await this.invalidateTaskCache(userId);

      return updatedTimeEntry;
    } catch (error) {
      logger.error('Error updating time entry', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get time entries for a task
   */
  async getTimeEntriesForTask(taskId: string, userId: string): Promise<TimeEntry[]> {
    try {
      // Validate task
      const task = await this.prisma.task.findUnique({
        where: { id: taskId }
      });

      if (!task) {
        throw new NotFoundError('Task not found');
      }

      // Check permission
      if (task.userId !== userId) {
        throw new NotFoundError('Task not found');
      }

      // Get time entries
      const timeEntries = await this.prisma.timeEntry.findMany({
        where: { taskId },
        orderBy: { startTime: 'desc' }
      });

      return timeEntries;
    } catch (error) {
      logger.error('Error getting time entries', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get task statistics for a user
   */
  async getTaskStatistics(userId: string): Promise<TaskStatistics> {
    try {
      // Cache key
      const cacheKey = `task-stats:${userId}`;
      const cachedStats = await cacheClient.get<TaskStatistics>(cacheKey);
      
      if (cachedStats) {
        return cachedStats;
      }

      // Get task statistics
      const now = new Date();
      const [
        total,
        completed,
        inProgress,
        todo,
        overdue,
        completedTasks,
        upcomingDeadlines
      ] = await Promise.all([
        this.prisma.task.count({ where: { userId } }),
        this.prisma.task.count({ where: { userId, status: 'completed' } }),
        this.prisma.task.count({ where: { userId, status: 'in_progress' } }),
        this.prisma.task.count({ where: { userId, status: 'todo' } }),
        this.prisma.task.count({ 
          where: { 
            userId, 
            status: { not: 'completed' }, 
            dueDate: { lt: now } 
          } 
        }),
        this.prisma.task.findMany({
          where: { userId, status: 'completed', completedAt: { not: null } },
          select: { createdAt: true, completedAt: true }
        }),
        this.prisma.task.findMany({
          where: { 
            userId, 
            status: { not: 'completed' }, 
            dueDate: { 
              gte: now,
              lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
            } 
          },
          orderBy: { dueDate: 'asc' },
          take: 5
        })
      ]);

      // Calculate completion rate
      const completionRate = total > 0 ? (completed / total) * 100 : 0;

      // Calculate average completion time
      let averageCompletionTime: number | null = null;
      if (completedTasks.length > 0) {
        const totalCompletionTime = completedTasks.reduce((sum, task) => {
          if (task.completedAt && task.createdAt) {
            return sum + (task.completedAt.getTime() - task.createdAt.getTime());
          }
          return sum;
        }, 0);
        
        // Average in milliseconds, convert to hours
        averageCompletionTime = totalCompletionTime / completedTasks.length / (1000 * 60 * 60);
      }

      const stats: TaskStatistics = {
        total,
        completed,
        inProgress,
        todo,
        overdue,
        completionRate,
        averageCompletionTime,
        upcomingDeadlines
      };

      // Cache the result
      await cacheClient.set(cacheKey, stats, this.CACHE_TTL);

      return stats;
    } catch (error) {
      logger.error('Error getting task statistics', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Update goal progress when tasks are completed
   */
  private async updateGoalProgress(goalId: string): Promise<void> {
    try {
      // Get goal
      const goal = await this.prisma.goal.findUnique({
        where: { id: goalId }
      });

      if (!goal || !goal.targetValue) {
        return;
      }

      // Count completed tasks for this goal
      const completedTasks = await this.prisma.task.count({
        where: {
          goalId,
          status: 'completed'
        }
      });

      // Get total tasks for this goal
      const totalTasks = await this.prisma.task.count({
        where: {
          goalId
        }
      });

      if (totalTasks === 0) {
        return;
      }

      // Calculate progress percentage
      const progressPercentage = (completedTasks / totalTasks) * 100;

      // Update goal progress
      await this.prisma.goal.update({
        where: { id: goalId },
        data: {
          currentValue: Math.min(progressPercentage, goal.targetValue),
          status: progressPercentage >= goal.targetValue ? 'completed' : 'active',
          completedAt: progressPercentage >= goal.targetValue ? new Date() : null
        }
      });
    } catch (error) {
      logger.error('Error updating goal progress', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Invalidate task cache for a user
   */
  private async invalidateTaskCache(userId: string): Promise<void> {
    try {
      await cacheClient.clearByPattern(`tasks:${userId}:`);
      await cacheClient.delete(`task-stats:${userId}`);
    } catch (error) {
      logger.error('Error invalidating task cache', error instanceof Error ? error : new Error(String(error)));
    }
  }
}

export default new TaskService(); 