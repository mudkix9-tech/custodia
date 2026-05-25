import { paginatedQuery } from '../utils/pagination.js';
import { z } from 'zod';
import { router, protectedProcedure, requirePermission } from '../trpc.js';
import { db } from '../db.js';
import { breaches, breachNotifications, breachRemediationTasks, auditLogs, organizations, users } from 'db';
import { eq, and, desc, isNull, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

const checkOrgContext = (user: any) => {
  if (!user.orgId) throw new TRPCError({ code: 'FORBIDDEN', message: 'No organization context' });
};

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
      const [breach] = await db.select().from(breaches).where(and(eq(breaches.id, input.breachId), eq(breaches.organizationId, ctx.user!.orgId)));
      if (!breach) throw new TRPCError({ code: 'NOT_FOUND' });

      const [org] = await db.select().from(organizations).where(eq(organizations.id, ctx.user!.orgId));
      const authority = org?.leadSupervisoryAuthority || 'generic';

      const [user] = await db.select().from(users).where(eq(users.id, ctx.user!.id));

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

      const [draft] = await db.insert(breachNotifications).values({
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
      return db.select().from(breachNotifications).where(eq(breachNotifications.breachId, input.breachId));
    }),
  update: protectedProcedure
    .use(requirePermission('breach', 'edit'))
    .input(z.object({ id: z.string().uuid(), content: z.any() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [updated] = await db.update(breachNotifications).set({ contentJson: input.content }).where(eq(breachNotifications.id, input.id)).returning();
      return updated;
    }),
  approve: protectedProcedure
    .use(requirePermission('breach', 'manage')) // admin only
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [updated] = await db.update(breachNotifications).set({ status: 'approved' }).where(eq(breachNotifications.id, input.id)).returning();
      return updated;
    }),
  markSent: protectedProcedure
    .use(requirePermission('breach', 'manage')) // admin only
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [notif] = await db.select().from(breachNotifications).where(eq(breachNotifications.id, input.id));
      if (!notif || notif.status !== 'approved') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Notification must be approved first.' });
      const [updated] = await db.update(breachNotifications).set({ status: 'sent', sentAt: new Date() }).where(eq(breachNotifications.id, input.id)).returning();
      return updated;
    }),
});

const tasksRouter = router({
  create: protectedProcedure
    .use(requirePermission('breach', 'edit'))
    .input(z.object({ breachId: z.string().uuid(), title: z.string(), description: z.string().optional(), priority: z.string().default('medium'), dueAt: z.date().optional() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [task] = await db.insert(breachRemediationTasks).values({
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
      return db.select().from(breachRemediationTasks).where(eq(breachRemediationTasks.breachId, input.breachId)).orderBy(breachRemediationTasks.createdAt);
    }),
  update: protectedProcedure
    .use(requirePermission('breach', 'edit'))
    .input(z.object({ id: z.string().uuid(), status: z.string(), completionNotes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [updated] = await db.update(breachRemediationTasks).set({ 
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
      await db.delete(breachRemediationTasks).where(eq(breachRemediationTasks.id, input.id));
      return { success: true };
    }),
});

const paginationInput = z.object({
  limit: z.number().min(1).max(100).default(25),
  cursor: z.string().nullish(),
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

      const [breach] = await db.insert(breaches).values({
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

      return breach;
    }),

  list: protectedProcedure
    .use(requirePermission('breach', 'view'))
    .query(async ({ ctx }) => {
      checkOrgContext(ctx.user);
      return db.select().from(breaches).where(eq(breaches.organizationId, ctx.user!.orgId)).orderBy(desc(breaches.createdAt));
    }),

  register: protectedProcedure
    .use(requirePermission('breach', 'view'))
    .query(async ({ ctx }) => {
      checkOrgContext(ctx.user);
      return db.select().from(breaches).where(eq(breaches.organizationId, ctx.user!.orgId)).orderBy(desc(breaches.discoveredAt));
    }),

  getById: protectedProcedure
    .use(requirePermission('breach', 'view'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [breach] = await db.select().from(breaches).where(and(eq(breaches.id, input.id), eq(breaches.organizationId, ctx.user!.orgId)));
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
      
      const [updated] = await db.update(breaches).set({
        dataCategoriesAffected: input.answers.dataCategories,
        estimatedRecordsAffected: input.answers.recordsAffected,
        riskToIndividuals: riskResults.overallRisk,
        riskAssessmentDetail: riskResults.reasoning,
        notifyAuthority: riskResults.notifyAuthority,
        notifyIndividuals: riskResults.notifyIndividuals,
        updatedAt: new Date()
      }).where(and(eq(breaches.id, input.id), eq(breaches.organizationId, ctx.user!.orgId))).returning();
      
      return updated;
    }),

  updateStatus: protectedProcedure
    .use(requirePermission('breach', 'manage')) // admin only
    .input(z.object({ id: z.string().uuid(), status: z.string() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [updated] = await db.update(breaches).set({ status: input.status, updatedAt: new Date() }).where(and(eq(breaches.id, input.id), eq(breaches.organizationId, ctx.user!.orgId))).returning();
      return updated;
    }),

  close: protectedProcedure
    .use(requirePermission('breach', 'manage')) // admin only
    .input(z.object({ id: z.string().uuid(), rootCause: z.string(), lessonsLearned: z.string() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [updated] = await db.update(breaches).set({ 
        status: 'closed', 
        rootCause: input.rootCause, 
        lessonsLearned: input.lessonsLearned,
        resolvedAt: new Date(),
        updatedAt: new Date() 
      }).where(and(eq(breaches.id, input.id), eq(breaches.organizationId, ctx.user!.orgId))).returning();
      return updated;
    }),
});
