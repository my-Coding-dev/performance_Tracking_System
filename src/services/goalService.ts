import { PrismaClient, Goal, Milestone, Task } from '@prisma/client';
import db from '../utils/database';
import logger from '../utils/logger';
import cacheClient from '../utils/cache';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { JsonFilters } from '../utils/cache';

interface CreateGoalData {
  title: string;
  description?: string;
  userId: string;
  teamId?: string;
  category: string;
  targetValue?: number;
  startDate?: Date;
  endDate?: Date;
  parentGoalId?: string;
  isPublic?: boolean;
  metadata?: Record<string, any>;
}

interface UpdateGoalData {
  title?: string;
  description?: string;
  teamId?: string | null;
  category?: string;
  targetValue?: number | null;
  currentValue?: number;
  startDate?: Date | null;
  endDate?: Date | null;
  status?: string;
  completedAt?: Date | null;
  parentGoalId?: string | null;
  isPublic?: boolean;
  metadata?: Record<string, any>;
}

interface CreateMilestoneData {
  goalId: string;
  title: string;
  description?: string;
  targetValue?: number;
  dueDate?: Date;
}

interface UpdateMilestoneData {
  title?: string;
  description?: string;
  targetValue?: number;
  isCompleted?: boolean;
  dueDate?: Date | null;
  completedAt?: Date | null;
}

interface GoalFilterOptions {
  category?: string | string[];
  status?: string | string[];
  parentGoalId?: string;
  teamId?: string;
  search?: string;
  isPublic?: boolean;
  dateRange?: { from?: Date; to?: Date };
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

interface GoalProgress {
  goalId: string;
  title: string;
  currentValue: number;
  targetValue: number | null;
  percentage: number;
  status: string;
  milestones: Array<{
    id: string;
    title: string;
    isCompleted: boolean;
    targetValue: number | null;
    dueDate: Date | null;
  }>;
}

// Import the NoteItem interface if it's in a separate file, otherwise define it here
interface NoteItem {
  content: string;
  type?: string;
  timestamp?: Date;
  resolved?: boolean;
}

// New interface for task creation related to goals
interface GoalTaskData {
  title: string;
  description?: string;
  startDate?: Date;
  dueDate?: Date;
  priority: string;
  resourceLinks?: string[];
  notes?: string | NoteItem[];
  focusRequired?: boolean;
  doubts?: string;
  tags?: string[];
}

class GoalService {
  private prisma: PrismaClient;
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor() {
    this.prisma = db.getPrisma();
  }

  /**
   * Create a new goal
   */
  async createGoal(data: CreateGoalData): Promise<Goal> {
    try {
      // Validate parent goal if provided
      if (data.parentGoalId) {
        const parentGoal = await this.prisma.goal.findUnique({ 
          where: { id: data.parentGoalId } 
        });
        
        if (!parentGoal) {
          throw new NotFoundError('Parent goal not found');
        }
      }

      // Set default targetValue if not provided
      const targetValue = data.targetValue || 100; // Default to 100% completion

      // Create goal
      const goal = await this.prisma.goal.create({
        data: {
          title: data.title,
          description: data.description,
          userId: data.userId,
          teamId: data.teamId,
          category: data.category,
          targetValue,
          currentValue: 0, // Start at 0 progress
          startDate: data.startDate || new Date(),
          endDate: data.endDate,
          status: 'active',
          parentGoalId: data.parentGoalId,
          isPublic: data.isPublic || false,
          metadata: data.metadata ? JSON.stringify(data.metadata) : undefined
        }
      });

      // If goal has start and end dates, create initial task
      if (goal.startDate && goal.endDate) {
        await this.createInitialTasksForGoal(goal);
      }

      // Invalidate cache
      await this.invalidateGoalCache(data.userId);

      return goal;
    } catch (error) {
      logger.error('Error creating goal', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get a goal by ID
   */
  async getGoalById(goalId: string, userId: string): Promise<Goal> {
    try {
      // Try to get from cache first
      const cacheKey = `goal:${goalId}`;
      const cachedGoal = await cacheClient.get<Goal>(cacheKey);
      
      if (cachedGoal) {
        return cachedGoal;
      }

      // Get from database
      const goal = await this.prisma.goal.findUnique({
        where: { id: goalId },
        include: {
          milestones: true,
          subgoals: true,
          tasks: {
            select: {
              id: true,
              title: true,
              status: true,
              dueDate: true
            }
          }
        }
      });

      if (!goal) {
        throw new NotFoundError('Goal not found');
      }

      // Check permission
      if (goal.userId !== userId && !goal.teamId && !goal.isPublic) {
        throw new NotFoundError('Goal not found');
      }

      // Cache the result
      await cacheClient.set(cacheKey, goal, this.CACHE_TTL);

      return goal;
    } catch (error) {
      logger.error('Error getting goal', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Update a goal
   */
  async updateGoal(goalId: string, userId: string, data: UpdateGoalData): Promise<Goal> {
    try {
      // Get goal
      const goal = await this.prisma.goal.findUnique({
        where: { id: goalId }
      });

      if (!goal) {
        throw new NotFoundError('Goal not found');
      }

      // Check permission
      if (goal.userId !== userId) {
        throw new NotFoundError('Goal not found');
      }

      // Validate parent goal if provided
      if (data.parentGoalId) {
        const parentGoal = await this.prisma.goal.findUnique({ 
          where: { id: data.parentGoalId } 
        });
        
        if (!parentGoal) {
          throw new NotFoundError('Parent goal not found');
        }

        // Prevent circular reference
        if (data.parentGoalId === goalId) {
          throw new BadRequestError('Goal cannot be its own parent');
        }
      }

      // Check if status is changing to completed
      if (data.status === 'completed' && goal.status !== 'completed') {
        data.completedAt = new Date();
        
        // If no currentValue is provided, set to targetValue
        if (data.currentValue === undefined && goal.targetValue) {
          data.currentValue = goal.targetValue;
        }
      }

      // Parse metadata if provided
      let metadata: any = undefined;
      if (data.metadata) {
        metadata = JSON.stringify(data.metadata);
      }

      // Build update data, handling null values appropriately
      const updateData: any = {
        title: data.title,
        description: data.description,
        teamId: data.teamId,
        category: data.category,
        targetValue: data.targetValue,
        currentValue: data.currentValue,
        status: data.status,
        completedAt: data.completedAt,
        parentGoalId: data.parentGoalId,
        isPublic: data.isPublic,
        metadata
      };

      // Handle startDate and endDate separately to avoid null issues
      if (data.startDate !== undefined) {
        if (data.startDate === null) {
          // If null is provided, set to current date instead
          updateData.startDate = new Date();
        } else {
          updateData.startDate = data.startDate;
        }
      }

      if (data.endDate !== undefined) {
        updateData.endDate = data.endDate; // This can be null
      }

      // Update goal
      const updatedGoal = await this.prisma.goal.update({
        where: { id: goalId },
        data: updateData
      });

      // If date range was updated, update tasks
      const startDateChanged = data.startDate !== undefined && 
                              (!goal.startDate || data.startDate?.getTime() !== goal.startDate.getTime());
      const endDateChanged = data.endDate !== undefined && 
                            (!goal.endDate || data.endDate?.getTime() !== goal.endDate.getTime());
      
      if ((startDateChanged || endDateChanged) && updatedGoal.startDate && updatedGoal.endDate) {
        await this.updateTasksForGoalDateChange(updatedGoal, goal);
      }

      // If goal is marked as completed, update parent goal progress
      if (data.status === 'completed' && goal.status !== 'completed' && updatedGoal.parentGoalId) {
        await this.updateParentGoalProgress(updatedGoal.parentGoalId);
      }

      // Invalidate cache
      await this.invalidateGoalCache(userId);
      await cacheClient.delete(`goal:${goalId}`);

      return updatedGoal;
    } catch (error) {
      logger.error('Error updating goal', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Delete a goal
   */
  async deleteGoal(goalId: string, userId: string): Promise<boolean> {
    try {
      // Get goal
      const goal = await this.prisma.goal.findUnique({
        where: { id: goalId }
      });

      if (!goal) {
        throw new NotFoundError('Goal not found');
      }

      // Check permission
      if (goal.userId !== userId) {
        throw new NotFoundError('Goal not found');
      }

      // Check if goal has subgoals
      const subgoals = await this.prisma.goal.count({
        where: { parentGoalId: goalId }
      });

      if (subgoals > 0) {
        throw new BadRequestError('Cannot delete goal with subgoals');
      }

      // Delete all milestones
      await this.prisma.milestone.deleteMany({
        where: { goalId }
      });

      // Delete goal
      await this.prisma.goal.delete({
        where: { id: goalId }
      });

      // Invalidate cache
      await this.invalidateGoalCache(userId);
      await cacheClient.delete(`goal:${goalId}`);

      return true;
    } catch (error) {
      logger.error('Error deleting goal', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get goals for a user with filtering and pagination
   */
  async getGoals(userId: string, options: GoalFilterOptions = {}): Promise<{ goals: Goal[]; total: number }> {
    try {
      const { 
        category, 
        status, 
        parentGoalId, 
        teamId, 
        search, 
        isPublic, 
        dateRange, 
        sortBy = 'createdAt', 
        sortOrder = 'desc',
        page = 1, 
        limit = 10 
      } = options;

      // Build filter conditions
      const where: any = { 
        OR: [
          { userId },
          { teamId: { not: null } }, // Team goals
          { isPublic: true } // Public goals
        ]
      };

      // Category filter
      if (category) {
        if (Array.isArray(category)) {
          where.category = { in: category };
        } else {
          where.category = category;
        }
      }

      // Status filter
      if (status) {
        if (Array.isArray(status)) {
          where.status = { in: status };
        } else {
          where.status = status;
        }
      }

      // Parent goal filter
      if (parentGoalId) {
        where.parentGoalId = parentGoalId;
      } else if (parentGoalId === null) {
        where.parentGoalId = null; // Only top-level goals
      }

      // Team filter
      if (teamId) {
        where.teamId = teamId;
      }

      // Public filter
      if (isPublic !== undefined) {
        where.isPublic = isPublic;
      }

      // Date range filter
      if (dateRange) {
        where.OR = [
          // Start date in range
          dateRange.from && dateRange.to
            ? { 
                startDate: { 
                  gte: dateRange.from,
                  lte: dateRange.to
                } 
              }
            : dateRange.from
            ? { startDate: { gte: dateRange.from } }
            : dateRange.to
            ? { startDate: { lte: dateRange.to } }
            : undefined,
          
          // End date in range
          dateRange.from && dateRange.to
            ? { 
                endDate: { 
                  gte: dateRange.from,
                  lte: dateRange.to
                } 
              }
            : dateRange.from
            ? { endDate: { gte: dateRange.from } }
            : dateRange.to
            ? { endDate: { lte: dateRange.to } }
            : undefined,
        ].filter(Boolean); // Remove undefined conditions
      }

      // Search filter
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ];
      }

      // Determine sort field and direction
      const orderBy: any = {};
      orderBy[sortBy] = sortOrder;

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Cache key based on query parameters
      const cacheKey = `goals:${userId}:${JSON.stringify({ where, orderBy, skip, limit })}`;
      const cachedResult = await cacheClient.get<{ goals: Goal[], total: number }>(cacheKey);

      if (cachedResult) {
        return cachedResult;
      }

      // Get goals from database
      const [goals, total] = await this.prisma.$transaction([
        this.prisma.goal.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: {
            milestones: true,
            _count: {
              select: {
                tasks: true,
                subgoals: true
              }
            }
          }
        }),
        this.prisma.goal.count({ where })
      ]);

      const result = { goals, total };

      // Cache the result
      await cacheClient.set(cacheKey, result, this.CACHE_TTL);

      return result;
    } catch (error) {
      logger.error('Error getting goals', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Create a milestone for a goal
   */
  async createMilestone(data: CreateMilestoneData, userId: string): Promise<Milestone> {
    try {
      // Validate goal
      const goal = await this.prisma.goal.findUnique({
        where: { id: data.goalId }
      });

      if (!goal) {
        throw new NotFoundError('Goal not found');
      }

      // Check permission
      if (goal.userId !== userId) {
        throw new NotFoundError('Goal not found');
      }

      // Create milestone
      const milestone = await this.prisma.milestone.create({
        data: {
          goalId: data.goalId,
          title: data.title,
          description: data.description,
          targetValue: data.targetValue,
          dueDate: data.dueDate
        }
      });

      // Invalidate cache
      await cacheClient.delete(`goal:${data.goalId}`);
      await this.invalidateGoalCache(userId);

      return milestone;
    } catch (error) {
      logger.error('Error creating milestone', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Update a milestone
   */
  async updateMilestone(milestoneId: string, userId: string, data: UpdateMilestoneData): Promise<Milestone> {
    try {
      // Get milestone with goal
      const milestone = await this.prisma.milestone.findUnique({
        where: { id: milestoneId },
        include: {
          goal: true
        }
      });

      if (!milestone) {
        throw new NotFoundError('Milestone not found');
      }

      // Check permission
      if (milestone.goal.userId !== userId) {
        throw new NotFoundError('Milestone not found');
      }

      // If milestone is being completed, set completedAt
      let completedAt = data.completedAt;
      if (data.isCompleted && !milestone.isCompleted) {
        completedAt = new Date();
      }

      // Build update data, handling null values appropriately
      const updateData: any = {
        title: data.title,
        description: data.description,
        targetValue: data.targetValue,
        isCompleted: data.isCompleted,
        completedAt
      };

      // Handle dueDate separately
      if (data.dueDate !== undefined) {
        updateData.dueDate = data.dueDate; // This can be null
      }

      // Update milestone
      const updatedMilestone = await this.prisma.milestone.update({
        where: { id: milestoneId },
        data: updateData
      });

      // If milestone is completed, update goal progress
      if (data.isCompleted && !milestone.isCompleted) {
        await this.updateGoalProgressFromMilestones(milestone.goalId);
      }

      // Invalidate cache
      await cacheClient.delete(`goal:${milestone.goalId}`);
      await this.invalidateGoalCache(userId);

      return updatedMilestone;
    } catch (error) {
      logger.error('Error updating milestone', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Delete a milestone
   */
  async deleteMilestone(milestoneId: string, userId: string): Promise<boolean> {
    try {
      // Get milestone with goal
      const milestone = await this.prisma.milestone.findUnique({
        where: { id: milestoneId },
        include: {
          goal: true
        }
      });

      if (!milestone) {
        throw new NotFoundError('Milestone not found');
      }

      // Check permission
      if (milestone.goal.userId !== userId) {
        throw new NotFoundError('Milestone not found');
      }

      // Delete milestone
      await this.prisma.milestone.delete({
        where: { id: milestoneId }
      });

      // Update goal progress
      await this.updateGoalProgressFromMilestones(milestone.goalId);

      // Invalidate cache
      await cacheClient.delete(`goal:${milestone.goalId}`);
      await this.invalidateGoalCache(userId);

      return true;
    } catch (error) {
      logger.error('Error deleting milestone', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get detailed progress for a goal
   */
  async getGoalProgress(goalId: string, userId: string): Promise<GoalProgress> {
    try {
      // Get goal with milestones
      const goal = await this.prisma.goal.findUnique({
        where: { id: goalId },
        include: {
          milestones: true
        }
      });

      if (!goal) {
        throw new NotFoundError('Goal not found');
      }

      // Check permission
      if (goal.userId !== userId && !goal.teamId && !goal.isPublic) {
        throw new NotFoundError('Goal not found');
      }

      // Calculate progress percentage
      const percentage = goal.targetValue 
        ? Math.min(100, (goal.currentValue / goal.targetValue) * 100) 
        : 0;

      // Format response
      const progress: GoalProgress = {
        goalId: goal.id,
        title: goal.title,
        currentValue: goal.currentValue,
        targetValue: goal.targetValue,
        percentage,
        status: goal.status,
        milestones: goal.milestones.map(m => ({
          id: m.id,
          title: m.title,
          isCompleted: m.isCompleted,
          targetValue: m.targetValue,
          dueDate: m.dueDate
        }))
      };

      return progress;
    } catch (error) {
      logger.error('Error getting goal progress', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Update goal progress based on milestones
   */
  private async updateGoalProgressFromMilestones(goalId: string): Promise<void> {
    try {
      // Get goal with milestones
      const goal = await this.prisma.goal.findUnique({
        where: { id: goalId },
        include: {
          milestones: true
        }
      });

      if (!goal) {
        return;
      }

      // If no milestones, don't update progress
      if (goal.milestones.length === 0) {
        return;
      }

      // Calculate progress based on completed milestones
      const completedMilestones = goal.milestones.filter(m => m.isCompleted).length;
      const totalMilestones = goal.milestones.length;
      const progressPercentage = (completedMilestones / totalMilestones) * 100;

      // Determine if goal is completed
      const isCompleted = completedMilestones === totalMilestones;

      // Update goal
      await this.prisma.goal.update({
        where: { id: goalId },
        data: {
          currentValue: progressPercentage,
          status: isCompleted ? 'completed' : 'active',
          completedAt: isCompleted ? new Date() : null
        }
      });

      // If goal is now completed and has a parent, update parent goal progress
      if (isCompleted && goal.parentGoalId) {
        await this.updateParentGoalProgress(goal.parentGoalId);
      }
    } catch (error) {
      logger.error('Error updating goal progress from milestones', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Update parent goal progress when a subgoal is completed
   */
  private async updateParentGoalProgress(parentGoalId: string): Promise<void> {
    try {
      // Get parent goal with subgoals
      const parentGoal = await this.prisma.goal.findUnique({
        where: { id: parentGoalId },
        include: {
          subgoals: true
        }
      });

      if (!parentGoal) {
        return;
      }

      // Calculate progress based on completed subgoals
      const completedSubgoals = parentGoal.subgoals.filter(g => g.status === 'completed').length;
      const totalSubgoals = parentGoal.subgoals.length;
      
      if (totalSubgoals === 0) {
        return;
      }
      
      const progressPercentage = (completedSubgoals / totalSubgoals) * 100;

      // Determine if parent goal is completed
      const isCompleted = completedSubgoals === totalSubgoals;

      // Update parent goal
      await this.prisma.goal.update({
        where: { id: parentGoalId },
        data: {
          currentValue: progressPercentage,
          status: isCompleted ? 'completed' : 'active',
          completedAt: isCompleted ? new Date() : null
        }
      });

      // If parent goal is now completed and has a parent, update that parent goal's progress
      if (isCompleted && parentGoal.parentGoalId) {
        await this.updateParentGoalProgress(parentGoal.parentGoalId);
      }
    } catch (error) {
      logger.error('Error updating parent goal progress', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Invalidate goal cache for a user
   */
  private async invalidateGoalCache(userId: string): Promise<void> {
    try {
      await cacheClient.clearByPattern(`goals:${userId}:`);
    } catch (error) {
      logger.error('Error invalidating goal cache', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get a goal by ID with related tasks
   */
  async getGoalWithTasks(goalId: string, userId: string): Promise<{goal: Goal, tasks: Task[]}> {
    try {
      // Get goal
      const goal = await this.getGoalById(goalId, userId);
      
      // Get related tasks
      const tasks = await this.prisma.task.findMany({
        where: { 
          goalId,
          userId
        },
        orderBy: [
          { dueDate: 'asc' },
          { startDate: 'asc' }
        ],
        include: {
          timeEntries: {
            select: {
              id: true,
              startTime: true,
              endTime: true,
              duration: true,
              description: true
            },
            orderBy: {
              startTime: 'desc'
            }
          }
        }
      });
      
      return { goal, tasks };
    } catch (error) {
      logger.error('Error getting goal with tasks', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Add a task to a goal
   */
  async addTaskToGoal(goalId: string, userId: string, taskData: GoalTaskData): Promise<Task> {
    try {
      // Validate goal
      const goal = await this.prisma.goal.findUnique({
        where: { id: goalId }
      });

      if (!goal) {
        throw new NotFoundError('Goal not found');
      }

      // Check permission
      if (goal.userId !== userId) {
        throw new NotFoundError('Goal not found');
      }

      // Prepare metadata
      const metadata: any = {
        resourceLinks: taskData.resourceLinks || [],
        focusRequired: taskData.focusRequired || false
      };

      // Handle notes field
      if (taskData.notes) {
        metadata.notes = taskData.notes;
      }
      
      // Add doubts as a note if provided
      if (taskData.doubts) {
        if (!metadata.notes) {
          metadata.notes = [];
        }
        
        if (typeof metadata.notes === 'string') {
          // Convert string notes to array if doubts need to be added
          metadata.notes = [
            { content: metadata.notes, type: 'general' },
            { content: taskData.doubts, type: 'question', resolved: false, timestamp: new Date() }
          ];
        } else if (Array.isArray(metadata.notes)) {
          metadata.notes.push({
            content: taskData.doubts,
            type: 'question',
            resolved: false,
            timestamp: new Date()
          });
        }
      }

      // Create task
      const task = await this.prisma.task.create({
        data: {
          title: taskData.title,
          description: taskData.description || '',
          status: 'todo',
          priority: taskData.priority,
          userId,
          goalId,
          dueDate: taskData.dueDate || null,
          startDate: taskData.startDate || null,
          tags: taskData.tags || [],
          metadata: JSON.stringify(metadata)
        }
      });

      // Invalidate cache
      await cacheClient.delete(`goal:${goalId}`);
      await this.invalidateGoalCache(userId);

      return task;
    } catch (error) {
      logger.error('Error adding task to goal', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Create initial tasks for a goal based on date range
   * @private
   */
  private async createInitialTasksForGoal(goal: Goal): Promise<void> {
    try {
      if (!goal.startDate || !goal.endDate) {
        return;
      }

      // Calculate total days for the goal
      const totalDays = Math.ceil(
        (goal.endDate.getTime() - goal.startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Skip if less than 1 day
      if (totalDays < 1) {
        return;
      }

      // Create planning task for the first day
      await this.prisma.task.create({
        data: {
          title: `Plan strategy for: ${goal.title}`,
          description: `Create a detailed plan to achieve the goal: ${goal.title}`,
          status: 'todo',
          priority: 'high',
          userId: goal.userId,
          goalId: goal.id,
          dueDate: new Date(goal.startDate.getTime() + 24 * 60 * 60 * 1000), // Due 1 day after start
          tags: ['planning'],
          metadata: JSON.stringify({
            isAutomaticallyGenerated: true,
            taskType: 'planning'
          })
        }
      });

      // Create midpoint review task if goal is longer than 7 days
      if (totalDays > 7) {
        const midpointDate = new Date(
          goal.startDate.getTime() + (goal.endDate.getTime() - goal.startDate.getTime()) / 2
        );

        await this.prisma.task.create({
          data: {
            title: `Midpoint review for: ${goal.title}`,
            description: `Review progress and adjust strategy for goal: ${goal.title}`,
            status: 'todo',
            priority: 'medium',
            userId: goal.userId,
            goalId: goal.id,
            dueDate: midpointDate,
            tags: ['review'],
            metadata: JSON.stringify({
              isAutomaticallyGenerated: true,
              taskType: 'review'
            })
          }
        });
      }

      // Create final review task for the last day
      await this.prisma.task.create({
        data: {
          title: `Final review for: ${goal.title}`,
          description: `Complete final tasks and review achievement of goal: ${goal.title}`,
          status: 'todo',
          priority: 'high',
          userId: goal.userId,
          goalId: goal.id,
          dueDate: new Date(goal.endDate),
          tags: ['completion'],
          metadata: JSON.stringify({
            isAutomaticallyGenerated: true,
            taskType: 'completion'
          })
        }
      });

    } catch (error) {
      logger.error('Error creating initial tasks for goal', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Update tasks when goal dates change
   * @private
   */
  private async updateTasksForGoalDateChange(updatedGoal: Goal, originalGoal: Goal): Promise<void> {
    try {
      // Get automatically generated tasks for this goal
      const tasks = await this.prisma.task.findMany({
        where: {
          goalId: updatedGoal.id,
          metadata: {
            not: null
          }
        }
      });

      if (tasks.length === 0) {
        // If no auto-generated tasks exist, create new ones
        await this.createInitialTasksForGoal(updatedGoal);
        return;
      }

      // Filter tasks to only include automatically generated ones
      const autoGeneratedTasks = tasks.filter(task => {
        try {
          const metadata = JSON.parse(task.metadata as string || '{}');
          return metadata.isAutomaticallyGenerated === true;
        } catch {
          return false;
        }
      });

      if (autoGeneratedTasks.length === 0) {
        // If no auto-generated tasks exist, create new ones
        await this.createInitialTasksForGoal(updatedGoal);
        return;
      }

      // Calculate date shift
      let startShift = 0;
      let totalDurationChange = 0;

      if (originalGoal.startDate && updatedGoal.startDate) {
        startShift = updatedGoal.startDate.getTime() - originalGoal.startDate.getTime();
      }

      if (originalGoal.startDate && originalGoal.endDate && updatedGoal.startDate && updatedGoal.endDate) {
        const oldDuration = originalGoal.endDate.getTime() - originalGoal.startDate.getTime();
        const newDuration = updatedGoal.endDate.getTime() - updatedGoal.startDate.getTime();
        totalDurationChange = newDuration - oldDuration;
      }

      // Update each task
      for (const task of autoGeneratedTasks) {
        try {
          // Parse metadata
          const metadata = JSON.parse(task.metadata as string || '{}');
          const taskType = metadata.taskType;

          if (task.dueDate) {
            let newDueDate = new Date(task.dueDate);
            
            if (taskType === 'planning' && updatedGoal.startDate) {
              // Planning task is always 1 day after start
              newDueDate = new Date(updatedGoal.startDate.getTime() + 24 * 60 * 60 * 1000);
            } else if (taskType === 'completion' && updatedGoal.endDate) {
              // Completion task is always on the end date
              newDueDate = new Date(updatedGoal.endDate);
            } else if (taskType === 'review' && updatedGoal.startDate && updatedGoal.endDate) {
              // Review task is at the midpoint
              newDueDate = new Date(
                updatedGoal.startDate.getTime() + 
                (updatedGoal.endDate.getTime() - updatedGoal.startDate.getTime()) / 2
              );
            } else {
              // For other tasks, shift proportionally
              newDueDate = new Date(task.dueDate.getTime() + startShift);
            }

            // Update the task
            await this.prisma.task.update({
              where: { id: task.id },
              data: { dueDate: newDueDate }
            });
          }
        } catch (taskError) {
          logger.error('Error updating individual task date', 
            taskError instanceof Error ? taskError : new Error(String(taskError))
          );
          // Continue with other tasks even if one fails
        }
      }
    } catch (error) {
      logger.error('Error updating tasks for goal date change', 
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}

export default new GoalService(); 