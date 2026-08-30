/**
 * The vendor intelligence service — audit P-1, the pipeline's spine.
 *
 * One service inside `apps/api` exposing `enrich(name, domain)` for the
 * add-vendor path, `enrichBatch(targets)` for the queue with checkpointing, and
 * `reverify(vendorId)` for freshness. Replaces both islands' roles: the
 * `gather-vendors.ts` script (deleted in Sprint 5; it appended to a JSON file
 * nothing read) and the standalone `vendor-pipeline/` workspace.
 *
 * **Sprint 5 removed the model from this path entirely (VD-1).** There is no
 * `callGemini`, no `groundingMetadata`, no `ai_grounded` provenance and no
 * prompt. The reasoning is in `audit docs/vendor-catalogue-sourcing-programme.md`
 * §1 and it is short: a model cannot produce provenance, the confidence floor it
 * lands on reads like measurement to a reviewer clearing a queue, and the five
 * fields it was asked for are the ones that decide whether a customer's transfer
 * is lawful. What it did that this pipeline genuinely needs — guessing where a
 * vendor publishes its DPA — is a path permutation over a known domain plus
 * link extraction off the vendor's own legal index, and that lives in
 * `vendorUrlCandidates.ts`. Everything else is now a registry lookup, a probe
 * result, or an explicit gap. A gap is an acceptable output.
 *
 * What it keeps from the gatherer — the parts the audit called right:
 *   - the refuse-to-guess principle, now structural: a URL is only a field once
 *     a probe has fetched it and its body looks like the document it claims;
 *   - independent HTTP probes of every candidate URL;
 *   - domain-authority checking, now via classifyDocumentDomain's outcomes;
 *   - two-bucket output — auto-acceptable candidates vs the review queue.
 *
 * What it fixes from the gatherer:
 *   - per-field confidence instead of the boolean AND gate (P-7);
 *   - parent-company domains as an outcome, not a reject (P-7);
 *   - probe failures classified so quarantine ≠ bad data (P-6);
 *   - concurrency + checkpointing through vendor_intelligence_runs.cursor;
 *   - output lands in vendor_candidates for human review (P-3), not a JSON file.
 *
 * **Sprint 6 hardened the probe, which is now the only Tier 2 source.** Two
 * controls run per host before it is asked for a document: its robots.txt
 * (VD-3), because a crawler that announces itself by name and ignores the one
 * file a host uses to answer it is the worst of both; and a negative control
 * against a path that cannot exist (VD-6), because a host that answers 2xx for
 * everything otherwise verifies nine of nine enumerated DPA URLs. Both are
 * cached per host for the target and both are charged to the request budget.
 */
import { db } from '../db.js';
import {
  vendorIntelligenceRuns,
  vendorCandidates,
  vendorFieldProvenance,
  vendorProbeDocuments,
  vendors,
} from 'db';
import { eq, sql } from 'drizzle-orm';
import {
  assessCandidate,
  fieldConfidence,
  type CandidateAssessment,
  type FieldEvidence,
} from './vendorFieldConfidence.js';
import { assertPublicHost } from './safeFetch.js';
import { classifyDocumentDomain, VENDOR_PARENT_DOMAINS } from './vendorDomains.js';
import {
  classifyFetchError,
  classifyResponse,
  detectSoftNotFound,
  downgradeForSoftNotFound,
  evaluateContentSignals,
  isGatedUrl,
  statusFromOutcome,
  USER_AGENT,
  type ProbeDocType,
} from './vendorProbe.js';
import { RobotsCache, type RobotsFetchResult } from './robotsTxt.js';
import { htmlToStoredText } from './htmlText.js';
import {
  loadRulesFor,
  urlRulesFor,
  vocabularyFor,
  applyFieldRules,
  markRuleOutcome,
  type ExtractionRule,
  type FieldExtractionOutcome,
} from './vendorExtractionRules.js';
import {
  DOC_TYPE_ORDER,
  enumerateCandidateUrls,
  extractLinkCandidates,
  indexPageUrls,
  isTrustCentreUrl,
  type CandidateUrl,
} from './vendorUrlCandidates.js';

export * from './vendorIntelligenceMappers.js';
import {
  type EnrichTarget,
  type ExtractedRecord,
  type RejectedCandidateUrl,
  type EnrichResult,
  type ProvenanceWrite,
  type StoredCatalogueFields,
  type ReverifyOutcome,
  buildCatalogueWrites,
  diffFreshAgainstCatalogue,
  normaliseCandidateDomain,
  slugify,
} from './vendorIntelligenceMappers.js';

// ---------------------------------------------------------------------------
// HTTP probe — honest user agent (P-8), classified failures (P-6)
// ---------------------------------------------------------------------------

/**
 * `USER_AGENT` moved to `vendorProbe.ts` in Sprint 6, next to the
 * `USER_AGENT_TOKEN` that `robotsTxt.ts` matches on. They have to be the same
 * string or we honour a robots.txt group nobody writes while ignoring the one
 * they do, and that failure is silent — so a fixture asserts it, which needs
 * both of them somewhere a fixture can import.
 */

const MAX_BYTES = 10 * 1024 * 1024;

interface ProbeResult {
  status: 'verified' | 'failed';
  failureClass?: string;
  resolvedUrl?: string | null;
  httpStatus?: number | null;
  signals?: 'verified' | 'partial' | 'gated';
  bodySnippet?: string;
  /**
   * What the probe actually read, flattened and bounded.
   *
   * Carried on every outcome and not only the verified ones, because the page a
   * reviewer most needs to see is the one that was rejected: "this looked like a
   * DPA and is a marketing summary" cannot be said about a page nobody kept.
   * Absent for a fetch that never got a body.
   */
  text?: string;
  isPdf?: boolean;
}

/** One page a run read, on its way to `vendor_probe_documents`. */
export interface ProbeDocumentRecord {
  url: string;
  docType: ProbeDocType;
  httpStatus: number | null;
  /** The verdict, so the panel can show why a page was not accepted. */
  outcome: string;
  text: string;
  isPdf: boolean;
}

interface FetchedDocument {
  ok: true;
  httpStatus: number;
  resolvedUrl: string;
  /** `'[pdf]'` for a PDF: probed for existence and gating only, never parsed here. */
  body: string;
  isPdf: boolean;
  /** The URL pattern itself says "login wall" — checked before any signal match. */
  gatedUrl: boolean;
}

interface FetchFailure {
  ok: false;
  failureClass: string;
  httpStatus?: number | null;
  resolvedUrl: string;
}

export type FetchOutcome = FetchedDocument | FetchFailure;

/**
 * Fetch one URL with the size cap, the private-address refusal and the honest
 * UA, and hand back the body.
 *
 * Split out of `probeUrl` in Sprint 5 because the link-extraction pass needs
 * the body of a legal index page without pretending that page is a DPA:
 * `/legal` is not a document to verify, it is a list of links to documents.
 */
export async function fetchDocument(url: string): Promise<FetchOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    // The URL here is enumerated or read off a page, so it is outside input
    // even though no customer typed it. Refuse private address space before the
    // request is made; `http://localhost/dpa` is a fact about the candidate list
    // and not about the vendor, and it should not be a way to make the backend
    // probe its own container.
    try {
      await assertPublicHost(new URL(url).hostname);
    } catch {
      clearTimeout(timer);
      return { ok: false, failureClass: 'blocked_private_address', resolvedUrl: url };
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8' },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok) {
      clearTimeout(timer);
      return {
        ok: false,
        failureClass: classifyResponse(response.status, '', false),
        httpStatus: response.status,
        resolvedUrl: response.url || url,
      };
    }

    const finalUrl = response.url || url;

    // Stream with a size cap before decoding anything.
    const chunks: Buffer[] = [];
    let total = 0;
    let tooLarge = false;
    if (response.body) {
      for await (const chunk of response.body as unknown as AsyncIterable<unknown>) {
        const buf = Buffer.from(chunk as Uint8Array);
        total += buf.length;
        chunks.push(buf);
        if (total > MAX_BYTES) {
          tooLarge = true;
          break;
        }
      }
    }
    clearTimeout(timer);

    if (tooLarge) {
      return { ok: false, failureClass: 'too_large', httpStatus: response.status, resolvedUrl: finalUrl };
    }

    const contentType = response.headers.get('content-type') || '';
    const isPdf = contentType.includes('application/pdf') || finalUrl.toLowerCase().endsWith('.pdf');

    return {
      ok: true,
      httpStatus: response.status,
      resolvedUrl: finalUrl,
      // PDFs count as reachable content; pdf-parse stays in the P-9 analyser
      // where its output is actually used, and a scanned PDF is still a document.
      body: isPdf ? '[pdf]' : Buffer.concat(chunks).toString('utf8'),
      isPdf,
      gatedUrl: isGatedUrl(finalUrl),
    };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, failureClass: classifyFetchError(err), resolvedUrl: url };
  }
}

export async function probeUrl(
  url: string,
  type: ProbeDocType,
  options: { hostSoftNotFound?: boolean; siteTokens?: readonly string[] } = {},
): Promise<ProbeResult> {
  const fetched = await fetchDocument(url);
  if (!fetched.ok) {
    return {
      status: 'failed',
      failureClass: fetched.failureClass,
      httpStatus: fetched.httpStatus ?? null,
      resolvedUrl: fetched.resolvedUrl,
    };
  }

  // Flattened once, here, and reused: the signal scan, the reject log and the
  // stored copy are all looking at the same characters. Evaluating raw HTML and
  // storing stripped text would let the two disagree about what the page said.
  const text = htmlToStoredText(fetched.body);

  const raw = evaluateContentSignals(fetched.body, type, options.siteTokens ?? []);
  // VD-6: on a host that answers 2xx for a path that cannot exist, a token
  // match is a fact about the host's 404 handler and not about this URL.
  const signals = downgradeForSoftNotFound(raw, options.hostSoftNotFound === true);
  if (signals === 'gated') {
    return {
      status: 'failed',
      failureClass: 'gated_content',
      httpStatus: fetched.httpStatus,
      resolvedUrl: fetched.resolvedUrl,
      text,
      isPdf: fetched.isPdf,
    };
  }
  if (signals === 'verified') {
    return {
      status: 'verified',
      httpStatus: fetched.httpStatus,
      resolvedUrl: fetched.resolvedUrl,
      signals,
      bodySnippet: text.slice(0, 400),
      text,
      isPdf: fetched.isPdf,
    };
  }
  return {
    status: 'failed',
    // The downgrade keeps its own class rather than borrowing `content_mismatch`:
    // "the host answers 200 for everything" and "we saw the page and it was
    // something else" send a reviewer to different places, and the reject log is
    // the only record of why the field came back absent.
    //
    // `gatedUrl` used to be computed here and thrown away, so a login wall that
    // did not also say "password" in its body was filed as `content_mismatch` —
    // "the DPA is not there" rather than "we could not see it".
    failureClass:
      raw === 'verified' ? 'soft_404' : classifyResponse(200, fetched.body, fetched.gatedUrl),
    httpStatus: fetched.httpStatus,
    resolvedUrl: fetched.resolvedUrl,
    signals,
    text,
    isPdf: fetched.isPdf,
  };
}

// ---------------------------------------------------------------------------
// Field assembly
// ---------------------------------------------------------------------------

type ProbeCache = Map<string, ProbeResult>;

// `statusFromOutcome` moved to `vendorProbe.ts` in Sprint 6, beside the failure
// classes it maps, so that adding a class and deciding what it is worth are one
// edit — and so the fixtures can assert the mapping without importing `db.js`.
export { statusFromOutcome };

/**
 * Attach probe outcomes to the URL fields. Kept separate from `extractAndProbe`
 * so the mapping is assertable in fixtures without a cache.
 *
 * Only fields that have a source get an evidence object. Sprint 5 deleted the
 * five model-asserted entries that used to sit here — headquarters country,
 * transfer mechanisms, security certifications, processing locations, EU
 * hosting — because nothing sources them without a model. They return in
 * Sprint 7 off the DPF registry and in Sprint 9 off an analyst; until then they
 * are absent, which is a tier, not a failure.
 */
export function buildFieldEvidence(
  record: ExtractedRecord,
  cache?: ProbeCache,
  fieldOutcomes: readonly FieldExtractionOutcome[] = [],
): Record<string, FieldEvidence> {
  const fields: Record<string, FieldEvidence> = {};

  const urlField = (field: 'dpaUrl' | 'privacyPolicyUrl' | 'subProcessorListUrl') => {
    const url = record[field] ?? null;
    if (!url) return;
    const evidence: FieldEvidence = {
      value: url,
      // A document on a third-party compliance portal is Tier 3 evidence about
      // the vendor; one on the vendor's own site (`trust.stripe.com` included)
      // is Tier 2.
      sourceType: isTrustCentreUrl(url) ? 'trust_centre' : 'http_probe',
      domainOk: classifyDocumentDomain(url, record.website || '') !== 'unknown',
      resolvedUrl: url,
    };
    // Unprobed but present — the unprobed ceiling keeps it reviewable.
    evidence.probeStatus = cache?.has(url) ? statusFromOutcome(cache.get(url)!) : 'partially_probed';
    fields[field] = evidence;
  };

  urlField('dpaUrl');
  urlField('privacyPolicyUrl');
  urlField('subProcessorListUrl');

  /**
   * The five Chapter V fields, when a taught rule filled one.
   *
   * These have had no source since Sprint 5 removed the model, and this is the
   * first thing that gives them one. The tier is `http_probe` and not a sixth
   * tier of its own: the evidence really is "we fetched the vendor's own page
   * and read this text". What a person vouched for is the *locator*, and the
   * value behind it is re-extracted mechanically on every run — so it decays on
   * the probe's curve and re-verifies like a probe, which is what it is.
   *
   * `verified_probed_success` rather than the unprobed ceiling because the page
   * was fetched on this run and the anchor matched in it. A rule that stopped
   * matching never reaches here: it produces no evidence, and therefore no
   * column and no provenance row.
   */
  for (const outcome of fieldOutcomes) {
    if (!outcome.matched || outcome.value === null) continue;
    if (fields[outcome.fieldName]) continue;
    fields[outcome.fieldName] = {
      value: outcome.value,
      sourceType: 'http_probe',
      probeStatus: 'verified_probed_success',
      domainOk: true,
      resolvedUrl: outcome.url,
    };
  }

  return fields;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/** A pool handle or a transaction handle — both accept `.insert()`. */
export type ProvenanceWriteHandle = {
  insert: (typeof db)['insert'];
};

/**
 * P-2's write path. Approval is the moment provenance exists — a row per
 * accepted field carrying its source type, URL and confidence, so the register
 * can show "DPA · 90 · probed on stripe.com · today" next to a field that says
 * "not yet verified". Upsert on (vendor, field, tier): re-approval after a
 * reverify refreshes those rows rather than stacking them.
 *
 * **Takes the handle, so there is exactly one of these.** The approve path runs
 * inside a transaction and used to carry its own copy, `writeProvenanceInTx` in
 * `routers/vendorIntelligence.ts` — identical but for the handle, which is the
 * VD-7 shape and cost what VD-7 always costs. When Sprint 10 widened the unique
 * key to include `source_type`, this copy was retargeted and the other was not,
 * so the transactional one went on naming a constraint that no longer existed.
 * Postgres answers that with `there is no unique or exclusion constraint
 * matching the ON CONFLICT specification`, which means **every candidate
 * approval threw** from Sprint 10 until this was merged. `tsc` sees a valid
 * column list either way, and the only surface that calls it is a review console
 * nobody had used yet.
 */
export async function writeProvenance(
  vendorId: string,
  rows: ProvenanceWrite[],
  handle: ProvenanceWriteHandle = db,
): Promise<void> {
  if (rows.length === 0) return;
  await handle
    .insert(vendorFieldProvenance)
    .values(
      rows.map((row) => ({
        vendorId,
        fieldName: row.fieldName,
        value: row.value as unknown as Record<string, unknown>,
        sourceType: row.sourceType,
        sourceUrl: row.sourceUrl ?? null,
        confidence: Math.max(0, Math.min(100, Math.round(row.confidence))),
        evidenceSnippet: row.evidenceSnippet ?? null,
      })),
    )
    .onConflictDoUpdate({
      // (vendor, field, tier) since Sprint 10. A probe re-run replaces the
      // previous probe of that field and leaves the registry row and any analyst
      // correction standing, which is what makes precedence representable at all.
      target: [
        vendorFieldProvenance.vendorId,
        vendorFieldProvenance.fieldName,
        vendorFieldProvenance.sourceType,
      ],
      set: {
        value: sql`excluded.value`,
        sourceUrl: sql`excluded.source_url`,
        confidence: sql`excluded.confidence`,
        evidenceSnippet: sql`excluded.evidence_snippet`,
        retrievedAt: new Date(),
      },
    });
}

// ---------------------------------------------------------------------------
// enrich / enrichBatch / reverify
// ---------------------------------------------------------------------------

/**
 * Enrich one target end to end: enumerate -> probe -> assess -> persist a
 * candidate. Never throws for a data-quality reason; returns ok:false with a
 * failure class instead, because one bad target must not kill a batch.
 */
export async function enrichOne(
  target: EnrichTarget,
  log: ProbeLogger = () => {},
): Promise<EnrichResult> {
  try {
    // Rules belong to a catalogue row, so a target with no vendor id has none —
    // which is the ordinary case for a brand-new candidate nobody has reviewed.
    const rules = target.vendorId
      ? ((await loadRulesFor(db, [target.vendorId])).get(target.vendorId) ?? [])
      : [];

    const extracted = await extractAndProbe(target, rules, log);

    // A taught value is a value the record now has. `buildCatalogueWrites` gives
    // it `http_probe` provenance like any other page read: a human vouched for
    // the *locator*, not for the value, and the value is re-extracted from the
    // vendor's own page on every run. The rule id travels in the evidence so the
    // console can show which fields were taught.
    for (const outcome of extracted.fieldOutcomes) {
      if (!outcome.matched || outcome.value === null) continue;
      (extracted.record as Record<string, unknown>)[outcome.fieldName] = outcome.value;
    }

    const fields = buildFieldEvidence(
      { ...extracted.record, website: extracted.record.website || target.website || '' },
      extracted.cache,
      extracted.fieldOutcomes,
    );

    const website = extracted.record.website || target.website || '';
    const assessment = assessCandidate(
      extracted.record.name || target.name,
      website,
      fields,
      VENDOR_PARENT_DOMAINS,
    );

    return {
      target,
      ok: true,
      extracted: extracted.record,
      assessment,
      rejectedUrls: extracted.rejectedUrls,
      documents: extracted.documents,
      fieldOutcomes: extracted.fieldOutcomes,
    };
  } catch (err) {
    return {
      target,
      ok: false,
      failureClass: classifyFetchError(err),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Hard ceiling on requests per target. Enumeration turns a bare domain into
 * roughly thirty candidates, so the budget and the per-type stop are what keep
 * that from becoming thirty requests at every host.
 *
 * The two Sprint 6 controls — one robots.txt and one negative-control fetch per
 * host — are charged to the same budget. They are requests the host serves, and
 * a ceiling that only counted the ones we hoped to learn something from would be
 * measuring our intentions rather than its load. The candidate list is ordered
 * most-likely-first, so what a tighter effective budget cuts is its tail.
 */
const MAX_PROBES_PER_TARGET = 24;

/**
 * One request per second, one at a time, across everything a target touches.
 *
 * Stricter than the "one in-flight per host" the sourcing programme asks for,
 * because the pacing is per target rather than per host: a vendor's own domain,
 * its trust subdomain and the third-party portals share one clock. That is the
 * conservative direction and it costs a few seconds per vendor on a job that
 * runs in a worker.
 */
const PER_HOST_DELAY_MS = 1_000;

/**
 * Fetch one robots.txt for the cache. Deliberately its own small fetch rather
 * than `fetchDocument`: a 404 here is an ordinary, expected answer meaning "no
 * restrictions", not a probe failure worth classifying, and the file is a few
 * kilobytes of text that never needs the 10 MB streaming path.
 */
async function fetchRobots(robotsUrl: string): Promise<RobotsFetchResult | null> {
  try {
    await assertPublicHost(new URL(robotsUrl).hostname);
    const response = await fetch(robotsUrl, {
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/plain,*/*;q=0.8' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { status: response.status, body: '' };
    const body = (await response.text()).slice(0, 512 * 1024);
    return { status: response.status, body };
  } catch {
    // Unreadable is not disallowed — see the note on `RobotsCache`.
    return null;
  }
}

/** A path that cannot exist, for the soft-404 negative control (VD-6). */
function negativeControlUrl(origin: string): string {
  const random = Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0'),
  ).join('');
  return `${origin}/${random}`;
}

/**
 * Where a run says what it is doing.
 *
 * A probe is thirty-odd paced requests over a couple of minutes. Without this it
 * is a process that appears to hang and then produces a verdict, which is
 * unusable for the one operator watching it and was the actual complaint: the
 * console's re-probe button reported "queued" and then nothing observable ever
 * happened again.
 */
export type ProbeLogger = (line: string) => void;

async function extractAndProbe(
  target: EnrichTarget,
  rules: readonly ExtractionRule[] = [],
  log: ProbeLogger = () => {},
): Promise<{
  record: ExtractedRecord;
  rejectedUrls: RejectedCandidateUrl[];
  cache: ProbeCache;
  documents: ProbeDocumentRecord[];
  fieldOutcomes: FieldExtractionOutcome[];
}> {
  const website = target.website || '';
  const record: ExtractedRecord = {
    name: target.name,
    slug: slugify(target.name),
    website,
    category: target.category ?? null,
    description: null,
    dpaUrl: null,
    privacyPolicyUrl: null,
    subProcessorListUrl: null,
    // The five Chapter V fields. Nothing sources them without a model, so they
    // leave here empty and `buildCatalogueWrites` writes neither a column nor a
    // provenance row for them. Sprint 7 fills the first from the DPF registry.
    headquartersCountry: null,
    dataProcessingLocations: [],
    transferMechanisms: [],
    securityCertifications: [],
    euHostingAvailable: null,
    aliases: [],
  };

  const cache: ProbeCache = new Map();
  const rejectedUrls: RejectedCandidateUrl[] = [];
  /**
   * Every page this run read, kept for the review console.
   *
   * Accumulated here rather than derived from `cache` afterwards because the
   * cache is keyed on URL alone and carries no document type: the same page can
   * be reached as a DPA candidate and as a privacy candidate, and a reviewer
   * asking "why was this rejected" needs to know which question was being asked
   * of it.
   */
  const documents: ProbeDocumentRecord[] = [];
  /** What the taught field rules produced, matched or not. */
  const fieldOutcomes: FieldExtractionOutcome[] = [];

  const { pinned, denied } = urlRulesFor(rules);
  const vocabulary = vocabularyFor(rules);

  if (rules.length > 0) {
    log(
      `${rules.length} taught rule(s): ${pinned.length} pinned, ${denied.length} denied, ` +
      `${Object.values(vocabulary).flat().length} vocabulary token(s)`,
    );
  }
  const resolved: Partial<Record<ProbeDocType, string>> = {};
  let budget = MAX_PROBES_PER_TARGET;
  let lastRequestAt = 0;

  const pace = async () => {
    const wait = PER_HOST_DELAY_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
  };

  // Both controls are per host and live for this target only. A vendor's own
  // domain, its trust subdomain and each portal answer for themselves.
  const robots = new RobotsCache(async (robotsUrl) => {
    budget -= 1;
    await pace();
    return fetchRobots(robotsUrl);
  });
  const softNotFound = new Map<string, boolean>();
  /** URLs refused by robots — link extraction can re-find an enumerated path. */
  const skipped = new Set<string>();

  /**
   * Has this host been caught answering 2xx for a path that cannot exist?
   * One request per host, before the first real probe against it.
   */
  const hostSoftNotFound = async (url: string): Promise<boolean> => {
    let origin: string;
    let host: string;
    try {
      const parsed = new URL(url);
      origin = parsed.origin;
      host = parsed.host;
    } catch {
      return false;
    }
    const known = softNotFound.get(host);
    if (known !== undefined) return known;
    budget -= 1;
    await pace();
    const control = await fetchDocument(negativeControlUrl(origin));
    const soft = detectSoftNotFound(
      control.ok ? { ok: true, httpStatus: control.httpStatus, body: control.body } : { ok: false },
    );
    softNotFound.set(host, soft);
    return soft;
  };

  /** Probe one candidate, unless its document type is already settled. */
  const tryCandidate = async (candidate: CandidateUrl): Promise<void> => {
    if (resolved[candidate.type] || budget <= 0) return;
    if (cache.has(candidate.url) || skipped.has(candidate.url)) return;

    // VD-3. Checked before the request, not after: the point of robots.txt is
    // that the request is not made. A disallowed path is recorded so the
    // reviewer can see we stopped rather than found nothing, and it writes no
    // probe outcome into the cache — there is no evidence to score, and an
    // absent field is a tier.
    if (!(await robots.allows(candidate.url))) {
      log(`  robots  ${candidate.url}`);
      skipped.add(candidate.url);
      rejectedUrls.push({
        url: candidate.url,
        type: candidate.type,
        origin: candidate.origin,
        failureClass: 'blocked_by_robots',
        httpStatus: null,
      });
      return;
    }
    if (budget <= 0) return;

    // The negative control is deliberately *not* robots-checked. We only reach
    // it once robots has permitted a real document request to this host, and a
    // second decision over a synthetic path would fail open in exactly the
    // direction VD-6 exists to close — skipping the control means not
    // downgrading, which is how a soft-404 host verifies its homepage as a DPA.
    const soft = await hostSoftNotFound(candidate.url);
    if (budget <= 0) return;

    budget -= 1;
    await pace();
    const outcome = await probeUrl(candidate.url, candidate.type, {
      hostSoftNotFound: soft,
      siteTokens: vocabulary[candidate.type] ?? [],
    });
    cache.set(candidate.url, outcome);

    const verdict = outcome.status === 'verified'
      ? 'VERIFIED'
      : (outcome.failureClass ?? 'failed');
    log(
      `  ${String(outcome.httpStatus ?? '---').padEnd(3)} ${verdict.padEnd(20)} ` +
      `${String(outcome.text?.length ?? 0).padStart(7)}c  ${candidate.url}`,
    );

    // Taught field rules run against whatever this page turned out to be, not
    // only against pages that verified: a reviewer who pinned a regions table
    // wants it read even though a regions table is not a DPA and never verifies
    // as one.
    if (outcome.text !== undefined) {
      const applied = applyFieldRules(rules, candidate.url, outcome.text);
      for (const a of applied) {
        log(
          a.matched
            ? `  taught  ${a.fieldName} = ${JSON.stringify(a.value)?.slice(0, 90)}`
            : `  TAUGHT RULE NO LONGER MATCHES: ${a.fieldName} — writing nothing`,
        );
      }
      fieldOutcomes.push(...applied);
    }

    // Stored whatever the verdict, which is the point: the page a reviewer most
    // needs to open is the one that was rejected.
    if (outcome.text !== undefined) {
      documents.push({
        url: outcome.resolvedUrl ?? candidate.url,
        docType: candidate.type,
        httpStatus: outcome.httpStatus ?? null,
        outcome: outcome.status === 'verified' ? 'verified' : (outcome.failureClass ?? 'failed'),
        text: outcome.text,
        isPdf: outcome.isPdf === true,
      });
    }

    if (outcome.status === 'verified') {
      resolved[candidate.type] = candidate.url;
      return;
    }
    // Everything tried and rejected is the audit trail for why a field came
    // back absent — the reviewer's answer to "did you even look".
    rejectedUrls.push({
      url: candidate.url,
      type: candidate.type,
      origin: candidate.origin,
      failureClass: outcome.failureClass,
      httpStatus: outcome.httpStatus ?? null,
    });
  };

  for (const candidate of enumerateCandidateUrls(target, { pinned, denied })) {
    await tryCandidate(candidate);
  }

  // The long tail: a vendor who publishes a DPA at a path nobody guesses still
  // links to it from a legal index page. Only run it for types still open.
  if (budget > 0 && DOC_TYPE_ORDER.some((type) => !resolved[type])) {
    log(`following links from the legal index for: ${DOC_TYPE_ORDER.filter((t) => !resolved[t]).join(', ')}`);
    for (const indexUrl of indexPageUrls(website)) {
      if (budget <= 0 || DOC_TYPE_ORDER.every((type) => resolved[type])) break;
      if (!(await robots.allows(indexUrl))) continue;
      if (budget <= 0) break;
      budget -= 1;
      await pace();
      const page = await fetchDocument(indexUrl);
      if (!page.ok || page.isPdf) continue;
      for (const candidate of extractLinkCandidates(page.body, page.resolvedUrl, website)) {
        await tryCandidate(candidate);
      }
    }
  }

  record.dpaUrl = resolved.dpa ?? null;
  record.subProcessorListUrl = resolved.subprocessors ?? null;
  record.privacyPolicyUrl = resolved.privacy ?? null;

  const found = DOC_TYPE_ORDER.filter((t) => resolved[t]);
  log(
    `done: ${found.length ? found.join(', ') + ' found' : 'nothing verified'}` +
    `, ${documents.length} page(s) stored, ${rejectedUrls.length} rejected`,
  );

  return { record, rejectedUrls, cache, documents, fieldOutcomes };
}

/**
 * Batch enrichment with checkpointing. The run row is both the log and the
 * resume point: each completed target bumps `cursor`, so a worker killed at
 * target 30 of 55 restarts at 30 rather than paying for the first 30 again —
 * which is what made the original sequential gatherer a nine-hour non-starter
 * for 5,000 targets.
 */
export async function runEnrichBatch(runId: string, targets: EnrichTarget[]): Promise<void> {
  await db.update(vendorIntelligenceRuns).set({ status: 'running' }).where(eq(vendorIntelligenceRuns.id, runId));

  let processed = 0;
  let failed = 0;

  try {
    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i]!;
      const result = await enrichOne(target);

      if (!result.ok || !result.extracted || !result.assessment) {
        failed += 1;
      } else {
        // The per-field confidence travels with the decision, and used not to.
        // `approveCandidate` selects the entries carrying a number and hands the
        // rest to `buildCatalogueWrites`' unprobed fallback — so dropping it
        // here meant *every* approved field was written at the
        // `partially_probed` ceiling of 45, including ones a probe had verified
        // at 90. The staging row was quietly worth less than the run that
        // produced it, and the reviewer had no per-field number to read either.
        const probeResults: Record<
          string,
          {
            status: string;
            confidence: number;
            failureClass?: string;
            resolvedUrl?: string | null;
            /** Set when a taught rule produced this field, naming the page. */
            taughtFrom?: string;
            ruleId?: string;
          }
        > = {};
        for (const [field, per] of Object.entries(result.assessment.perField)) {
          probeResults[field] = {
            status: String(per.decision),
            confidence: per.confidence,
            failureClass: per.domainOutcome,
          };
        }
        // A taught field rides in `probe_results` alongside the probe outcomes,
        // carrying the page it was read from. It has to survive from the run to
        // the approval, because that is where `buildCatalogueWrites` decides
        // whether the field has a source at all — a rule that ran, matched, and
        // was then forgotten at the last step would write nothing, which looks
        // exactly like a rule that never matched.
        for (const outcome of result.fieldOutcomes ?? []) {
          if (!outcome.matched || outcome.value === null) continue;
          probeResults[outcome.fieldName] = {
            status: 'taught',
            confidence: fieldConfidence({
              value: outcome.value,
              sourceType: 'http_probe',
              probeStatus: 'verified_probed_success',
            }),
            taughtFrom: outcome.url,
            ruleId: outcome.ruleId,
          };
        }

        await upsertCandidate({
          runId,
          target,
          record: result.extracted,
          assessment: result.assessment,
          rejectedUrls: result.rejectedUrls ?? [],
          probeResults,
          documents: (result.documents ?? []) as ProbeDocumentRecord[],
        });

        await recordRuleOutcomes(result.fieldOutcomes ?? []);
      }

      processed += 1;
      // Checkpoint after each target: the expensive unit is the enumeration and
      // the probes behind it, so the cursor advances per target, not per batch.
      await db
        .update(vendorIntelligenceRuns)
        .set({ processed, cursor: i + 1, failed })
        .where(eq(vendorIntelligenceRuns.id, runId));

      // No inter-target gap: politeness is per host now (`PER_HOST_DELAY_MS`),
      // and consecutive targets are different hosts.
    }

    await db
      .update(vendorIntelligenceRuns)
      .set({ status: 'completed', finishedAt: new Date() })
      .where(eq(vendorIntelligenceRuns.id, runId));
  } catch (err) {
    await db
      .update(vendorIntelligenceRuns)
      .set({
        status: 'failed',
        lastError: err instanceof Error ? err.message : String(err),
        finishedAt: new Date(),
      })
      .where(eq(vendorIntelligenceRuns.id, runId));
    throw err;
  }
}


/**
 * Upsert a candidate on its normalised domain. Two targets resolving to the
 * same host update one row instead of duplicating it; a re-run refreshes the
 * payload in place while resetting any prior review state, because the record
 * being reviewed has changed underneath the reviewer.
 */
export async function upsertCandidate(input: {
  runId: string;
  target: EnrichTarget;
  record: ExtractedRecord;
  assessment: CandidateAssessment;
  rejectedUrls: RejectedCandidateUrl[];
  probeResults: Record<
    string,
    {
      status: string;
      confidence?: number;
      failureClass?: string;
      resolvedUrl?: string | null;
      taughtFrom?: string;
      ruleId?: string;
    }
  >;
  documents?: ProbeDocumentRecord[];
}): Promise<'inserted' | 'updated'> {
  const domain = normaliseCandidateDomain(input.record.website || input.target.website || '');
  const values = {
    runId: input.runId,
    name: (input.record.name || input.target.name || '').slice(0, 255),
    slug: (input.record.slug || slugify(input.record.name || input.target.name || '')).slice(0, 100),
    category: input.record.category || input.target.category || null,
    domain,
    payload: input.record as unknown as Record<string, unknown>,
    probeResults: input.probeResults,
    // The `grounding` column, repurposed in Sprint 5: it holds the enumerated
    // and rejected URLs rather than a model's retrieved-pages list. Same column,
    // no migration, opposite epistemic value — this one says what was checked.
    grounding: input.rejectedUrls.length > 0 ? input.rejectedUrls : null,
    confidence: input.assessment.confidence,
    status: 'pending' as const,
    rejectionReason: null,
    reviewedBy: null,
    reviewedAt: null,
    createdVendorId: null,
  };

  const [row] = await db
    .insert(vendorCandidates)
    .values(values)
    .onConflictDoUpdate({
      target: vendorCandidates.domain,
      set: {
        runId: values.runId,
        name: values.name,
        slug: values.slug,
        category: values.category,
        payload: values.payload,
        probeResults: values.probeResults,
        grounding: values.grounding,
        confidence: values.confidence,
        status: 'pending',
        rejectionReason: null,
        reviewedBy: null,
        reviewedAt: null,
        createdVendorId: null,
      },
    })
    .returning({ id: vendorCandidates.id, createdAt: vendorCandidates.createdAt });

  if (row && input.documents && input.documents.length > 0) {
    await storeProbeDocuments({ candidateId: row.id }, input.documents);
  }

  return row && row.createdAt && new Date(row.createdAt).getTime() > Date.now() - 5_000 ? 'inserted' : 'updated';
}

/**
 * Stamp every taught rule that ran with whether it did what it promised.
 *
 * This is what makes drift visible. `last_applied_at` moves whenever a rule was
 * consulted and `last_matched_at` only when it matched, so the two diverging is
 * the whole signal: a rule applied last night and last matched in March has been
 * failing since March, and the console reads that without opening the page.
 *
 * A failing rule also flips to `broken`, and a broken `field_extract` produces
 * no evidence — so no column and no provenance row. That is the point of the
 * design: falling back to generic enumeration would leave the field populated by
 * a guess, at a confidence the reviewer believed they had vouched for.
 */
async function recordRuleOutcomes(
  outcomes: readonly { ruleId: string; matched: boolean }[],
): Promise<void> {
  for (const outcome of outcomes) {
    await markRuleOutcome(db, outcome.ruleId, outcome.matched);
  }
}

/**
 * Keep what a run read, so a reviewer can see it and a rule can be taught from it.
 *
 * Upsert on (parent, url) rather than insert, so a re-probe refreshes the copy in
 * place: the reviewer should be looking at what the *last* run saw, and a table
 * that accumulated one row per run per page would answer "what does this page
 * say" with a history nobody asked for.
 *
 * Owned by exactly one parent. A run building a candidate writes against the
 * candidate; a re-verification of a catalogue row writes against the vendor.
 * Both partial unique indexes exist because Postgres treats NULLs in a unique
 * constraint as distinct, so a single composite key would let every re-run
 * insert a duplicate rather than update.
 */
export async function storeProbeDocuments(
  parent: { candidateId: string } | { vendorId: string },
  documents: readonly ProbeDocumentRecord[],
): Promise<void> {
  if (documents.length === 0) return;

  const byCandidate = 'candidateId' in parent;
  const rows = documents.map((doc) => ({
    candidateId: byCandidate ? parent.candidateId : null,
    vendorId: byCandidate ? null : parent.vendorId,
    url: doc.url,
    docType: doc.docType,
    httpStatus: doc.httpStatus,
    outcome: doc.outcome,
    text: doc.text,
    isPdf: doc.isPdf,
    fetchedAt: new Date(),
  }));

  await db
    .insert(vendorProbeDocuments)
    .values(rows)
    .onConflictDoUpdate({
      target: byCandidate
        ? [vendorProbeDocuments.candidateId, vendorProbeDocuments.url]
        : [vendorProbeDocuments.vendorId, vendorProbeDocuments.url],
      // The index is partial, so its predicate has to be repeated here or
      // Postgres cannot work out which index the conflict is against and refuses
      // the statement outright (`infer_arbiter_indexes`). Naming the columns is
      // not enough on its own — a fact no fixture can reach, because it is the
      // planner's objection rather than the query builder's.
      targetWhere: byCandidate
        ? sql`candidate_id is not null`
        : sql`vendor_id is not null`,
      set: {
        docType: sql`excluded.doc_type`,
        httpStatus: sql`excluded.http_status`,
        outcome: sql`excluded.outcome`,
        text: sql`excluded.text`,
        isPdf: sql`excluded.is_pdf`,
        fetchedAt: sql`excluded.fetched_at`,
      },
    });
}

// ---------------------------------------------------------------------------
// reverify — freshness for an existing catalogue vendor
// ---------------------------------------------------------------------------

/**
 * Re-run enrichment against a catalogue vendor and report what changed,
 * without touching the live row. Freshness was previously a write-only column
 * (`vendors.lastVerifiedAt` set by `verifyVendorProfile`, displayed nowhere);
 * this makes verification a reviewable diff the reviewer can accept.
 */
export async function reverifyVendor(
  vendor: { id: string; name: string; website: string | null },
  log: ProbeLogger = () => {},
): Promise<ReverifyOutcome> {
  if (!vendor.website) {
    log(`${vendor.name} has no website — nothing to probe`);
    return { vendorId: vendor.id, ok: false, changes: [] };
  }
  log(`probing ${vendor.name} (${vendor.website})`);
  // The vendor id is what makes taught rules apply: rules belong to a catalogue
  // row, and a target without one is treated as a vendor nobody has reviewed.
  const result = await enrichOne(
    { name: vendor.name, website: vendor.website, vendorId: vendor.id },
    log,
  );
  if (!result.ok || !result.extracted || !result.assessment) {
    log(`probe failed: ${result.failureClass ?? 'unknown'} ${result.error ?? ''}`);
    return { vendorId: vendor.id, ok: false, changes: [] };
  }
  const [storedRow] = await db
    .select({
      dpaUrl: vendors.dpaUrl,
      privacyPolicyUrl: vendors.privacyPolicyUrl,
      subProcessorListUrl: vendors.subProcessorListUrl,
      headquartersCountry: vendors.headquartersCountry,
    })
    .from(vendors)
    .where(eq(vendors.id, vendor.id));

  const changes = storedRow
    ? diffFreshAgainstCatalogue(storedRow, result.extracted, result.assessment)
    : [];

  // Against the vendor rather than a candidate: a re-verification is asking about
  // a row that already exists, so this is where the console reads the current
  // pages from when a reviewer is teaching a rule for a seeded vendor. Without
  // it the whole catalogue queue would have nothing to show but the 82 rows'
  // stored values, which is the state that made teaching impossible.
  await storeProbeDocuments(
    { vendorId: vendor.id },
    (result.documents ?? []) as ProbeDocumentRecord[],
  );

  await recordRuleOutcomes(result.fieldOutcomes ?? []);

  log(changes.length
    ? `${changes.length} change(s) against the catalogue: ${changes.map((c: any) => c.field).join(', ')}`
    : 'no changes against the catalogue');

  return {
    vendorId: vendor.id,
    ok: true,
    changes,
    assessment: result.assessment,
  };
}
