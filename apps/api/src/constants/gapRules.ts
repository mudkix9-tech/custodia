import { db } from '../db.js';
import { organizationVendors, vendors, complianceGaps, processingActivities, privacyPolicies, dsarRequests, breaches, trainingModules, trainingCompletions, clientProcessingActivities } from 'db';
import { and, eq, notInArray, isNull, lt, not, exists, sql } from 'drizzle-orm';

export const DETECTION_RULES = [
  // Vendor gaps
  {
    id: 'missing_dpa',
    severity: 'high',
    gdprArticles: ['Article 28'],
    detect: async (orgId: string) => {
      return db.query.organizationVendors.findMany({
        where: and(
          eq(organizationVendors.organizationId, orgId),
          notInArray(organizationVendors.dpaStatus, ['signed']),
        ),
        with: { vendor: true },
      });
    },
    buildGap: (record: any) => ({
      entityType: 'vendor',
      entityId: record.id,
      gapType: 'missing_dpa',
      title: `Missing DPA: ${record.vendor?.name || 'Unknown Vendor'}`,
      description: `No signed Data Processing Agreement with ${record.vendor?.name || 'Unknown Vendor'}.`,
      severity: record.vendor?.riskLevel === 'critical' ? 'critical' : 'high',
      resolutionUrl: `/vendors/${record.id}`,
    }),
  },
  {
    id: 'expired_dpa',
    severity: 'high',
    gdprArticles: ['Article 28'],
    detect: async (orgId: string) => {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      return db.query.organizationVendors.findMany({
        where: and(
          eq(organizationVendors.organizationId, orgId),
          eq(organizationVendors.dpaStatus, 'signed'),
          lt(organizationVendors.dpaExpiresAt, thirtyDaysFromNow)
        ),
        with: { vendor: true },
      });
    },
    buildGap: (record: any) => ({
      entityType: 'vendor',
      entityId: record.id,
      gapType: 'expired_dpa',
      title: `DPA Expired or Expiring Soon: ${record.vendor?.name || 'Unknown'}`,
      description: `The DPA is expired or will expire within 30 days.`,
      severity: record.vendor?.riskLevel === 'critical' ? 'critical' : 'medium',
      resolutionUrl: `/vendors/${record.id}`,
    }),
  },
  {
    id: 'high_risk_vendor_no_review',
    severity: 'high',
    gdprArticles: ['Article 32'],
    detect: async (orgId: string) => {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      return db.query.organizationVendors.findMany({
        where: and(
          eq(organizationVendors.organizationId, orgId),
          lt(organizationVendors.lastReviewedAt, oneYearAgo)
        ),
        with: { vendor: true },
      });
    },
    buildGap: (record: any) => ({
      entityType: 'vendor',
      entityId: record.id,
      gapType: 'high_risk_vendor_no_review',
      title: `Overdue Vendor Review: ${record.vendor?.name || 'Unknown'}`,
      description: `Vendor review is overdue by more than 1 year.`,
      severity: 'high',
      resolutionUrl: `/vendors/${record.id}`,
    }),
  },

  // ROPA gaps
  {
    id: 'incomplete_activity',
    severity: 'medium',
    gdprArticles: ['Article 30'],
    detect: async (orgId: string) => {
      return db.query.processingActivities.findMany({
        where: and(
          eq(processingActivities.organizationId, orgId),
          isNull(processingActivities.lawfulBasis)
        ),
      });
    },
    buildGap: (record: any) => ({
      entityType: 'ropa',
      entityId: record.id,
      gapType: 'incomplete_activity',
      title: `Incomplete ROPA Activity: ${record.name}`,
      description: `Missing lawful basis for this processing activity.`,
      severity: 'medium',
      resolutionUrl: `/ropa/${record.id}`,
    }),
  },
  {
    id: 'stale_activity',
    severity: 'medium',
    gdprArticles: ['Article 30'],
    detect: async (orgId: string) => {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      return db.query.processingActivities.findMany({
        where: and(
          eq(processingActivities.organizationId, orgId),
          lt(processingActivities.updatedAt, oneYearAgo)
        ),
      });
    },
    buildGap: (record: any) => ({
      entityType: 'ropa',
      entityId: record.id,
      gapType: 'stale_activity',
      title: `Stale ROPA Activity: ${record.name}`,
      description: `This processing activity hasn't been updated in over a year.`,
      severity: 'medium',
      resolutionUrl: `/ropa/${record.id}`,
    }),
  },

  // Policy gaps
  {
    id: 'no_privacy_policy',
    severity: 'high',
    gdprArticles: ['Article 13', 'Article 14'],
    detect: async (orgId: string) => {
      const count = await db.query.privacyPolicies.findMany({
        where: eq(privacyPolicies.organizationId, orgId),
      });
      return count.length === 0 ? [{ id: orgId, name: 'Organization' }] : [];
    },
    buildGap: (record: any) => ({
      entityType: 'policy',
      entityId: record.id,
      gapType: 'no_privacy_policy',
      title: `Missing Privacy Policy`,
      description: `No privacy policy has been created for the organization.`,
      severity: 'high',
      resolutionUrl: `/policies`,
    }),
  },

  // DSAR gaps
  {
    id: 'overdue_dsar',
    severity: 'critical',
    gdprArticles: ['Article 12'],
    detect: async (orgId: string) => {
      return db.query.dsarRequests.findMany({
        where: and(
          eq(dsarRequests.organizationId, orgId),
          not(eq(dsarRequests.status, 'completed')),
          lt(dsarRequests.deadlineAt, new Date())
        ),
      });
    },
    buildGap: (record: any) => ({
      entityType: 'dsar',
      entityId: record.id,
      gapType: 'overdue_dsar',
      title: `Overdue DSAR: ${record.referenceNumber}`,
      description: `This Data Subject Access Request has passed its deadline.`,
      severity: 'critical',
      resolutionUrl: `/dsar/${record.id}`,
    }),
  },
];
