import express, { Request, Response } from 'express';
import taskController from '../controllers/taskController';
import authMiddleware from '../middlewares/authMiddleware';

const router = express.Router();

// Apply authentication middleware to all task routes
router.use(authMiddleware.authenticate);

/**
 * @route   POST /api/v1/tasks
 * @desc    Create a new task
 * @access  Private
 */
router.post('/', (req: Request, res: Response) => 
  taskController.createTask(req as any, res)
);

/**
 * @route   GET /api/v1/tasks
 * @desc    Get all tasks for the current user with filtering and pagination
 * @access  Private
 */
router.get('/', (req: Request, res: Response) => 
  taskController.getTasks(req as any, res)
);

/**
 * @route   GET /api/v1/tasks/statistics
 * @desc    Get task statistics for the current user
 * @access  Private
 */
router.get('/statistics', (req: Request, res: Response) => 
  taskController.getTaskStatistics(req as any, res)
);

/**
 * @route   GET /api/v1/tasks/:id
 * @desc    Get a task by ID
 * @access  Private
 */
router.get('/:id', (req: Request, res: Response) => 
  taskController.getTask(req as any, res)
);

/**
 * @route   PUT /api/v1/tasks/:id
 * @desc    Update a task
 * @access  Private
 */
router.put('/:id', (req: Request, res: Response) => 
  taskController.updateTask(req as any, res)
);

/**
 * @route   DELETE /api/v1/tasks/:id
 * @desc    Delete a task
 * @access  Private
 */
router.delete('/:id', (req: Request, res: Response) => 
  taskController.deleteTask(req as any, res)
);

/**
 * @route   POST /api/v1/tasks/:taskId/time-entries
 * @desc    Create a time entry for a task
 * @access  Private
 */
router.post('/:taskId/time-entries', (req: Request, res: Response) => 
  taskController.createTimeEntry(req as any, res)
);

/**
 * @route   GET /api/v1/tasks/:taskId/time-entries
 * @desc    Get all time entries for a task
 * @access  Private
 */
router.get('/:taskId/time-entries', (req: Request, res: Response) => 
  taskController.getTimeEntries(req as any, res)
);

/**
 * @route   PUT /api/v1/tasks/:taskId/time-entries/:timeEntryId
 * @desc    Update a time entry
 * @access  Private
 */
router.put('/:taskId/time-entries/:timeEntryId', (req: Request, res: Response) => 
  taskController.updateTimeEntry(req as any, res)
);

export default router; 