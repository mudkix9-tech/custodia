import { db } from '../db.js';
import { users, processingActivities, organizationVendors, dpias, consentDomains, organizations } from 'db';
import { eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { TIER_LIMITS, isNewAiWindow, aiWindowReset } from '../constants/aiQuota.js';

// The plan table and the monthly window rules live in constants/aiQuota.ts so
// they can be reached by the standalone fixtures -- this file imports db.js,
// which throws on import without DATABASE_URL. Re-exported so existing importers
// of TIER_LIMITS are unaffected.
export { TIER_LIMITS, isNewAiWindow, aiWindowReset } from '../constants/aiQuota.js';

export type ResourceType = 'users' | 'ropa' | 'vendors' | 'dpia' | 'domains' | 'ai';

export async function enforceLimit(
  database: typeof db,
  orgId: string,
  resourceType: ResourceType,
  incrementBy = 1,
  tx?: any
) {

  const executor = tx || database;

  // Use a transaction + FOR UPDATE lock to avoid race conditions during bulk operations
  const runTransaction = async (txn: any) => {
    // Lock the organization row
    const orgRes = await txn.select({ id: organizations.id, subscriptionTier: organizations.subscriptionTier })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .for('update');

    if (!orgRes.length) throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
    const tier = (orgRes[0].subscriptionTier as keyof typeof TIER_LIMITS) || 'professional';
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.professional;
    const limit = limits[resourceType];

    if (limit === Infinity) return;

    let currentCount = 0;

    switch (resourceType) {
      case 'users':
        const resUsers = await txn.select({ count: sql<number>`count(*)::int` }).from(users).where(eq(users.organizationId, orgId));
        currentCount = resUsers[0]?.count || 0;
        break;
      case 'ropa':
        const resRopa = await txn.select({ count: sql<number>`count(*)::int` }).from(processingActivities).where(eq(processingActivities.organizationId, orgId));
        currentCount = resRopa[0]?.count || 0;
        break;
      case 'vendors':
        const resVendors = await txn.select({ count: sql<number>`count(*)::int` }).from(organizationVendors).where(eq(organizationVendors.organizationId, orgId));
        currentCount = resVendors[0]?.count || 0;
        break;
      case 'dpia':
        const resDpia = await txn.select({ count: sql<number>`count(*)::int` }).from(dpias).where(eq(dpias.organizationId, orgId));
        currentCount = resDpia[0]?.count || 0;
        break;
      case 'domains':
        const resDomains = await txn.select({ count: sql<number>`count(*)::int` }).from(consentDomains).where(eq(consentDomains.organizationId, orgId));
        currentCount = resDomains[0]?.count || 0;
        break;
      default:
        throw new Error(`Unknown resource type: ${resourceType}`);
    }

    if (currentCount + incrementBy > limit) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `Subscription limit reached for ${resourceType}. Upgrade your plan to add more.`,
      });
    }
  };

  if (tx) {
    await runTransaction(tx);
  } else {
    await database.transaction(runTransaction);
  }
}

export async function trackAiUsage(orgId: string, tokensOrQueries = 1, tx?: any) {
  const executor = tx || db;
  
  const runTransaction = async (txn: any) => {
    const orgRes = await txn.select({
      id: organizations.id,
      subscriptionTier: organizations.subscriptionTier,
      aiQueriesUsed: organizations.aiQueriesUsed,
      aiLastResetAt: organizations.aiLastResetAt,
    })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .for('update');

    if (!orgRes.length) return;
    const org = orgRes[0];

    const tier = (org.subscriptionTier as keyof typeof TIER_LIMITS) || 'professional';
    const limit = TIER_LIMITS[tier]?.ai || TIER_LIMITS.professional.ai;

    if (limit === Infinity) {
      // Still track usage
      await txn.update(organizations)
        .set({ aiQueriesUsed: sql`${organizations.aiQueriesUsed} + ${tokensOrQueries}` })
        .where(eq(organizations.id, orgId));
      return;
    }

    // Check if month has rolled over
    const now = new Date();
    const lastReset = org.aiLastResetAt ? new Date(org.aiLastResetAt) : now;
    let currentUsage = org.aiQueriesUsed || 0;

    if (isNewAiWindow(lastReset, now)) {
      currentUsage = 0;
      // Both counters, because both hang off aiLastResetAt -- see isNewAiWindow.
      await txn.update(organizations)
        .set(aiWindowReset(now))
        .where(eq(organizations.id, orgId));
    }

    if (currentUsage + tokensOrQueries > limit) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `Monthly AI query limit reached. Upgrade your plan for more queries.`,
      });
    }

    await txn.update(organizations)
      .set({ aiQueriesUsed: sql`${organizations.aiQueriesUsed} + ${tokensOrQueries}` })
      .where(eq(organizations.id, orgId));
  };

  if (tx) {
    await runTransaction(tx);
  } else {
    await db.transaction(runTransaction);
  }
}
