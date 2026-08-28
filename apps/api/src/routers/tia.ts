import { z } from 'zod';
import { transferImpactAssessments, processingTransfers, processingActivities, organizationVendors, vendors, organizations } from 'db';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { router, protectedProcedure, requireRole, requirePermission } from '../trpc.js';
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
  opts: { orgId: string; vendorId: string; riskLevel: string | null | undefined; completed: boolean },
) {
  await dbc.update(processingTransfers)
    .set({
      // `true` unconditionally said "this transfer has a completed TIA" even
      // where the assessment's conclusion was to suspend the transfer — the
      // register then showed a green tick on the one transfer that must not
      // happen. The risk level below is what carries the bad news, and it was
      // being contradicted by the flag beside it.
      tiaCompleted: opts.completed,
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
 * D24. Both save paths mark the register row when the assessment moves --
 * previously only the insert path did, so completing an existing draft left the
 * register saying no TIA exists.
 *
 * The flag tracks the assessment's *state*, in both directions. Setting it and
 * never clearing it meant a completed TIA that was reopened for revision — the
 * ordinary thing to do when a sub-processor changes — left the register
 * asserting a finished Chapter V assessment that no longer existed.
 */
async function markOrgVendorTia(dbc: any, orgId: string, vendorId: string, completed: boolean) {
  await dbc.update(organizationVendors)
    .set({ tiaCompleted: completed })
    .where(and(
      eq(organizationVendors.vendorId, vendorId),
      eq(organizationVendors.organizationId, orgId),
    ));
}

/**
 * A completed TIA whose conclusion is "do not transfer" is not a green tick.
 *
 * `tiaCompleted` is read by the register as reassurance and by the risk engine
 * as a mitigating factor, so a suspended transfer that sets it says the
 * opposite of what the assessment concluded. The assessment being *finished* and
 * the transfer being *permissible* are two different facts, and only the second
 * belongs on the register's flag.
 */
const CONCLUSIONS_PERMITTING_TRANSFER = ['proceed', 'proceed_with_conditions'] as const;

function transferIsPermitted(conclusion?: string | null): boolean {
  return !!conclusion && (CONCLUSIONS_PERMITTING_TRANSFER as readonly string[]).includes(conclusion);
}

/*
 * D58. These two were `requireRole("admin")`, which is org administration rather
 * than data protection: the DPO and Privacy Manager roles both carry
 * `vendors: { view: true, edit: true }` and neither is an org admin, so the person
 * whose job a transfer impact assessment actually is could not open one. Gated on
 * the vendor permission the rest of the module uses — read to view, edit to save.
 */
export const tiaRouter = router({
  getForVendor: protectedProcedure
    .use(requirePermission('vendors', 'view'))
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
    .use(requirePermission('vendors', 'edit'))
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
      const tiaId = input.id;

      /**
       * Only the fields the caller actually sent.
       *
       * This used to build the payload as `input.x ?? null` for every column,
       * which is PUT semantics on a six-step wizard: any save that did not carry
       * the whole form — the autosave on step 4, a client that omits a field it
       * has no input for — silently nulled the five steps around it, and
       * `dataSubjectCategories` reset to `[]`. `undefined` now means "not
       * mentioned" and is left alone, which is the same discipline
       * `updateOrgVendor` uses one router over.
       */
      const payload: any = { updatedAt: new Date() };
      const set = (column: string, value: unknown) => {
        if (value !== undefined) payload[column] = value;
      };

      set('destinationCountry', input.destinationCountry);
      set('transferMechanism', input.transferMechanism);
      set('dataExporter', input.dataExporter);
      set('dataImporter', input.dataImporter);
      set('transferPurpose', input.transferPurpose);
      set('dataSubjectCategories', input.dataSubjectCategories);
      set('transferFrequency', input.transferFrequency);
      set('onwardTransfers', input.onwardTransfers);
      set('surveillanceLawsExist', input.surveillanceLawsExist);
      set('independentDpaExists', input.independentDpaExists);
      set('effectiveRemediesExist', input.effectiveRemediesExist);
      set('legalAssessmentConclusion', input.legalAssessmentConclusion);
      set('legalAssessmentDetail', input.legalAssessmentDetail);
      set('relevantCaseLaw', input.relevantCaseLaw);
      set('technicalMeasures', input.technicalMeasures);
      set('organizationalMeasures', input.organizationalMeasures);
      set('contractualMeasures', input.contractualMeasures);
      set('measuresDetail', input.measuresDetail);
      set('residualRiskLevel', input.residualRiskLevel);
      set('residualRiskJustification', input.residualRiskJustification);
      set('conclusion', input.conclusion);
      set('conditions', input.conditions);
      set('reevaluationIntervalMonths', input.reevaluationIntervalMonths);
      set('reevaluationTriggers', input.reevaluationTriggers);
      payload.status = input.status;

      const completed = input.status === 'completed';
      if (completed) {
        payload.approvedBy = ctx.user!.id;
        payload.approvedAt = new Date();
      } else {
        // Reopening a completed assessment withdraws its approval. Leaving the
        // approver stamped on a document that is being rewritten attributes the
        // new text to someone who never saw it.
        payload.approvedBy = null;
        payload.approvedAt = null;
      }

      let saved;
      if (tiaId) {
        const [updated] = await ctx.db.update(transferImpactAssessments)
          .set(payload)
          .where(and(
            eq(transferImpactAssessments.id, tiaId),
            eq(transferImpactAssessments.organizationId, ctx.user!.orgId)
          ))
          .returning();
        if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
        saved = updated;
      } else {
        const [inserted] = await ctx.db.insert(transferImpactAssessments)
          .values({
            ...payload,
            organizationId: ctx.user!.orgId,
            vendorId: input.vendorId,
            // An insert needs the not-null columns even where the caller was
            // silent, which an update does not.
            destinationCountry: input.destinationCountry,
            transferMechanism: input.transferMechanism,
            dataSubjectCategories: input.dataSubjectCategories ?? [],
            technicalMeasures: input.technicalMeasures ?? [],
            organizationalMeasures: input.organizationalMeasures ?? [],
            contractualMeasures: input.contractualMeasures ?? [],
          })
          .returning();
        if (!inserted) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Insert returned no row.' });
        saved = inserted;
      }

      // One path for both branches (D24). The register's flag records whether a
      // *finished assessment permits the transfer*, not merely whether somebody
      // pressed Complete — see transferIsPermitted.
      const permitted = completed && transferIsPermitted(saved.conclusion);
      await markOrgVendorTia(ctx.db, ctx.user!.orgId, input.vendorId, permitted);

      if (completed) {
        await propagateTiaToTransfers(ctx.db, {
          orgId: ctx.user!.orgId,
          vendorId: input.vendorId,
          riskLevel: saved.conclusion === 'suspend' ? 'critical' : saved.residualRiskLevel,
          completed: permitted,
        });
      }

      return saved;
    }),

  /**
   * D9. The real export. Sprint 0 removed a button whose handler returned a
   * fabricated S3 URL under a "Mocking PDF generation" comment; this renders
   * the actual assessment through the shared pipeline and returns it base64,
   * exactly as export.article30 does.
   *
   * `destinationCountry` is optional but meaningful: a TIA is an assessment of a
   * transfer to *one* third country, and a vendor can have several. Exporting
   * "the most recent row for this vendor" hands somebody a document about Japan
   * when they asked about the United States, with nothing on the page to say so.
   * Where the caller does not choose, the latest is used and the country is
   * printed on the cover.
   *
   * Gated on `vendors.view` rather than the admin role: the rest of the module
   * is permission-gated, and the person who has to hand this to a regulator is
   * the DPO, who is not necessarily an org admin.
   */
  exportPdf: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .input(z.object({
      vendorId: z.string().uuid(),
      destinationCountry: z.string().length(2).optional(),
      tiaId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const where = [
        eq(transferImpactAssessments.organizationId, ctx.user!.orgId),
        eq(transferImpactAssessments.vendorId, input.vendorId),
      ];
      if (input.tiaId) where.push(eq(transferImpactAssessments.id, input.tiaId));
      if (input.destinationCountry) {
        where.push(eq(transferImpactAssessments.destinationCountry, input.destinationCountry));
      }

      const [tia] = await ctx.db.select()
        .from(transferImpactAssessments)
        .where(and(...where))
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

      // The controller's own name belongs on a Chapter V document — the
      // exporting organisation is half of the transfer being assessed, and
      // `dataExporter` is free text the wizard may not have collected.
      const [org] = await ctx.db.select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, ctx.user!.orgId));

      try {
        const pdfBuffer = await renderPdf('vendors-tia', {
          tia,
          vendorName: ov?.name || 'Vendor',
          organizationName: org?.name ?? null,
          generatedAt: new Date().toISOString(),
        });
        const slug = (ov?.name || 'vendor').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        return {
          success: true,
          pdfData: pdfBuffer.toString('base64'),
          filename: `tia-${slug}-${tia.destinationCountry?.toLowerCase() ?? 'transfer'}-${new Date().toISOString().slice(0, 10)}.pdf`,
        };
      } catch (err: any) {
        console.error('TIA PDF render failed:', err.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to generate the TIA PDF.' });
      }
    }),

  /**
   * Every TIA recorded for a vendor, newest first — one per third country in
   * the normal case. The wizard needs this to stop overwriting the assessment
   * for one country with the assessment for another.
   */
  listForVendor: protectedProcedure
    .use(requirePermission('vendors', 'view'))
    .input(z.object({ vendorId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.select({
        id: transferImpactAssessments.id,
        destinationCountry: transferImpactAssessments.destinationCountry,
        transferMechanism: transferImpactAssessments.transferMechanism,
        status: transferImpactAssessments.status,
        conclusion: transferImpactAssessments.conclusion,
        residualRiskLevel: transferImpactAssessments.residualRiskLevel,
        approvedAt: transferImpactAssessments.approvedAt,
        updatedAt: transferImpactAssessments.updatedAt,
      })
        .from(transferImpactAssessments)
        .where(and(
          eq(transferImpactAssessments.organizationId, ctx.user!.orgId),
          eq(transferImpactAssessments.vendorId, input.vendorId),
        ))
        .orderBy(desc(transferImpactAssessments.updatedAt));
    }),
});
