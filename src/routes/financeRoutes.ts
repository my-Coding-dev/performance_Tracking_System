import express, { Request, Response } from 'express';
import financeController from '../controllers/financeController';
import authMiddleware from '../middlewares/authMiddleware';

const router = express.Router();

// Apply authentication middleware to all finance routes
router.use(authMiddleware.authenticate);

/**
 * @route   POST /api/v1/finance/accounts
 * @desc    Create a new account
 * @access  Private
 */
router.post('/accounts', (req: Request, res: Response) => 
  financeController.createAccount(req as any, res)
);

/**
 * @route   GET /api/v1/finance/accounts
 * @desc    Get all accounts for the current user
 * @access  Private
 */
router.get('/accounts', (req: Request, res: Response) => 
  financeController.getAccounts(req as any, res)
);

/**
 * @route   GET /api/v1/finance/accounts/:id
 * @desc    Get an account by ID
 * @access  Private
 */
router.get('/accounts/:id', (req: Request, res: Response) => 
  financeController.getAccount(req as any, res)
);

/**
 * @route   PUT /api/v1/finance/accounts/:id
 * @desc    Update an account
 * @access  Private
 */
router.put('/accounts/:id', (req: Request, res: Response) => 
  financeController.updateAccount(req as any, res)
);

/**
 * @route   DELETE /api/v1/finance/accounts/:id
 * @desc    Delete an account
 * @access  Private
 */
router.delete('/accounts/:id', (req: Request, res: Response) => 
  financeController.deleteAccount(req as any, res)
);

/**
 * @route   POST /api/v1/finance/transactions
 * @desc    Create a new transaction
 * @access  Private
 */
router.post('/transactions', (req: Request, res: Response) => 
  financeController.createTransaction(req as any, res)
);

/**
 * @route   GET /api/v1/finance/transactions
 * @desc    Get all transactions for the current user with filtering and pagination
 * @access  Private
 */
router.get('/transactions', (req: Request, res: Response) => 
  financeController.getTransactions(req as any, res)
);

/**
 * @route   GET /api/v1/finance/transactions/:id
 * @desc    Get a transaction by ID
 * @access  Private
 */
router.get('/transactions/:id', (req: Request, res: Response) => 
  financeController.getTransaction(req as any, res)
);

/**
 * @route   PUT /api/v1/finance/transactions/:id
 * @desc    Update a transaction
 * @access  Private
 */
router.put('/transactions/:id', (req: Request, res: Response) => 
  financeController.updateTransaction(req as any, res)
);

/**
 * @route   DELETE /api/v1/finance/transactions/:id
 * @desc    Delete a transaction
 * @access  Private
 */
router.delete('/transactions/:id', (req: Request, res: Response) => 
  financeController.deleteTransaction(req as any, res)
);

/**
 * @route   GET /api/v1/finance/summary
 * @desc    Get financial summary for the current user
 * @access  Private
 */
router.get('/summary', (req: Request, res: Response) => 
  financeController.getFinancialSummary(req as any, res)
);

export default router; 