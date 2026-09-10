import { db } from '../db.js';
import { regulatoryUpdates, regulatoryImpactAssessments, organizations, processingActivities, processingTransfers, organizationVendors, users } from 'db';
import { eq, inArray, isNull, and, sql } from 'drizzle-orm';
import { queueNotification } from '../utils/notifications.js';

export async function generateImpactAssessments(updateId: string) {
  const update = await db.query.regulatoryUpdates.findFirst({
    where: eq(regulatoryUpdates.id, updateId),
  });

  if (!update) throw new Error('Update not found');

  const orgs = await db.query.organizations.findMany({
    where: isNull(organizations.deletedAt),
  });

  for (const org of orgs) {
    const matches = await matchOrgAgainstRules(org.id, (update.impactRules as any[]) || []);

    if (matches.affectedActivities.length === 0 && matches.affectedVendors.length === 0 && matches.affectedTransfers.length === 0) {
      continue; // Update doesn't affect this org
    }

    await db.insert(regulatoryImpactAssessments).values({
      regulatoryUpdateId: updateId,
      organizationId: org.id,
      affectedActivities: matches.affectedActivities, // Assuming these columns use jsonb in db
      affectedVendors: matches.affectedVendors,
      affectedTransfers: matches.affectedTransfers,
      recommendedActions: matches.recommendedActions,
      status: 'unread',
    });

    await queueNotification({
      organizationId: org.id,
      type: 'regulatory.update_published' as any,
      title: `Regulatory update: ${update.title}`,
      body: `This update affects ${matches.affectedActivities.length} of your processing activities.`,
      actionUrl: `/updates/${updateId}`,
    });
  }
}

async function matchOrgAgainstRules(orgId: string, rules: any[]) {
  const affectedActivities: any[] = [];
  const affectedVendors: any[] = [];
  const affectedTransfers: any[] = [];
  const recommendedActions: any[] = [];

  for (const rule of rules) {
    // Match each rule's conditions against the org's data
    if (rule.conditions.hasTransfersTo) {
      // Find all activities for this org
      const activities = await db.query.processingActivities.findMany({
        where: eq(processingActivities.organizationId, orgId)
      });
      if (activities.length > 0) {
        const matchingTransfers = await db.query.processingTransfers.findMany({
          where: and(
              inArray(processingTransfers.processingActivityId, activities.map(a => a.id)),
              inArray(processingTransfers.destinationCountry, rule.conditions.hasTransfersTo)
          )
        });
        affectedTransfers.push(...matchingTransfers);

        // Push associated activities
        for (const mt of matchingTransfers) {
           const act = activities.find(a => a.id === mt.processingActivityId);
           if (act && !affectedActivities.find(a => a.activityId === act.id)) {
               affectedActivities.push({
                   activityId: act.id,
                   activityName: act.name,
                   reason: rule.messageTemplate || `Transfers to ${mt.destinationCountry}`
               });
           }
        }
      }
    }

    if (rule.conditions.usesVendorCategory) {
      const orgVendorsList = await db.query.organizationVendors.findMany({
          where: eq(organizationVendors.organizationId, orgId),
          with: { vendor: true }
      });
      const matched = orgVendorsList.filter((ov: any) => rule.conditions.usesVendorCategory.includes(ov.vendor?.category));
      for (const ov of matched) {
          if (!affectedVendors.find(v => v.vendorId === ov.vendorId)) {
             affectedVendors.push({
                 vendorId: ov.vendorId,
                 vendorName: (ov as any).vendor?.name,
                 reason: rule.messageTemplate || `Uses vendor category: ${(ov as any).vendor?.category}`
             });
          }
      }
    }

    if (rule.recommendedActions) {
       recommendedActions.push(...rule.recommendedActions);
    }
  }


  return { affectedActivities, affectedVendors, affectedTransfers, recommendedActions };
}

export async function matchRegulatoryUpdateToOrganizations(documentId: string) {
  // Find organizations that have had at least one user login in the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  // The queue is imported here rather than at the top to avoid a circular
  // dependency; it does not depend on the org lookup, so the two resolve together.
  const [activeOrgs, { impactAssessmentQueue }] = await Promise.all([
    db.selectDistinct({ id: organizations.id })
      .from(organizations)
      .innerJoin(users, eq(users.organizationId, organizations.id))
      .where(
        and(
          isNull(organizations.deletedAt),
          sql`${users.lastLoginAt} >= ${thirtyDaysAgo}`
        )
      ),
    import('../workers/impactAssessmentWorker.js'),
  ]);
  
  if (!impactAssessmentQueue) {
    console.warn('[RegulatoryImpact] Queue not available, unable to dispatch match jobs');
    return;
  }

  console.log(`[RegulatoryImpact] Dispatching semantic match jobs for ${activeOrgs.length} active orgs...`);

  for (const org of activeOrgs) {
    await impactAssessmentQueue.add('match-org-semantic', { 
      documentId, 
      organizationId: org.id 
    });
  }
}
