/**
 * C34–C36. The discovery scan.
 *
 * Three sources, one pass, one upsert-and-resolve cycle — the pattern
 * `consent_findings` established and the reason `ropa_discovery_signals` carries a
 * UNIQUE over (org, source, source_key): an upsert bumps `last_seen_at`, anything a
 * completed run did not touch flips to `resolved`, and re-running the scan is free.
 *
 * The resolve half is the part worth being careful about. A vendor that appears in
 * the queue on Monday and is added to an activity on Tuesday should *disappear* on
 * Wednesday, not sit there as a permanent reminder of work already done. And a
 * signal a human dismissed must never come back with a fresh id and the same text
 * — which is why dismissal is excluded from both halves rather than only from the
 * insert.
 *
 * Dormant by default. It writes into a queue and can notify, and the first run
 * against an established register will find real work — which a customer should
 * meet because they turned discovery on, not because they deployed on a Tuesday.
 */
import { createWorker, createQueue, type Job } from '../lib/queue.js';
import { db } from '../db.js';
import {
  ropaDiscoverySignals,
  organizations,
  organizationVendors,
  vendors,
  organizationIntegrations,
  processingActivities,
  processingRecipients,
  consentDomains,
  consentTrackerObservations,
  consentScanRuns,
  trackerRegistry,
  users,
} from 'db';
import { and, eq, desc, inArray, isNull, ne, sql } from 'drizzle-orm';
import { queueNotification } from '../utils/notifications.js';
import {
  vendorSignal,
  trackerSignal,
  connectorSignal,
  isVendorReferenced,
  isTrackerReferenced,
  type DiscoverySignal,
} from '../lib/ropaDiscovery.js';

export const ropaDiscoveryQueue = process.env.NODE_ENV === 'test'
  ? null as any
  : createQueue('ropa-discovery');

export const ropaDiscoveryWorker = createWorker('ropa-discovery', async (job: Job) => {
  if (job.name === 'ropa-discovery-dispatch') {
    const orgs = await db.select({ id: organizations.id }).from(organizations)
      .where(isNull(organizations.deletedAt));
    for (const org of orgs) {
      await ropaDiscoveryQueue.add('ropa-discovery-scan', { orgId: org.id });
    }
    return { dispatched: orgs.length };
  }

  const orgId = job.data?.orgId;
  if (!orgId) return { skipped: true, reason: 'No organisation' };
  return scanOrganisation(orgId);
});

async function scanOrganisation(orgId: string) {
  const signals: DiscoverySignal[] = [
    ...(await scanVendors(orgId)),
    ...(await scanTrackers(orgId)),
    ...(await scanConnectors(orgId)),
  ];

  const seen = new Set<string>();
  let created = 0;

  for (const signal of signals) {
    seen.add(`${signal.source}::${signal.sourceKey}`);

    const [existing] = await db.select({ id: ropaDiscoverySignals.id, status: ropaDiscoverySignals.status })
      .from(ropaDiscoverySignals)
      .where(and(
        eq(ropaDiscoverySignals.organizationId, orgId),
        eq(ropaDiscoverySignals.source, signal.source),
        eq(ropaDiscoverySignals.sourceKey, signal.sourceKey),
      ));

    if (existing) {
      // A dismissed signal keeps its dismissal. A human judged it; the scan finding
      // the same evidence again is not new information.
      if (existing.status === 'dismissed' || existing.status === 'accepted') {
        await db.update(ropaDiscoverySignals)
          .set({ lastSeenAt: new Date(), detectionCount: sql`${ropaDiscoverySignals.detectionCount} + 1` })
          .where(eq(ropaDiscoverySignals.id, existing.id));
        continue;
      }

      await db.update(ropaDiscoverySignals)
        .set({
          ...signalColumns(signal),
          status: 'open',
          lastSeenAt: new Date(),
          detectionCount: sql`${ropaDiscoverySignals.detectionCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(ropaDiscoverySignals.id, existing.id));
      continue;
    }

    await db.insert(ropaDiscoverySignals).values({
      organizationId: orgId,
      ...signalColumns(signal),
      status: 'open',
    }).onConflictDoNothing();
    created += 1;
  }

  // Anything the completed run did not touch is no longer true, so it resolves.
  // Scoped to `open` only: an accepted signal is history and a dismissed one is a
  // decision, and neither is something a scan should quietly overwrite.
  const open = await db.select({ id: ropaDiscoverySignals.id, source: ropaDiscoverySignals.source, sourceKey: ropaDiscoverySignals.sourceKey })
    .from(ropaDiscoverySignals)
    .where(and(
      eq(ropaDiscoverySignals.organizationId, orgId),
      eq(ropaDiscoverySignals.status, 'open'),
    ));

  const stale = open.filter((s: any) => !seen.has(`${s.source}::${s.sourceKey}`)).map((s: any) => s.id);
  if (stale.length > 0) {
    await db.update(ropaDiscoverySignals)
      .set({ status: 'resolved', updatedAt: new Date() })
      .where(and(
        eq(ropaDiscoverySignals.organizationId, orgId),
        inArray(ropaDiscoverySignals.id, stale),
      ));
  }

  if (created > 0) await notifyOwner(orgId, created);
  return { signals: signals.length, created, resolved: stale.length };
}

function signalColumns(signal: DiscoverySignal) {
  return {
    source: signal.source,
    sourceKey: signal.sourceKey,
    title: signal.title.slice(0, 255),
    description: signal.description,
    confidence: signal.confidence,
    suggestedName: signal.suggestedName.slice(0, 255),
    suggestedPurpose: signal.suggestedPurpose,
    suggestedLawfulBasis: signal.suggestedLawfulBasis,
    suggestedDataCategories: signal.suggestedDataCategories as any,
    suggestedDataSubjects: signal.suggestedDataSubjects as any,
    suggestedRecipients: signal.suggestedRecipients as any,
    suggestedTransfers: signal.suggestedTransfers as any,
    evidence: signal.evidence as any,
    vendorId: signal.vendorId ?? null,
    consentDomainId: signal.consentDomainId ?? null,
    integrationId: signal.integrationId ?? null,
  };
}

// ---------------------------------------------------------------------------
// C34 — vendors nothing references
// ---------------------------------------------------------------------------
async function scanVendors(orgId: string): Promise<DiscoverySignal[]> {
  const linked = await db.select({
    organizationVendorId: organizationVendors.id,
    vendorId: organizationVendors.vendorId,
    dpaStatus: organizationVendors.dpaStatus,
    dataCategoriesShared: organizationVendors.dataCategoriesShared,
    name: vendors.name,
    category: vendors.category,
    description: vendors.description,
    headquartersCountry: vendors.headquartersCountry,
    dataProcessingLocations: vendors.dataProcessingLocations,
    typicalDataCategories: vendors.typicalDataCategories,
    transferMechanisms: vendors.transferMechanisms,
  })
    .from(organizationVendors)
    .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
    .where(eq(organizationVendors.organizationId, orgId));

  if (linked.length === 0) return [];

  const recipients = await db.select({
    vendorId: processingRecipients.vendorId,
    name: processingRecipients.name,
  })
    .from(processingRecipients)
    .innerJoin(processingActivities, eq(processingRecipients.processingActivityId, processingActivities.id))
    .where(and(
      eq(processingActivities.organizationId, orgId),
      isNull(processingActivities.deletedAt),
    ));

  return linked
    .filter((v: any) => v.vendorId && !isVendorReferenced(v.vendorId, v.name ?? '', recipients as any))
    .map((v: any) => vendorSignal({
      vendorId: v.vendorId,
      organizationVendorId: v.organizationVendorId,
      name: v.name ?? 'Unnamed vendor',
      category: v.category,
      description: v.description,
      headquartersCountry: v.headquartersCountry,
      dataProcessingLocations: v.dataProcessingLocations,
      typicalDataCategories: v.typicalDataCategories,
      // From the shared catalogue, which is the only place a mechanism is recorded
      // against a vendor — `organization_vendors` has no such column. The draft
      // carries it as evidence for the reviewer, never as the transfer's own
      // mechanism: `accept` writes `pending_assessment` regardless (D17).
      transferMechanisms: v.transferMechanisms,
      dpaStatus: v.dpaStatus,
      dataCategoriesShared: v.dataCategoriesShared,
    }));
}

// ---------------------------------------------------------------------------
// C35 — trackers no activity explains
// ---------------------------------------------------------------------------
async function scanTrackers(orgId: string): Promise<DiscoverySignal[]> {
  const domains = await db.select({ id: consentDomains.id, domain: consentDomains.domain })
    .from(consentDomains)
    .where(eq(consentDomains.organizationId, orgId));
  if (domains.length === 0) return [];

  // The register's own text, as one haystack. A tracker is "accounted for" if any
  // activity mentions it anywhere — a recipient row, a purpose, a description —
  // because the register's answer to "we use Google Analytics" is as often a
  // sentence in a purpose as it is a structured recipient.
  const [activities, recipients] = await Promise.all([
    db.select({ name: processingActivities.name, purpose: processingActivities.purpose, description: processingActivities.description })
      .from(processingActivities)
      .where(and(eq(processingActivities.organizationId, orgId), isNull(processingActivities.deletedAt))),
    db.select({ name: processingRecipients.name })
      .from(processingRecipients)
      .innerJoin(processingActivities, eq(processingRecipients.processingActivityId, processingActivities.id))
      .where(and(eq(processingActivities.organizationId, orgId), isNull(processingActivities.deletedAt))),
  ]);

  const haystacks = [
    ...activities.flatMap((a: any) => [a.name, a.purpose, a.description]),
    ...recipients.map((r: any) => r.name),
  ].filter((v): v is string => typeof v === 'string' && v.length > 0);

  const signals: DiscoverySignal[] = [];

  for (const domain of domains) {
    // The latest successful scan of this domain, and only that one. Observations
    // from a failed run describe a page that did not finish loading, and a
    // discovery queue built on those would fill with trackers that were never there.
    const [run] = await db.select({ id: consentScanRuns.id })
      .from(consentScanRuns)
      .where(and(eq(consentScanRuns.domainId, domain.id), eq(consentScanRuns.status, 'ok')))
      .orderBy(desc(consentScanRuns.startedAt))
      .limit(1);
    if (!run) continue;

    const observations = await db.select({
      observedHost: consentTrackerObservations.observedHost,
      trackerKey: consentTrackerObservations.trackerKey,
      provider: consentTrackerObservations.provider,
      requiredCategory: consentTrackerObservations.requiredCategory,
      matchedVendorId: consentTrackerObservations.matchedVendorId,
      carriedIdentifiers: consentTrackerObservations.carriedIdentifiers,
      pass: consentTrackerObservations.pass,
      requestCount: consentTrackerObservations.requestCount,
      purpose: trackerRegistry.purpose,
    })
      .from(consentTrackerObservations)
      .leftJoin(trackerRegistry, eq(consentTrackerObservations.trackerKey, trackerRegistry.trackerKey))
      .where(eq(consentTrackerObservations.scanRunId, run.id));

    // One signal per host, not per observation: the same host appears once in the
    // pre-consent pass and once in the post-consent pass, and two identical cards
    // is how a queue gets ignored.
    const byHost = new Map<string, typeof observations[number] & { firedPreConsent: boolean }>();
    for (const o of observations) {
      const existing = byHost.get(o.observedHost);
      const firedPreConsent = (existing?.firedPreConsent ?? false) || o.pass === 'pre_consent';
      byHost.set(o.observedHost, { ...(existing ?? o), ...o, firedPreConsent });
    }

    for (const observation of byHost.values()) {
      // A first-party host is the site itself, not a third party the register has
      // failed to mention.
      if (observation.observedHost.endsWith(domain.domain)) continue;
      if (isTrackerReferenced(observation, haystacks)) continue;

      signals.push(trackerSignal({
        domainId: domain.id,
        domain: domain.domain,
        observedHost: observation.observedHost,
        trackerKey: observation.trackerKey,
        provider: observation.provider,
        requiredCategory: observation.requiredCategory,
        purpose: observation.purpose,
        matchedVendorId: observation.matchedVendorId,
        carriedIdentifiers: observation.carriedIdentifiers,
        firedPreConsent: observation.firedPreConsent,
        requestCount: observation.requestCount,
      }));
    }
  }

  return signals;
}

// ---------------------------------------------------------------------------
// C36 — connected SaaS with no record behind it
// ---------------------------------------------------------------------------
async function scanConnectors(orgId: string): Promise<DiscoverySignal[]> {
  const integrations = await db.select({
    id: organizationIntegrations.id,
    provider: organizationIntegrations.provider,
    providerAccountName: organizationIntegrations.providerAccountName,
    createdAt: organizationIntegrations.createdAt,
  })
    .from(organizationIntegrations)
    .where(and(
      eq(organizationIntegrations.organizationId, orgId),
      eq(organizationIntegrations.status, 'active'),
    ));
  if (integrations.length === 0) return [];

  const activities = await db.select({
    name: processingActivities.name,
    purpose: processingActivities.purpose,
    description: processingActivities.description,
  })
    .from(processingActivities)
    .where(and(eq(processingActivities.organizationId, orgId), isNull(processingActivities.deletedAt)));

  const recipients = await db.select({ name: processingRecipients.name })
    .from(processingRecipients)
    .innerJoin(processingActivities, eq(processingRecipients.processingActivityId, processingActivities.id))
    .where(and(eq(processingActivities.organizationId, orgId), isNull(processingActivities.deletedAt)));

  const haystack = [
    ...activities.flatMap((a: any) => [a.name, a.purpose, a.description]),
    ...recipients.map((r: any) => r.name),
  ].filter(Boolean).join('   ').toLowerCase();

  return integrations
    .map((i: any) => connectorSignal({
      id: i.id,
      provider: i.provider,
      providerAccountName: i.providerAccountName,
      connectedAt: i.createdAt,
    }))
    .filter((s): s is DiscoverySignal => {
      if (!s) return false;
      // Matched on the provider slug rather than the profile label, because
      // "Microsoft 365" in a purpose and "microsoft" as a provider are the same
      // fact and only one of them is a substring of the other.
      const provider = String(s.evidence.provider ?? '').toLowerCase();
      return provider.length > 2 && !haystack.includes(provider);
    });
}

/**
 * Who hears that discovery found something.
 *
 * One in-app notification per scan carrying a count, not one per signal. The first
 * scan of an established register can produce forty findings, and forty
 * notifications is an unsubscribe.
 */
async function notifyOwner(orgId: string, created: number) {
  const [owner] = await db.select({ id: users.id })
    .from(users)
    .where(and(eq(users.organizationId, orgId), inArray(users.role, ['admin', 'owner'])))
    .limit(1);
  if (!owner) return;

  await queueNotification({
    organizationId: orgId,
    userId: owner.id,
    type: 'ropa.discovery.found',
    title: `${created} thing${created === 1 ? '' : 's'} your register does not account for`,
    body: 'Discovery found vendors, trackers or connected systems that no processing activity describes.',
    actionUrl: '/ropa/discovery',
  });
}
