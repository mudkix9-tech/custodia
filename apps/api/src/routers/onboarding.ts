import { router, protectedProcedure, requireRole } from '../trpc.js';
import { z } from 'zod';
import { db } from '../db.js';
import { eq, and, inArray, sql } from 'drizzle-orm';
import {
  organizations,
  organizationVendors,
  vendors,
  processingActivities,
  processingDataCategories,
  processingRecipients,
  processingTransfers,
  privacyPolicies,
  policyVersions,
  users,
  auditLogs
} from 'db';
import { isAdequateDestination } from '../constants/transferDestinations.js';

const ROPA_TEMPLATES = {
  marketing_agency: [
    {
      id: 'website_analytics',
      name: 'Website Analytics Tracking',
      description: 'Tracking website visitor behavior for performance optimization',
      purpose: 'To analyze website traffic, measure marketing campaign effectiveness, and optimize user experience through behavioral analytics.',
      lawfulBasis: 'legitimate_interests',
      lawfulBasisDetail: 'Legitimate interest in understanding website performance and optimizing marketing spend.',
      dataSubjectCategories: ['website_visitors'],
      estimatedDataSubjects: '1000-10000',
      processingType: ['collection', 'storage', 'analysis'],
      dataCategories: [
        { category: 'ip_address', categoryGroup: 'technical', source: 'automated_collection' },
        { category: 'cookies', categoryGroup: 'technical', source: 'automated_collection' },
        { category: 'browsing_history', categoryGroup: 'behavioral', source: 'automated_collection' },
        { category: 'device_id', categoryGroup: 'technical', source: 'automated_collection' },
      ],
      suggestedVendorCategories: ['analytics'],
      retentionPeriod: '24 months',
      securityMeasures: ['encryption_in_transit', 'access_controls', 'pseudonymization'],
    },
    {
      id: 'email_marketing',
      name: 'Email Marketing Campaigns',
      description: 'Sending marketing emails and newsletters to subscribers',
      purpose: 'To send promotional emails, newsletters, and automated marketing sequences to subscribed contacts.',
      lawfulBasis: 'consent',
      lawfulBasisDetail: 'Consent obtained through email signup forms with explicit opt-in.',
      dataSubjectCategories: ['customers', 'website_visitors'],
      estimatedDataSubjects: '1000-10000',
      processingType: ['collection', 'storage', 'analysis', 'sharing'],
      dataCategories: [
        { category: 'email', categoryGroup: 'contact', source: 'direct_from_subject' },
        { category: 'full_name', categoryGroup: 'identity', source: 'direct_from_subject' },
        { category: 'email_engagement', categoryGroup: 'behavioral', source: 'automated_collection' },
      ],
      suggestedVendorCategories: ['email_marketing'],
      retentionPeriod: 'Until consent is withdrawn',
      securityMeasures: ['encryption_in_transit', 'encryption_at_rest', 'access_controls'],
    },
    {
      id: 'crm_management',
      name: 'CRM Contact Management',
      description: 'Managing client and prospect relationships in a CRM system',
      purpose: 'To manage business relationships, track sales opportunities, and maintain client communication history.',
      lawfulBasis: 'contract',
      lawfulBasisDetail: 'Processing necessary for the performance of contracts with clients and pre-contractual inquiries.',
      dataSubjectCategories: ['customers'],
      estimatedDataSubjects: '<1000',
      processingType: ['collection', 'storage', 'analysis'],
      dataCategories: [
        { category: 'full_name', categoryGroup: 'identity', source: 'direct_from_subject' },
        { category: 'email', categoryGroup: 'contact', source: 'direct_from_subject' },
        { category: 'phone', categoryGroup: 'contact', source: 'direct_from_subject' },
        { category: 'employer', categoryGroup: 'employment', source: 'direct_from_subject' },
        { category: 'job_title', categoryGroup: 'employment', source: 'direct_from_subject' },
      ],
      suggestedVendorCategories: ['crm'],
      retentionPeriod: 'Duration of contract + 6 months',
      securityMeasures: ['encryption_in_transit', 'encryption_at_rest', 'access_controls', 'audit_logging'],
    },
    {
      id: 'social_advertising',
      name: 'Social Media Advertising',
      description: 'Running targeted advertising campaigns on social platforms',
      purpose: 'To deliver targeted advertisements to prospective customers on social media platforms using audience data and conversion tracking.',
      lawfulBasis: 'consent',
      lawfulBasisDetail: 'Consent obtained via cookie consent mechanism for tracking and targeting.',
      dataSubjectCategories: ['website_visitors'],
      estimatedDataSubjects: '10000-100000',
      processingType: ['collection', 'sharing', 'analysis'],
      dataCategories: [
        { category: 'cookies', categoryGroup: 'technical', source: 'automated_collection' },
        { category: 'ip_address', categoryGroup: 'technical', source: 'automated_collection' },
        { category: 'browsing_history', categoryGroup: 'behavioral', source: 'automated_collection' },
        { category: 'purchase_history', categoryGroup: 'behavioral', source: 'automated_collection' },
      ],
      suggestedVendorCategories: ['advertising'],
      retentionPeriod: '12 months',
      securityMeasures: ['encryption_in_transit', 'access_controls'],
    },
    {
      id: 'client_project_management',
      name: 'Client Project Management',
      description: 'Managing client projects, tasks, and deliverables',
      purpose: 'To coordinate project deliverables, track tasks, and manage client communications within project management tools.',
      lawfulBasis: 'contract',
      lawfulBasisDetail: 'Processing necessary for the performance of client service agreements.',
      dataSubjectCategories: ['customers'],
      estimatedDataSubjects: '<1000',
      processingType: ['collection', 'storage'],
      dataCategories: [
        { category: 'full_name', categoryGroup: 'identity', source: 'direct_from_subject' },
        { category: 'email', categoryGroup: 'contact', source: 'direct_from_subject' },
        { category: 'job_title', categoryGroup: 'employment', source: 'direct_from_subject' },
      ],
      suggestedVendorCategories: ['project_management'],
      retentionPeriod: 'Duration of contract + 12 months',
      securityMeasures: ['encryption_in_transit', 'access_controls'],
    },
  ],
};

export const onboardingRouter = router({
  getStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const [org] = await db.select({
        onboardingCompleted: organizations.onboardingCompleted,
        onboardingDismissed: organizations.onboardingDismissed,
        onboardingStep: organizations.onboardingStep,
      }).from(organizations).where(eq(organizations.id, ctx.user!.orgId));

      return org;
    }),

  saveOrgProfile: protectedProcedure
    .use(requireRole('owner'))
    .input(z.object({
      name: z.string().min(1),
      legalName: z.string().optional(),
      countryCode: z.string().length(2),
      industry: z.string().optional(),
      companySize: z.string().optional(),
      hasDpo: z.boolean().default(false),
      dpoName: z.string().optional(),
      dpoEmail: z.string().email().optional(),
      leadSupervisoryAuthority: z.string().optional(),
      slug: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const { industry, companySize, ...orgData } = input;

      const [org] = await db.update(organizations)
        .set({
          ...orgData,
          settings: sql`jsonb_set(jsonb_set(COALESCE(settings, '{}'::jsonb), '{industry}', ${JSON.stringify(industry)}::jsonb, true), '{companySize}', ${JSON.stringify(companySize)}::jsonb, true)`,
          onboardingStep: 1,
        })
        .where(eq(organizations.id, ctx.user!.orgId))
        .returning();

      return org;
    }),

  saveVendors: protectedProcedure
    .input(z.object({
      vendorIds: z.array(z.string()), // Accept string IDs temporarily for mock data
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.vendorIds.length > 0) {
        // Find existing vendors to not duplicate
        const existing = await db.select({ vendorId: organizationVendors.vendorId })
          .from(organizationVendors)
          .where(and(
            eq(organizationVendors.organizationId, ctx.user!.orgId),
            inArray(organizationVendors.vendorId, input.vendorIds)
          ));

        const existingIds = existing.map(e => e.vendorId);
        const toAdd = input.vendorIds.filter(id => !existingIds.includes(id));

        if (toAdd.length > 0) {
          await db.insert(organizationVendors).values(
            toAdd.map(id => ({
              organizationId: ctx.user!.orgId,
              vendorId: id,
              dpaStatus: 'not_started',
            }))
          );
        }
      }

      await db.update(organizations)
        .set({ onboardingStep: 2 })
        .where(eq(organizations.id, ctx.user!.orgId));

      return { success: true };
    }),

  getTemplates: protectedProcedure
    .input(z.object({ industry: z.string().default('marketing_agency') }))
    .query(async ({ input }) => {
      const industry = input.industry as keyof typeof ROPA_TEMPLATES;
      return ROPA_TEMPLATES[industry] || ROPA_TEMPLATES.marketing_agency;
    }),

  createFromTemplate: protectedProcedure
    .input(z.object({
      templateId: z.string(),
      industry: z.string().default('marketing_agency')
    }))
    .mutation(async ({ ctx, input }) => {
      const industry = input.industry as keyof typeof ROPA_TEMPLATES;
      const templates = ROPA_TEMPLATES[industry] || ROPA_TEMPLATES.marketing_agency;
      const template = templates.find(t => t.id === input.templateId);

      if (!template) {
        throw new Error('Template not found');
      }

      // Create main processing activity
      const [activity] = await db.insert(processingActivities).values({
        organizationId: ctx.user!.orgId,
        name: template.name,
        description: template.description,
        purpose: template.purpose,
        lawfulBasis: template.lawfulBasis,
        lawfulBasisDetail: template.lawfulBasisDetail,
        dataSubjectCategories: template.dataSubjectCategories,
        estimatedDataSubjects: template.estimatedDataSubjects,
        processingType: template.processingType,
        retentionPeriod: template.retentionPeriod,
        securityMeasures: template.securityMeasures,

      }).returning();

      // Insert data categories
      if (template.dataCategories.length > 0) {
        await db.insert(processingDataCategories).values(
          template.dataCategories.map(cat => ({
            processingActivityId: activity!.id,
            category: cat.category,
            categoryGroup: cat.categoryGroup,
            source: cat.source,
          }))
        );
      }

      // Link to existing organization vendors based on suggested categories
      if (template.suggestedVendorCategories.length > 0) {
        // Fetch org's vendors that match the suggested categories
        const matchingVendors = await db.select({
          id: vendors.id,
          name: vendors.name,
          category: vendors.category,
          headquartersCountry: vendors.headquartersCountry,
          orgVendorId: organizationVendors.id,
          usingEuHosting: organizationVendors.usingEuHosting,
        })
        .from(organizationVendors)
        .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
        .where(and(
          eq(organizationVendors.organizationId, ctx.user!.orgId),
          inArray(vendors.category, template.suggestedVendorCategories)
        ));

        for (const vendor of matchingVendors) {
          // Add as recipient
          await db.insert(processingRecipients).values({
            processingActivityId: activity!.id,
            recipientType: 'vendor',
            name: vendor.name,
            vendorId: vendor.id,
          });

          // Check if non-EU transfer needs to be created
          const hq = vendor.headquartersCountry;
          const isEuHq = hq && isAdequateDestination(hq);
          const hasEuHosting = vendor.usingEuHosting;

          if (!isEuHq && !hasEuHosting && hq) {
            await db.insert(processingTransfers).values({
              processingActivityId: activity!.id,
              destinationCountry: hq.substring(0, 2),
              destinationEntity: vendor.name,
              vendorId: vendor.id,
              transferMechanism: 'pending_assessment',
            });
          }
        }
      }

      await db.update(organizations)
        .set({ onboardingStep: 3 })
        .where(eq(organizations.id, ctx.user!.orgId));

      return activity;
    }),

  generatePolicy: protectedProcedure
    .input(z.object({}))
    .mutation(async ({ ctx }) => {
      // Stub for policy generation - creates the draft record
      // In reality this might call the AI or template engine

      const [org] = await db.select({ slug: organizations.slug })
        .from(organizations)
        .where(eq(organizations.id, ctx.user!.orgId));

      const [policy] = await db.insert(privacyPolicies).values({
        organizationId: ctx.user!.orgId,
        name: 'Website Privacy Policy',

        type: 'privacy_policy',
        language: 'en',

      }).returning();

      await db.insert(policyVersions).values({
        policyId: policy!.id,
        versionNumber: 1,
        contentHtml: '# Privacy Policy\n\nThis policy is auto-generated based on your Processing Activities.', contentMarkdown: '# Privacy Policy\n\nThis policy is auto-generated based on your Processing Activities.',

        createdBy: ctx.user!.id,
      });

      await db.update(organizations)
        .set({ onboardingStep: 4 })
        .where(eq(organizations.id, ctx.user!.orgId));

      return { policyId: policy!.id, publicUrlPath: `/legal/${org?.slug}/privacy` };
    }),

  publishPolicy: protectedProcedure
    .use(requireRole('admin'))
    .input(z.object({ policyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db.update(privacyPolicies)
        .set({ publishedAt: new Date() })
        .where(and(
          eq(privacyPolicies.id, input.policyId),
          eq(privacyPolicies.organizationId, ctx.user!.orgId)
        ));

      return { success: true };
    }),

  inviteTeam: protectedProcedure
    .use(requireRole('admin'))
    .input(z.object({
      invites: z.array(z.object({
        email: z.string().email(),
        role: z.string()
      }))
    }))
    .mutation(async ({ ctx, input }) => {
      // Just record they are invited (this would normally queue emails)
      for (const invite of input.invites) {
        // Check if user exists
        const [existingUser] = await db.select().from(users).where(eq(users.email, invite.email));
        if (!existingUser) {
          await db.insert(users).values({
            email: invite.email,
            role: invite.role,
            organizationId: ctx.user!.orgId,
            name: invite.email.split('@')[0],
            invitedAt: new Date(),
          } as any);
        }
      }

      await db.update(organizations)
        .set({ onboardingStep: 5 })
        .where(eq(organizations.id, ctx.user!.orgId));

      return { success: true };
    }),

  complete: protectedProcedure
    .mutation(async ({ ctx }) => {
      await db.update(organizations)
        .set({
          onboardingCompleted: true,
          onboardingCompletedAt: new Date(),
          onboardingStep: 6
        })
        .where(eq(organizations.id, ctx.user!.orgId));

      return { success: true };
    }),

  dismiss: protectedProcedure
    .mutation(async ({ ctx }) => {
      await db.update(organizations)
        .set({ onboardingDismissed: true })
        .where(eq(organizations.id, ctx.user!.orgId));

      return { success: true };
    }),

  resume: protectedProcedure
    .mutation(async ({ ctx }) => {
      const [org] = await db.select({ onboardingStep: organizations.onboardingStep })
        .from(organizations)
        .where(eq(organizations.id, ctx.user!.orgId));

      return { step: org?.onboardingStep || 0 };
    }),
});
