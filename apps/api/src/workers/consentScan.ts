import { createWorker, createQueue, Job } from '../lib/queue.js';
import { db } from '../db.js';
import {
  consentDomains,
  consentFindings,
  consentScanRuns,
  consentTrackerObservations,
  organizationVendors,
  vendors,
} from 'db';
import { and, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import crypto from 'crypto';
import {
  scanDomainTwoPass,
  type PassResult,
  type PostConsentMethod,
  type ScanPass,
  type TwoPassScanResult,
} from '../lib/browserPool.js';
import { CMP_REGISTRY, acceptanceCookiesFor, detectCmp } from '../lib/cmpRegistry.js';
import {
  classifyCookieName,
  loadTrackerRegistry,
  matchTrackerByDomain,
  type TrackerEntry,
} from '../lib/trackerRegistry.js';
import {
  evaluateConsentScan,
  type EvaluatorCookie,
  type EvaluatorObservation,
  type Finding,
} from '../lib/consentEvaluator.js';

export const consentScanQueue = createQueue('consent-scan');

const SCAN_INTERVAL_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

/** Spread of the dispatch window, so a single-concurrency cluster is not hit at once. */
const JITTER_WINDOW_SECONDS = 3 * 60 * 60;

/**
 * Deterministic per-domain offset. Hashing the id rather than randomising means a
 * re-dispatch lands a domain in the same slot instead of reshuffling the queue.
 */
function jitterSecondsFor(domainId: string): number {
  const hash = crypto.createHash('sha1').update(domainId).digest();
  return hash.readUInt32BE(0) % JITTER_WINDOW_SECONDS;
}

function isDue(lastRunAt: Date | null, frequency: string | null): boolean {
  if (!lastRunAt) return true;
  const days = SCAN_INTERVAL_DAYS[frequency ?? 'weekly'] ?? 7;
  return Date.now() - lastRunAt.getTime() >= days * 24 * 60 * 60 * 1000;
}

/**
 * Every CMP's acceptance cookie is seeded on pass 2 at once. A page ignores cookies
 * belonging to a CMP it does not run, so this reaches a consented state in a single
 * scan instead of spending a page load on detection first. Which CMP was actually
 * present is worked out afterwards from pass 1, and that is what decides whether
 * the acceptance is treated as reliable.
 */
export function allAcceptanceCookies(domain: string) {
  return CMP_REGISTRY.flatMap(cmp => acceptanceCookiesFor(cmp, domain));
}

export function resolvePostConsentMethod(
  scannerMethod: PostConsentMethod,
  detectedCmpKey: string | null
): PostConsentMethod {
  const detected = CMP_REGISTRY.find(c => c.key === detectedCmpKey);
  const clicked = scannerMethod === 'clicked' || scannerMethod === 'seeded_and_clicked';

  if (detected && detected.acceptanceCookies.length > 0) return 'seeded_cookies';
  if (clicked) return 'clicked';
  return 'unknown';
}

type EnrichedObservation = EvaluatorObservation & {
  sampleUrl: string | null;
  resourceType: string | null;
  requestCount: number;
};

export function enrichPass(
  pass: PassResult,
  registry: TrackerEntry[],
  vendorIdBySlug: Map<string, string>
): EnrichedObservation[] {
  return pass.requests.map(request => {
    let path = '';
    try {
      path = new URL(request.url).pathname;
    } catch {
      path = '';
    }

    const tracker = matchTrackerByDomain(request.host, registry, path);
    const slug = tracker?.vendorSlug ?? null;

    return {
      observedHost: request.host,
      trackerKey: tracker?.trackerKey ?? null,
      provider: tracker?.provider ?? null,
      requiredCategory: tracker?.requiredCategory ?? null,
      vendorSlug: slug,
      matchedVendorId: slug ? vendorIdBySlug.get(slug) ?? null : null,
      pass: pass.pass,
      resourceType: request.resourceType ?? null,
      carriedIdentifiers: request.carriedIdentifiers,
      consentSignal: request.consentSignal,
      requestCount: request.requestCount,
      sampleUrl: request.url || null,
    };
  });
}

/**
 * Classifies the cookies the scan itself observed, rather than trusting stale rows.
 *
 * `planted` are the acceptance cookies pass 2 seeded to reach a consented state.
 * They come back out of page.cookies() indistinguishable from the site's own, and
 * counting them meant a clean site reported a dozen unclassified_cookie findings
 * about cookies the scanner had put there.
 *
 * The name alone cannot settle who set it, because a site running one of the CMPs
 * in the registry writes a cookie of exactly the name we plant — a live scan of
 * cookieyes.com had its real `cookieyes-consent` suppressed this way. The pass is
 * what settles it: pass 1 is never seeded, so anything it saw is the site's own and
 * is kept. Only pass 2 can be carrying the scanner's cookies. Both passes are still
 * merged so a cookie set only after consent is not lost.
 *
 * The residual case is a CMP that writes its consent cookie *only* after acceptance:
 * our seeded value overwrote it, the names are identical and nothing in
 * `ScannedCookie` can separate them, so it is dropped. That costs one `necessary`
 * cookie that raises no finding, against the dozen false ones counting our own would
 * raise. Comparing values would settle it, but cookie values carry identifiers and
 * deliberately never reach our evidence tables.
 */
export function toEvaluatorCookies(
  passes: PassResult[],
  registry: TrackerEntry[],
  planted: Set<string>
): EvaluatorCookie[] {
  const seen = new Map<string, EvaluatorCookie>();
  for (const pass of passes) {
    for (const cookie of pass.cookies) {
      if (pass.pass !== 'pre_consent' && planted.has(cookie.name)) continue;
      if (seen.has(cookie.name)) continue;
      const classification = classifyCookieName(cookie.name, registry);
      seen.set(cookie.name, {
        cookieName: cookie.name,
        category: classification.category,
        provider: classification.provider,
        isThirdParty: cookie.isThirdParty,
      });
    }
  }
  return Array.from(seen.values());
}

async function loadVendorIdsBySlug(): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: vendors.id, slug: vendors.slug })
    .from(vendors)
    .where(isNotNull(vendors.slug));

  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.slug && !map.has(row.slug)) map.set(row.slug, row.id);
  }
  return map;
}

async function loadKnownVendorSlugs(organizationId: string): Promise<string[]> {
  const rows = await db
    .select({ slug: vendors.slug })
    .from(organizationVendors)
    .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
    .where(eq(organizationVendors.organizationId, organizationId));

  return rows.map(r => r.slug).filter((s): s is string => Boolean(s));
}

async function persistObservations(
  scanRunId: string,
  domainId: string,
  observations: EnrichedObservation[]
) {
  if (observations.length === 0) return;

  // The scanner already aggregates by host per pass, so (run, host, pass) is unique
  // by construction. onConflictDoNothing only guards against a retried insert.
  const values = observations.map(o => ({
    scanRunId,
    domainId,
    observedHost: o.observedHost.slice(0, 255),
    trackerKey: o.trackerKey,
    provider: o.provider,
    requiredCategory: o.requiredCategory,
    matchedVendorId: o.matchedVendorId ?? null,
    pass: o.pass,
    resourceType: o.resourceType ? o.resourceType.slice(0, 30) : null,
    carriedIdentifiers: o.carriedIdentifiers,
    consentSignal: o.consentSignal,
    requestCount: o.requestCount,
    sampleUrl: o.sampleUrl,
  }));

  const chunkSize = 200;
  for (let i = 0; i < values.length; i += chunkSize) {
    await db
      .insert(consentTrackerObservations)
      .values(values.slice(i, i + chunkSize))
      .onConflictDoNothing();
  }
}

/**
 * Upserts findings on (domain, type, host) and then resolves anything this run did
 * not re-observe. Fixing the banner therefore closes the finding on the next scan,
 * and the closure is dated evidence of the remediation.
 */
async function reconcileFindings(
  organizationId: string,
  domainId: string,
  scanRunId: string,
  findings: Finding[]
): Promise<number> {
  const now = new Date();

  // Both key columns are varchar(255) and the sweep below reads them back from the
  // database, so the key has to be built from the values as *persisted*. Truncating
  // at insert but keying on the raw finding meant any cookie name past 255 characters
  // could not match itself, and the run that wrote the finding immediately resolved
  // it again — the same self-resolving sweep that per-cookie findings hit before
  // migration 0043, arriving by a different route.
  const persisted = findings.map(finding => ({
    finding,
    observedHost: finding.observedHost.slice(0, 255),
    subject: (finding.subject ?? '').slice(0, 255),
  }));

  for (const { finding, observedHost, subject } of persisted) {
    await db
      .insert(consentFindings)
      .values({
        organizationId,
        domainId,
        findingType: finding.findingType,
        severity: finding.severity,
        trackerKey: finding.trackerKey,
        provider: finding.provider,
        observedHost,
        subject,
        requiredCategory: finding.requiredCategory,
        matchedVendorId: finding.matchedVendorId,
        evidence: finding.evidence,
        confidence: finding.confidence.toFixed(2),
        state: 'open',
        firstSeenAt: now,
        lastSeenAt: now,
        firstScanRunId: scanRunId,
        lastScanRunId: scanRunId,
      })
      .onConflictDoUpdate({
        target: [
          consentFindings.domainId,
          consentFindings.findingType,
          consentFindings.observedHost,
          consentFindings.subject,
        ],
        set: {
          severity: finding.severity,
          trackerKey: finding.trackerKey,
          provider: finding.provider,
          requiredCategory: finding.requiredCategory,
          matchedVendorId: finding.matchedVendorId,
          evidence: finding.evidence,
          confidence: finding.confidence.toFixed(2),
          lastSeenAt: now,
          lastScanRunId: scanRunId,
          // A finding a user dismissed stays dismissed; only reopen what the scan
          // itself had previously closed.
          state: sql`CASE WHEN ${consentFindings.state} = 'resolved' THEN 'open' ELSE ${consentFindings.state} END`,
          resolvedAt: sql`CASE WHEN ${consentFindings.state} = 'resolved' THEN NULL ELSE ${consentFindings.resolvedAt} END`,
        },
      });
  }

  // Anything still open that this run did not touch has been fixed.
  const stillPresent = new Set(
    persisted.map(p => `${p.finding.findingType}|${p.observedHost}|${p.subject}`)
  );
  const openFindings = await db
    .select({
      id: consentFindings.id,
      findingType: consentFindings.findingType,
      observedHost: consentFindings.observedHost,
      subject: consentFindings.subject,
    })
    .from(consentFindings)
    .where(and(eq(consentFindings.domainId, domainId), eq(consentFindings.state, 'open')));

  const staleIds = openFindings
    .filter(f => !stillPresent.has(`${f.findingType}|${f.observedHost}|${f.subject ?? ''}`))
    .map(f => f.id);

  if (staleIds.length > 0) {
    await db
      .update(consentFindings)
      .set({ state: 'resolved', resolvedAt: now, lastScanRunId: scanRunId })
      .where(inArray(consentFindings.id, staleIds));
  }

  const [openCount] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(consentFindings)
    .where(
      and(
        eq(consentFindings.domainId, domainId),
        eq(consentFindings.state, 'open'),
        ne(consentFindings.severity, 'info')
      )
    );

  return openCount?.total ?? 0;
}

export async function reconcileDomain(domainId: string): Promise<string | null> {
  const [domainRow] = await db
    .select()
    .from(consentDomains)
    .where(eq(consentDomains.id, domainId));

  if (!domainRow) {
    console.warn(`[Consent Scan] Domain ${domainId} not found.`);
    return null;
  }

  const [run] = await db
    .insert(consentScanRuns)
    .values({
      organizationId: domainRow.organizationId,
      domainId: domainRow.id,
      status: 'running',
    })
    .returning({ id: consentScanRuns.id });

  if (!run) return null;

  try {
    const registry = await loadTrackerRegistry();
    const vendorIdBySlug = await loadVendorIdsBySlug();
    const knownVendorSlugs = await loadKnownVendorSlugs(domainRow.organizationId);

    const seedCookies = allAcceptanceCookies(domainRow.domain);
    const plantedCookieNames = new Set(seedCookies.map(c => c.name));

    const scan: TwoPassScanResult = await scanDomainTwoPass(`https://${domainRow.domain}`, {
      consentCookies: seedCookies,
      allowClickFallback: true,
    });

    const preObservations = enrichPass(scan.pre, registry, vendorIdBySlug);
    const postObservations = enrichPass(scan.post, registry, vendorIdBySlug);
    const observations = [...preObservations, ...postObservations];

    // Custodia's banner has no distinguishing host, so it is identified by the page
    // fetching this domain's own banner script.
    const servesCustodiaBanner = scan.pre.requests.some(r =>
      r.url.includes(`/api/cmp/${domainRow.scriptId}/`)
    );
    const detected = detectCmp(
      scan.pre.requests.map(r => r.host),
      scan.pre.cookies.map(c => c.name)
    );
    const cmpKey = detected?.key ?? (servesCustodiaBanner ? 'custodia' : null);
    const postConsentMethod = resolvePostConsentMethod(scan.postConsentMethod, cmpKey);

    await persistObservations(run.id, domainRow.id, observations);

    const cookies = toEvaluatorCookies([scan.pre, scan.post], registry, plantedCookieNames);

    const findings = evaluateConsentScan(
      { postConsentMethod },
      observations,
      {
        domain: domainRow.domain,
        categories: (domainRow.categories ?? []) as string[],
        gcmV2Enabled: domainRow.gcmV2Enabled ?? false,
        tcfEnabled: domainRow.tcfEnabled ?? false,
        cmp: cmpKey,
        knownVendorSlugs,
      },
      cookies,
      registry
    );

    const findingsOpen = await reconcileFindings(
      domainRow.organizationId,
      domainRow.id,
      run.id,
      findings
    );

    await db
      .update(consentScanRuns)
      .set({
        status: 'ok',
        finishedAt: new Date(),
        cmpDetected: cmpKey,
        postConsentMethod,
        preRequestCount: scan.pre.requests.length,
        postRequestCount: scan.post.requests.length,
        cookiesFound: cookies.length,
        findingsOpen,
        error: scan.pre.navigationError ?? scan.post.navigationError ?? null,
      })
      .where(eq(consentScanRuns.id, run.id));

    console.log(
      `[Consent Scan] ${domainRow.domain}: cmp=${cmpKey ?? 'none'} method=${postConsentMethod} ` +
      `pre=${scan.pre.requests.length} post=${scan.post.requests.length} findings=${findings.length}`
    );

    return run.id;
  } catch (err: any) {
    console.error(`[Consent Scan] Failed for ${domainRow.domain}: ${err?.message}`);
    await db
      .update(consentScanRuns)
      .set({
        status: 'failed',
        finishedAt: new Date(),
        error: String(err?.message ?? err).slice(0, 2000),
      })
      .where(eq(consentScanRuns.id, run.id));
    return run.id;
  }
}

async function dispatchDueDomains(): Promise<number> {
  const domains = await db
    .select({
      id: consentDomains.id,
      domain: consentDomains.domain,
      scanFrequency: consentDomains.scanFrequency,
      lastRunAt: sql<Date | null>`max(${consentScanRuns.startedAt})`,
    })
    .from(consentDomains)
    .leftJoin(consentScanRuns, eq(consentScanRuns.domainId, consentDomains.id))
    .groupBy(consentDomains.id, consentDomains.domain, consentDomains.scanFrequency);

  let dispatched = 0;
  for (const domain of domains) {
    const lastRunAt = domain.lastRunAt ? new Date(domain.lastRunAt) : null;
    if (!isDue(lastRunAt, domain.scanFrequency)) continue;

    await consentScanQueue.add(
      'reconcile-domain',
      { domainId: domain.id },
      {
        // One in-flight scan per domain, and a deterministic offset so 200 domains
        // do not all arrive at a single-concurrency browser at 05:00.
        singletonKey: domain.id,
        startAfter: jitterSecondsFor(domain.id),
      }
    );
    dispatched += 1;
  }

  return dispatched;
}

export const consentScanWorker = createWorker('consent-scan', async (job: Job) => {
  if (job.name === 'weekly-reconcile-dispatch') {
    const dispatched = await dispatchDueDomains();
    console.log(`[Consent Scan] Dispatched ${dispatched} domain scans.`);
    return;
  }

  if (job.name === 'reconcile-domain') {
    const { domainId } = job.data ?? {};
    if (!domainId) {
      console.error('[Consent Scan] reconcile-domain job missing domainId');
      return;
    }
    await reconcileDomain(domainId);
    return;
  }

  console.warn(`[Consent Scan] Unhandled job name: ${job.name}`);
}, { teamSize: 1 });

consentScanWorker.on('error', (err: Error) =>
  console.warn('[Consent Scan Worker] Error:', err.message)
);

export type { ScanPass };
