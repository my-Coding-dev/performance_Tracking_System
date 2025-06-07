import { PrismaClient } from '@prisma/client';
import db from '../utils/database';
import logger from '../utils/logger';
import cacheClient from '../utils/cache';

interface ProductivitySummary {
  taskCompletion: {
    completed: number;
    total: number;
    completionRate: number;
  };
  focusTime: {
    total: number; // In minutes
    average: number; // Average per day
    byDay: Record<string, number>;
  };
  goalProgress: {
    activeGoals: number;
    completedGoals: number;
    upcomingMilestones: Array<{
      id: string;
      title: string;
      goalId: string;
      goalTitle: string;
      dueDate: Date | null;
    }>;
  };
  timeTracking: {
    mostProductiveDay: string;
    mostProductiveHour: number;
    categoryBreakdown: Array<{
      category: string;
      timeSpent: number; // In minutes
      percentage: number;
    }>;
  };
}

interface PerformanceTrend {
  dates: string[];
  taskCompletionRates: number[];
  focusTimeMinutes: number[];
  goalCompletionRates: number[];
}

interface IntegratedDashboard {
  productivity: {
    taskCompletionRate: number;
    focusTimeToday: number;
    activeGoals: number;
    upcomingDeadlines: Array<{
      type: 'task' | 'milestone';
      id: string;
      title: string;
      dueDate: Date | null;
      parentTitle?: string;
    }>;
  };
  finances: {
    monthlyIncome: number;
    monthlyExpenses: number;
    netCashflow: number;
    topExpenseCategories: Array<{
      category: string;
      amount: number;
    }>;
    financeInsights: FinanceInsights;
  };
  performance: {
    productivityScore: number;
    productivityTrend: 'increasing' | 'decreasing' | 'stable';
    mostProductiveHour: number;
    recentFocusSessions: Array<{
      date: Date;
      duration: number;
      productivity: number | null;
    }>;
  };
  recentActivity: Array<{
    type: 'task' | 'goal' | 'transaction';
    id: string;
    title: string;
    date: Date;
    details: string;
  }>;
  notes: {
    unresolved: number;
    recent: Array<{
      taskId: string;
      taskTitle: string;
      content: string;
      type: string;
      timestamp: Date;
      resolved: boolean;
    }>;
    byType: Record<string, number>;
  };
  goalTaskInsights: {
    goalsWithoutTasks: number;
    taskDistribution: Array<{
      goalId: string;
      goalTitle: string;
      totalTasks: number;
      completedTasks: number;
    }>;
    completionMethods: {
      taskBased: number;
      milestoneBased: number;
      subgoalBased: number;
      manual: number;
    };
  };
}

// New interface for financial insights
interface FinanceInsights {
  monthlyTrend: {
    months: string[];
    income: number[];
    expenses: number[];
    savings: number[];
  };
  spendingPatterns: {
    weekdayAvg: number;
    weekendAvg: number;
    morningAvg: number;
    eveningAvg: number;
    highestSpendingDay: string;
  };
  savingsRate: number;
  recurringExpenses: Array<{
    category: string;
    average: number;
    frequency: string;
  }>;
  unusualTransactions: Array<{
    id: string;
    description: string;
    amount: number;
    date: Date;
    category: string;
  }>;
}

// New interface for note analysis
interface NoteItem {
  content: string;
  type?: string;
  timestamp?: Date;
  resolved?: boolean;
}

// New interface for goal-task analysis results
interface GoalTaskInsights {
  goalsWithoutTasks: number;
  taskDistribution: Array<{
    goalId: string;
    goalTitle: string;
    totalTasks: number;
    completedTasks: number;
  }>;
  completionMethods: {
    taskBased: number;
    milestoneBased: number;
    subgoalBased: number;
    manual: number;
  };
}

// New interface for notes summary
interface NotesSummary {
  unresolved: number;
  recent: Array<{
    taskId: string;
    taskTitle: string;
    content: string;
    type: string;
    timestamp: Date;
    resolved: boolean;
  }>;
  byType: Record<string, number>;
}

class AnalyticsService {
  private prisma: PrismaClient;
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor() {
    this.prisma = db.getPrisma();
  }

  /**
   * Get productivity summary for a user
   */
  async getProductivitySummary(userId: string, period: 'day' | 'week' | 'month' = 'week'): Promise<ProductivitySummary> {
    try {
      // Calculate date range
      const now = new Date();
      let startDate: Date;
      
      if (period === 'day') {
        startDate = new Date(now.setHours(0, 0, 0, 0));
      } else if (period === 'week') {
        // Start from the beginning of the week (Sunday)
        const day = now.getDay();
        startDate = new Date(now);
        startDate.setDate(now.getDate() - day);
        startDate.setHours(0, 0, 0, 0);
      } else { // month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      
      const endDate = new Date();

      // Cache key based on user and period
      const cacheKey = `productivity:${userId}:${period}:${startDate.toISOString()}`;
      const cachedSummary = await cacheClient.get<ProductivitySummary>(cacheKey);
      
      if (cachedSummary) {
        return cachedSummary;
      }

      // Get data from database in parallel
      const [
        tasks,
        timeEntries,
        goals,
        milestones
      ] = await Promise.all([
        // Tasks created or due in the period
        this.prisma.task.findMany({
          where: {
            userId,
            OR: [
              { createdAt: { gte: startDate } },
              { dueDate: { gte: startDate, lte: endDate } }
            ]
          }
        }),
        
        // Time entries in the period
        this.prisma.timeEntry.findMany({
          where: {
            userId,
            startTime: { gte: startDate, lte: endDate }
          },
          include: {
            task: true
          }
        }),
        
        // Active goals
        this.prisma.goal.findMany({
          where: {
            userId,
            status: 'active'
          }
        }),
        
        // Upcoming milestones
        this.prisma.milestone.findMany({
          where: {
            goal: {
              userId
            },
            isCompleted: false,
            dueDate: { gte: new Date() }
          },
          include: {
            goal: {
              select: {
                id: true,
                title: true
              }
            }
          },
          orderBy: {
            dueDate: 'asc'
          },
          take: 5
        })
      ]);

      // Calculate task completion metrics
      const completedTasks = tasks.filter(task => task.status === 'completed').length;
      const totalTasks = tasks.length;
      const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      // Calculate focus time metrics
      const totalFocusMinutes = timeEntries.reduce((total, entry) => {
        // Calculate duration in minutes
        let duration = 0;
        if (entry.duration) {
          duration = Math.floor(entry.duration / 60); // Convert seconds to minutes
        } else if (entry.endTime) {
          duration = Math.floor((entry.endTime.getTime() - entry.startTime.getTime()) / 60000);
        }
        return total + duration;
      }, 0);

      // Focus time by day
      const focusByDay: Record<string, number> = {};
      timeEntries.forEach(entry => {
        const day = entry.startTime.toISOString().split('T')[0];
        
        let duration = 0;
        if (entry.duration) {
          duration = Math.floor(entry.duration / 60); // Convert seconds to minutes
        } else if (entry.endTime) {
          duration = Math.floor((entry.endTime.getTime() - entry.startTime.getTime()) / 60000);
        }
        
        focusByDay[day] = (focusByDay[day] || 0) + duration;
      });

      // Calculate days in the period
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysInPeriod = Math.max(1, daysDiff); // Avoid division by zero
      
      // Calculate average focus time per day
      const averageFocusMinutes = totalFocusMinutes / daysInPeriod;

      // Determine most productive day and hour
      let mostProductiveDay = 'N/A';
      let maxDayMinutes = 0;
      
      Object.entries(focusByDay).forEach(([day, minutes]) => {
        if (minutes > maxDayMinutes) {
          mostProductiveDay = day;
          maxDayMinutes = minutes;
        }
      });

      // Calculate focus time by hour of day
      const focusByHour: Record<number, number> = {};
      timeEntries.forEach(entry => {
        const hour = entry.startTime.getHours();
        
        let duration = 0;
        if (entry.duration) {
          duration = Math.floor(entry.duration / 60); // Convert seconds to minutes
        } else if (entry.endTime) {
          duration = Math.floor((entry.endTime.getTime() - entry.startTime.getTime()) / 60000);
        }
        
        focusByHour[hour] = (focusByHour[hour] || 0) + duration;
      });

      // Determine most productive hour
      let mostProductiveHour = 0;
      let maxHourMinutes = 0;
      
      Object.entries(focusByHour).forEach(([hour, minutes]) => {
        if (minutes > maxHourMinutes) {
          mostProductiveHour = parseInt(hour, 10);
          maxHourMinutes = minutes;
        }
      });

      // Calculate focus time by task category or tags
      const focusByCategory: Record<string, number> = {};
      timeEntries.forEach(entry => {
        // Use tags as categories if available, otherwise use 'Uncategorized'
        const category = entry.task?.tags?.length ? entry.task.tags[0] : 'Uncategorized';
        
        let duration = 0;
        if (entry.duration) {
          duration = Math.floor(entry.duration / 60); // Convert seconds to minutes
        } else if (entry.endTime) {
          duration = Math.floor((entry.endTime.getTime() - entry.startTime.getTime()) / 60000);
        }
        
        focusByCategory[category] = (focusByCategory[category] || 0) + duration;
      });

      // Format category breakdown
      const categoryBreakdown = Object.entries(focusByCategory)
        .map(([category, timeSpent]) => ({
          category,
          timeSpent,
          percentage: totalFocusMinutes > 0 ? (timeSpent / totalFocusMinutes) * 100 : 0
        }))
        .sort((a, b) => b.timeSpent - a.timeSpent);

      // Format upcoming milestones
      const upcomingMilestones = milestones.map(milestone => ({
        id: milestone.id,
        title: milestone.title,
        goalId: milestone.goal.id,
        goalTitle: milestone.goal.title,
        dueDate: milestone.dueDate
      }));

      // Build the summary
      const summary: ProductivitySummary = {
        taskCompletion: {
          completed: completedTasks,
          total: totalTasks,
          completionRate
        },
        focusTime: {
          total: totalFocusMinutes,
          average: averageFocusMinutes,
          byDay: focusByDay
        },
        goalProgress: {
          activeGoals: goals.length,
          completedGoals: goals.filter(goal => goal.status === 'completed').length,
          upcomingMilestones
        },
        timeTracking: {
          mostProductiveDay,
          mostProductiveHour,
          categoryBreakdown
        }
      };

      // Cache the result
      await cacheClient.set(cacheKey, summary, this.CACHE_TTL);

      return summary;
    } catch (error) {
      logger.error('Error getting productivity summary', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get performance trends over time
   */
  async getPerformanceTrends(userId: string, days: number = 30): Promise<PerformanceTrend> {
    try {
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      // Cache key based on user and period
      const cacheKey = `trends:${userId}:${days}:${startDate.toISOString()}`;
      const cachedTrends = await cacheClient.get<PerformanceTrend>(cacheKey);
      
      if (cachedTrends) {
        return cachedTrends;
      }

      // Generate dates array
      const dates: string[] = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        dates.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Initialize data arrays
      const taskCompletionRates: number[] = [];
      const focusTimeMinutes: number[] = [];
      const goalCompletionRates: number[] = [];

      // Calculate metrics for each day
      for (const date of dates) {
        const dayStart = new Date(`${date}T00:00:00.000Z`);
        const dayEnd = new Date(`${date}T23:59:59.999Z`);
        
        // Tasks for the day
        const tasks = await this.prisma.task.findMany({
          where: {
            userId,
            OR: [
              { 
                dueDate: { 
                  gte: dayStart,
                  lte: dayEnd 
                } 
              },
              {
                completedAt: {
                  gte: dayStart,
                  lte: dayEnd
                }
              }
            ]
          }
        });
        
        // Calculate task completion rate
        const completedTasks = tasks.filter(task => task.status === 'completed').length;
        const totalTasks = tasks.length;
        const dailyCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        taskCompletionRates.push(dailyCompletionRate);
        
        // Calculate focus time
        const timeEntries = await this.prisma.timeEntry.findMany({
          where: {
            userId,
            startTime: { 
              gte: dayStart,
              lte: dayEnd 
            }
          }
        });
        
        const dailyFocusMinutes = timeEntries.reduce((total, entry) => {
          let duration = 0;
          if (entry.duration) {
            duration = Math.floor(entry.duration / 60); // Convert seconds to minutes
          } else if (entry.endTime) {
            duration = Math.floor((entry.endTime.getTime() - entry.startTime.getTime()) / 60000);
          }
          return total + duration;
        }, 0);
        
        focusTimeMinutes.push(dailyFocusMinutes);
        
        // Goals progress
        const goals = await this.prisma.goal.findMany({
          where: {
            userId,
            OR: [
              { startDate: { lte: dayEnd } },
              { endDate: { gte: dayStart } }
            ]
          }
        });
        
        const completedGoals = goals.filter(goal => goal.status === 'completed').length;
        const totalGoals = goals.length;
        const dailyGoalCompletionRate = totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0;
        goalCompletionRates.push(dailyGoalCompletionRate);
      }

      // Build the trends object
      const trends: PerformanceTrend = {
        dates,
        taskCompletionRates,
        focusTimeMinutes,
        goalCompletionRates
      };

      // Cache the result
      await cacheClient.set(cacheKey, trends, this.CACHE_TTL);

      return trends;
    } catch (error) {
      logger.error('Error getting performance trends', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get recommendations for improving productivity
   */
  async getProductivityRecommendations(userId: string): Promise<string[]> {
    try {
      // Get recent productivity data
      const summary = await this.getProductivitySummary(userId, 'week');
      
      const recommendations: string[] = [];

      // Task completion recommendations
      if (summary.taskCompletion.completionRate < 50) {
        recommendations.push('Consider breaking down tasks into smaller, more manageable items to improve completion rate.');
      }

      // Focus time recommendations
      if (summary.focusTime.average < 120) { // Less than 2 hours per day
        recommendations.push('Try scheduling dedicated focus blocks of 25-50 minutes with short breaks in between.');
      }

      // Most productive time recommendations
      recommendations.push(`Schedule your most important work at ${summary.timeTracking.mostProductiveHour}:00, when you're historically most productive.`);

      // Goal recommendations
      if (summary.goalProgress.upcomingMilestones.length > 0) {
        const nextMilestone = summary.goalProgress.upcomingMilestones[0];
        recommendations.push(`Focus on your upcoming milestone: "${nextMilestone.title}" for the goal "${nextMilestone.goalTitle}".`);
      }

      // General recommendations
      recommendations.push('Track your time consistently to get more accurate productivity insights.');
      recommendations.push('Use the Pomodoro technique (25 min work, 5 min break) for better focus and productivity.');

      return recommendations;
    } catch (error) {
      logger.error('Error getting productivity recommendations', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get integrated dashboard with data from multiple features
   */
  async getIntegratedDashboard(userId: string): Promise<IntegratedDashboard> {
    try {
      // Cache key
      const cacheKey = `dashboard:${userId}`;
      const cachedDashboard = await cacheClient.get<IntegratedDashboard>(cacheKey);
      
      if (cachedDashboard) {
        return cachedDashboard;
      }

      // Get current date information
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const nextWeek = new Date(now);
      nextWeek.setDate(now.getDate() + 7);

      // Fetch data from various services in parallel
      const [
        // Tasks
        tasks,
        todayTimeEntries,
        
        // Goals and milestones
        activeGoals,
        upcomingMilestones,
        
        // Finance
        transactions,
        
        // Focus sessions
        recentFocusSessions,
        
        // Recent activity
        recentTasks,
        recentGoals,
        recentTransactions,
        
        // Get the new data elements
        notesSummary,
        goalTaskInsights,
        financeInsights
      ] = await Promise.all([
        // Tasks - upcoming and in progress
        this.prisma.task.findMany({
          where: {
            userId,
            status: { not: 'completed' },
            dueDate: { 
              not: null,
              lte: nextWeek
            }
          },
          orderBy: {
            dueDate: 'asc'
          },
          take: 5
        }),
        
        // Today's time entries
        this.prisma.timeEntry.findMany({
          where: {
            userId,
            startTime: { gte: today }
          }
        }),
        
        // Active goals
        this.prisma.goal.findMany({
          where: {
            userId,
            status: 'active'
          }
        }),
        
        // Upcoming milestones
        this.prisma.milestone.findMany({
          where: {
            goal: {
              userId,
              status: 'active'
            },
            isCompleted: false,
            dueDate: { lte: nextWeek }
          },
          include: {
            goal: {
              select: {
                title: true
              }
            }
          },
          orderBy: {
            dueDate: 'asc'
          },
          take: 3
        }),
        
        // This month's transactions
        this.prisma.transaction.findMany({
          where: {
            userId,
            date: {
              gte: monthStart,
              lte: monthEnd
            }
          }
        }),
        
        // Recent focus sessions
        this.prisma.focusSession.findMany({
          where: {
            userId
          },
          orderBy: {
            startTime: 'desc'
          },
          take: 5
        }),
        
        // Recent tasks
        this.prisma.task.findMany({
          where: {
            userId
          },
          orderBy: {
            updatedAt: 'desc'
          },
          take: 3
        }),
        
        // Recent goals
        this.prisma.goal.findMany({
          where: {
            userId
          },
          orderBy: {
            updatedAt: 'desc'
          },
          take: 3
        }),
        
        // Recent transactions
        this.prisma.transaction.findMany({
          where: {
            userId
          },
          orderBy: {
            date: 'desc'
          },
          take: 3
        }),
        
        // Get notes summary
        this.getNotesSummary(userId),
        
        // Get goal-task insights
        this.getGoalTaskInsights(userId),
        
        // Get finance insights
        this.getFinanceInsights(userId)
      ]);

      // Process task data
      const totalTasks = await this.prisma.task.count({ 
        where: { 
          userId,
          createdAt: { gte: monthStart }
        } 
      });
      
      const completedTasks = await this.prisma.task.count({
        where: {
          userId,
          status: 'completed',
          completedAt: { gte: monthStart }
        }
      });
      
      const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
      
      // Calculate today's focus time
      const focusTimeToday = todayTimeEntries.reduce((total, entry) => {
        let duration = 0;
        if (entry.duration) {
          duration = Math.floor(entry.duration / 60); // Convert seconds to minutes
        } else if (entry.endTime) {
          duration = Math.floor((entry.endTime.getTime() - entry.startTime.getTime()) / 60000);
        }
        return total + duration;
      }, 0);

      // Process finance data
      const income = transactions
        .filter(t => t.type === 'INCOME')
        .reduce((sum, t) => sum + t.amount, 0);
        
      const expenses = transactions
        .filter(t => t.type === 'EXPENSE')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const netCashflow = income - expenses;
      
      // Calculate top expense categories
      const expensesByCategory: Record<string, number> = {};
      transactions.forEach(transaction => {
        if (transaction.type === 'EXPENSE' && transaction.category) {
          expensesByCategory[transaction.category] = (expensesByCategory[transaction.category] || 0) + transaction.amount;
        }
      });
      
      const topExpenseCategories = Object.entries(expensesByCategory)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);
      
      // Process performance data
      // Calculate productivity score (weighted average of task completion, focus time, and goal progress)
      const focusHoursToday = focusTimeToday / 60;
      const focusScore = Math.min(100, (focusHoursToday / 8) * 100); // Target: 8 hours
      
      const goalProgress = activeGoals.reduce((sum, goal) => sum + (goal.currentValue / (goal.targetValue || 100)), 0);
      const goalScore = activeGoals.length > 0 ? (goalProgress / activeGoals.length) * 100 : 100;
      
      const productivityScore = Math.round((taskCompletionRate * 0.4) + (focusScore * 0.4) + (goalScore * 0.2));
      
      // Determine productivity trend
      const lastWeekStart = new Date(now);
      lastWeekStart.setDate(now.getDate() - 7);
      
      const lastWeekEntries = await this.prisma.timeEntry.findMany({
        where: {
          userId,
          startTime: {
            gte: lastWeekStart,
            lt: today
          }
        }
      });
      
      const lastWeekFocusTime = lastWeekEntries.reduce((total, entry) => {
        let duration = 0;
        if (entry.duration) {
          duration = Math.floor(entry.duration / 60); // Convert seconds to minutes
        } else if (entry.endTime) {
          duration = Math.floor((entry.endTime.getTime() - entry.startTime.getTime()) / 60000);
        }
        return total + duration;
      }, 0);
      
      const lastWeekDailyAverage = lastWeekFocusTime / 7; // Average daily focus time last week
      const todayVsAverage = focusTimeToday - lastWeekDailyAverage;
      
      let productivityTrend: 'increasing' | 'decreasing' | 'stable';
      if (todayVsAverage > 30) { // More than 30 minutes improvement
        productivityTrend = 'increasing';
      } else if (todayVsAverage < -30) { // More than 30 minutes decline
        productivityTrend = 'decreasing';
      } else {
        productivityTrend = 'stable';
      }
      
      // Determine most productive hour
      const focusByHour: Record<number, number> = {};
      
      lastWeekEntries.concat(todayTimeEntries).forEach(entry => {
        const hour = entry.startTime.getHours();
        
        let duration = 0;
        if (entry.duration) {
          duration = Math.floor(entry.duration / 60); // Convert seconds to minutes
        } else if (entry.endTime) {
          duration = Math.floor((entry.endTime.getTime() - entry.startTime.getTime()) / 60000);
        }
        
        focusByHour[hour] = (focusByHour[hour] || 0) + duration;
      });
      
      let mostProductiveHour = 9; // Default to 9 AM
      let maxHourMinutes = 0;
      
      Object.entries(focusByHour).forEach(([hourStr, minutes]) => {
        const hour = parseInt(hourStr, 10);
        if (minutes > maxHourMinutes) {
          mostProductiveHour = hour;
          maxHourMinutes = minutes;
        }
      });
      
      // Format focus sessions
      const formattedFocusSessions = recentFocusSessions.map(session => ({
        date: session.startTime,
        duration: session.duration ? session.duration / 60 : 0, // Convert to minutes with null check
        productivity: session.productivity
      }));
      
      // Build upcoming deadlines
      const upcomingDeadlines = [
        ...tasks.map(task => ({
          type: 'task' as const,
          id: task.id,
          title: task.title,
          dueDate: task.dueDate
        })),
        ...upcomingMilestones.map(milestone => ({
          type: 'milestone' as const,
          id: milestone.id,
          title: milestone.title,
          dueDate: milestone.dueDate,
          parentTitle: milestone.goal.title
        }))
      ].sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.getTime() - b.dueDate.getTime();
      });
      
      // Build recent activity
      const recentActivity = [
        ...recentTasks.map(task => ({
          type: 'task' as const,
          id: task.id,
          title: task.title,
          date: task.updatedAt,
          details: `Status: ${task.status}`
        })),
        ...recentGoals.map(goal => ({
          type: 'goal' as const,
          id: goal.id,
          title: goal.title,
          date: goal.updatedAt,
          details: `Progress: ${Math.round(goal.currentValue)}%`
        })),
        ...recentTransactions.map(transaction => ({
          type: 'transaction' as const,
          id: transaction.id,
          title: transaction.description || 'Transaction',
          date: transaction.date,
          details: `${transaction.type}: $${transaction.amount.toFixed(2)}`
        }))
      ].sort((a, b) => b.date.getTime() - a.date.getTime());

      // Build dashboard object
      const dashboard: IntegratedDashboard = {
        productivity: {
          taskCompletionRate,
          focusTimeToday,
          activeGoals: activeGoals.length,
          upcomingDeadlines
        },
        finances: {
          monthlyIncome: income,
          monthlyExpenses: expenses,
          netCashflow,
          topExpenseCategories,
          financeInsights
        },
        performance: {
          productivityScore,
          productivityTrend,
          mostProductiveHour,
          recentFocusSessions: formattedFocusSessions
        },
        recentActivity,
        notes: notesSummary,
        goalTaskInsights
      };

      // Cache the result
      await cacheClient.set(cacheKey, dashboard, this.CACHE_TTL);

      return dashboard;
    } catch (error) {
      logger.error('Error getting integrated dashboard', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Analyze notes data from tasks
   */
  async getNotesSummary(userId: string): Promise<NotesSummary> {
    try {
      // Cache key
      const cacheKey = `notes-summary:${userId}`;
      const cachedSummary = await cacheClient.get<NotesSummary>(cacheKey);
      
      if (cachedSummary) {
        return cachedSummary;
      }

      // Get all tasks with metadata
      const tasks = await this.prisma.task.findMany({
        where: { userId },
        select: {
          id: true,
          title: true,
          metadata: true
        }
      });

      // Extract notes from metadata
      const notesByType: Record<string, number> = {};
      let unresolvedCount = 0;
      const recentNotes: Array<{
        taskId: string;
        taskTitle: string;
        content: string;
        type: string;
        timestamp: Date;
        resolved: boolean;
      }> = [];

      // Process each task's notes
      tasks.forEach(task => {
        if (!task.metadata) return;
        
        try {
          const metadata = JSON.parse(String(task.metadata));
          if (!metadata.notes) return;
          
          // Handle notes as string or array
          if (typeof metadata.notes === 'string') {
            // Count as general note
            notesByType['general'] = (notesByType['general'] || 0) + 1;
            
            // Add to recent notes if it's not empty
            if (metadata.notes.trim()) {
              recentNotes.push({
                taskId: task.id,
                taskTitle: task.title,
                content: metadata.notes,
                type: 'general',
                timestamp: new Date(), // Default to now since string notes don't have timestamps
                resolved: true // Default to resolved for simple string notes
              });
            }
          } else if (Array.isArray(metadata.notes)) {
            // Process structured notes
            metadata.notes.forEach((note: NoteItem) => {
              // Count by type
              const type = note.type || 'general';
              notesByType[type] = (notesByType[type] || 0) + 1;
              
              // Count unresolved notes
              if (note.resolved === false) {
                unresolvedCount++;
              }
              
              // Add to recent notes
              recentNotes.push({
                taskId: task.id,
                taskTitle: task.title,
                content: note.content,
                type: note.type || 'general',
                timestamp: note.timestamp ? new Date(note.timestamp) : new Date(),
                resolved: note.resolved !== false // Default to true if not explicitly false
              });
            });
          }
        } catch (error) {
          // Skip this task if metadata parsing fails
          logger.error(`Error parsing task metadata for task ${task.id}`, error instanceof Error ? error : new Error(String(error)));
        }
      });

      // Sort recent notes by timestamp (newest first) and limit to 10
      const sortedRecentNotes = recentNotes
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 10);

      const summary: NotesSummary = {
        unresolved: unresolvedCount,
        recent: sortedRecentNotes,
        byType: notesByType
      };

      // Cache the result
      await cacheClient.set(cacheKey, summary, this.CACHE_TTL);

      return summary;
    } catch (error) {
      logger.error('Error getting notes summary', error instanceof Error ? error : new Error(String(error)));
      // Return empty summary on error
      return {
        unresolved: 0,
        recent: [],
        byType: {}
      };
    }
  }

  /**
   * Analyze goal-task relationships and insights
   */
  async getGoalTaskInsights(userId: string): Promise<GoalTaskInsights> {
    try {
      // Cache key
      const cacheKey = `goal-task-insights:${userId}`;
      const cachedInsights = await cacheClient.get<GoalTaskInsights>(cacheKey);
      
      if (cachedInsights) {
        return cachedInsights;
      }

      // Get all goals with tasks
      const goals = await this.prisma.goal.findMany({
        where: { userId },
        select: {
          id: true,
          title: true,
          metadata: true,
          milestones: {
            select: { id: true }
          },
          subgoals: {
            select: { id: true }
          },
          tasks: {
            select: {
              id: true,
              status: true
            }
          }
        }
      });

      // Count goals without tasks
      const goalsWithoutTasks = goals.filter(goal => goal.tasks.length === 0).length;

      // Calculate task distribution
      const taskDistribution = goals.map(goal => {
        const totalTasks = goal.tasks.length;
        const completedTasks = goal.tasks.filter(task => task.status === 'completed').length;
        
        return {
          goalId: goal.id,
          goalTitle: goal.title,
          totalTasks,
          completedTasks
        };
      });

      // Analyze completion methods
      const completionMethods = {
        taskBased: 0,
        milestoneBased: 0,
        subgoalBased: 0,
        manual: 0
      };

      goals.forEach(goal => {
        // Try to determine completion method from metadata
        let completionMethod = 'manual'; // Default
        
        if (goal.metadata) {
          try {
            const metadata = JSON.parse(String(goal.metadata));
            if (metadata.completionMethod) {
              completionMethod = metadata.completionMethod;
            }
          } catch (error) {
            // Skip metadata parsing if it fails
          }
        }
        
        // If no explicit method, infer based on structure
        if (completionMethod === 'manual') {
          if (goal.tasks.length > 0) {
            completionMethod = 'taskBased';
          } else if (goal.milestones.length > 0) {
            completionMethod = 'milestoneBased';
          } else if (goal.subgoals.length > 0) {
            completionMethod = 'subgoalBased';
          }
        }
        
        // Increment the appropriate counter
        completionMethods[completionMethod as keyof typeof completionMethods]++;
      });

      const insights: GoalTaskInsights = {
        goalsWithoutTasks,
        taskDistribution: taskDistribution.sort((a, b) => b.totalTasks - a.totalTasks).slice(0, 5), // Top 5 by task count
        completionMethods
      };

      // Cache the result
      await cacheClient.set(cacheKey, insights, this.CACHE_TTL);

      return insights;
    } catch (error) {
      logger.error('Error getting goal-task insights', error instanceof Error ? error : new Error(String(error)));
      // Return empty insights on error
      return {
        goalsWithoutTasks: 0,
        taskDistribution: [],
        completionMethods: {
          taskBased: 0,
          milestoneBased: 0,
          subgoalBased: 0,
          manual: 0
        }
      };
    }
  }

  /**
   * Analyze financial data to generate insights
   */
  async getFinanceInsights(userId: string): Promise<FinanceInsights> {
    try {
      // Cache key
      const cacheKey = `finance-insights:${userId}`;
      const cachedInsights = await cacheClient.get<FinanceInsights>(cacheKey);
      
      if (cachedInsights) {
        return cachedInsights;
      }

      // Get current date information
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Get data for the last 6 months
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      
      // Get transactions for the last 6 months
      const transactions = await this.prisma.transaction.findMany({
        where: {
          userId,
          date: { gte: sixMonthsAgo }
        },
        orderBy: {
          date: 'asc'
        }
      });

      // Generate monthly trend data
      const monthlyData: Record<string, { income: number; expenses: number; savings: number }> = {};
      
      // Initialize for all 6 months, even if no transactions
      for (let i = 0; i < 6; i++) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[monthKey] = { income: 0, expenses: 0, savings: 0 };
      }
      
      // Populate with actual data
      transactions.forEach(transaction => {
        const date = new Date(transaction.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { income: 0, expenses: 0, savings: 0 };
        }
        
        if (transaction.type === 'INCOME') {
          monthlyData[monthKey].income += transaction.amount;
        } else if (transaction.type === 'EXPENSE') {
          monthlyData[monthKey].expenses += transaction.amount;
        }
        
        // Calculate savings
        monthlyData[monthKey].savings = monthlyData[monthKey].income - monthlyData[monthKey].expenses;
      });
      
      // Sort months and format trend data
      const sortedMonths = Object.keys(monthlyData).sort();
      const monthlyTrend = {
        months: sortedMonths.map(m => {
          const [year, month] = m.split('-');
          return `${month}/${year.slice(2)}`;
        }),
        income: sortedMonths.map(m => monthlyData[m].income),
        expenses: sortedMonths.map(m => monthlyData[m].expenses),
        savings: sortedMonths.map(m => monthlyData[m].savings)
      };

      // Calculate spending patterns
      let weekdayTotal = 0;
      let weekdayCount = 0;
      let weekendTotal = 0;
      let weekendCount = 0;
      let morningTotal = 0;
      let morningCount = 0;
      let eveningTotal = 0;
      let eveningCount = 0;
      
      // Track spending by day of week
      const daySpending: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      const dayCount: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      
      transactions.forEach(transaction => {
        if (transaction.type !== 'EXPENSE') return;
        
        const date = new Date(transaction.date);
        const day = date.getDay(); // 0 = Sunday, 6 = Saturday
        const hour = date.getHours();
        
        // Weekend vs Weekday
        if (day === 0 || day === 6) {
          weekendTotal += transaction.amount;
          weekendCount++;
        } else {
          weekdayTotal += transaction.amount;
          weekdayCount++;
        }
        
        // Morning vs Evening
        if (hour >= 5 && hour < 12) {
          morningTotal += transaction.amount;
          morningCount++;
        } else if (hour >= 17 && hour < 23) {
          eveningTotal += transaction.amount;
          eveningCount++;
        }
        
        // By day of week
        daySpending[day] += transaction.amount;
        dayCount[day]++;
      });
      
      // Calculate averages
      const weekdayAvg = weekdayCount > 0 ? weekdayTotal / weekdayCount : 0;
      const weekendAvg = weekendCount > 0 ? weekendTotal / weekendCount : 0;
      const morningAvg = morningCount > 0 ? morningTotal / morningCount : 0;
      const eveningAvg = eveningCount > 0 ? eveningTotal / eveningCount : 0;
      
      // Find highest spending day
      let highestSpendingDayNum = 0;
      let highestAvg = 0;
      
      for (let i = 0; i < 7; i++) {
        const avg = dayCount[i] > 0 ? daySpending[i] / dayCount[i] : 0;
        if (avg > highestAvg) {
          highestAvg = avg;
          highestSpendingDayNum = i;
        }
      }
      
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const highestSpendingDay = days[highestSpendingDayNum];

      // Calculate savings rate (last 3 months)
      let totalIncome = 0;
      let totalSavings = 0;
      
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const recentTransactions = transactions.filter(t => new Date(t.date) >= threeMonthsAgo);
      
      recentTransactions.forEach(transaction => {
        if (transaction.type === 'INCOME') {
          totalIncome += transaction.amount;
        } else if (transaction.type === 'EXPENSE') {
          totalSavings -= transaction.amount;
        }
      });
      
      totalSavings += totalIncome;
      const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;

      // Identify recurring expenses
      const expenseByCategory: Record<string, number[]> = {};
      
      // Group expenses by category and month
      recentTransactions.forEach(transaction => {
        if (transaction.type !== 'EXPENSE' || !transaction.category) return;
        
        const date = new Date(transaction.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const key = `${transaction.category}:${monthKey}`;
        
        if (!expenseByCategory[key]) {
          expenseByCategory[key] = [];
        }
        
        expenseByCategory[key].push(transaction.amount);
      });
      
      // Identify categories with similar monthly spending
      const recurringCandidates: Record<string, number[]> = {};
      
      Object.entries(expenseByCategory).forEach(([key, amounts]) => {
        const [category, _] = key.split(':');
        
        if (!recurringCandidates[category]) {
          recurringCandidates[category] = [];
        }
        
        // Sum amounts for the month
        const monthlyTotal = amounts.reduce((sum, amount) => sum + amount, 0);
        recurringCandidates[category].push(monthlyTotal);
      });
      
      // Filter to only categories with consistent spending
      const recurringExpenses = Object.entries(recurringCandidates)
        .filter(([_, amounts]) => amounts.length >= 2) // At least 2 months of data
        .map(([category, amounts]) => {
          const average = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
          
          // Determine frequency
          let frequency = 'monthly';
          
          // Check standard deviation to see if it's consistent
          const mean = average;
          const variance = amounts.reduce((sum, amount) => sum + Math.pow(amount - mean, 2), 0) / amounts.length;
          const stdDev = Math.sqrt(variance);
          
          // If std deviation is high, it might be irregular
          if (stdDev > mean * 0.3) {
            frequency = 'irregular';
          }
          
          return {
            category,
            average,
            frequency
          };
        })
        .sort((a, b) => b.average - a.average)
        .slice(0, 5); // Top 5 recurring expenses

      // Find unusual transactions (outliers)
      const unusualTransactions: Array<{
        id: string;
        description: string;
        amount: number;
        date: Date;
        category: string;
      }> = [];
      
      // Calculate average and std dev for each category
      const categoryStats: Record<string, { mean: number; stdDev: number }> = {};
      
      // Group by category first
      const expensesByCategory: Record<string, number[]> = {};
      
      recentTransactions.forEach(transaction => {
        if (transaction.type !== 'EXPENSE') return;
        
        const category = transaction.category || 'Uncategorized';
        
        if (!expensesByCategory[category]) {
          expensesByCategory[category] = [];
        }
        
        expensesByCategory[category].push(transaction.amount);
      });
      
      // Calculate stats for each category
      Object.entries(expensesByCategory).forEach(([category, amounts]) => {
        const mean = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
        
        const variance = amounts.reduce((sum, amount) => sum + Math.pow(amount - mean, 2), 0) / amounts.length;
        const stdDev = Math.sqrt(variance);
        
        categoryStats[category] = { mean, stdDev };
      });
      
      // Find outliers
      recentTransactions.forEach(transaction => {
        if (transaction.type !== 'EXPENSE') return;
        
        const category = transaction.category || 'Uncategorized';
        
        if (!categoryStats[category]) return;
        
        const { mean, stdDev } = categoryStats[category];
        
        // If amount is more than 2 standard deviations away from mean, flag as unusual
        if (transaction.amount > mean + 2 * stdDev) {
          unusualTransactions.push({
            id: transaction.id,
            description: transaction.description || 'Unknown',
            amount: transaction.amount,
            date: transaction.date,
            category
          });
        }
      });
      
      // Only keep top 5 most unusual
      const topUnusualTransactions = unusualTransactions
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      // Compile insights
      const insights: FinanceInsights = {
        monthlyTrend,
        spendingPatterns: {
          weekdayAvg,
          weekendAvg,
          morningAvg,
          eveningAvg,
          highestSpendingDay
        },
        savingsRate,
        recurringExpenses,
        unusualTransactions: topUnusualTransactions
      };

      // Cache the result
      await cacheClient.set(cacheKey, insights, this.CACHE_TTL);

      return insights;
    } catch (error) {
      logger.error('Error getting finance insights', error instanceof Error ? error : new Error(String(error)));
      // Return basic insights on error
      return {
        monthlyTrend: {
          months: [],
          income: [],
          expenses: [],
          savings: []
        },
        spendingPatterns: {
          weekdayAvg: 0,
          weekendAvg: 0,
          morningAvg: 0,
          eveningAvg: 0,
          highestSpendingDay: 'N/A'
        },
        savingsRate: 0,
        recurringExpenses: [],
        unusualTransactions: []
      };
    }
  }
}

export default new AnalyticsService(); 