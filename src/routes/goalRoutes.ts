import express, { Request, Response } from 'express';
import goalController from '../controllers/goalController';
import authMiddleware from '../middlewares/authMiddleware';

const router = express.Router();

// Apply authentication middleware to all goal routes
router.use(authMiddleware.authenticate);

/**
 * @route   POST /api/v1/goals
 * @desc    Create a new goal
 * @access  Private
 */
router.post('/', (req: Request, res: Response) => 
  goalController.createGoal(req as any, res)
);

/**
 * @route   GET /api/v1/goals
 * @desc    Get all goals for the current user with filtering and pagination
 * @access  Private
 */
router.get('/', (req: Request, res: Response) => 
  goalController.getGoals(req as any, res)
);

/**
 * @route   GET /api/v1/goals/:id
 * @desc    Get a goal by ID
 * @access  Private
 */
router.get('/:id', (req: Request, res: Response) => 
  goalController.getGoal(req as any, res)
);

/**
 * @route   GET /api/v1/goals/:id/progress
 * @desc    Get progress for a goal
 * @access  Private
 */
router.get('/:id/progress', (req: Request, res: Response) => 
  goalController.getGoalProgress(req as any, res)
);

/**
 * @route   PUT /api/v1/goals/:id
 * @desc    Update a goal
 * @access  Private
 */
router.put('/:id', (req: Request, res: Response) => 
  goalController.updateGoal(req as any, res)
);

/**
 * @route   DELETE /api/v1/goals/:id
 * @desc    Delete a goal
 * @access  Private
 */
router.delete('/:id', (req: Request, res: Response) => 
  goalController.deleteGoal(req as any, res)
);

/**
 * @route   POST /api/v1/goals/:goalId/milestones
 * @desc    Create a milestone for a goal
 * @access  Private
 */
router.post('/:goalId/milestones', (req: Request, res: Response) => 
  goalController.createMilestone(req as any, res)
);

/**
 * @route   PUT /api/v1/goals/:goalId/milestones/:milestoneId
 * @desc    Update a milestone
 * @access  Private
 */
router.put('/:goalId/milestones/:milestoneId', (req: Request, res: Response) => 
  goalController.updateMilestone(req as any, res)
);

/**
 * @route   DELETE /api/v1/goals/:goalId/milestones/:milestoneId
 * @desc    Delete a milestone
 * @access  Private
 */
router.delete('/:goalId/milestones/:milestoneId', (req: Request, res: Response) => 
  goalController.deleteMilestone(req as any, res)
);

export default router; 