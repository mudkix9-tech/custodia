import { createWorker, createQueue } from '../lib/queue.js';
import { db } from '../db.js';
import { privacyPolicies, policyVersions, users, organizations } from 'db';
import { eq, and } from 'drizzle-orm';
import { queueNotification } from '../utils/notifications.js';
import { generatePolicyMarkdown } from '../routers/policies.js';

export const policiesQueue = createQueue('policies-automation');

const policiesWorker = createWorker('policies-automation', async job => {
  if (job.name === 'policy-ropa-sync') {
    console.log('[Policies Worker] Running ROPA sync...');
    
    const activePolicies = await db.select().from(privacyPolicies).where(eq(privacyPolicies.syncWithRopa, true));
    
    for (const policy of activePolicies) {
      const [currentVersion] = policy.currentVersionId ? 
        await db.select().from(policyVersions).where(eq(policyVersions.id, policy.currentVersionId)) : [null];

      // Generate new policy based on current ROPA
      const { markdown: newMarkdown, diffs, hasChanges } = await generatePolicyMarkdown(policy.organizationId, currentVersion?.contentMarkdown);

      if (hasChanges) {
        console.log(`[Policies Worker] Changes detected for policy ${policy.id}`);
        // Create new draft version
        await db.insert(policyVersions).values({
          policyId: policy.id,
          versionNumber: (currentVersion?.versionNumber || 0) + 1,
          contentMarkdown: newMarkdown,
          contentHtml: `<div>${newMarkdown}</div>`, // Naive HTML for background worker
          changeType: 'auto_generated',
          diffFromPrevious: diffs,
          changeSummary: 'Auto-generated draft based on recent ROPA changes.',
        });

        // Notify owner
        const owners = await db.select().from(users).where(and(eq(users.organizationId, policy.organizationId), eq(users.role, 'owner')));
        const [org] = await db.select().from(organizations).where(eq(organizations.id, policy.organizationId));
        if (!org) continue;
        
        for (const owner of owners) {
          try {
            await queueNotification({
              organizationId: policy.organizationId,
              userId: owner.id,
              type: 'policy.out_of_sync',
              title: `[${org.name}] Privacy Policy out of sync with ROPA`,
              body: `Your Privacy Policy is out of date due to recent ROPA changes. A new draft has been generated. Please review and publish the updated version to remain compliant.`,
              actionUrl: `/policies/${policy.id}`
            });
          } catch (e) { console.error('Failed to queue policy sync email', e); }
        }
      }
    }
  }
}, { drainDelay: 60 });

policiesWorker.on('error', (err: Error) => console.warn('[Policies Worker] Error:', err.message));

export async function schedulePoliciesJobs() {
  try {
    const repeatableJobs = await policiesQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await policiesQueue.removeRepeatableByKey(job.key);
    }
    // Run daily
    await policiesQueue.add('policy-ropa-sync', {}, { repeat: { pattern: '0 3 * * *' } });
    console.log('✅ Policies background jobs scheduled');
  } catch (err: any) {
    console.warn('⚠️ Could not schedule Policies jobs:', err.message);
  }
}
