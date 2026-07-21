import { z } from 'zod';
import { router, protectedProcedure, requirePermission } from '../trpc.js';
import { orgEmbeddingsQueue } from '../lib/queue.js';
import { db } from '../db.js';
import { dpias, dpiaRisks, dpiaMeasures, auditLogs, processingRecipients, organizationVendors, vendors, complianceGaps } from 'db';
import { eq, and, desc, inArray, lt } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { syncDpiaGaps } from '../lib/dpiaGapSync.js';
import { enforceLimit } from '../lib/billing.js';

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
  prePopulatedType: z.enum(['missing_dpa', 'clause_gaps', 'missing_certs']).optional().nullable(),
});

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
              const vendorName = orgVendor.name || vendor.name;
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
      data: z.record(z.any()),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      
      const [updated] = await ctx.db.update(dpias)
        .set({ ...input.data, updatedAt: new Date() })
        .where(and(eq(dpias.id, input.id), eq(dpias.organizationId, ctx.user!.orgId)))
        .returning();

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

  risks: router({
    list: protectedProcedure
      .use(requirePermission('ropa', 'view'))
      .input(z.object({ dpiaId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        return ctx.db.select().from(dpiaRisks).where(eq(dpiaRisks.dpiaId, input.dpiaId));
      }),
      
    create: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        dpiaId: z.string().uuid(),
        description: z.string().min(1),
        likelihood: z.number().min(1).max(5).optional(),
        severity: z.number().min(1).max(5).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const initialRiskScore = (input.likelihood && input.severity) ? input.likelihood * input.severity : null;
        
        const [inserted] = await ctx.db.insert(dpiaRisks).values({
          ...input,
          initialRiskScore,
        }).returning();

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
        data: z.record(z.any()),
      }))
      .mutation(async ({ ctx, input }) => {
        // If updating likelihood or severity, recalculate initialRiskScore
        const [updated] = await ctx.db.update(dpiaRisks)
          .set(input.data)
          .where(eq(dpiaRisks.id, input.id))
          .returning();

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
        const [deleted] = await ctx.db.delete(dpiaRisks).where(eq(dpiaRisks.id, input.id)).returning();

        if (deleted) {
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
        return ctx.db.select().from(dpiaMeasures).where(eq(dpiaMeasures.dpiaRiskId, input.dpiaRiskId));
      }),
      
    create: protectedProcedure
      .use(requirePermission('ropa', 'edit'))
      .input(z.object({
        dpiaRiskId: z.string().uuid(),
        description: z.string().min(1),
        status: z.string().default('planned'),
      }))
      .mutation(async ({ ctx, input }) => {
        const [inserted] = await ctx.db.insert(dpiaMeasures).values(input).returning();

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
        const [updated] = await ctx.db.update(dpiaMeasures)
          .set(input.data)
          .where(eq(dpiaMeasures.id, input.id))
          .returning();

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
