import { paginatedQuery } from '../utils/pagination.js';
import { z } from 'zod';
import { orgEmbeddingsQueue } from '../lib/queue.js';
import { router, protectedProcedure, requirePermission, verifyGroupScopeAndLog } from '../trpc.js';
import { breaches, breachNotifications, breachRemediationTasks, organizations, users } from 'db';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { assertOwned, assertParentOwned } from '../lib/tenancy.js';

const checkOrgContext = (user: any) => {
  if (!user.orgId) throw new TRPCError({ code: 'FORBIDDEN', message: 'No organization context' });
};

const paginationInput = z.object({
  limit: z.number().min(1).max(100).default(25),
  cursor: z.string().nullish(),
});

// Risk Assessment Matrix Logic
function assessBreachRisk(answers: any) {
  let severityScore = 0;
  let likelihoodScore = 0;

  const dataCategories = answers.dataCategories || [];
  if (dataCategories.includes('financial')) severityScore += 3;
  if (dataCategories.includes('health')) severityScore += 4;
  if (dataCategories.includes('credentials')) severityScore += 4;
  if (dataCategories.includes('identity')) severityScore += 3;
  if (dataCategories.includes('contact')) severityScore += 1;
  
  const records = answers.recordsAffected || 0;
  if (records > 10000) severityScore += 4;
  else if (records > 1000) severityScore += 3;
  else if (records > 100) severityScore += 2;
  else severityScore += 1;

  if (answers.identityTheftRisk) severityScore += 3;
  if (answers.dataWasEncrypted) severityScore -= 3;

  if (answers.confirmedAccess) likelihoodScore += 4;
  else likelihoodScore += 2;
  if (answers.publiclyAccessible) likelihoodScore += 3;
  if (answers.maliciousIntent) likelihoodScore += 2;
  if (answers.containedWithinHours) likelihoodScore -= 1;

  const riskLevel = severityScore * likelihoodScore;

  const categorize = (val: number, isRisk = false) => {
    if (isRisk) {
      if (val <= 4) return 'unlikely';
      if (val <= 9) return 'low';
      if (val <= 16) return 'medium';
      return 'high';
    }
    if (val <= 2) return 'negligible';
    if (val <= 5) return 'low';
    if (val <= 8) return 'medium';
    return 'high';
  };

  const overall = categorize(riskLevel, true);
  const notifyAuth = riskLevel > 4; // required unless unlikely
  const notifyIndiv = riskLevel >= 16; // required if high risk

  return {
    severity: categorize(severityScore),
    likelihood: categorize(likelihoodScore),
    overallRisk: overall,
    notifyAuthority: notifyAuth,
    notifyIndividuals: notifyIndiv,
    reasoning: `Calculated severity score ${severityScore} and likelihood score ${likelihoodScore}. Overall risk level is ${overall.toUpperCase()}. Notification to authority: ${notifyAuth ? 'REQUIRED' : 'NOT REQUIRED'}. Notification to individuals: ${notifyIndiv ? 'REQUIRED' : 'NOT REQUIRED'}.`
  };
}

const notificationsRouter = router({
  generate: protectedProcedure
    .use(requirePermission('breach', 'edit'))
    .input(z.object({ breachId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [breach] = await ctx.db.select().from(breaches).where(and(eq(breaches.id, input.breachId), eq(breaches.organizationId, ctx.user!.orgId)));
      if (!breach) throw new TRPCError({ code: 'NOT_FOUND' });

      const [org] = await ctx.db.select().from(organizations).where(eq(organizations.id, ctx.user!.orgId));
      const authority = org?.leadSupervisoryAuthority || 'generic';

      const [user] = await ctx.db.select().from(users).where(eq(users.id, ctx.user!.id));

      // Very simple mock generation template based on authority
      let content = {
        authority,
        nature_of_breach: breach.description,
        categories_affected: breach.dataCategoriesAffected,
        approximate_records: breach.estimatedRecordsAffected,
        likely_consequences: breach.riskAssessmentDetail,
        measures_taken: 'Pending tasks...',
        dpo_contact: org?.dpoEmail || user?.email,
      };

      const [draft] = await ctx.db.insert(breachNotifications).values({
        breachId: breach.id,
        notificationType: 'supervisory_authority',
        status: 'draft',
        contentJson: content,
        createdBy: ctx.user!.id,
      }).returning();

      return draft;
    }),
  list: protectedProcedure
    .use(requirePermission('breach', 'view'))
    .input(z.object({ breachId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      await assertParentOwned(ctx.db, breaches, input.breachId, ctx.user!.orgId, 'Breach');
      return ctx.db.select().from(breachNotifications).where(eq(breachNotifications.breachId, input.breachId));
    }),
  update: protectedProcedure
    .use(requirePermission('breach', 'edit'))
    .input(z.object({ id: z.string().uuid(), content: z.any() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      await assertOwned(ctx.db, {
        table: breachNotifications,
        id: input.id,
        orgId: ctx.user!.orgId,
        label: 'Notification',
        via: [{ table: breaches, on: eq(breachNotifications.breachId, breaches.id) }],
      });
      const [updated] = await ctx.db.update(breachNotifications).set({ contentJson: input.content }).where(eq(breachNotifications.id, input.id)).returning();
      return updated;
    }),
  approve: protectedProcedure
    .use(requirePermission('breach', 'manage')) // admin only
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      await assertOwned(ctx.db, {
        table: breachNotifications,
        id: input.id,
        orgId: ctx.user!.orgId,
        label: 'Notification',
        via: [{ table: breaches, on: eq(breachNotifications.breachId, breaches.id) }],
      });
      const [updated] = await ctx.db.update(breachNotifications).set({ status: 'approved' }).where(eq(breachNotifications.id, input.id)).returning();
      return updated;
    }),
  markSent: protectedProcedure
    .use(requirePermission('breach', 'manage')) // admin only
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const notif = await assertOwned(ctx.db, {
        table: breachNotifications,
        id: input.id,
        orgId: ctx.user!.orgId,
        label: 'Notification',
        via: [{ table: breaches, on: eq(breachNotifications.breachId, breaches.id) }],
      });
      if (notif.status !== 'approved') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Notification must be approved first.' });
      const [updated] = await ctx.db.update(breachNotifications).set({ status: 'sent', sentAt: new Date() }).where(eq(breachNotifications.id, input.id)).returning();
      return updated;
    }),
});

const tasksRouter = router({
  create: protectedProcedure
    .use(requirePermission('breach', 'edit'))
    .input(z.object({ breachId: z.string().uuid(), title: z.string(), description: z.string().optional(), priority: z.string().default('medium'), dueAt: z.date().optional() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      await assertParentOwned(ctx.db, breaches, input.breachId, ctx.user!.orgId, 'Breach');
      const [task] = await ctx.db.insert(breachRemediationTasks).values({
        breachId: input.breachId,
        title: input.title,
        description: input.description,
        priority: input.priority,
        dueAt: input.dueAt,
      }).returning();
      return task;
    }),
  list: protectedProcedure
    .use(requirePermission('breach', 'view'))
    .input(z.object({ breachId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      await assertParentOwned(ctx.db, breaches, input.breachId, ctx.user!.orgId, 'Breach');
      return ctx.db.select().from(breachRemediationTasks).where(eq(breachRemediationTasks.breachId, input.breachId)).orderBy(breachRemediationTasks.createdAt);
    }),
  update: protectedProcedure
    .use(requirePermission('breach', 'edit'))
    .input(z.object({ id: z.string().uuid(), status: z.string(), completionNotes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      await assertOwned(ctx.db, {
        table: breachRemediationTasks,
        id: input.id,
        orgId: ctx.user!.orgId,
        label: 'Task',
        via: [{ table: breaches, on: eq(breachRemediationTasks.breachId, breaches.id) }],
      });
      const [updated] = await ctx.db.update(breachRemediationTasks).set({
        status: input.status, 
        completionNotes: input.completionNotes,
        completedAt: input.status === 'completed' ? new Date() : null
      }).where(eq(breachRemediationTasks.id, input.id)).returning();
      return updated;
    }),
  delete: protectedProcedure
    .use(requirePermission('breach', 'manage')) // admin only
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      await assertOwned(ctx.db, {
        table: breachRemediationTasks,
        id: input.id,
        orgId: ctx.user!.orgId,
        label: 'Task',
        via: [{ table: breaches, on: eq(breachRemediationTasks.breachId, breaches.id) }],
      });
      await ctx.db.delete(breachRemediationTasks).where(eq(breachRemediationTasks.id, input.id));
      return { success: true };
    }),
});

export const breachesRouter = router({
  notifications: notificationsRouter,
  tasks: tasksRouter,

  report: protectedProcedure
    .input(z.object({
      title: z.string(),
      description: z.string(),
      discoveryMethod: z.string(),
      discoveredAt: z.date(),
      breachType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const referenceNumber = `BRE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const deadline = new Date(input.discoveredAt);
      deadline.setHours(deadline.getHours() + 72);

      const [breach] = await ctx.db.insert(breaches).values({
        organizationId: ctx.user!.orgId,
        referenceNumber,
        title: input.title,
        description: input.description,
        discoveryMethod: input.discoveryMethod,
        discoveredAt: input.discoveredAt,
        discoveredBy: ctx.user!.id,
        notificationDeadline: deadline,
        breachType: input.breachType,
        status: 'detected',
      }).returning();

      if (!breach) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      await orgEmbeddingsQueue.add('embed-breach', {
        orgId: ctx.user!.orgId,
        entityType: 'breach',
        entityId: breach.id,
        action: 'upsert'
      });

      return breach;
    }),

  list: protectedProcedure
    .use(requirePermission('breach', 'view'))
    .input(paginationInput.extend({ includeChildEntities: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);

      let targetOrgs: string | string[] = ctx.user!.orgId;
      let orgMap = new Map<string, string>();

      if (input.includeChildEntities) {
        if (ctx.user!.entityScope !== 'group') throw new TRPCError({ code: 'FORBIDDEN' });
        
        const childOrgs = await ctx.db.select({ id: organizations.id, name: organizations.name })
          .from(organizations)
          .where(eq(organizations.parentOrganizationId, ctx.user!.orgId));
          
        const parentOrg = await ctx.db.select({ id: organizations.id, name: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, ctx.user!.orgId));
          
        const allOrgs = [...parentOrg, ...childOrgs];
        targetOrgs = allOrgs.map((o: any) => o.id);
        allOrgs.forEach((o: any) => orgMap.set(o.id, o.name));
        
        await verifyGroupScopeAndLog(
          ctx.user!.id,
          ctx.user!.orgId,
          targetOrgs,
          ctx.user!.entityScope,
          'query'
        );
      }

      const result = await paginatedQuery(
        breaches,
        targetOrgs,
        { limit: input.limit, after: input.cursor || undefined },
        'createdAt',
        'desc'
      );

      // organizationName is only present for the group view, so it is declared
      // optional rather than assigned in behind the row type's back.
      const data = result.data.map((b) => ({
        ...b,
        organizationName: input.includeChildEntities
          ? (orgMap.get(b.organizationId) || 'Unknown')
          : undefined,
      }));

      return { ...result, data };
    }),

  register: protectedProcedure
    .use(requirePermission('breach', 'view'))
    .input(paginationInput)
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      return paginatedQuery(
        breaches,
        ctx.user!.orgId,
        { limit: input.limit, after: input.cursor || undefined },
        'discoveredAt',
        'desc'
      );
    }),

  getById: protectedProcedure
    .use(requirePermission('breach', 'view'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [breach] = await ctx.db.select().from(breaches).where(and(eq(breaches.id, input.id), eq(breaches.organizationId, ctx.user!.orgId)));
      if (!breach) throw new TRPCError({ code: 'NOT_FOUND' });
      return breach;
    }),

  updateAssessment: protectedProcedure
    .use(requirePermission('breach', 'edit'))
    .input(z.object({
      id: z.string().uuid(),
      answers: z.any()
    }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const riskResults = assessBreachRisk(input.answers);
      
      const [updated] = await ctx.db.update(breaches).set({
        dataCategoriesAffected: input.answers.dataCategories,
        estimatedRecordsAffected: input.answers.recordsAffected,
        riskToIndividuals: riskResults.overallRisk,
        riskAssessmentDetail: riskResults.reasoning,
        notifyAuthority: riskResults.notifyAuthority,
        notifyIndividuals: riskResults.notifyIndividuals,
        updatedAt: new Date()
      }).where(and(eq(breaches.id, input.id), eq(breaches.organizationId, ctx.user!.orgId))).returning();
      
      await orgEmbeddingsQueue.add('embed-breach', {
        orgId: ctx.user!.orgId,
        entityType: 'breach',
        entityId: updated.id,
        action: 'upsert'
      });

      return updated;
    }),

  updateStatus: protectedProcedure
    .use(requirePermission('breach', 'manage')) // admin only
    .input(z.object({ id: z.string().uuid(), status: z.string() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [updated] = await ctx.db.update(breaches).set({ status: input.status, updatedAt: new Date() }).where(and(eq(breaches.id, input.id), eq(breaches.organizationId, ctx.user!.orgId))).returning();
      
      await orgEmbeddingsQueue.add('embed-breach', {
        orgId: ctx.user!.orgId,
        entityType: 'breach',
        entityId: updated.id,
        action: 'upsert'
      });

      return updated;
    }),

  close: protectedProcedure
    .use(requirePermission('breach', 'manage')) // admin only
    .input(z.object({ id: z.string().uuid(), rootCause: z.string(), lessonsLearned: z.string() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [updated] = await ctx.db.update(breaches).set({
        status: 'closed', 
        rootCause: input.rootCause, 
        lessonsLearned: input.lessonsLearned,
        resolvedAt: new Date(),
        updatedAt: new Date() 
      }).where(and(eq(breaches.id, input.id), eq(breaches.organizationId, ctx.user!.orgId))).returning();
      
      await orgEmbeddingsQueue.add('embed-breach', {
        orgId: ctx.user!.orgId,
        entityType: 'breach',
        entityId: updated.id,
        action: 'upsert'
      });

      return updated;
    }),
});
