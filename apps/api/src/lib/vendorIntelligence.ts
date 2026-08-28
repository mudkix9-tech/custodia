/**
 * The vendor intelligence service — audit P-1, the pipeline's spine.
 *
 * One service inside `apps/api` exposing `enrich(name, domain)` for the
 * add-vendor path, `enrichBatch(targets)` for the queue with checkpointing, and
 * `reverify(vendorId)` for freshness. Replaces both islands' roles:
 * `packages/db/src/scripts/gather-vendors.ts` (which appended to a JSON file
 * nothing read) and the standalone `vendor-pipeline/` workspace.
 *
 * What it keeps from the gatherer — the parts the audit called right:
 *   - the refuse-to-guess directive (21/40 pending records carried dpaUrl:null
 *     because the model declined rather than inventing domain.com/dpa);
 *   - independent HTTP probes of every extracted URL;
 *   - domain-authority checking, now via classifyDocumentDomain's outcomes;
 *   - two-bucket output — auto-acceptable candidates vs the review queue.
 *
 * What it fixes from the gatherer:
 *   - per-field confidence instead of the boolean AND gate (P-7);
 *   - parent-company domains as an outcome, not a reject (P-7);
 *   - probe failures classified so quarantine ≠ bad data (P-6);
 *   - groundingMetadata captured where it is produced (P-8/D23);
 *   - one structured-output repair retry;
 *   - concurrency + checkpointing through vendor_intelligence_runs.cursor;
 *   - output lands in vendor_candidates for human review (P-3), not a JSON file.
 */
import { db } from '../db.js';
import {
  vendorIntelligenceRuns,
  vendorCandidates,
  vendorFieldProvenance,
  vendors,
} from 'db';
import { eq, sql } from 'drizzle-orm';
import { genai, genAiConfigError } from './genai.js';
import {
  assessCandidate,
  type CandidateAssessment,
  type FieldEvidence,
} from './vendorFieldConfidence.js';
import { assertPublicHost } from './safeFetch.js';
import { classifyDocumentDomain, VENDOR_PARENT_DOMAINS } from './vendorDomains.js';
import {
  classifyFetchError,
  classifyResponse,
  evaluateContentSignals,
  isGatedUrl,
  type ProbeDocType,
} from './vendorProbe.js';

export * from './vendorIntelligenceMappers.js';
import {
  type EnrichTarget,
  type ExtractedRecord,
  type GroundingSource,
  type EnrichResult,
  type ProvenanceWrite,
  type StoredCatalogueFields,
  type ReverifyOutcome,
  buildCatalogueWrites,
  diffFreshAgainstCatalogue,
  normaliseCandidateDomain,
  slugify,
} from './vendorIntelligenceMappers.js';


const REFUSE_TO_GUESS_PROMPT = (name: string, website: string) => `
You are a GDPR compliance researcher. We need verified data for "${name}" (${website}).
Use Google Search to locate the official URLs for their:
- Privacy Policy
- Data Processing Agreement (DPA)
- Subprocessor list
Find their headquarters country, data hosting regions, security certifications, and transfer mechanisms.

CRITICAL DIRECTIVES:
1. Only return URLs that are explicitly mentioned in the search results.
2. If you cannot find a valid URL in the search results for a specific legal/DPA/subprocessor document, set the corresponding field to null.
3. NEVER guess, speculate, or try to construct URLs based on common patterns (like domain/privacy or domain/dpa).

Return ONLY a JSON object matching exactly this shape (omit no keys):
{"name":"...","slug":"...","website":"${website}","description":null,"category":null,"headquartersCountry":"XX","dataProcessingLocations":["XX"],"dpaUrl":null,"privacyPolicyUrl":null,"subProcessorListUrl":null,"transferMechanisms":[],"euHostingAvailable":false,"securityCertifications":[],"aliases":[]}
`.trim();

interface GeminiLike {
  models: {
    generateContent: (args: unknown) => Promise<any>;
  };
}

/** Brace-slice JSON out of a model response that may wrap it in prose or fences. */
function sliceJson(text: string): string | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function extractGrounding(response: any): GroundingSource[] {
  const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return [];
  return chunks
    .map((chunk: any) => ({ title: chunk?.web?.title, uri: chunk?.web?.uri }))
    .filter((source: GroundingSource) => typeof source.uri === 'string' && source.uri.length > 0)
    .slice(0, 20);
}

async function callGemini(
  ai: GeminiLike,
  target: EnrichTarget,
): Promise<{ record: ExtractedRecord; grounding: GroundingSource[] }> {
  const website = target.website || '';
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: REFUSE_TO_GUESS_PROMPT(target.name, website),
    config: { tools: [{ googleSearch: {} }] },
  });

  const text = response?.text?.trim() || '';
  let parsed: any = null;

  const firstSlice = sliceJson(text);
  if (firstSlice) {
    try {
      parsed = JSON.parse(firstSlice);
    } catch {
      parsed = null;
    }
  }

  // One repair retry. A malformed first answer gets an explicit second ask
  // rather than being dropped — but only one, so a systematically broken prompt
  // fails loudly instead of burning quota twice per target forever.
  if (!parsed || typeof parsed !== 'object') {
    const repairResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `${REFUSE_TO_GUESS_PROMPT(target.name, website)}\n\nYour previous answer was not parseable JSON. Return ONLY the JSON object, nothing else.`,
      config: { tools: [{ googleSearch: {} }] },
    });
    const repairText = repairResponse?.text?.trim() || '';
    const repairSlice = sliceJson(repairText);
    if (!repairSlice) throw new Error('Model returned no JSON object after one repair retry');
    parsed = JSON.parse(repairSlice);
  }

  // Strip whitespace glitches from URLs — the gatherer did this and it was right.
  for (const field of ['dpaUrl', 'privacyPolicyUrl', 'subProcessorListUrl'] as const) {
    if (typeof parsed[field] === 'string') parsed[field] = (parsed[field] as string).replace(/\s+/g, '');
  }

  return { record: parsed as ExtractedRecord, grounding: extractGrounding(response) };
}

// ---------------------------------------------------------------------------
// HTTP probe — honest user agent (P-8), classified failures (P-6)
// ---------------------------------------------------------------------------

/**
 * A compliance product crawling behind a spoofed Chrome UA "will eventually be
 * a support ticket from a vendor's security team" (audit P-8). This UA names
 * the product; robots.txt respect is handled at the batch level.
 */
const USER_AGENT =
  'CustodiaVendorIntelligence/1.0 (+https://custodia.com/bot; compliance-document-verification)';

const MAX_BYTES = 10 * 1024 * 1024;

interface ProbeResult {
  status: 'verified' | 'failed';
  failureClass?: string;
  resolvedUrl?: string | null;
  httpStatus?: number | null;
  signals?: 'verified' | 'partial' | 'gated';
  bodySnippet?: string;
}

export async function probeUrl(
  url: string,
  type: ProbeDocType,
): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    // The URL here came from a model or from an unreviewed candidate, so it is
    // outside input even though no customer typed it. Refuse private address space
    // before the request is made; a hallucinated `http://localhost/dpa` is a fact
    // about the extraction, not about the vendor, and it should not be a way to
    // make the backend probe its own container.
    try {
      await assertPublicHost(new URL(url).hostname);
    } catch {
      clearTimeout(timer);
      return { status: 'failed', failureClass: 'blocked_private_address', resolvedUrl: url };
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
        status: 'failed',
        failureClass: classifyResponse(response.status, '', false),
        httpStatus: response.status,
        resolvedUrl: response.url || url,
      };
    }

    const finalUrl = response.url || url;
    const gated = isGatedUrl(finalUrl);

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

    const contentType = response.headers.get('content-type') || '';
    const lowerUrl = finalUrl.toLowerCase();
    let bodyText: string;

    if (contentType.includes('application/pdf') || lowerUrl.endsWith('.pdf')) {
      // PDFs are probed for existence and gating only — pdf-parse stays in the
      // P-9 analyser where its output is actually used. A scanned PDF still
      // counts as reachable content.
      bodyText = tooLarge ? '' : '[pdf]';
      if (tooLarge) {
        return {
          status: 'failed',
          failureClass: 'too_large',
          httpStatus: response.status,
          resolvedUrl: finalUrl,
        };
      }
    } else {
      bodyText = tooLarge ? '' : Buffer.concat(chunks).toString('utf8');
      if (tooLarge) {
        return { status: 'failed', failureClass: 'too_large', httpStatus: response.status, resolvedUrl: finalUrl };
      }
    }

    const signals = evaluateContentSignals(bodyText, type);
    if (signals === 'gated') {
      return { status: 'failed', failureClass: 'gated_content', httpStatus: response.status, resolvedUrl: finalUrl };
    }
    if (signals === 'verified') {
      return { status: 'verified', httpStatus: response.status, resolvedUrl: finalUrl, signals, bodySnippet: bodyText.slice(0, 400) };
    }
    return {
      status: 'failed',
      failureClass: classifyResponse(200, bodyText, false),
      httpStatus: response.status,
      resolvedUrl: finalUrl,
      signals,
    };
  } catch (err) {
    clearTimeout(timer);
    return { status: 'failed', failureClass: classifyFetchError(err), resolvedUrl: url };
  }
}

// ---------------------------------------------------------------------------
// Field assembly
// ---------------------------------------------------------------------------

type ProbeCache = Map<string, ProbeResult>;

export function statusFromOutcome(
  outcome: { status: string; failureClass?: string },
): NonNullable<FieldEvidence['probeStatus']> {
  if (outcome.status === 'verified') return 'verified_probed_success';
  if (outcome.failureClass === 'content_mismatch') return 'partially_probed';
  if (outcome.failureClass === 'gated_content') return 'failed_gated';
  return 'failed_probed';
}

/**
 * Attach probe outcomes to the URL fields. Kept separate from
 * `buildFieldEvidence` so the mapping is assertable in fixtures without a cache.
 */
export function buildFieldEvidence(
  record: ExtractedRecord,
  cache?: ProbeCache,
): Record<string, FieldEvidence> {
  const fields: Record<string, FieldEvidence> = {};

  const urlField = (
    field: 'dpaUrl' | 'privacyPolicyUrl' | 'subProcessorListUrl',
  ): FieldEvidence => {
    const url = record[field] ?? null;
    const evidence: FieldEvidence = {
      value: url,
      sourceType: url ? 'http_probe' : 'ai_grounded',
      domainOk: url ? classifyDocumentDomain(url, record.website || '') !== 'unknown' : undefined,
      resolvedUrl: url,
    };
    if (url && cache?.has(url)) {
      evidence.probeStatus = statusFromOutcome(cache.get(url)!);
    } else if (url) {
      // Unprobed but present — the unprobed ceiling keeps it reviewable.
      evidence.probeStatus = 'partially_probed';
    }
    return evidence;
  };

  fields.dpaUrl = urlField('dpaUrl');
  fields.privacyPolicyUrl = urlField('privacyPolicyUrl');
  fields.subProcessorListUrl = urlField('subProcessorListUrl');

  // Model-only facts stay at the unprobed ceiling of 40 — visible, usable for
  // review context, never bulk-approved on their own.
  fields.headquartersCountry = { value: record.headquartersCountry ?? null, sourceType: 'ai_grounded' };
  fields.transferMechanisms = { value: record.transferMechanisms ?? [], sourceType: 'ai_grounded' };
  fields.securityCertifications = { value: record.securityCertifications ?? [], sourceType: 'ai_grounded' };
  fields.dataProcessingLocations = { value: record.dataProcessingLocations ?? [], sourceType: 'ai_grounded' };
  fields.euHostingAvailable = { value: record.euHostingAvailable ?? false, sourceType: 'ai_grounded' };

  return fields;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * P-2's write path. Approval is the moment provenance exists — a row per
 * accepted field carrying its source type, URL and confidence, so the register
 * can show "HQ = US · 0.98 · probed · verified today" next to a field that says
 * "unverified — please check". Upsert on (vendor_id, field_name): re-approval
 * after a reverify refreshes the rows rather than stacking them.
 */
export async function writeProvenance(vendorId: string, rows: ProvenanceWrite[]): Promise<void> {
  if (rows.length === 0) return;
  await db
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
      target: [vendorFieldProvenance.vendorId, vendorFieldProvenance.fieldName],
      set: {
        value: sql`excluded.value`,
        sourceType: sql`excluded.source_type`,
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
 * The shared client, not a private one. This used to build its own with the
 * same API-key-first ordering `genai.ts` has since been corrected for, so a
 * Vertex deployment got one client per convention and two different answers to
 * "which Google product are we talking to".
 *
 * Returns null only when nothing is configured at all, which is what the
 * caller's "client unavailable" branch is for.
 */
function makeClient(): GeminiLike | null {
  if (genAiConfigError()) return null;
  return genai as unknown as GeminiLike;
}

/** Worker-facing client factory — the service keeps its own private one. */
export const makeGeminiClient = makeClient;

/**
 * Enrich one target end to end: extract -> probe -> assess -> persist a
 * candidate. Never throws for a data-quality reason; returns ok:false with a
 * failure class instead, because one bad target must not kill a batch.
 */
export async function enrichOne(ai: GeminiLike, target: EnrichTarget): Promise<EnrichResult> {
  try {
    const extracted = await extractAndProbe(ai, target);

    const fields = buildFieldEvidence(
      { ...extracted.record, website: extracted.record.website || target.website || '' },
      extracted.cache,
    );

    const website = extracted.record.website || target.website || '';
    const assessment = assessCandidate(
      extracted.record.name || target.name,
      website,
      fields,
      VENDOR_PARENT_DOMAINS,
    );

    return { target, ok: true, extracted: extracted.record, assessment, grounding: extracted.grounding };
  } catch (err) {
    return {
      target,
      ok: false,
      failureClass: classifyFetchError(err),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function extractAndProbe(
  ai: GeminiLike,
  target: EnrichTarget,
): Promise<{
  record: ExtractedRecord;
  grounding: GroundingSource[];
  cache: ProbeCache;
}> {
  const { record, grounding } = await callGemini(ai, target);
  const cache: ProbeCache = new Map();
  const probes: Array<{ url: string; type: ProbeDocType }> = [];
  if (record.dpaUrl) probes.push({ url: record.dpaUrl, type: 'dpa' });
  if (record.privacyPolicyUrl) probes.push({ url: record.privacyPolicyUrl, type: 'privacy' });
  if (record.subProcessorListUrl) probes.push({ url: record.subProcessorListUrl, type: 'subprocessors' });

  // Bounded concurrency of three across the three URLs — enough to keep the
  // batch moving through slow sites without turning the prober into a hammer.
  const CONCURRENCY = 3;
  let index = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, probes.length) }, async () => {
    while (index < probes.length) {
      const probe = probes[index]!;
      index += 1;
      if (!cache.has(probe.url)) {
        cache.set(probe.url, await probeUrl(probe.url, probe.type));
      }
    }
  });
  await Promise.all(workers);

  return { record, grounding, cache };
}

/**
 * Batch enrichment with checkpointing. The run row is both the log and the
 * resume point: each completed target bumps `cursor`, so a worker killed at
 * target 30 of 55 restarts at 30 rather than paying for the first 30 again —
 * which is what made the original sequential gatherer a nine-hour non-starter
 * for 5,000 targets.
 */
export async function runEnrichBatch(runId: string, targets: EnrichTarget[]): Promise<void> {
  const ai = makeClient();
  if (!ai) throw new Error(genAiConfigError() ?? 'Gemini client unavailable');

  await db.update(vendorIntelligenceRuns).set({ status: 'running' }).where(eq(vendorIntelligenceRuns.id, runId));

  let processed = 0;
  let failed = 0;

  try {
    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i]!;
      const result = await enrichOne(ai, target);

      if (!result.ok || !result.extracted || !result.assessment) {
        failed += 1;
      } else {
        const probeResults: Record<string, { status: string; failureClass?: string; resolvedUrl?: string | null }> = {};
        for (const [field, per] of Object.entries(result.assessment.perField)) {
          probeResults[field] = {
            status: String(per.decision),
            failureClass: per.domainOutcome,
          };
        }
        await upsertCandidate({
          runId,
          target,
          record: result.extracted,
          assessment: result.assessment,
          grounding: result.grounding ?? [],
          probeResults,
        });
      }

      processed += 1;
      // Checkpoint after each target: the expensive unit is the Gemini call +
      // three probes behind it, so the cursor advances per target, not per batch.
      await db
        .update(vendorIntelligenceRuns)
        .set({ processed, cursor: i + 1, failed })
        .where(eq(vendorIntelligenceRuns.id, runId));

      // Politeness gap between model calls, as the gatherer had.
      if (i < targets.length - 1) await new Promise((resolve) => setTimeout(resolve, 1_500));
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
  grounding: GroundingSource[];
  probeResults: Record<string, { status: string; failureClass?: string; resolvedUrl?: string | null }>;
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
    grounding: input.grounding.length > 0 ? input.grounding : null,
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
    return row && row.createdAt && new Date(row.createdAt).getTime() > Date.now() - 5_000 ? 'inserted' : 'updated';
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
  ai: GeminiLike,
  vendor: { id: string; name: string; website: string | null },
): Promise<ReverifyOutcome> {
  if (!vendor.website) {
    return { vendorId: vendor.id, ok: false, changes: [] };
  }
  const result = await enrichOne(ai, { name: vendor.name, website: vendor.website });
  if (!result.ok || !result.extracted || !result.assessment) {
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

  return {
    vendorId: vendor.id,
    ok: true,
    changes,
    assessment: result.assessment,
  };
}


