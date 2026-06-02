import { z } from 'zod';
import { router, protectedProcedure, requirePermission } from '../trpc.js';
import { TRPCError } from '@trpc/server';

export const analyticsRouter = router({
  getComplianceTrend: protectedProcedure
    .use(requirePermission('assessments', 'view'))
    .query(async ({ ctx }) => {
      // Mocked for advanced reporting
      // Return 12-month history of compliance scores + projected trajectory
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentMonth = new Date().getMonth();
      const trend = [];
      let baseScore = 60;

      for (let i = 0; i < 12; i++) {
        const monthIndex = (currentMonth - 11 + i + 12) % 12;
        trend.push({
          month: months[monthIndex],
          score: Math.min(100, Math.max(0, baseScore + Math.floor(Math.random() * 10 - 2)))
        });
        baseScore = trend[trend.length - 1].score + 2; // Generally improving trend
      }

      const projected = [
        { month: months[(currentMonth + 1) % 12], score: Math.min(100, baseScore + 2) },
        { month: months[(currentMonth + 2) % 12], score: Math.min(100, baseScore + 4) },
      ];

      return {
        historical: trend,
        projected,
      };
    }),

  getDepartmentScores: protectedProcedure
    .use(requirePermission('assessments', 'view'))
    .query(async ({ ctx }) => {
      // Mock department level scoring
      return [
        { department: 'Engineering', score: 85 },
        { department: 'HR', score: 92 },
        { department: 'Marketing', score: 68 },
        { department: 'Sales', score: 74 },
        { department: 'Finance', score: 88 },
      ];
    }),

  getBenchmark: protectedProcedure
    .use(requirePermission('assessments', 'view'))
    .query(async ({ ctx }) => {
      // Return anonymized comparison against other orgs of similar size/industry
      // In a real scenario, this would aggregate scores across the system.
      // Mocked for now.
      return {
        yourScore: 72,
        industryAverage: 58,
        topQuartile: 85,
        industry: 'Technology',
        size: 'Enterprise',
      };
    }),

  getAdvancedMetrics: protectedProcedure
    .use(requirePermission('assessments', 'view'))
    .query(async ({ ctx }) => {
      // Additional metrics for the dashboard
      return {
        gapResolutionVelocity: [
          { week: 'W1', resolved: 2 },
          { week: 'W2', resolved: 5 },
          { week: 'W3', resolved: 3 },
          { week: 'W4', resolved: 8 },
        ],
        dsarResponseTime: [
          { days: '1-7', count: 12 },
          { days: '8-14', count: 8 },
          { days: '15-21', count: 4 },
          { days: '>21', count: 1 },
        ],
        trainingCompletion: [
          { month: 'Jan', rate: 75 },
          { month: 'Feb', rate: 80 },
          { month: 'Mar', rate: 85 },
          { month: 'Apr', rate: 92 },
        ],
        pillarTrend: [
          { pillar: 'Privacy', score: 85, previous: 80 },
          { pillar: 'Security', score: 72, previous: 75 },
          { pillar: 'Governance', score: 65, previous: 60 },
        ]
      };
    }),
});
