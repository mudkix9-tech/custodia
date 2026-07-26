import { createWorker, createQueue } from '../lib/queue.js';
import { db } from '../db.js';
import { regulatoryUpdateMatches, organizations, users } from 'db';
import { eq, isNull, inArray, and } from 'drizzle-orm';
import { queueNotification } from '../utils/notifications.js';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

export const regulatoryNotificationWorker = createWorker(
  'regulatory-notification-queue',
  async (job) => {
    // Note: the job payload doesn't need data since we're polling all un-notified matches
    console.log(`[RegulatoryNotificationWorker] Checking for unnotified high/medium assessments`);

    // 1. Fetch un-notified matches that are 'assessed' with 'high' or 'medium' confidence
    const unnotifiedMatches = await db.select()
      .from(regulatoryUpdateMatches)
      .where(
        and(
          eq(regulatoryUpdateMatches.status, 'assessed'),
          isNull(regulatoryUpdateMatches.notifiedAt),
          inArray(regulatoryUpdateMatches.confidence, ['high', 'medium'])
        )
      );

    if (unnotifiedMatches.length === 0) {
      console.log(`[RegulatoryNotificationWorker] No unnotified matches found.`);
      return { status: 'success', matchesNotified: 0 };
    }

    // 2. Group matches by organizationId
    const matchesByOrg = new Map<string, typeof unnotifiedMatches>();
    for (const match of unnotifiedMatches) {
      if (!matchesByOrg.has(match.organizationId)) {
        matchesByOrg.set(match.organizationId, []);
      }
      matchesByOrg.get(match.organizationId)!.push(match);
    }

    // 3. Process each organization's notifications
    for (const [orgId, matches] of matchesByOrg.entries()) {
      try {
        const title = `New Regulatory Impact`;
        const count = matches.length;
        const body = `${count} processing activit${count > 1 ? 'ies are' : 'y is'} affected by new regulatory guidance.`;
        
        await queueNotification({
          organizationId: orgId,
          type: 'regulatory_update.impact_detected',
          title,
          body,
          actionUrl: '/dashboard', // Deep link to dashboard to view widget
          metadata: { matchesCount: count }
        });

        // 4. Mark matches as notified
        const matchIds = matches.map(m => m.id);
        await db.update(regulatoryUpdateMatches)
          .set({ notifiedAt: new Date() })
          .where(inArray(regulatoryUpdateMatches.id, matchIds));
          
        console.log(`[RegulatoryNotificationWorker] Queued notification for org ${orgId} (${count} matches).`);
      } catch (err) {
        console.error(`[RegulatoryNotificationWorker] Failed to notify org ${orgId}:`, err);
      }
    }

    return { status: 'success', matchesNotified: unnotifiedMatches.length, orgsNotified: matchesByOrg.size };
  }, { drainDelay: 60 });

const regulatoryNotificationQueue = createQueue('regulatory-notification-queue');

export async function scheduleRegulatoryNotificationJobs() {
  await regulatoryNotificationQueue.add('check-regulatory-notifications', {}, {
    repeat: {
      pattern: '0 * * * *', // Run every hour at the top of the hour
    },
  });
  console.log('Scheduled regulatory notification checks');
}
