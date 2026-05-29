import { dispatchWebhook } from '../utils/webhookDispatcher.js';
import { paginatedQuery } from '../utils/pagination.js';
import { router, protectedProcedure, requirePermission } from '../trpc.js';
import { z } from 'zod';
import { db } from '../db.js';
import { privacyPolicies, policyVersions, organizations, vendors, organizationVendors, processingActivities } from 'db';
import { eq, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { diffWords } from 'diff';
import { Anthropic } from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'dummy_key',
});

const checkOrgContext = (user: any) => {
  if (!user.orgId) throw new TRPCError({ code: 'FORBIDDEN', message: 'No organization context' });
};

// Policy Generation Template Engine
export async function generatePolicyMarkdown(orgId: string, previousMarkdown?: string) {
  const [org] = await ctx.db.select().from(organizations).where(eq(organizations.id, orgId));
  if (!org) return { markdown: '', diffs: null, hasChanges: false };
  
  // Fetch ROPA data
  const activities = await ctx.db.select().from(processingActivities).where(eq(processingActivities.organizationId, orgId));
  const orgVends = await ctx.db.select({
    orgVendor: organizationVendors,
    vendor: vendors
  }).from(organizationVendors)
    .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
    .where(eq(organizationVendors.organizationId, orgId));

  let currentRopaState = `Organization Name: ${org.name}\n`;
  if (activities.length > 0) {
    currentRopaState += `\nProcessing Activities:\n`;
    for (const act of activities) {
      currentRopaState += `- ${act.name}: ${act.purpose} (Legal Basis: ${act.lawfulBasis})\n`;
    }
  }

  if (orgVends.length > 0) {
    currentRopaState += `\nThird-Party Vendors (Data Processors):\n`;
    for (const ov of orgVends) {
      currentRopaState += `- ${ov.vendor.name}: ${ov.orgVendor.purpose || ov.vendor.category} (Location: ${ov.vendor.headquartersCountry})\n`;
    }
  }

  let newMarkdown = previousMarkdown || '';

  try {
    const prompt = `You are a GDPR legal expert. 
Review the following current Privacy Policy (if any) and update it to strictly align with the current Record of Processing Activities (ROPA) and Vendors.
If there is no previous policy, write a comprehensive GDPR-compliant privacy policy from scratch using the ROPA data.
Ensure all data processors (vendors) and processing activities are accurately disclosed.
Output ONLY the final Markdown text of the updated policy. Do NOT wrap it in \`\`\`markdown, just return the raw text.

=== CURRENT POLICY ===
${previousMarkdown || '(No current policy)'}

=== CURRENT ROPA & VENDORS ===
${currentRopaState}
`;

    const msg = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    const aiText = msg.content.filter(block => block.type === 'text').map((block: any) => block.text).join('\n');
    if (aiText && aiText.trim().length > 0) {
      newMarkdown = aiText.trim();
    }
  } catch (err) {
    console.warn('AI Policy Generation failed, falling back to simple template', err);
    // Fallback simple generation
    newMarkdown = `# Privacy Policy for ${org.name}\n\nLast updated: ${new Date().toLocaleDateString()}\n\n## 1. Who we are\nThis privacy policy explains how ${org.name} ("we", "us", "our") collects, uses, and protects your personal data.\n\n`;
    if (activities.length > 0) {
      newMarkdown += `## 2. Processing Activities\n`;
      for (const act of activities) {
        newMarkdown += `- **${act.name}**: ${act.purpose}.\n`;
      }
    }
    if (orgVends.length > 0) {
      newMarkdown += `\n## 3. Data Processors\n`;
      for (const ov of orgVends) {
        newMarkdown += `- **${ov.vendor.name}**: Used for ${ov.orgVendor.purpose || ov.vendor.category}.\n`;
      }
    }
  }

  let diffs = null;
  let hasChanges = true;
  if (previousMarkdown) {
    const changes = diffWords(previousMarkdown, newMarkdown);
    hasChanges = changes.some(c => c.added || c.removed);
    diffs = changes;
  }

  return { markdown: newMarkdown, diffs, hasChanges };
}

const paginationInput = z.object({
  limit: z.number().min(1).max(100).default(25),
  cursor: z.string().nullish(),
});

export const policiesRouter = router({
  list: protectedProcedure
    .use(requirePermission('ropa', 'view')) // Requires privacy policies permission, using ropa for now
    .input(paginationInput)
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      return paginatedQuery(
        privacyPolicies,
        ctx.user!.orgId,
        { limit: input.limit, after: input.cursor || undefined },
        'createdAt',
        'desc'
      );
    }),

  getById: protectedProcedure
    .use(requirePermission('ropa', 'view'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [policy] = await ctx.db.select().from(privacyPolicies).where(eq(privacyPolicies.id, input.id));
      if (!policy) return null;
      
      const versions = await ctx.db.select().from(policyVersions)
        .where(eq(policyVersions.policyId, policy!.id))
        .orderBy(desc(policyVersions.versionNumber));
        
      return { policy, versions };
    }),

  create: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({ name: z.string(), type: z.string() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [policy] = await ctx.db.insert(privacyPolicies).values({
        organizationId: ctx.user!.orgId,
        name: input.name,
        type: input.type,
      }).returning();
      await dispatchWebhook(ctx.user!.orgId, 'policy.created', { policyId: policy!.id });
      return policy;
    }),

  generateDraft: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({ policyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      const [policy] = await ctx.db.select().from(privacyPolicies).where(eq(privacyPolicies.id, input.policyId));
      if (!policy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Policy not found' });
      
      const [currentVersion] = policy.currentVersionId 
        ? await ctx.db.select().from(policyVersions).where(eq(policyVersions.id, policy.currentVersionId))
        : [null];

      const { markdown, diffs } = await generatePolicyMarkdown(ctx.user!.orgId, currentVersion?.contentMarkdown);
      
      const [newVersion] = await ctx.db.insert(policyVersions).values({
        policyId: policy!.id,
        versionNumber: (currentVersion?.versionNumber || 0) + 1,
        contentMarkdown: markdown,
        contentHtml: `<div>${markdown.replace(/\n/g, '<br/>')}</div>`, // simplistic
        changeType: 'auto_generated',
        changeSummary: 'Generated from ROPA',
        diffFromPrevious: diffs,
        createdBy: ctx.user!.id,
      }).returning();
      
      await dispatchWebhook(ctx.user!.orgId, 'policy.updated', { policyId: policy!.id });
      return newVersion;
    }),

  publishVersion: protectedProcedure
    .use(requirePermission('ropa', 'edit'))
    .input(z.object({ policyId: z.string().uuid(), versionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      checkOrgContext(ctx.user);
      await ctx.db.update(privacyPolicies)
        .set({ currentVersionId: input.versionId, publishedAt: new Date() })
        .where(eq(privacyPolicies.id, input.policyId));
      await dispatchWebhook(ctx.user!.orgId, 'policy.published', { policyId: input.policyId });
      return { success: true };
    }),
});
