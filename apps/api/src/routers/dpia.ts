import { z } from 'zod';
import { router, protectedProcedure, requirePermission } from '../trpc.js';
import { orgEmbeddingsQueue } from '../lib/queue.js';
import { db } from '../db.js';
import { dpias, dpiaRisks, dpiaMeasures, dpiaVersions, dpiaScreenings, auditLogs, processingActivities, processingRecipients, organizationVendors, vendors, complianceGaps, organizations } from 'db';
import { eq, and, desc, inArray, lt, isNull, ilike, or, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { assertOwned, assertParentOwned } from '../lib/tenancy.js';
import { syncDpiaGaps } from '../lib/dpiaGapSync.js';
import { enforceLimit } from '../lib/billing.js';
import {
  DPIA_TEMPLATES,
  findDpiaTemplate,
  riskBand,
  aggregateRiskLevels,
} from '../lib/dpiaTemplates.js';
import { contentHash } from '../lib/assessments.js';
import {
  DPIA_STATUSES,
  DPIA_RISK_CATEGORIES,
  DPIA_HARMS,
  DPIA_MEASURE_TYPES,
  DPIA_MEASURE_EFFECTIVENESS,
  DPO_OPINION_OUTCOMES,
  DPIA_SIGN_OFF_DECISIONS,
  DPIA_CONSULTATION_METHODS,
  PRIOR_CONSULTATION_STATUSES,
  RISK_SCALE,
} from '../constants/assessmentVocabularies.js';
import { nextReviewFrom } from '../lib/ropaLifecycle.js';

const checkOrgContext = (user: any) => {
  if (!user.orgId) throw new TRPCError({ code: 'FORBIDDEN', message: 'No organization context' });
};

const dpiaResidualRiskSchema = z.object({
  id: z.string().uuid(),
  description: z.string(),
  riskCategory: z.enum(['confidentiality', 'integrity', 'availability', 'unlawful_processing', 'discrimination', 'other']),
  likelihood: z.enum(['low', 'medium', 'high']),
  severity: z.enum(['low', 'medium', 'high']),
  residualRiskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  relatedVendorId: z.string().uuid().optional().nullable(),
  relatedProcessingActivityId: z.string().uuid().optional().nullable(),
  mitigationRequired: z.boolean(),
  mitigationDescription: z.string().optional().nullable(),
  mitigationOwner: z.string().optional().nullable(),
  mitigationDueDate: z.string().optional().nullable(),
  mitigationStatus: z.enum(['not_started', 'in_progress', 'completed']),
  alreadyReflectedInBaseScore: z.boolean().optional().nullable(),
  // 'high_risk_flag' is written by the DPIA tab when it auto-documents a high or
  // critical risk vendor. It was missing here, so a DPIA containing one of those
  // rows failed validation on *every* subsequent save, not just on creation.
  prePopulatedType: z.enum(['missing_dpa', 'clause_gaps', 'missing_certs', 'high_risk_flag']).optional().nullable(),
});

/**
 * F57. What a DPIA form may write.
 *
 * `z.record(z.any())` spread into `.set()` was the same mass-assignment hole D2
 * was in the ROPA router: ownership of the row was checked and the payload was
 * not, so anyone with `ropa:edit` could rewrite `organization_id`, `approved_by`,
 * `signed_off_at` or `created_at`. The sign-off columns are deliberately absent —
 * they move through `signOff`, `recordDpoOpinion` and `recordConsultation`, each
 * of which checks something first.
 */
const dpiaUpdateSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(8000).nullish(),
  processingActivityIds: z.array(z.string().uuid()).max(50),

  processingDescription: z.string().max(20000).nullish(),
  purposes: z.string().max(8000).nullish(),
  scopeDescription: z.string().max(8000).nullish(),
  contextDescription: z.string().max(8000).nullish(),
  legitimateInterestPursued: z.string().max(8000).nullish(),
  dataFlowDescription: z.string().max(8000).nullish(),
  necessityAssessment: z.string().max(20000).nullish(),
  proportionalityAssessment: z.string().max(20000).nullish(),

  status: z.enum(DPIA_STATUSES),
  ownerId: z.string().uuid().nullish(),
  reviewCadenceMonths: z.number().int().min(0).max(60).nullish(),
  nextReviewAt: z.coerce.date().nullish(),

  priorConsultationStatus: z.enum(PRIOR_CONSULTATION_STATUSES).nullish(),
  priorConsultationAuthority: z.string().max(120).nullish(),
  priorConsultationSubmittedAt: z.coerce.date().nullish(),
  priorConsultationReference: z.string().max(120).nullish(),
  priorConsultationResponse: z.string().max(8000).nullish(),
  priorConsultationRespondedAt: z.coerce.date().nullish(),
}).partial();

/** The half of a risk that is not the two axes. */
const dpiaRiskDetailSchema = z.object({
  riskCategory: z.enum(DPIA_RISK_CATEGORIES).nullish(),
  harms: z.array(z.enum(DPIA_HARMS)).max(12).optional(),
  affectedSubjects: z.string().max(2000).nullish(),
  sourceOfRisk: z.string().max(2000).nullish(),
  residualLikelihood: z.number().int().min(1).max(5).nullish(),
  residualSeverity: z.number().int().min(1).max(5).nullish(),
}).partial();

/**
 * F57. Keep the DPIA's two aggregate levels in step with its risks.
 *
 * `overall_risk_level` and `residual_risk_level` are denormalised — the register
 * reads them, the gap scanner reads them, and the Art. 36 flag is derived from
 * the second. Nothing recomputed them when a risk was added, edited or scored, so
 * a DPIA that had grown a critical risk still reported whatever level was typed
 * into it on the day it was created.
 *
 * Called at the end of every mutation that can move a risk, in the same shape
 * `refreshCompleteness` uses in the ROPA router and for the same reason.
 */
async function refreshDpiaRiskLevels(dbc: any, dpiaId: string, orgId: string): Promise<void> {
  const risks = await dbc.select().from(dpiaRisks).where(eq(dpiaRisks.dpiaId, dpiaId));
  const levels = aggregateRiskLevels(risks as any[]);

  await dbc.update(dpias)
    .set({
      overallRiskLevel: levels.overall,
      residualRiskLevel: levels.residual,
      requiresPriorConsultation: levels.requiresPriorConsultation,
    })
    .where(and(eq(dpias.id, dpiaId), eq(dpias.organizationId, orgId)));
}

/**
 * F57/I90. A point-in-time copy of the DPIA and its risk register, hashed.
 *
 * The version number is allocated from what is already stored rather than from
 * `dpias.version`, which predates this table; the unique constraint on
 * (dpia, version) is the backstop that turns two concurrent snapshots into a
 * conflict rather than two different documents both calling themselves v3.
 */
async function snapshotDpia(
  dbc: any,
  dpia: any,
  risks: any[],
  opts: { reason: string; note?: string | null; userId: string },
): Promise<any> {
  const riskIds = risks.map((r) => r.id);
  const measures = riskIds.length
    ? await dbc.select().from(dpiaMeasures).where(inArray(dpiaMeasures.dpiaRiskId, riskIds))
    : [];

  const snapshot = {
    takenAt: new Date().toISOString(),
    dpia,
    risks: risks.map((risk) => ({
      ...risk,
      measures: (measures as any[]).filter((m) => m.dpiaRiskId === risk.id),
    })),
  };

  const [{ value: highest } = { value: 0 }] = await dbc
    .select({ value: sql<number>`coalesce(max(${dpiaVersions.version}), 0)` })
    .from(dpiaVersions)
    .where(eq(dpiaVersions.dpiaId, dpia.id));

  const version = Number(highest ?? 0) + 1;
  const [row] = await dbc.insert(dpiaVersions).values({
    organizationId: dpia.organizationId,
    dpiaId: dpia.id,
    version,
    reason: opts.reason,
    note: opts.note ?? null,
    snapshot: snapshot as any,
    contentHash: contentHash(snapshot),
    status: dpia.status,
    residualRiskLevel: dpia.residualRiskLevel,
    createdBy: opts.userId,
  }).returning();

  await dbc.update(dpias)
    .set({ version })
    .where(and(eq(dpias.id, dpia.id), eq(dpias.organizationId, dpia.organizationId)));

  return row;
}

export const dpiaRouter = router({
  list: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .query(async ({ ctx }) => {
      checkOrgContext(ctx.user);
      return ctx.db.select()
        .from(dpias)
        .where(eq(dpias.organizationId, ctx.user!.orgId))
        .orderBy(desc(dpias.updatedAt));
    }),

  get: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const dpia = await ctx.db.query.dpias.findFirst({
        where: and(
          eq(dpias.id, input.id),
          eq(dpias.organizationId, ctx.user!.orgId)
        ),
      });

      if (!dpia) throw new TRPCError({ code: 'NOT_FOUND' });
      return dpia;
    }),

  create: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      processingActivityIds: z.array(z.string()).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      await enforceLimit(ctx.db, ctx.user!.orgId, 'dpia', 1);
      
      const prePopulatedRisks: any[] = [];
      
      if (input.processingActivityIds.length > 0) {
        const linkedRecipients = await ctx.db.select()
          .from(processingRecipients)
          .where(and(
            inArray(processingRecipients.processingActivityId, input.processingActivityIds),
            eq(processingRecipients.recipientType, 'vendor')
          ));
        
        if (linkedRecipients.length > 0) {
          const orgVendorIds = linkedRecipients.map((r: any) => r.vendorId).filter(Boolean) as string[];
          if (orgVendorIds.length > 0) {
            const vendorsData = await ctx.db.select({
              orgVendor: organizationVendors,
              vendor: vendors
            })
            .from(organizationVendors)
            .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
            .where(and(
              inArray(organizationVendors.id, orgVendorIds),
              eq(organizationVendors.organizationId, ctx.user!.orgId)
            ));

            const { randomUUID } = await import('crypto');

            for (const item of vendorsData) {
              const { orgVendor, vendor } = item;
              // organization_vendors has no name column, so this always resolved
              // to vendor.name anyway.
              const vendorName = vendor.name;
              const activityId = linkedRecipients.find((r: any) => r.vendorId === orgVendor.id)?.processingActivityId;

              // 1. Missing DPA Risk
              if (orgVendor.dpaStatus !== 'signed' && orgVendor.dpaStatus !== 'draft') {
                prePopulatedRisks.push({
                  id: randomUUID(),
                  description: `Missing DPA for vendor: ${vendorName}`,
                  riskCategory: 'unlawful_processing',
                  likelihood: orgVendor.riskScore && orgVendor.riskScore > 50 ? 'high' : 'medium',
                  severity: 'high',
                  residualRiskLevel: orgVendor.riskScore && orgVendor.riskScore > 50 ? 'critical' : 'high',
                  relatedVendorId: orgVendor.id,
                  relatedProcessingActivityId: activityId || null,
                  mitigationRequired: true,
                  mitigationStatus: 'not_started',
                  mitigationDescription: `Execute and sign a formal Data Processing Agreement (DPA) with ${vendorName} satisfying GDPR Article 28 requirements.`,
                  alreadyReflectedInBaseScore: true,
                  prePopulatedType: 'missing_dpa'
                });
              }

              // 2. DPA Clause Gaps Risk
              if (orgVendor.dpaStatus === 'signed') {
                const coverage = orgVendor.dpaClauseCoverage || {};
                const clauseLabels: Record<string, string> = {
                  documentedInstructions: 'Documented Instructions',
                  confidentiality: 'Confidentiality Commitment',
                  securityMeasures: 'Security Measures',
                  subProcessorRestrictions: 'Sub-processor Restrictions',
                  dataSubjectRights: 'Data Subject Rights Assistance',
                  securityBreachDpia: 'Breach Notification Assistance',
                  deletionOnTermination: 'Deletion on Termination',
                  auditRights: 'Audit Rights'
                };
                const missing = Object.keys(clauseLabels).filter(k => !(coverage as any)[k]);
                if (missing.length > 0) {
                  prePopulatedRisks.push({
                    id: randomUUID(),
                    description: `DPA clause coverage gaps for vendor: ${vendorName}. Missing clauses: ${missing.map(k => clauseLabels[k]).join(', ')}`,
                    riskCategory: 'unlawful_processing',
                    likelihood: 'medium',
                    severity: 'medium',
                    residualRiskLevel: 'medium',
                    relatedVendorId: orgVendor.id,
                    relatedProcessingActivityId: activityId || null,
                    mitigationRequired: true,
                    mitigationStatus: 'not_started',
                    mitigationDescription: `Amend DPA with ${vendorName} to include missing Article 28(3) clauses.`,
                    alreadyReflectedInBaseScore: true,
                    prePopulatedType: 'clause_gaps'
                  });
                }
              }

              // 3. Missing key security certifications
              const certsList = [
                ...(orgVendor.certifications || []),
                ...(vendor.securityCertifications || [])
              ].map(c => c.toLowerCase());
              const hasSoc2 = certsList.some(c => c.includes('soc2') || c.includes('soc 2'));
              const hasIso = certsList.some(c => c.includes('iso27001') || c.includes('iso 27001') || c.includes('iso-27001'));
              if (!hasSoc2 || !hasIso) {
                const missingCerts = [];
                if (!hasSoc2) missingCerts.push('SOC 2');
                if (!hasIso) missingCerts.push('ISO 27001');
                prePopulatedRisks.push({
                  id: randomUUID(),
                  description: `Missing key security certifications (${missingCerts.join(' / ')}) for vendor: ${vendorName}`,
                  riskCategory: 'other',
                  likelihood: 'medium',
                  severity: 'medium',
                  residualRiskLevel: 'medium',
                  relatedVendorId: orgVendor.id,
                  relatedProcessingActivityId: activityId || null,
                  mitigationRequired: true,
                  mitigationStatus: 'not_started',
                  mitigationDescription: `Request a SOC 2 Type II report / ISO 27001 certificate from ${vendorName} or run a comprehensive security assessment.`,
                  alreadyReflectedInBaseScore: true,
                  prePopulatedType: 'missing_certs'
                });
              }
            }
          }
        }
      }

      const [newDpia] = await ctx.db.insert(dpias).values({
        organizationId: ctx.user!.orgId,
        title: input.title,
        description: input.description,
        processingActivityIds: input.processingActivityIds,
        residualRisks: prePopulatedRisks,
      }).returning();

      if (!newDpia) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      await orgEmbeddingsQueue.add('embed-dpia', {
        orgId: ctx.user!.orgId,
        entityType: 'dpia',
        entityId: newDpia.id,
        action: 'upsert'
      });

      await syncDpiaGaps(newDpia.id);

      return newDpia;
    }),

  update: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({
      id: z.string().uuid(),
      data: dpiaUpdateSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);

      const [updated] = await ctx.db.update(dpias)
        .set({ ...input.data, updatedAt: new Date() })
        .where(and(eq(dpias.id, input.id), eq(dpias.organizationId, ctx.user!.orgId)))
        .returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });

      await orgEmbeddingsQueue.add('embed-dpia', {
        orgId: ctx.user!.orgId,
        entityType: 'dpia',
        entityId: updated.id,
        action: 'upsert'
      });

      await syncDpiaGaps(updated.id);

      return updated;
    }),

  updateResidualRisks: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({
      dpiaId: z.string().uuid(),
      residualRisks: z.array(dpiaResidualRiskSchema),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);

      const [updated] = await ctx.db.update(dpias)
        .set({ 
          residualRisks: input.residualRisks, 
          updatedAt: new Date() 
        })
        .where(and(
          eq(dpias.id, input.dpiaId),
          eq(dpias.organizationId, ctx.user!.orgId)
        ))
        .returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'DPIA not found' });
      }

      await orgEmbeddingsQueue.add('embed-dpia', {
        orgId: ctx.user!.orgId,
        entityType: 'dpia',
        entityId: updated.id,
        action: 'upsert'
      });

      await syncDpiaGaps(updated.id);

      return updated;
    }),

  updateMitigationStatus: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({
      dpiaId: z.string().uuid(),
      riskId: z.string().uuid(),
      mitigationStatus: z.enum(['not_started', 'in_progress', 'completed']),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      
      const { sql } = await import('drizzle-orm');

      const [updated] = await ctx.db.update(dpias)
        .set({
          residualRisks: sql`COALESCE((
            SELECT jsonb_agg(
              CASE 
                WHEN elem->>'id' = ${input.riskId} 
                THEN elem || jsonb_build_object('mitigationStatus', ${input.mitigationStatus}::text)
                ELSE elem 
              END
            )
            FROM jsonb_array_elements(COALESCE(${dpias.residualRisks}, '[]'::jsonb)) AS elem
          ), '[]'::jsonb)`,
          updatedAt: new Date()
        })
        .where(and(
          eq(dpias.id, input.dpiaId),
          eq(dpias.organizationId, ctx.user!.orgId)
        ))
        .returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'DPIA not found' });
      }

      await orgEmbeddingsQueue.add('embed-dpia', {
        orgId: ctx.user!.orgId,
        entityType: 'dpia',
        entityId: updated.id,
        action: 'upsert'
      });

      await syncDpiaGaps(updated.id);

      return updated;
    }),

  /**
   * F57. The template library.
   *
   * Content that ships with the product, not data a customer owns — see
   * `lib/dpiaTemplates.ts` for why it is code. A template is a starting position:
   * the risks that apply to this kind of processing and the measures normally
   * offered against them, so a DPIA opens as a document to argue with rather than
   * as a blank page.
   */
  templates: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .query(() =>
      DPIA_TEMPLATES.map((t) => ({
        id: t.id,
        title: t.title,
        summary: t.summary,
        riskCount: t.risks.length,
        typicalCriteria: t.typicalCriteria,
      })),
    ),

  /**
   * F57. Open a DPIA from a template, or from a screening that concluded one was
   * required.
   *
   * Separate from `create` because it does something `create` must not: it writes
   * risks and measures. `create` already pre-populates risks from vendor findings,
   * and stacking template risks on top of that in one procedure would produce a
   * DPIA nobody can tell apart from one somebody wrote.
   */
  createFromTemplate: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({
      templateId: z.string().max(60),
      title: z.string().min(1).max(255),
      processingActivityIds: z.array(z.string().uuid()).max(50).default([]),
      screeningId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      await enforceLimit(ctx.db, ctx.user!.orgId, 'dpia', 1);

      const template = findDpiaTemplate(input.templateId);
      if (!template) throw new TRPCError({ code: 'NOT_FOUND', message: 'Unknown template' });

      // Client-supplied foreign keys, proved. Both would otherwise let a caller
      // attach another tenant's activity or screening to their own DPIA — the
      // class the tenancy audit reported 22 of before it counted foreign keys.
      if (input.processingActivityIds.length > 0) {
        const owned = await ctx.db.select({ id: processingActivities.id })
          .from(processingActivities)
          .where(and(
            inArray(processingActivities.id, input.processingActivityIds),
            eq(processingActivities.organizationId, ctx.user!.orgId),
          ));
        if (owned.length !== input.processingActivityIds.length) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found' });
        }
      }
      if (input.screeningId) {
        await assertParentOwned(ctx.db, dpiaScreenings, input.screeningId, ctx.user!.orgId, 'Screening');
      }

      const [dpia] = await ctx.db.insert(dpias).values({
        organizationId: ctx.user!.orgId,
        title: input.title,
        description: template.summary,
        processingActivityIds: input.processingActivityIds,
        processingDescription: template.processingDescription,
        scopeDescription: template.scopeDescription,
        contextDescription: template.contextDescription,
        necessityAssessment: template.necessityAssessment,
        proportionalityAssessment: template.proportionalityAssessment,
        templateId: template.id,
        screeningId: input.screeningId ?? null,
        status: 'draft',
        ownerId: ctx.user!.id,
        createdBy: ctx.user!.id,
      }).returning();
      if (!dpia) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      for (const risk of template.risks) {
        const [row] = await ctx.db.insert(dpiaRisks).values({
          dpiaId: dpia.id,
          description: risk.description,
          riskCategory: risk.riskCategory,
          harms: risk.harms,
          likelihood: risk.likelihood,
          severity: risk.severity,
          initialRiskScore: risk.likelihood * risk.severity,
          affectedSubjects: risk.affectedSubjects,
          sourceOfRisk: risk.sourceOfRisk,
        }).returning();
        if (!row) continue;

        for (const measure of risk.measures) {
          await ctx.db.insert(dpiaMeasures).values({
            dpiaRiskId: row.id,
            description: measure.description,
            measureType: measure.measureType,
            status: 'planned',
          });
        }
      }

      await refreshDpiaRiskLevels(ctx.db, dpia.id, ctx.user!.orgId);

      if (input.screeningId) {
        await ctx.db.update(dpiaScreenings)
          .set({ dpiaId: dpia.id, updatedAt: new Date() })
          .where(and(
            eq(dpiaScreenings.id, input.screeningId),
            eq(dpiaScreenings.organizationId, ctx.user!.orgId),
          ));
      }

      // Every linked activity points back, so the register's DPIA filter and the
      // editor's DPIA tab both find it without a second lookup.
      if (input.processingActivityIds.length > 0) {
        await ctx.db.update(processingActivities)
          .set({ dpiaId: dpia.id, requiresDpia: true })
          .where(and(
            inArray(processingActivities.id, input.processingActivityIds),
            eq(processingActivities.organizationId, ctx.user!.orgId),
          ));
      }

      await orgEmbeddingsQueue.add('embed-dpia', {
        orgId: ctx.user!.orgId,
        entityType: 'dpia',
        entityId: dpia.id,
        action: 'upsert',
      });
      await syncDpiaGaps(dpia.id);

      return dpia;
    }),

  /**
   * F57. The whole assessment in one read — the DPIA, its risks, their measures,
   * the linked activities and the version history.
   *
   * `get` returns the row alone, which is right for the register's DPIA tab and
   * useless for a module with its own route: the editor would otherwise open with
   * five round trips before it can render a risk matrix.
   */
  full: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const dpia = await assertParentOwned(ctx.db, dpias, input.id, ctx.user!.orgId, 'DPIA');

      const risks = await ctx.db.select().from(dpiaRisks)
        .where(eq(dpiaRisks.dpiaId, input.id))
        .orderBy(desc(dpiaRisks.initialRiskScore));

      const riskIds = (risks as any[]).map((r) => r.id);
      const measures = riskIds.length
        ? await ctx.db.select().from(dpiaMeasures).where(inArray(dpiaMeasures.dpiaRiskId, riskIds))
        : [];

      const activityIds = Array.isArray(dpia.processingActivityIds)
        ? (dpia.processingActivityIds as string[])
        : [];
      const activities = activityIds.length
        ? await ctx.db.select({
            id: processingActivities.id,
            name: processingActivities.name,
            lawfulBasis: processingActivities.lawfulBasis,
            status: processingActivities.status,
          }).from(processingActivities)
            .where(and(
              inArray(processingActivities.id, activityIds),
              eq(processingActivities.organizationId, ctx.user!.orgId),
            ))
        : [];

      const versions = await ctx.db.select({
        id: dpiaVersions.id,
        version: dpiaVersions.version,
        reason: dpiaVersions.reason,
        note: dpiaVersions.note,
        contentHash: dpiaVersions.contentHash,
        residualRiskLevel: dpiaVersions.residualRiskLevel,
        createdAt: dpiaVersions.createdAt,
        createdBy: dpiaVersions.createdBy,
      }).from(dpiaVersions)
        .where(and(
          eq(dpiaVersions.dpiaId, input.id),
          eq(dpiaVersions.organizationId, ctx.user!.orgId),
        ))
        .orderBy(desc(dpiaVersions.version));

      const withMeasures = (risks as any[]).map((risk) => ({
        ...risk,
        band: riskBand(risk.likelihood, risk.severity),
        residualBand: riskBand(risk.residualLikelihood, risk.residualSeverity),
        measures: (measures as any[]).filter((m) => m.dpiaRiskId === risk.id),
      }));

      return {
        dpia,
        risks: withMeasures,
        activities,
        versions,
        levels: aggregateRiskLevels(risks as any[]),
        template: findDpiaTemplate(dpia.templateId),
      };
    }),

  /**
   * F57. The DPO's advice under Art. 35(2).
   *
   * Its own procedure rather than three fields on `update`, because the thing
   * being recorded is an *event*: a named person gave an opinion on a date. Left
   * to a generic update it would be overwritten by the next autosave of the form
   * around it, and the date would move with it.
   *
   * `dpoAdviceFollowed = false` requires a reason. The controller decides, not the
   * DPO — that is what Art. 39 means — but departing from the advice without
   * recording why is the gap an authority looks for first.
   */
  recordDpoOpinion: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({
      id: z.string().uuid(),
      opinion: z.string().trim().min(10).max(8000),
      outcome: z.enum(DPO_OPINION_OUTCOMES),
      adviceFollowed: z.boolean().nullish(),
      departureReason: z.string().max(4000).nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertParentOwned(ctx.db, dpias, input.id, ctx.user!.orgId, 'DPIA');

      if (input.adviceFollowed === false && !input.departureReason?.trim()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Departing from the DPO’s advice has to say why.',
        });
      }

      const [updated] = await ctx.db.update(dpias)
        .set({
          dpoConsulted: true,
          dpoOpinion: input.opinion,
          dpoOpinionOutcome: input.outcome,
          dpoOpinionBy: ctx.user!.id,
          dpoOpinionAt: new Date(),
          dpoAdviceFollowed: input.adviceFollowed ?? null,
          dpoAdviceDepartureReason: input.departureReason ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(dpias.id, input.id), eq(dpias.organizationId, ctx.user!.orgId)))
        .returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });

      await syncDpiaGaps(updated.id);
      return updated;
    }),

  /**
   * F57. Art. 35(9) — the views of data subjects, sought or reasoned away.
   *
   * "Where appropriate" is a judgement, and both answers are legitimate. What is
   * not legitimate is silence, so the procedure refuses a `sought: false` with no
   * reason rather than storing two nulls that read as "nobody has looked at this".
   */
  recordConsultation: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({
      id: z.string().uuid(),
      sought: z.boolean(),
      method: z.enum(DPIA_CONSULTATION_METHODS).nullish(),
      summary: z.string().max(8000).nullish(),
      notSoughtReason: z.string().max(4000).nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertParentOwned(ctx.db, dpias, input.id, ctx.user!.orgId, 'DPIA');

      if (input.sought && !input.summary?.trim()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Record what the consultation found.' });
      }
      if (!input.sought && !input.notSoughtReason?.trim()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Record why the views of data subjects were not sought.' });
      }

      const [updated] = await ctx.db.update(dpias)
        .set({
          consultationSought: input.sought,
          consultationMethod: input.sought ? input.method ?? null : null,
          consultationSummary: input.sought ? input.summary ?? null : null,
          consultationNotSoughtReason: input.sought ? null : input.notSoughtReason ?? null,
          consultationAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(dpias.id, input.id), eq(dpias.organizationId, ctx.user!.orgId)))
        .returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });

      await syncDpiaGaps(updated.id);
      return updated;
    }),

  /**
   * F57. Sign-off, with a snapshot and a hash.
   *
   * The refusal list is the point. A DPIA can be signed off with unmitigated risk
   * — that is what `proceed_with_conditions` is for — but not without the three
   * things Art. 35 actually requires: a description of the processing, a risk
   * assessment, and the DPO's advice where a DPO is designated. Signing off a
   * document missing those is signing off a document that does not exist yet.
   *
   * The snapshot is I90's bargain applied here: a sign-off nobody can prove was
   * not edited afterwards is not a sign-off.
   */
  signOff: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({
      id: z.string().uuid(),
      decision: z.enum(DPIA_SIGN_OFF_DECISIONS),
      conditions: z.string().max(4000).nullish(),
      note: z.string().max(500).nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const dpia = await assertParentOwned(ctx.db, dpias, input.id, ctx.user!.orgId, 'DPIA');

      const risks = await ctx.db.select().from(dpiaRisks).where(eq(dpiaRisks.dpiaId, input.id));

      const missing: string[] = [];
      if (!dpia.processingDescription?.trim()) missing.push('processing description (Art. 35(7)(a))');
      if (!dpia.necessityAssessment?.trim()) missing.push('necessity and proportionality (Art. 35(7)(b))');
      if ((risks as any[]).length === 0) missing.push('risks to rights and freedoms (Art. 35(7)(c))');

      const [org] = await ctx.db.select({ hasDpo: organizations.hasDpo }).from(organizations)
        .where(eq(organizations.id, ctx.user!.orgId));
      if (org?.hasDpo && !dpia.dpoConsulted) missing.push('DPO advice (Art. 35(2))');

      if (input.decision !== 'do_not_proceed' && missing.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `The assessment is missing: ${missing.join('; ')}.`,
        });
      }

      if (input.decision === 'proceed_with_conditions' && !input.conditions?.trim()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Name the conditions the processing may proceed under.' });
      }

      const levels = aggregateRiskLevels(risks as any[]);
      const now = new Date();

      const [updated] = await ctx.db.update(dpias)
        .set({
          signOffDecision: input.decision,
          signOffConditions: input.conditions ?? null,
          signedOffBy: ctx.user!.id,
          signedOffAt: now,
          status: input.decision === 'do_not_proceed' ? 'superseded' : 'signed_off',
          approvedBy: ctx.user!.id,
          approvedAt: now,
          lastReviewedAt: now,
          nextReviewAt: nextReviewFrom(now, dpia.reviewCadenceMonths || 12),
          overallRiskLevel: levels.overall,
          residualRiskLevel: levels.residual,
          requiresPriorConsultation: levels.requiresPriorConsultation,
          priorConsultationStatus: levels.requiresPriorConsultation
            ? dpia.priorConsultationStatus ?? 'required'
            : dpia.priorConsultationStatus ?? 'not_required',
          updatedAt: now,
        })
        .where(and(eq(dpias.id, input.id), eq(dpias.organizationId, ctx.user!.orgId)))
        .returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });

      await snapshotDpia(ctx.db, updated, risks as any[], {
        reason: 'signed_off',
        note: input.note ?? null,
        userId: ctx.user!.id,
      });

      await syncDpiaGaps(updated.id);
      return { dpia: updated, levels };
    }),

  /** F57. Versions, and the hash that proves one has not moved since. */
  versions: router({
    list: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ dpiaId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        await assertParentOwned(ctx.db, dpias, input.dpiaId, ctx.user!.orgId, 'DPIA');
        return ctx.db.select().from(dpiaVersions)
          .where(and(
            eq(dpiaVersions.dpiaId, input.dpiaId),
            eq(dpiaVersions.organizationId, ctx.user!.orgId),
          ))
          .orderBy(desc(dpiaVersions.version));
      }),

    create: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({ dpiaId: z.string().uuid(), note: z.string().max(500).nullish() }))
      .mutation(async ({ ctx, input }) => {
        const dpia = await assertParentOwned(ctx.db, dpias, input.dpiaId, ctx.user!.orgId, 'DPIA');
        const risks = await ctx.db.select().from(dpiaRisks).where(eq(dpiaRisks.dpiaId, input.dpiaId));
        return snapshotDpia(ctx.db, dpia, risks as any[], {
          reason: 'manual',
          note: input.note ?? null,
          userId: ctx.user!.id,
        });
      }),

    /**
     * I90. Recompute the digest and say whether it still matches.
     *
     * The comparison is against the *stored snapshot*, not against the live DPIA:
     * a version that has drifted from the document means the snapshot itself was
     * tampered with, which is the only thing a hash can actually prove. Whether
     * the live record has since been edited is what the version list is for.
     */
    verify: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const version = await assertOwned(ctx.db, {
          table: dpiaVersions,
          id: input.id,
          orgId: ctx.user!.orgId,
          label: 'Version',
        });

        const recomputed = contentHash(version.snapshot);
        return {
          version: version.version,
          storedHash: version.contentHash,
          recomputedHash: recomputed,
          // A version taken before 0048 has no hash. "Cannot be verified" and
          // "fails verification" are opposite findings and the caller has to be
          // able to tell them apart.
          verifiable: !!version.contentHash,
          intact: !!version.contentHash && version.contentHash === recomputed,
        };
      }),
  }),

  risks: router({
    list: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ dpiaId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        await assertParentOwned(ctx.db, dpias, input.dpiaId, ctx.user!.orgId, 'DPIA');
        return ctx.db.select().from(dpiaRisks).where(eq(dpiaRisks.dpiaId, input.dpiaId));
      }),
      
    create: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        dpiaId: z.string().uuid(),
        description: z.string().min(1),
        likelihood: z.number().min(1).max(5).optional(),
        severity: z.number().min(1).max(5).optional(),
      }).merge(dpiaRiskDetailSchema))
      .mutation(async ({ ctx, input }) => {
        // The sibling list/update/delete all prove ownership; this one did not,
        // so a caller could hang a risk off any tenant's DPIA.
        await assertParentOwned(ctx.db, dpias, input.dpiaId, ctx.user!.orgId, 'DPIA');

        const initialRiskScore = (input.likelihood && input.severity) ? input.likelihood * input.severity : null;
        const residualRiskScore = (input.residualLikelihood && input.residualSeverity)
          ? input.residualLikelihood * input.residualSeverity
          : null;

        const [inserted] = await ctx.db.insert(dpiaRisks).values({
          ...input,
          initialRiskScore,
          residualRiskScore,
        }).returning();
        if (!inserted) throw new TRPCError({ code: 'NOT_FOUND' });

        await refreshDpiaRiskLevels(ctx.db, input.dpiaId, ctx.user!.orgId);

        await orgEmbeddingsQueue.add('embed-dpia', {
          orgId: ctx.user!.orgId,
          entityType: 'dpia',
          entityId: inserted.dpiaId,
          action: 'upsert'
        });

        return inserted;
      }),
      
    update: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        id: z.string().uuid(),
        // Explicit, like the ropa mutations: `z.record(z.any())` spread into .set()
        // let a caller with ropa:edit rewrite dpiaId and move a risk onto another
        // organisation's DPIA, which the ownership check above cannot see.
        data: z.object({
          description: z.string().min(1),
          likelihood: z.number().int().min(1).max(5),
          severity: z.number().int().max(5).min(1),
        }).merge(dpiaRiskDetailSchema).partial(),
      }))
      .mutation(async ({ ctx, input }) => {
        const existing = await assertOwned(ctx.db, {
          table: dpiaRisks,
          id: input.id,
          orgId: ctx.user!.orgId,
          label: 'Risk',
          via: [{ table: dpias, on: eq(dpiaRisks.dpiaId, dpias.id) }],
        });

        // The comment here promised this and the code never did it, so a risk edited
        // from L3/S3 to L5/S5 kept a score of 9 — and the score is what the grid
        // colours and what the DPIA is read on.
        const likelihood = input.data.likelihood ?? existing.likelihood;
        const severity = input.data.severity ?? existing.severity;
        // The residual pair follows the same rule as the initial one, and for the
        // same reason: the score is what the matrix colours and what Art. 36 is
        // read off, so a stale one is a wrong answer wearing a right one's badge.
        const residualLikelihood = input.data.residualLikelihood ?? existing.residualLikelihood;
        const residualSeverity = input.data.residualSeverity ?? existing.residualSeverity;
        const payload = {
          ...input.data,
          initialRiskScore: (likelihood && severity) ? likelihood * severity : null,
          residualRiskScore: (residualLikelihood && residualSeverity) ? residualLikelihood * residualSeverity : null,
          updatedAt: new Date(),
        };

        const [updated] = await ctx.db.update(dpiaRisks)
          .set(payload)
          .where(eq(dpiaRisks.id, input.id))
          .returning();
        if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });

        await refreshDpiaRiskLevels(ctx.db, updated.dpiaId, ctx.user!.orgId);

        await orgEmbeddingsQueue.add('embed-dpia', {
          orgId: ctx.user!.orgId,
          entityType: 'dpia',
          entityId: updated.dpiaId,
          action: 'upsert'
        });

        return updated;
      }),
      
    delete: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await assertOwned(ctx.db, {
          table: dpiaRisks,
          id: input.id,
          orgId: ctx.user!.orgId,
          label: 'Risk',
          via: [{ table: dpias, on: eq(dpiaRisks.dpiaId, dpias.id) }],
        });

        const [deleted] = await ctx.db.delete(dpiaRisks).where(eq(dpiaRisks.id, input.id)).returning();

        if (deleted) {
          await refreshDpiaRiskLevels(ctx.db, deleted.dpiaId, ctx.user!.orgId);
          await orgEmbeddingsQueue.add('embed-dpia', {
            orgId: ctx.user!.orgId,
            entityType: 'dpia',
            entityId: deleted.dpiaId,
            action: 'upsert'
          });
        }

        return deleted;
      })
  }),

  measures: router({
    list: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ dpiaRiskId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        await assertOwned(ctx.db, {
          table: dpiaRisks,
          id: input.dpiaRiskId,
          orgId: ctx.user!.orgId,
          label: 'Risk',
          via: [{ table: dpias, on: eq(dpiaRisks.dpiaId, dpias.id) }],
        });
        return ctx.db.select().from(dpiaMeasures).where(eq(dpiaMeasures.dpiaRiskId, input.dpiaRiskId));
      }),
      
    create: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        dpiaRiskId: z.string().uuid(),
        description: z.string().min(1),
        status: z.string().default('planned'),
        measureType: z.enum(DPIA_MEASURE_TYPES).optional(),
        ownerId: z.string().uuid().nullish(),
        dueDate: z.coerce.date().nullish(),
        effectiveness: z.enum(DPIA_MEASURE_EFFECTIVENESS).optional(),
        evidence: z.string().max(4000).nullish(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertOwned(ctx.db, {
          table: dpiaRisks,
          id: input.dpiaRiskId,
          orgId: ctx.user!.orgId,
          label: 'Risk',
          via: [{ table: dpias, on: eq(dpiaRisks.dpiaId, dpias.id) }],
        });

        const [inserted] = await ctx.db.insert(dpiaMeasures).values(input).returning();
        if (!inserted) throw new TRPCError({ code: 'NOT_FOUND' });

        const [risk] = await ctx.db.select().from(dpiaRisks).where(eq(dpiaRisks.id, inserted.dpiaRiskId));
        if (risk) {
          await orgEmbeddingsQueue.add('embed-dpia', {
            orgId: ctx.user!.orgId,
            entityType: 'dpia',
            entityId: risk.dpiaId,
            action: 'upsert'
          });
        }

        return inserted;
      }),
      
    update: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        id: z.string().uuid(),
        data: z.record(z.any()),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertOwned(ctx.db, {
          table: dpiaMeasures,
          id: input.id,
          orgId: ctx.user!.orgId,
          label: 'Measure',
          via: [
            { table: dpiaRisks, on: eq(dpiaMeasures.dpiaRiskId, dpiaRisks.id) },
            { table: dpias, on: eq(dpiaRisks.dpiaId, dpias.id) },
          ],
        });

        const [updated] = await ctx.db.update(dpiaMeasures)
          .set(input.data)
          .where(eq(dpiaMeasures.id, input.id))
          .returning();
        if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });

        const [risk] = await ctx.db.select().from(dpiaRisks).where(eq(dpiaRisks.id, updated.dpiaRiskId));
        if (risk) {
          await orgEmbeddingsQueue.add('embed-dpia', {
            orgId: ctx.user!.orgId,
            entityType: 'dpia',
            entityId: risk.dpiaId,
            action: 'upsert'
          });
        }

        return updated;
      }),
      
    delete: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await assertOwned(ctx.db, {
          table: dpiaMeasures,
          id: input.id,
          orgId: ctx.user!.orgId,
          label: 'Measure',
          via: [
            { table: dpiaRisks, on: eq(dpiaMeasures.dpiaRiskId, dpiaRisks.id) },
            { table: dpias, on: eq(dpiaRisks.dpiaId, dpias.id) },
          ],
        });

        const [deleted] = await ctx.db.delete(dpiaMeasures).where(eq(dpiaMeasures.id, input.id)).returning();

        if (deleted) {
          const [risk] = await ctx.db.select().from(dpiaRisks).where(eq(dpiaRisks.id, deleted.dpiaRiskId));
          if (risk) {
            await orgEmbeddingsQueue.add('embed-dpia', {
              orgId: ctx.user!.orgId,
              entityType: 'dpia',
              entityId: risk.dpiaId,
              action: 'upsert'
            });
          }
        }

        return deleted;
      })
  }),

  getOverdueRemediationCount: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .query(async ({ ctx }) => {
      checkOrgContext(ctx.user);

      const overdueGaps = await ctx.db.select()
        .from(complianceGaps)
        .where(and(
          eq(complianceGaps.organizationId, ctx.user!.orgId),
          eq(complianceGaps.source, 'dpia'),
          inArray(complianceGaps.status, ['open', 'in_progress']),
          inArray(complianceGaps.severity, ['high', 'critical']),
          lt(complianceGaps.mitigationDueDate, new Date())
        ));

      return { count: overdueGaps.length };
    }),
});
