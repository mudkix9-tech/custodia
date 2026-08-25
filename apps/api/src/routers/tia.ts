import { z } from 'zod';
import { transferImpactAssessments, processingTransfers, processingActivities, organizationVendors, vendors } from 'db';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { router, protectedProcedure, requireRole } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { renderPdf } from '../lib/pdfClient.js';

/**
 * Propagate a completed TIA onto the transfer rows it covers, for this organisation only.
 *
 * `processing_transfers` carries no organization_id — it is only reachable through its
 * parent activity — and `vendors` is a **shared** catalogue, so `vendorId` on its own is
 * not a tenant predicate. Filtering on it alone let one organisation's completed TIA flip
 * every other tenant's transfer row for the same vendor to "TIA: Completed", or to
 * "Suspended" where the conclusion was to suspend: fabricated Chapter V evidence appearing
 * inside a stranger's register.
 */
async function propagateTiaToTransfers(
  dbc: any,
  opts: { orgId: string; vendorId: string; riskLevel: string | null | undefined },
) {
  await dbc.update(processingTransfers)
    .set({
      tiaCompleted: true,
      tiaRiskLevel: opts.riskLevel,
    })
    .where(and(
      eq(processingTransfers.vendorId, opts.vendorId),
      inArray(
        processingTransfers.processingActivityId,
        dbc.select({ id: processingActivities.id })
          .from(processingActivities)
          .where(eq(processingActivities.organizationId, opts.orgId)),
      ),
    ));
}

/**
 * D24. Both save paths mark the register row complete when the assessment does --
 * previously only the insert path did, so completing an existing draft left the
 * register saying no TIA exists.
 */
async function markOrgVendorTiaComplete(dbc: any, orgId: string, vendorId: string) {
  await dbc.update(organizationVendors)
    .set({ tiaCompleted: true })
    .where(and(
      eq(organizationVendors.vendorId, vendorId),
      eq(organizationVendors.organizationId, orgId),
    ));
}

export const tiaRouter = router({
  getForVendor: protectedProcedure
    .use(requireRole("admin"))
    .input(z.object({ vendorId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [tia] = await ctx.db.select()
        .from(transferImpactAssessments)
        .where(and(
          eq(transferImpactAssessments.organizationId, ctx.user!.orgId),
          eq(transferImpactAssessments.vendorId, input.vendorId)
        ))
        .orderBy(desc(transferImpactAssessments.createdAt))
        .limit(1);

      return tia || null;
    }),

  save: protectedProcedure
    .use(requireRole("admin"))
    .input(z.object({
      id: z.string().uuid().optional(),
      vendorId: z.string().uuid(),
      destinationCountry: z.string().length(2),
      transferMechanism: z.string(),

      // D25. Recommendations 01/2020 Step 1 -- "know your transfer". The schema
      // models these; the save dropped all six, so a wizard that asked for them
      // threw the answers away and the exported document assessed nothing.
      dataExporter: z.string().max(255).nullable().optional(),
      dataImporter: z.string().max(255).nullable().optional(),
      transferPurpose: z.string().max(4000).nullable().optional(),
      dataSubjectCategories: z.array(z.string().max(120)).max(50).nullable().optional(),
      transferFrequency: z.string().max(40).nullable().optional(),
      onwardTransfers: z.string().max(2000).nullable().optional(),

      surveillanceLawsExist: z.boolean().nullable().optional(),
      independentDpaExists: z.boolean().nullable().optional(),
      effectiveRemediesExist: z.boolean().nullable().optional(),
      legalAssessmentConclusion: z.string().nullable().optional(),
      legalAssessmentDetail: z.string().max(4000).nullable().optional(),
      relevantCaseLaw: z.string().max(2000).nullable().optional(),

      technicalMeasures: z.any().optional(),
      organizationalMeasures: z.any().optional(),
      contractualMeasures: z.any().optional(),
      measuresDetail: z.string().max(4000).nullable().optional(),

      residualRiskLevel: z.string().nullable().optional(),
      residualRiskJustification: z.string().max(4000).nullable().optional(),

      conclusion: z.string().nullable().optional(),
      conditions: z.string().max(4000).nullable().optional(),
      status: z.string().default('draft'),

      // Step 6 -- re-evaluation at appropriate intervals.
      reevaluationIntervalMonths: z.number().int().min(1).max(120).nullable().optional(),
      reevaluationTriggers: z.string().max(2000).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let tiaId = input.id;

      const payload: any = {
        organizationId: ctx.user!.orgId,
        vendorId: input.vendorId,
        destinationCountry: input.destinationCountry,
        transferMechanism: input.transferMechanism,
        dataExporter: input.dataExporter ?? null,
        dataImporter: input.dataImporter ?? null,
        transferPurpose: input.transferPurpose ?? null,
        dataSubjectCategories: input.dataSubjectCategories ?? [],
        transferFrequency: input.transferFrequency ?? null,
        onwardTransfers: input.onwardTransfers ?? null,
        surveillanceLawsExist: input.surveillanceLawsExist,
        independentDpaExists: input.independentDpaExists,
        effectiveRemediesExist: input.effectiveRemediesExist,
        legalAssessmentConclusion: input.legalAssessmentConclusion,
        legalAssessmentDetail: input.legalAssessmentDetail ?? null,
        relevantCaseLaw: input.relevantCaseLaw ?? null,
        technicalMeasures: input.technicalMeasures || [],
        organizationalMeasures: input.organizationalMeasures || [],
        contractualMeasures: input.contractualMeasures || [],
        measuresDetail: input.measuresDetail ?? null,
        residualRiskLevel: input.residualRiskLevel,
        residualRiskJustification: input.residualRiskJustification,
        conclusion: input.conclusion,
        conditions: input.conditions ?? null,
        status: input.status,
        reevaluationIntervalMonths: input.reevaluationIntervalMonths ?? null,
        reevaluationTriggers: input.reevaluationTriggers ?? null,
        updatedAt: new Date(),
      };

      if (input.status === 'completed') {
        payload.approvedBy = ctx.user!.id;
        payload.approvedAt = new Date();
      }

      if (tiaId) {
        const [updated] = await ctx.db.update(transferImpactAssessments)
          .set(payload)
          .where(and(
            eq(transferImpactAssessments.id, tiaId),
            eq(transferImpactAssessments.organizationId, ctx.user!.orgId)
          ))
          .returning();
        if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
        
        // Auto-update linked transfers and the register row (D24)
        if (input.status === 'completed') {
          await markOrgVendorTiaComplete(ctx.db, ctx.user!.orgId, input.vendorId);
          await propagateTiaToTransfers(ctx.db, {
            orgId: ctx.user!.orgId,
            vendorId: input.vendorId,
            riskLevel: input.conclusion === 'suspend' ? 'critical' : input.residualRiskLevel,
          });
        }

        return updated;
      } else {
        const [inserted] = await ctx.db.insert(transferImpactAssessments)
          .values(payload)
          .returning();
        
        // Update org vendor
        if (input.status === 'completed') {
          await ctx.db.update(organizationVendors)
            .set({ tiaCompleted: true })
            .where(and(
              eq(organizationVendors.vendorId, input.vendorId),
              eq(organizationVendors.organizationId, ctx.user!.orgId)
            ));
            
          await propagateTiaToTransfers(ctx.db, {
            orgId: ctx.user!.orgId,
            vendorId: input.vendorId,
            riskLevel: input.conclusion === 'suspend' ? 'critical' : input.residualRiskLevel,
          });
        }

        return inserted;
      }
    }),

  /**
   * D9. The real export. Sprint 0 removed a button whose handler returned a
   * fabricated S3 URL under a "Mocking PDF generation" comment; this renders
   * the actual assessment through the shared pipeline and returns it base64,
   * exactly as export.article30 does.
   */
  exportPdf: protectedProcedure
    .use(requireRole('admin'))
    .input(z.object({ vendorId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [tia] = await ctx.db.select()
        .from(transferImpactAssessments)
        .where(and(
          eq(transferImpactAssessments.organizationId, ctx.user!.orgId),
          eq(transferImpactAssessments.vendorId, input.vendorId)
        ))
        .orderBy(desc(transferImpactAssessments.createdAt))
        .limit(1);

      if (!tia) throw new TRPCError({ code: 'NOT_FOUND', message: 'No TIA recorded for this vendor.' });

      const [ov] = await ctx.db.select({ name: vendors.name })
        .from(organizationVendors)
        .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
        .where(and(
          eq(organizationVendors.organizationId, ctx.user!.orgId),
          eq(organizationVendors.vendorId, input.vendorId),
        ));

      try {
        const pdfBuffer = await renderPdf('vendors-tia', {
          tia,
          vendorName: ov?.name || 'Vendor',
          generatedAt: new Date().toISOString(),
        });
        return {
          success: true,
          pdfData: pdfBuffer.toString('base64'),
          filename: `tia-${(ov?.name || 'vendor').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`,
        };
      } catch (err: any) {
        console.error('TIA PDF render failed:', err.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to generate the TIA PDF.' });
      }
    }),
});
