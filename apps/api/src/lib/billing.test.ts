import { enforceLimit, trackAiUsage, TIER_LIMITS } from './billing.js';
import { db } from '../db.js';
import { organizations, users, processingActivities, organizationVendors, dpias, consentDomains } from 'db';
import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';

// Mock dependencies
jest.mock('../db.js', () => ({
  db: {
    transaction: jest.fn(),
  },
}));

describe('Billing Limit Engine', () => {
  let mockTxn: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTxn = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      for: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };
  });

  describe('enforceLimit', () => {
    it('throws NOT_FOUND if org does not exist', async () => {
      mockTxn.for.mockResolvedValueOnce([]); // org not found

      try {
        await enforceLimit(db, 'org-id', 'users', 1, mockTxn);
        fail('Should have thrown NOT_FOUND');
      } catch (err: any) {
        expect(err).toBeInstanceOf(TRPCError);
        expect(err.code).toBe('NOT_FOUND');
      }
    });

    it('passes if enterprise tier (infinity)', async () => {
      mockTxn.for.mockResolvedValueOnce([{ id: 'org-id', subscriptionTier: 'enterprise' }]);
      // No count query should be executed
      await enforceLimit(db, 'org-id', 'users', 1, mockTxn);
      expect(mockTxn.select).toHaveBeenCalledTimes(1); // Only the org select
    });

    it('throws PRECONDITION_FAILED if limit reached', async () => {
      mockTxn.for.mockResolvedValueOnce([{ id: 'org-id', subscriptionTier: 'professional' }]);
      mockTxn.for.mockResolvedValueOnce([{ count: 50 }]); // 50 domains currently, limit is 50

      try {
        await enforceLimit(db, 'org-id', 'domains', 1, mockTxn);
        fail('Should have thrown PRECONDITION_FAILED');
      } catch (err: any) {
        expect(err).toBeInstanceOf(TRPCError);
        expect(err.code).toBe('PRECONDITION_FAILED');
      }
    });

    it('passes if limit not reached', async () => {
      mockTxn.for.mockResolvedValueOnce([{ id: 'org-id', subscriptionTier: 'professional' }]);
      mockTxn.for.mockResolvedValueOnce([{ count: 49 }]); // 49 domains currently, limit is 50

      await enforceLimit(db, 'org-id', 'domains', 1, mockTxn);
      // If no error thrown, test passes
    });
  });

  describe('trackAiUsage', () => {
    it('resets usage if month has rolled over', async () => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      mockTxn.for.mockResolvedValueOnce([{
        id: 'org-id',
        subscriptionTier: 'professional',
        aiQueriesUsed: 100,
        aiLastResetAt: lastMonth
      }]);

      await trackAiUsage('org-id', 1, mockTxn);
      
      expect(mockTxn.update).toHaveBeenCalledTimes(2);
      expect(mockTxn.set).toHaveBeenNthCalledWith(1, { aiQueriesUsed: 0, aiLastResetAt: expect.any(Date) });
    });

    it('throws PRECONDITION_FAILED if AI limit reached', async () => {
      const now = new Date();
      mockTxn.for.mockResolvedValueOnce([{
        id: 'org-id',
        subscriptionTier: 'professional',
        aiQueriesUsed: 2000,
        aiLastResetAt: now
      }]);

      try {
        await trackAiUsage('org-id', 1, mockTxn);
        fail('Should have thrown PRECONDITION_FAILED');
      } catch (err: any) {
        expect(err).toBeInstanceOf(TRPCError);
        expect(err.code).toBe('PRECONDITION_FAILED');
      }
    });

    it('increments usage if under limit', async () => {
      const now = new Date();
      mockTxn.for.mockResolvedValueOnce([{
        id: 'org-id',
        subscriptionTier: 'professional',
        aiQueriesUsed: 1999,
        aiLastResetAt: now
      }]);

      await trackAiUsage('org-id', 1, mockTxn);
      expect(mockTxn.update).toHaveBeenCalledTimes(1);
    });
  });
});
