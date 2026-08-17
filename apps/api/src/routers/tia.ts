import { z } from 'zod';
import { db } from '../db.js';
import { transferImpactAssessments, processingTransfers, processingActivities, organizationVendors, vendors } from 'db';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { router, protectedProcedure, requireRole } from '../trpc.js';
import { TRPCError } from '@trpc/server';

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
      
      surveillanceLawsExist: z.boolean().nullable().optional(),
      independentDpaExists: z.boolean().nullable().optional(),
      effectiveRemediesExist: z.boolean().nullable().optional(),
      legalAssessmentConclusion: z.string().nullable().optional(),
      
      technicalMeasures: z.any().optional(),
      organizationalMeasures: z.any().optional(),
      contractualMeasures: z.any().optional(),
      
      residualRiskLevel: z.string().nullable().optional(),
      residualRiskJustification: z.string().nullable().optional(),
      
      conclusion: z.string().nullable().optional(),
      status: z.string().default('draft'),
    }))
    .mutation(async ({ ctx, input }) => {
      let tiaId = input.id;
      
      const payload: any = {
        organizationId: ctx.user!.orgId,
        vendorId: input.vendorId,
        destinationCountry: input.destinationCountry,
        transferMechanism: input.transferMechanism,
        surveillanceLawsExist: input.surveillanceLawsExist,
        independentDpaExists: input.independentDpaExists,
        effectiveRemediesExist: input.effectiveRemediesExist,
        legalAssessmentConclusion: input.legalAssessmentConclusion,
        technicalMeasures: input.technicalMeasures || [],
        organizationalMeasures: input.organizationalMeasures || [],
        contractualMeasures: input.contractualMeasures || [],
        residualRiskLevel: input.residualRiskLevel,
        residualRiskJustification: input.residualRiskJustification,
        conclusion: input.conclusion,
        status: input.status,
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
        
        // Auto-update linked transfers
        if (input.status === 'completed') {
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
    
    // PDF Export placeholder (simulating Puppeteer pipeline)
    exportPdf: protectedProcedure
      .use(requireRole("admin"))
      .input(z.object({ tiaId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const [tia] = await ctx.db.select()
          .from(transferImpactAssessments)
          .where(and(
            eq(transferImpactAssessments.id, input.tiaId),
            eq(transferImpactAssessments.organizationId, ctx.user!.orgId)
          ));
          
        if (!tia) throw new TRPCError({ code: 'NOT_FOUND' });
        
        // Mocking PDF generation and S3 upload
        const mockS3Url = `https://s3.custodia.io/exports/tia_${tia.id}.pdf`;
        return { url: mockS3Url };
      })
});
