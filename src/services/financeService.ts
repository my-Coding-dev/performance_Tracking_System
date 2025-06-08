import { PrismaClient, Account, Transaction, Budget, BudgetAllocation, TransactionType } from '@prisma/client';
import db from '../utils/database';
import logger from '../utils/logger';
import cacheClient from '../utils/cache';
import { NotFoundError, BadRequestError } from '../utils/errors';

interface CreateAccountData {
  userId: string;
  name: string;
  accountType: string;
  balance: number;
  currency?: string;
  includeInTotal?: boolean;
  institution?: string;
  accountNumber?: string;
  notes?: string;
}

interface UpdateAccountData {
  name?: string;
  accountType?: string;
  balance?: number;
  currency?: string;
  isActive?: boolean;
  includeInTotal?: boolean;
  institution?: string;
  accountNumber?: string;
  notes?: string;
}

interface CreateTransactionData {
  userId: string;
  accountId: string;
  amount: number;
  description: string;
  date: Date;
  type: TransactionType;
  category?: string;
  subcategory?: string;
  isRecurring?: boolean;
  recurrenceRule?: string;
  transferToId?: string;
  status?: string;
  tags?: string[];
  notes?: string;
}

interface UpdateTransactionData {
  accountId?: string;
  amount?: number;
  description?: string;
  date?: Date;
  type?: TransactionType;
  category?: string;
  subcategory?: string;
  isRecurring?: boolean;
  recurrenceRule?: string | null;
  transferToId?: string | null;
  status?: string;
  tags?: string[];
  notes?: string | null;
}

interface CreateBudgetData {
  userId: string;
  name: string;
  amount: number;
  period: string;
  startDate: Date;
  endDate?: Date;
  isRecurring?: boolean;
  categories: string[];
  notes?: string;
}

interface UpdateBudgetData {
  name?: string;
  amount?: number;
  period?: string;
  startDate?: Date;
  endDate?: Date | null;
  isRecurring?: boolean;
  categories?: string[];
  notes?: string | null;
}

interface TransactionFilterOptions {
  accountId?: string;
  type?: TransactionType | TransactionType[];
  dateRange?: { from?: Date; to?: Date };
  categories?: string[];
  search?: string;
  isRecurring?: boolean;
  tags?: string[];
  minAmount?: number;
  maxAmount?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  netCashflow: number;
  accountBalances: Array<{
    id: string;
    name: string;
    balance: number;
    accountType: string;
  }>;
  topCategories: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  recentTransactions: Transaction[];
}

class FinanceService {
  private prisma: PrismaClient;
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor() {
    this.prisma = db.getPrisma();
  }

  /**
   * Create a new account
   */
  async createAccount(data: CreateAccountData): Promise<Account> {
    try {
      // Create account
      const account = await this.prisma.account.create({
        data: {
          userId: data.userId,
          name: data.name,
          accountType: data.accountType,
          balance: data.balance,
          currency: data.currency || 'USD',
          includeInTotal: data.includeInTotal !== false,
          institution: data.institution,
          accountNumber: data.accountNumber,
          notes: data.notes
        }
      });

      // Invalidate cache
      await this.invalidateFinanceCache(data.userId);

      return account;
    } catch (error) {
      logger.error('Error creating account', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get an account by ID
   */
  async getAccountById(accountId: string, userId: string): Promise<Account> {
    try {
      // Try to get from cache first
      const cacheKey = `account:${accountId}`;
      const cachedAccount = await cacheClient.get<Account>(cacheKey);
      
      if (cachedAccount) {
        return cachedAccount;
      }

      // Get from database
      const account = await this.prisma.account.findUnique({
        where: { id: accountId }
      });

      if (!account) {
        throw new NotFoundError('Account not found');
      }

      // Check permission
      if (account.userId !== userId) {
        throw new NotFoundError('Account not found');
      }

      // Cache the result
      await cacheClient.set(cacheKey, account, this.CACHE_TTL);

      return account;
    } catch (error) {
      logger.error('Error getting account', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get all accounts for a user
   */
  async getAccounts(userId: string): Promise<Account[]> {
    try {
      // Try to get from cache first
      const cacheKey = `accounts:${userId}`;
      const cachedAccounts = await cacheClient.get<Account[]>(cacheKey);
      
      if (cachedAccounts) {
        return cachedAccounts;
      }

      // Get from database
      const accounts = await this.prisma.account.findMany({
        where: { 
          userId,
          isActive: true
        },
        orderBy: {
          name: 'asc'
        }
      });

      // Cache the result
      await cacheClient.set(cacheKey, accounts, this.CACHE_TTL);

      return accounts;
    } catch (error) {
      logger.error('Error getting accounts', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Update an account
   */
  async updateAccount(accountId: string, userId: string, data: UpdateAccountData): Promise<Account> {
    try {
      // Get account
      const account = await this.prisma.account.findUnique({
        where: { id: accountId }
      });

      if (!account) {
        throw new NotFoundError('Account not found');
      }

      // Check permission
      if (account.userId !== userId) {
        throw new NotFoundError('Account not found');
      }

      // Update account
      const updatedAccount = await this.prisma.account.update({
        where: { id: accountId },
        data: {
          name: data.name,
          accountType: data.accountType,
          balance: data.balance,
          currency: data.currency,
          isActive: data.isActive,
          includeInTotal: data.includeInTotal,
          institution: data.institution,
          accountNumber: data.accountNumber,
          notes: data.notes
        }
      });

      // Invalidate cache
      await this.invalidateFinanceCache(userId);
      await cacheClient.delete(`account:${accountId}`);

      return updatedAccount;
    } catch (error) {
      logger.error('Error updating account', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Delete an account (soft delete by setting isActive to false)
   */
  async deleteAccount(accountId: string, userId: string): Promise<boolean> {
    try {
      // Get account
      const account = await this.prisma.account.findUnique({
        where: { id: accountId },
        include: {
          transactions: {
            take: 1
          }
        }
      });

      if (!account) {
        throw new NotFoundError('Account not found');
      }

      // Check permission
      if (account.userId !== userId) {
        throw new NotFoundError('Account not found');
      }

      // Check if account has transactions
      if (account.transactions.length > 0) {
        // Soft delete by setting isActive to false
        await this.prisma.account.update({
          where: { id: accountId },
          data: {
            isActive: false
          }
        });
      } else {
        // Hard delete if no transactions
        await this.prisma.account.delete({
          where: { id: accountId }
        });
      }

      // Invalidate cache
      await this.invalidateFinanceCache(userId);
      await cacheClient.delete(`account:${accountId}`);

      return true;
    } catch (error) {
      logger.error('Error deleting account', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Create a new transaction
   */
  async createTransaction(data: CreateTransactionData): Promise<Transaction> {
    try {
      // Validate account
      const account = await this.prisma.account.findUnique({
        where: { id: data.accountId }
      });

      if (!account) {
        throw new NotFoundError('Account not found');
      }

      // Check if it's a transfer and validate destination account
      if (data.type === TransactionType.TRANSFER && data.transferToId) {
        const destinationAccount = await this.prisma.account.findUnique({
          where: { id: data.transferToId }
        });

        if (!destinationAccount) {
          throw new NotFoundError('Destination account not found');
        }

        // Ensure transfer is not to the same account
        if (data.accountId === data.transferToId) {
          throw new BadRequestError('Cannot transfer to the same account');
        }
      }

      // Start a transaction to ensure consistency
      const result = await this.prisma.$transaction(async (tx) => {
        // Create the transaction
        const transaction = await tx.transaction.create({
          data: {
            userId: data.userId,
            accountId: data.accountId,
            amount: data.amount,
            description: data.description,
            date: data.date,
            type: data.type,
            category: data.category,
            subcategory: data.subcategory,
            isRecurring: data.isRecurring || false,
            recurrenceRule: data.recurrenceRule,
            transferToId: data.transferToId,
            status: data.status || 'cleared',
            tags: data.tags || [],
            notes: data.notes
          }
        });

        // Update account balance based on transaction type
        let balanceChange = 0;
        if (data.type === TransactionType.INCOME) {
          balanceChange = data.amount;
        } else if (data.type === TransactionType.EXPENSE) {
          balanceChange = -data.amount;
        } else if (data.type === TransactionType.TRANSFER) {
          balanceChange = -data.amount;
        }

        await tx.account.update({
          where: { id: data.accountId },
          data: {
            balance: {
              increment: balanceChange
            }
          }
        });

        // If it's a transfer, update destination account balance
        if (data.type === TransactionType.TRANSFER && data.transferToId) {
          await tx.account.update({
            where: { id: data.transferToId },
            data: {
              balance: {
                increment: data.amount
              }
            }
          });
        }

        return transaction;
      });

      // Invalidate cache
      await this.invalidateFinanceCache(data.userId);

      return result;
    } catch (error) {
      logger.error('Error creating transaction', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get a transaction by ID
   */
  async getTransactionById(transactionId: string, userId: string): Promise<Transaction> {
    try {
      // Try to get from cache first
      const cacheKey = `transaction:${transactionId}`;
      const cachedTransaction = await cacheClient.get<Transaction>(cacheKey);
      
      if (cachedTransaction) {
        return cachedTransaction;
      }

      // Get from database
      const transaction = await this.prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          account: true,
          transferTo: true
        }
      });

      if (!transaction) {
        throw new NotFoundError('Transaction not found');
      }

      // Check permission
      if (transaction.userId !== userId) {
        throw new NotFoundError('Transaction not found');
      }

      // Cache the result
      await cacheClient.set(cacheKey, transaction, this.CACHE_TTL);

      return transaction;
    } catch (error) {
      logger.error('Error getting transaction', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get transactions for a user with filtering and pagination
   */
  async getTransactions(userId: string, options: TransactionFilterOptions = {}): Promise<{ transactions: Transaction[]; total: number }> {
    try {
      const { 
        accountId, 
        type, 
        dateRange, 
        categories, 
        search, 
        isRecurring, 
        tags, 
        minAmount, 
        maxAmount, 
        sortBy = 'date', 
        sortOrder = 'desc',
        page = 1, 
        limit = 20 
      } = options;

      // Build filter conditions
      const where: any = { userId };

      // Account filter
      if (accountId) {
        where.accountId = accountId;
      }

      // Transaction type filter
      if (type) {
        if (Array.isArray(type)) {
          where.type = { in: type };
        } else {
          where.type = type;
        }
      }

      // Date range filter
      if (dateRange) {
        where.date = {};
        if (dateRange.from) {
          where.date.gte = dateRange.from;
        }
        if (dateRange.to) {
          where.date.lte = dateRange.to;
        }
      }

      // Categories filter
      if (categories && categories.length > 0) {
        where.category = { in: categories };
      }

      // Search filter
      if (search) {
        where.OR = [
          { description: { contains: search, mode: 'insensitive' } },
          { notes: { contains: search, mode: 'insensitive' } }
        ];
      }

      // Recurring filter
      if (isRecurring !== undefined) {
        where.isRecurring = isRecurring;
      }

      // Tags filter
      if (tags && tags.length > 0) {
        where.tags = { hasSome: tags };
      }

      // Amount range filter
      if (minAmount !== undefined || maxAmount !== undefined) {
        where.amount = {};
        if (minAmount !== undefined) {
          where.amount.gte = minAmount;
        }
        if (maxAmount !== undefined) {
          where.amount.lte = maxAmount;
        }
      }

      // Determine sort field and direction
      const orderBy: any = {};
      orderBy[sortBy] = sortOrder;

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Cache key based on query parameters
      const cacheKey = `transactions:${userId}:${JSON.stringify({ where, orderBy, skip, limit })}`;
      const cachedResult = await cacheClient.get<{ transactions: Transaction[], total: number }>(cacheKey);

      if (cachedResult) {
        return cachedResult;
      }

      // Get transactions from database
      const [transactions, total] = await this.prisma.$transaction([
        this.prisma.transaction.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: {
            account: {
              select: {
                name: true,
                accountType: true,
                currency: true
              }
            },
            transferTo: {
              select: {
                name: true,
                accountType: true
              }
            }
          }
        }),
        this.prisma.transaction.count({ where })
      ]);

      const result = { transactions, total };

      // Cache the result
      await cacheClient.set(cacheKey, result, this.CACHE_TTL);

      return result;
    } catch (error) {
      logger.error('Error getting transactions', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Update a transaction
   */
  async updateTransaction(transactionId: string, userId: string, data: UpdateTransactionData): Promise<Transaction> {
    try {
      // Get transaction with account
      const transaction = await this.prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          account: true
        }
      });

      if (!transaction) {
        throw new NotFoundError('Transaction not found');
      }

      // Check permission
      if (transaction.userId !== userId) {
        throw new NotFoundError('Transaction not found');
      }

      // Check if account is changing and validate new account
      let newAccount: Account | null = null;
      if (data.accountId && data.accountId !== transaction.accountId) {
        newAccount = await this.prisma.account.findUnique({
          where: { id: data.accountId }
        });

        if (!newAccount) {
          throw new NotFoundError('New account not found');
        }

        // Ensure user owns the new account
        if (newAccount.userId !== userId) {
          throw new NotFoundError('New account not found');
        }
      }

      // Check if it's a transfer and validate destination account
      let newDestinationAccount: Account | null = null;
      if (data.type === TransactionType.TRANSFER && data.transferToId && data.transferToId !== transaction.transferToId) {
        newDestinationAccount = await this.prisma.account.findUnique({
          where: { id: data.transferToId }
        });

        if (!newDestinationAccount) {
          throw new NotFoundError('Destination account not found');
        }

        // Ensure user owns the destination account
        if (newDestinationAccount.userId !== userId) {
          throw new NotFoundError('Destination account not found');
        }

        // Ensure transfer is not to the same account
        if ((data.accountId || transaction.accountId) === data.transferToId) {
          throw new BadRequestError('Cannot transfer to the same account');
        }
      }

      // Calculate amount changes for account balances
      const oldAmount = transaction.amount;
      const newAmount = data.amount !== undefined ? data.amount : oldAmount;
      const oldType = transaction.type;
      const newType = data.type !== undefined ? data.type : oldType;

      // Start a transaction to ensure consistency
      const result = await this.prisma.$transaction(async (tx) => {
        // Revert the effect of the original transaction on the original account
        let originalBalanceChange = 0;
        if (oldType === TransactionType.INCOME) {
          originalBalanceChange = -oldAmount; // Subtract the income
        } else if (oldType === TransactionType.EXPENSE) {
          originalBalanceChange = oldAmount; // Add back the expense
        } else if (oldType === TransactionType.TRANSFER) {
          originalBalanceChange = oldAmount; // Add back the transfer amount
        }

        await tx.account.update({
          where: { id: transaction.accountId },
          data: {
            balance: {
              increment: originalBalanceChange
            }
          }
        });

        // If it was a transfer, revert the effect on the original destination account
        if (oldType === TransactionType.TRANSFER && transaction.transferToId) {
          await tx.account.update({
            where: { id: transaction.transferToId },
            data: {
              balance: {
                decrement: oldAmount
              }
            }
          });
        }

        // Apply the new transaction effect on the account (which might be a different account)
        const targetAccountId = data.accountId || transaction.accountId;
        let newBalanceChange = 0;
        if (newType === TransactionType.INCOME) {
          newBalanceChange = newAmount;
        } else if (newType === TransactionType.EXPENSE) {
          newBalanceChange = -newAmount;
        } else if (newType === TransactionType.TRANSFER) {
          newBalanceChange = -newAmount;
        }

        await tx.account.update({
          where: { id: targetAccountId },
          data: {
            balance: {
              increment: newBalanceChange
            }
          }
        });

        // If it's a transfer now, update the new destination account
        if (newType === TransactionType.TRANSFER && data.transferToId) {
          await tx.account.update({
            where: { id: data.transferToId },
            data: {
              balance: {
                increment: newAmount
              }
            }
          });
        }

        // Update the transaction
        return await tx.transaction.update({
          where: { id: transactionId },
          data: {
            accountId: data.accountId,
            amount: data.amount,
            description: data.description,
            date: data.date,
            type: data.type,
            category: data.category,
            subcategory: data.subcategory,
            isRecurring: data.isRecurring,
            recurrenceRule: data.recurrenceRule,
            transferToId: data.transferToId,
            status: data.status,
            tags: data.tags,
            notes: data.notes
          }
        });
      });

      // Invalidate cache
      await this.invalidateFinanceCache(userId);
      await cacheClient.delete(`transaction:${transactionId}`);

      return result;
    } catch (error) {
      logger.error('Error updating transaction', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Delete a transaction
   */
  async deleteTransaction(transactionId: string, userId: string): Promise<boolean> {
    try {
      // Get transaction with account
      const transaction = await this.prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          account: true
        }
      });

      if (!transaction) {
        throw new NotFoundError('Transaction not found');
      }

      // Check permission
      if (transaction.userId !== userId) {
        throw new NotFoundError('Transaction not found');
      }

      // Start a transaction to ensure consistency
      await this.prisma.$transaction(async (tx) => {
        // Revert the effect of the transaction on the account balance
        let balanceChange = 0;
        if (transaction.type === TransactionType.INCOME) {
          balanceChange = -transaction.amount; // Subtract the income
        } else if (transaction.type === TransactionType.EXPENSE) {
          balanceChange = transaction.amount; // Add back the expense
        } else if (transaction.type === TransactionType.TRANSFER) {
          balanceChange = transaction.amount; // Add back the transfer amount
        }

        await tx.account.update({
          where: { id: transaction.accountId },
          data: {
            balance: {
              increment: balanceChange
            }
          }
        });

        // If it was a transfer, revert the effect on the destination account
        if (transaction.type === TransactionType.TRANSFER && transaction.transferToId) {
          await tx.account.update({
            where: { id: transaction.transferToId },
            data: {
              balance: {
                decrement: transaction.amount
              }
            }
          });
        }

        // Delete any budget allocations for this transaction
        await tx.budgetAllocation.deleteMany({
          where: { transactionId }
        });

        // Delete the transaction
        await tx.transaction.delete({
          where: { id: transactionId }
        });
      });

      // Invalidate cache
      await this.invalidateFinanceCache(userId);
      await cacheClient.delete(`transaction:${transactionId}`);

      return true;
    } catch (error) {
      logger.error('Error deleting transaction', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get financial summary for a user
   */
  async getFinancialSummary(userId: string, period: 'month' | 'year' = 'month'): Promise<FinancialSummary> {
    try {
      // Calculate date range
      const now = new Date();
      let startDate: Date;
      
      if (period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else {
        startDate = new Date(now.getFullYear(), 0, 1);
      }
      
      const endDate = new Date(now.getTime());

      // Cache key
      const cacheKey = `finance-summary:${userId}:${period}:${startDate.toISOString()}:${endDate.toISOString()}`;
      const cachedSummary = await cacheClient.get<FinancialSummary>(cacheKey);
      
      if (cachedSummary) {
        return cachedSummary;
      }

      // Get data from database
      const [accounts, transactions, expensesByCategory, recentTransactions] = await Promise.all([
        // Get active accounts
        this.prisma.account.findMany({
          where: { 
            userId,
            isActive: true
          },
          select: {
            id: true,
            name: true,
            balance: true,
            accountType: true
          }
        }),
        
        // Get all transactions in period
        this.prisma.transaction.findMany({
          where: {
            userId,
            date: {
              gte: startDate,
              lte: endDate
            }
          }
        }),
        
        // Get expenses by category
        this.prisma.transaction.groupBy({
          by: ['category'],
          where: {
            userId,
            type: TransactionType.EXPENSE,
            date: {
              gte: startDate,
              lte: endDate
            },
            category: { not: null }
          },
          _sum: {
            amount: true
          },
          orderBy: {
            _sum: {
              amount: 'desc'
            }
          },
          take: 5
        }),
        
        // Get recent transactions
        this.prisma.transaction.findMany({
          where: { userId },
          orderBy: { date: 'desc' },
          take: 5,
          include: {
            account: {
              select: {
                name: true,
                accountType: true
              }
            }
          }
        })
      ]);

      // Calculate totals
      const totalIncome = transactions
        .filter(t => t.type === TransactionType.INCOME)
        .reduce((sum, t) => sum + t.amount, 0);
        
      const totalExpenses = transactions
        .filter(t => t.type === TransactionType.EXPENSE)
        .reduce((sum, t) => sum + t.amount, 0);
        
      const netCashflow = totalIncome - totalExpenses;

      // Format category data
      const topCategories = expensesByCategory.map(cat => ({
        category: cat.category || 'Uncategorized',
        amount: cat._sum.amount || 0,
        percentage: totalExpenses > 0 ? ((cat._sum.amount || 0) / totalExpenses) * 100 : 0
      }));

      // Build summary
      const summary: FinancialSummary = {
        totalIncome,
        totalExpenses,
        netCashflow,
        accountBalances: accounts,
        topCategories,
        recentTransactions
      };

      // Cache the result
      await cacheClient.set(cacheKey, summary, this.CACHE_TTL);

      return summary;
    } catch (error) {
      logger.error('Error getting financial summary', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Invalidate finance cache for a user
   */
  private async invalidateFinanceCache(userId: string): Promise<void> {
    try {
      await cacheClient.clearByPattern(`accounts:${userId}`);
      await cacheClient.clearByPattern(`transactions:${userId}:`);
      await cacheClient.clearByPattern(`finance-summary:${userId}:`);
    } catch (error) {
      logger.error('Error invalidating finance cache', error instanceof Error ? error : new Error(String(error)));
    }
  }
}

export default new FinanceService(); 