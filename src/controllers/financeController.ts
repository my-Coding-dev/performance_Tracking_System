import { Request, Response } from 'express';
import financeService from '../services/financeService';
import logger from '../utils/logger';
import { AppError, ValidationError } from '../utils/errors';
import { TransactionType } from '@prisma/client';

// Extend Express Request type to include user
interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

class FinanceController {
  /**
   * Create a new account
   */
  async createAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { name, accountType, balance, currency, includeInTotal, institution, accountNumber, notes } = req.body;

      // Validate required fields
      if (!name || !accountType || balance === undefined) {
        throw new ValidationError('Missing required fields', {
          name: !name ? 'Name is required' : '',
          accountType: !accountType ? 'Account type is required' : '',
          balance: balance === undefined ? 'Balance is required' : ''
        });
      }

      // Validate account type
      const validAccountTypes = ['checking', 'savings', 'credit', 'investment', 'cash'];
      if (!validAccountTypes.includes(accountType)) {
        throw new ValidationError('Invalid account type', {
          accountType: `Account type must be one of: ${validAccountTypes.join(', ')}`
        });
      }

      // Create account
      const account = await financeService.createAccount({
        userId: req.user.userId,
        name,
        accountType,
        balance: parseFloat(balance),
        currency,
        includeInTotal,
        institution,
        accountNumber,
        notes
      });

      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: account
      });
    } catch (error) {
      logger.error('Error in createAccount controller', error instanceof Error ? error : new Error(String(error)));
      
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
        message: 'Failed to create account'
      });
    }
  }

  /**
   * Get all accounts for the current user
   */
  async getAccounts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const accounts = await financeService.getAccounts(req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Accounts retrieved successfully',
        data: accounts
      });
    } catch (error) {
      logger.error('Error in getAccounts controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to get accounts'
      });
    }
  }

  /**
   * Get an account by ID
   */
  async getAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const account = await financeService.getAccountById(id, req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Account retrieved successfully',
        data: account
      });
    } catch (error) {
      logger.error('Error in getAccount controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to get account'
      });
    }
  }

  /**
   * Update an account
   */
  async updateAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, accountType, balance, currency, isActive, includeInTotal, institution, accountNumber, notes } = req.body;

      // Update account
      const account = await financeService.updateAccount(id, req.user.userId, {
        name,
        accountType,
        balance: balance !== undefined ? parseFloat(balance) : undefined,
        currency,
        isActive: isActive === 'true' || isActive === true ? true : isActive === 'false' || isActive === false ? false : undefined,
        includeInTotal: includeInTotal === 'true' || includeInTotal === true ? true : includeInTotal === 'false' || includeInTotal === false ? false : undefined,
        institution,
        accountNumber,
        notes
      });

      res.status(200).json({
        success: true,
        message: 'Account updated successfully',
        data: account
      });
    } catch (error) {
      logger.error('Error in updateAccount controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to update account'
      });
    }
  }

  /**
   * Delete an account
   */
  async deleteAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await financeService.deleteAccount(id, req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (error) {
      logger.error('Error in deleteAccount controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to delete account'
      });
    }
  }

  /**
   * Create a new transaction
   */
  async createTransaction(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { 
        accountId, 
        amount, 
        description, 
        date, 
        type, 
        category, 
        subcategory, 
        isRecurring, 
        recurrenceRule,
        transferToId,
        status,
        tags,
        notes
      } = req.body;

      // Validate required fields
      if (!accountId || !amount || !description || !date || !type) {
        throw new ValidationError('Missing required fields', {
          accountId: !accountId ? 'Account is required' : "",
          amount: !amount ? 'Amount is required' : "",
          description: !description ? 'Description is required' : "",
          date: !date ? 'Date is required' : "",
          type: !type ? 'Transaction type is required' : ""
        });
      }

      // Validate transaction type
      if (!Object.values(TransactionType).includes(type as TransactionType)) {
        throw new ValidationError('Invalid transaction type', {
          type: `Type must be one of: ${Object.values(TransactionType).join(', ')}`
        });
      }

      // Create transaction
      const transaction = await financeService.createTransaction({
        userId: req.user.userId,
        accountId,
        amount: parseFloat(amount),
        description,
        date: new Date(date),
        type: type as TransactionType,
        category,
        subcategory,
        isRecurring: isRecurring === 'true' || isRecurring === true,
        recurrenceRule,
        transferToId,
        status,
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
        notes
      });

      res.status(201).json({
        success: true,
        message: 'Transaction created successfully',
        data: transaction
      });
    } catch (error) {
      logger.error('Error in createTransaction controller', error instanceof Error ? error : new Error(String(error)));
      
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
        message: 'Failed to create transaction'
      });
    }
  }

  /**
   * Get a transaction by ID
   */
  async getTransaction(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const transaction = await financeService.getTransactionById(id, req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Transaction retrieved successfully',
        data: transaction
      });
    } catch (error) {
      logger.error('Error in getTransaction controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to get transaction'
      });
    }
  }

  /**
   * Get transactions for current user with filtering and pagination
   */
  async getTransactions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        accountId,
        type,
        dateFrom,
        dateTo,
        categories,
        search,
        isRecurring,
        tags,
        minAmount,
        maxAmount,
        sortBy,
        sortOrder,
        page,
        limit
      } = req.query;

      // Parse transaction type(s)
      let transactionType: TransactionType | TransactionType[] | undefined = undefined;
      if (type) {
        if (Array.isArray(type)) {
          transactionType = type.map(t => t as TransactionType);
        } else {
          transactionType = type as TransactionType;
        }
      }

      // Build filter options
      const filterOptions: any = {
        accountId: accountId as string,
        type: transactionType,
        dateRange: (dateFrom || dateTo) ? {
          from: dateFrom ? new Date(dateFrom as string) : undefined,
          to: dateTo ? new Date(dateTo as string) : undefined
        } : undefined,
        categories: categories ? (Array.isArray(categories) ? categories : [categories]) as string[] : undefined,
        search: search as string,
        isRecurring: isRecurring === 'true' ? true : isRecurring === 'false' ? false : undefined,
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) as string[] : undefined,
        minAmount: minAmount ? parseFloat(minAmount as string) : undefined,
        maxAmount: maxAmount ? parseFloat(maxAmount as string) : undefined,
        sortBy: sortBy as string,
        sortOrder: sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : undefined,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined
      };

      // Get transactions
      const { transactions, total } = await financeService.getTransactions(req.user.userId, filterOptions);

      res.status(200).json({
        success: true,
        message: 'Transactions retrieved successfully',
        data: {
          transactions,
          total,
          page: filterOptions.page || 1,
          limit: filterOptions.limit || 20,
          totalPages: Math.ceil(total / (filterOptions.limit || 20))
        }
      });
    } catch (error) {
      logger.error('Error in getTransactions controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to get transactions'
      });
    }
  }

  /**
   * Update a transaction
   */
  async updateTransaction(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { 
        accountId, 
        amount, 
        description, 
        date, 
        type, 
        category, 
        subcategory, 
        isRecurring, 
        recurrenceRule,
        transferToId,
        status,
        tags,
        notes
      } = req.body;

      // Validate transaction type if provided
      if (type && !Object.values(TransactionType).includes(type as TransactionType)) {
        throw new ValidationError('Invalid transaction type', {
          type: `Type must be one of: ${Object.values(TransactionType).join(', ')}`
        });
      }

      // Update transaction
      const transaction = await financeService.updateTransaction(id, req.user.userId, {
        accountId,
        amount: amount !== undefined ? parseFloat(amount) : undefined,
        description,
        date: date ? new Date(date) : undefined,
        type: type as TransactionType | undefined,
        category,
        subcategory,
        isRecurring: isRecurring === 'true' || isRecurring === true ? true : isRecurring === 'false' || isRecurring === false ? false : undefined,
        recurrenceRule,
        transferToId,
        status,
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
        notes
      });

      res.status(200).json({
        success: true,
        message: 'Transaction updated successfully',
        data: transaction
      });
    } catch (error) {
      logger.error('Error in updateTransaction controller', error instanceof Error ? error : new Error(String(error)));
      
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
        message: 'Failed to update transaction'
      });
    }
  }

  /**
   * Delete a transaction
   */
  async deleteTransaction(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await financeService.deleteTransaction(id, req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Transaction deleted successfully'
      });
    } catch (error) {
      logger.error('Error in deleteTransaction controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to delete transaction'
      });
    }
  }

  /**
   * Get financial summary
   */
  async getFinancialSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { period } = req.query;

      const summary = await financeService.getFinancialSummary(
        req.user.userId, 
        (period === 'year' ? 'year' : 'month') as 'month' | 'year'
      );

      res.status(200).json({
        success: true,
        message: 'Financial summary retrieved successfully',
        data: summary
      });
    } catch (error) {
      logger.error('Error in getFinancialSummary controller', error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to get financial summary'
      });
    }
  }
}

export default new FinanceController(); 