import express, { Request, Response } from 'express';
import analyticsController from '../controllers/analyticsController';
import authMiddleware from '../middlewares/authMiddleware';

const router = express.Router();

// Apply authentication middleware to all analytics routes
router.use(authMiddleware.authenticate);

/**
 * @route   GET /api/v1/analytics/dashboard
 * @desc    Get integrated dashboard with data from multiple features
 * @access  Private
 */
router.get('/dashboard', (req: Request, res: Response) => 
  analyticsController.getIntegratedDashboard(req as any, res)
);

/**
 * @route   GET /api/v1/analytics/productivity
 * @desc    Get productivity summary for the current user
 * @access  Private
 */
router.get('/productivity', (req: Request, res: Response) => 
  analyticsController.getProductivitySummary(req as any, res)
);

/**
 * @route   GET /api/v1/analytics/trends
 * @desc    Get performance trends for the current user
 * @access  Private
 */
router.get('/trends', (req: Request, res: Response) => 
  analyticsController.getPerformanceTrends(req as any, res)
);

/**
 * @route   GET /api/v1/analytics/recommendations
 * @desc    Get productivity recommendations for the current user
 * @access  Private
 */
router.get('/recommendations', (req: Request, res: Response) => 
  analyticsController.getProductivityRecommendations(req as any, res)
);

/**
 * @route   GET /api/v1/analytics/notes
 * @desc    Get notes summary and analysis
 * @access  Private
 */
router.get('/notes', (req: Request, res: Response) => 
  analyticsController.getNotesSummary(req as any, res)
);

/**
 * @route   GET /api/v1/analytics/goal-task-insights
 * @desc    Get goal-task relationship insights
 * @access  Private
 */
router.get('/goal-task-insights', (req: Request, res: Response) => 
  analyticsController.getGoalTaskInsights(req as any, res)
);

/**
 * @route   GET /api/v1/analytics/finance-insights
 * @desc    Get detailed financial insights and analysis
 * @access  Private
 */
router.get('/finance-insights', (req: Request, res: Response) => 
  analyticsController.getFinanceInsights(req as any, res)
);

export default router; 