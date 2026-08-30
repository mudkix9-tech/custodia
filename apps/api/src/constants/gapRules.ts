import { db } from '../db.js';
import { organizationVendors, vendors, complianceGaps, processingActivities, privacyPolicies, dsarRequests, breaches, trainingModules, trainingCompletions, clientProcessingActivities } from 'db';
import { and, eq, notInArray, isNull, lt, not, exists, sql } from 'drizzle-orm';
import { EU_EEA_COUNTRIES, isAdequateDestination } from './transferDestinations.js';
import { dpfConditionMet, resolveDpfStatusBatch } from '../lib/vendorAdequacy.js';

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
      resolutionUrl: `/vendors/${record.vendorId}`,
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
      resolutionUrl: `/vendors/${record.vendorId}`,
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
      resolutionUrl: `/vendors/${record.vendorId}`,
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
  {
    id: 'missing_dpa_special_category',
    severity: 'critical',
    gdprArticles: ['Article 9', 'Article 28'],
    detect: async (orgId: string) => {
      const specialCategoryKeywords = [
        'health', 'biometric', 'genetic', 'racial', 'ethnic', 'political', 
        'religious', 'union', 'sexual', 'criminal', 'medical', 'philosophical', 
        'trade_union', 'special'
      ];
      const records = await db.query.organizationVendors.findMany({
        where: and(
          eq(organizationVendors.organizationId, orgId),
          not(eq(organizationVendors.dpaStatus, 'signed'))
        ),
        with: { vendor: true }
      });
      return records.filter((r: any) => {
        const categories = r.dataCategoriesShared || [];
        return categories.some((cat: string) => 
          specialCategoryKeywords.some(keyword => cat.toLowerCase().includes(keyword))
        );
      });
    },
    buildGap: (record: any) => ({
      entityType: 'vendor',
      entityId: record.id,
      gapType: 'missing_dpa_special_category',
      title: `Special Category Data: Missing DPA for ${record.vendor?.name || 'Vendor'}`,
      description: `Vendor ${record.vendor?.name || 'Vendor'} processes special category data (Article 9) but has no signed DPA (Article 28).`,
      severity: 'critical',
      resolutionUrl: `/vendors/${record.vendorId}`,
    }),
  },
  {
    id: 'third_country_transfer_no_safeguards',
    severity: 'high',
    gdprArticles: ['Article 44', 'Article 46'],
    detect: async (orgId: string) => {
      const records = await db.query.organizationVendors.findMany({
        where: eq(organizationVendors.organizationId, orgId),
        with: { vendor: true }
      });
      const withCountry = records.filter((r: any) => r.vendor?.headquartersCountry);

      // VD-23. One query for the whole org rather than one per vendor: this rule
      // runs over every linked vendor in the nightly scan, and a per-row lookup
      // would put VD-8's full-table scan back one level up.
      const registry = await resolveDpfStatusBatch(db, withCountry.map((r: any) => r.vendor));

      return withCountry.filter((r: any) => {
        const country = r.vendor.headquartersCountry.toUpperCase();
        if (EU_EEA_COUNTRIES.includes(country)) return false;

        // Both halves are real as of migration 0050. The org half was a phantom
        // read for as long as this rule existed -- `organization_vendors` had no
        // such column -- so an organisation that had signed its own SCCs still
        // saw the Art. 44 gap reported against it (audit D26).
        const orgMechanisms = (r.transferMechanisms || []) as string[];

        // VD-23. Adequacy for a US importer is a fact about that importer, so it
        // is asked with the register's verdict in hand rather than assumed from
        // the country. A vendor whose certification has lapsed is no longer
        // adequate and falls through to the safeguard test below.
        const conditionMet = dpfConditionMet(r.vendor, registry.get(r.vendor)?.status, orgMechanisms);
        if (isAdequateDestination(country, { conditionMet })) return false;

        const mechanisms = [
          ...(r.vendor.transferMechanisms || []),
          ...orgMechanisms
        ].map((m: string) => m.toLowerCase());

        // `data_privacy_framework` is deliberately *not* in this list any more.
        // Whether the DPF covers this transfer is the adequacy question above,
        // and the register has already answered it; leaving the token here as
        // well would let a checkbox somebody ticked in 2024 outrank an inactive
        // listing published by the Department of Commerce last week.
        const hasSafeguard = mechanisms.some(m => 
          m.includes('scc') || 
          m.includes('standard_contractual_clauses') || 
          m.includes('bcr') || 
          m.includes('binding_corporate_rules') ||
          m.includes('adequacy_decision')
        );

        return !hasSafeguard;
      });
    },
    buildGap: (record: any) => ({
      entityType: 'vendor',
      entityId: record.id,
      gapType: 'third_country_transfer_no_safeguards',
      title: `Unsecured Third-Country Transfer: ${record.vendor?.name || 'Vendor'}`,
      description: record.vendor?.headquartersCountry === 'US'
        ? `Vendor ${record.vendor?.name || 'Vendor'} is in the United States and does not hold a current Data Privacy Framework certification, so the adequacy decision does not cover this transfer. No SCCs or BCRs are recorded either.`
        : `Vendor ${record.vendor?.name || 'Vendor'} is located in a non-adequate third country (${record.vendor?.headquartersCountry}) and has no documented safeguards (e.g. SCCs or BCRs).`,
      severity: 'high',
      resolutionUrl: `/vendors/${record.vendorId}`,
    }),
  },
  {
    id: 'dpa_missing_subprocessor_clause',
    severity: 'high',
    gdprArticles: ['Article 28(3)(d)'],
    detect: async (orgId: string) => {
      const list = await db.select({
        id: organizationVendors.id,
        vendorId: organizationVendors.vendorId,
        vendorName: vendors.name,
        dpaClauseCoverage: organizationVendors.dpaClauseCoverage
      })
      .from(organizationVendors)
      .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
      .where(and(
        eq(organizationVendors.organizationId, orgId),
        eq(organizationVendors.dpaStatus, 'signed')
      ));

      return list.filter((ov: any) => {
        const coverage = ov.dpaClauseCoverage || {};
        return !coverage.subProcessorRestrictions;
      });
    },
    buildGap: (record: any) => ({
      entityType: 'vendor',
      entityId: record.id,
      gapType: 'dpa_missing_subprocessor_clause',
      title: `Missing Sub-processor Clause: ${record.vendorName}`,
      description: `The Data Processing Agreement with ${record.vendorName} does not include the mandatory Article 28(3)(d) clause regulating sub-processor notification and restrictions.`,
      severity: 'high',
      resolutionUrl: `/vendors/${record.vendorId}`,
    }),
  },
  {
    id: 'dpa_incomplete_clauses',
    severity: 'medium',
    gdprArticles: ['Article 28(3)'],
    detect: async (orgId: string) => {
      const list = await db.select({
        id: organizationVendors.id,
        vendorId: organizationVendors.vendorId,
        vendorName: vendors.name,
        dpaClauseCoverage: organizationVendors.dpaClauseCoverage
      })
      .from(organizationVendors)
      .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
      .where(and(
        eq(organizationVendors.organizationId, orgId),
        eq(organizationVendors.dpaStatus, 'signed')
      ));

      const clauseKeys = [
        'documentedInstructions',
        'confidentiality',
        'securityMeasures',
        'subProcessorRestrictions',
        'dataSubjectRights',
        'securityBreachDpia',
        'deletionOnTermination',
        'auditRights'
      ];

      return list.filter((ov: any) => {
        const coverage = ov.dpaClauseCoverage || {};
        const coveredCount = clauseKeys.filter(k => !!(coverage as any)[k]).length;
        return coveredCount < 6;
      }).map((ov: any) => {
        const coverage = ov.dpaClauseCoverage || {};
        const coveredCount = clauseKeys.filter(k => !!(coverage as any)[k]).length;
        return {
          ...ov,
          coveredCount
        };
      });
    },
    buildGap: (record: any) => ({
      entityType: 'vendor',
      entityId: record.id,
      gapType: 'dpa_incomplete_clauses',
      title: `Incomplete DPA Clauses: ${record.vendorName}`,
      description: `The Data Processing Agreement with ${record.vendorName} covers only ${record.coveredCount}/8 required Article 28 clauses, which poses a medium compliance risk.`,
      severity: 'medium',
      resolutionUrl: `/vendors/${record.vendorId}`,
    }),
  },
];
