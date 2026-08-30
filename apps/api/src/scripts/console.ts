/**
 * The local operator console — a catalogue verification workbench for one person.
 *
 *   npm run console --workspace=apps/api        # http://127.0.0.1:7331
 *
 * **Why this is not a page in `apps/web`.** Approving a candidate writes the
 * *shared* catalogue: one row read by every tenant. There used to be an
 * in-product console at `/vendors/intelligence` gated on `vendors:edit` — a
 * permission `member` carries — so the surface that rewrote global reference
 * data was reachable by any member of any organisation. It was removed with the
 * router behind it rather than left beside this one, because a route is not a
 * security boundary and its procedures were callable directly.
 *
 * This runs on loopback, on the operator's own machine, with the database
 * credential as the only authentication that matters — there is no public
 * endpoint to attack because there is no public endpoint.
 *
 * **The write paths live in `lib`, not here.** Approving and rejecting go
 * through `lib/vendorCandidateReview.ts`; correcting goes through
 * `lib/vendorCorrections.ts`, which `routers/vendors.ts` also calls. The console
 * is now the only caller of the first of those, so the split is no longer about
 * two callers sharing one rule — it is about keeping a shared-catalogue write
 * somewhere fixtures can reach and a reader can find. That is worth doing on its
 * own: extracting these is what surfaced a transactional provenance writer still
 * naming the pre-Sprint-10 unique key, which meant every approval threw, and a
 * staging row that dropped the per-field confidence the run had just computed.
 * Both had been live and unexercised (known-concerns §21).
 *
 * **Probing stays on the server.** Run triggers enqueue through pg-boss against
 * the shared `DATABASE_URL`, so the deployed worker does the fetching. Probing
 * from a laptop would put a home IP behind a self-identifying compliance
 * crawler, and the robots.txt and pacing rules exist to be defensible.
 *
 * Refuses to start unless it can be honest about all three of: not production,
 * not reachable, and attributable.
 */
process.env.WORKER_ROLE = 'web';

import * as dotenv from 'dotenv';
import http from 'node:http';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(HERE, '../../../../.env') });
dotenv.config();

const HOST = '127.0.0.1';
const PORT = Number(process.env.CONSOLE_PORT ?? 7331);

function refuse(reason: string, fix: string): never {
  console.error('');
  console.error(`The operator console will not start: ${reason}`);
  console.error(fix);
  console.error('');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  refuse(
    'NODE_ENV is production.',
    'This writes the shared catalogue from an unauthenticated loopback server. It is a\n' +
      'local tool and there is no configuration that makes it safe to run on a host\n' +
      'anybody else can reach.',
  );
}

if (!process.env.DATABASE_URL) {
  refuse('DATABASE_URL is not set.', 'Set it in .env — the console reads and writes the real database.');
}

/**
 * Attribution. Every correction records who made it, and `verified_by` resolves
 * to a person through `users` — which is what an auditor asking "who decided
 * this?" needs. A console that wrote `null` there would be producing exactly the
 * unattributable assertion the whole provenance model exists to prevent.
 *
 * An email is accepted as well as an id, because the id is the thing a person
 * does not have to hand and the email is. Either way what gets *stored* is the
 * id: an email is a login credential that can be changed, and provenance rows
 * outlive the address somebody used the day they wrote one.
 */
const OPERATOR_REF = process.env.PLATFORM_OPERATOR_USER_ID;
if (!OPERATOR_REF) {
  refuse(
    'PLATFORM_OPERATOR_USER_ID is not set.',
    'Set it to your users.id — or your email, which is resolved to one. Corrections '
      + 'carry an author, and a console that wrote none would be making anonymous '
      + 'assertions about named third parties.',
  );
}

const { db } = await import('../db.js');
const { users } = await import('db');
const { eq } = await import('drizzle-orm');

const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  .test(OPERATOR_REF);

const [operator] = await db
  .select({ id: users.id, email: users.email })
  .from(users)
  .where(looksLikeUuid ? eq(users.id, OPERATOR_REF) : eq(users.email, OPERATOR_REF));
if (!operator) {
  refuse(
    `PLATFORM_OPERATOR_USER_ID matches no user (${OPERATOR_REF}).`,
    looksLikeUuid
      ? 'It has to resolve to a real row, or the attribution it writes is a dead id.'
      : 'Read as an email because it is not a UUID, and no user has that address.',
  );
}

/** The id, whichever way it was given. This is what lands in `verified_by`. */
const OPERATOR_ID = operator.id;

const { approveCandidate, rejectCandidate, CandidateReviewError } = await import(
  '../lib/vendorCandidateReview.js'
);
const { submitFieldCorrection, applyCorrectionToColumn, CorrectionError, CORRECTABLE_FIELDS } =
  await import('../lib/vendorCorrections.js');
const { pendingCandidates, catalogueReviewRows, signalQueue, probeDocumentsFor, rulesFor } =
  await import('../lib/vendorReviewQueues.js');
const { deriveLocator, applyLocator } = await import('../lib/vendorLocator.js');
const { saveRule, deleteRule, RuleError } = await import('../lib/vendorExtractionRules.js');
const { vendorIntelligenceRuns } = await import('db');
const { vendorIntelligenceQueue } = await import('../workers/vendorIntelligence.js');

// ---------------------------------------------------------------------------
// routes
// ---------------------------------------------------------------------------

type Handler = (body: any) => Promise<unknown>;

const routes: Record<string, Handler> = {
  'GET /api/candidates': () => pendingCandidates(db),
  'GET /api/catalogue': () => catalogueReviewRows(db),
  'GET /api/signals': () => signalQueue(db),
  'GET /api/meta': async () => ({
    operator: operator.email ?? operator.id,
    fields: CORRECTABLE_FIELDS,
  }),

  'POST /api/approve': (body) =>
    approveCandidate({
      db,
      candidateId: String(body.id),
      overrides: body.overrides ?? undefined,
      reviewerId: OPERATOR_ID,
    }),

  'POST /api/reject': (body) =>
    rejectCandidate({
      db,
      candidateId: String(body.id),
      reason: body.reason ? String(body.reason) : null,
      reviewerId: OPERATOR_ID,
    }),

  'POST /api/correct': (body) =>
    submitFieldCorrection({
      db,
      vendorId: String(body.vendorId),
      fieldName: String(body.fieldName),
      value: body.value,
      sourceUrl: String(body.sourceUrl ?? ''),
      evidenceSnippet: String(body.evidenceSnippet ?? ''),
      reviewBy: String(body.reviewBy ?? ''),
      verifiedBy: OPERATOR_ID,
    }),

  /**
   * The second, explicit step. Kept a separate call rather than folded into
   * `/api/correct` so that recording what a person found and changing what the
   * product asserts stay two decisions — see `lib/vendorCorrections.ts`.
   */
  'POST /api/apply': (body) =>
    applyCorrectionToColumn({
      db,
      vendorId: String(body.vendorId),
      fieldName: String(body.fieldName),
    }),

  /** Queue a probe sweep. The deployed worker runs it; this only enqueues. */
  'POST /api/enrich': async (body) => {
    const targets = Array.isArray(body.targets) ? body.targets : [];
    if (targets.length === 0) throw new Error('No targets given');
    const [run] = await db
      .insert(vendorIntelligenceRuns)
      .values({
        kind: 'enrich_batch',
        status: 'pending',
        targets,
        triggeredBy: OPERATOR_ID,
      })
      .returning();
    await vendorIntelligenceQueue.add('enrich-batch', { runId: run!.id });
    return { runId: run!.id, queued: targets.length };
  },

  /** Re-probe one catalogue vendor for freshness. */
  'POST /api/reverify': async (body) => {
    await vendorIntelligenceQueue.add('reverify-vendor', { vendorId: String(body.vendorId) });
    return { queued: true };
  },

  /**
   * What the scraper read for this vendor or candidate, and what it was taught.
   *
   * The two travel together because they are read together: a reviewer looks at
   * a page in order to teach a rule about it, and looks at the rules in order to
   * understand why the page was accepted or refused.
   */
  'POST /api/evidence': async (body) => {
    const documents = await probeDocumentsFor(db, {
      vendorId: body.vendorId ? String(body.vendorId) : undefined,
      candidateId: body.candidateId ? String(body.candidateId) : undefined,
    });
    const rules = body.vendorId ? await rulesFor(db, String(body.vendorId)) : [];
    return { documents, rules };
  },

  /**
   * Derive a locator from a selection, without saving anything.
   *
   * Separate from `/api/rules` on purpose: the reviewer sees what their selection
   * produced and what it reads back *before* committing to it. A locator that
   * cannot reproduce the selection is never offered, so the failure lands on the
   * person who can still see the page.
   */
  'POST /api/derive': async (body) => {
    const text = String(body.text ?? '');
    const result = deriveLocator(
      text,
      Number(body.start),
      Number(body.end),
      { split: body.split ? String(body.split) : null },
    );
    return {
      locator: result.locator,
      problem: result.problem ?? null,
      preview: result.locator ? applyLocator(text, result.locator) : null,
    };
  },

  /** Teach a rule. Replaces any standing rule for the same target. */
  'POST /api/rules': (body) =>
    saveRule({
      db,
      vendorId: String(body.vendorId),
      kind: String(body.kind),
      docType: body.docType ? String(body.docType) : null,
      fieldName: body.fieldName ? String(body.fieldName) : null,
      url: body.url ? String(body.url) : null,
      locator: body.locator ?? null,
      note: body.note ? String(body.note) : null,
      authoredBy: OPERATOR_ID,
    }),

  /** Unlearn one. A delete, because an unlearned rule should leave no residue. */
  'POST /api/rules/delete': (body) =>
    deleteRule(db, String(body.vendorId), String(body.ruleId)),
};

// ---------------------------------------------------------------------------
// server
// ---------------------------------------------------------------------------

async function readBody(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

const server = http.createServer(async (req, res) => {
  const url = (req.url ?? '/').split('?')[0]!;
  const key = `${req.method} ${url}`;

  if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
    try {
      const page = await fs.readFile(resolve(HERE, 'console/index.html'), 'utf8');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(page);
    } catch {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('console/index.html is missing');
    }
    return;
  }

  const handler = routes[key];
  if (!handler) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: `No route for ${key}` }));
    return;
  }

  try {
    const body = req.method === 'POST' ? await readBody(req) : {};
    const result = await handler(body);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(result ?? null));
  } catch (err) {
    // The console is one person's tool, so the error it shows is the real one.
    // A generic 500 here would send the operator to the server log for something
    // the browser could have told them.
    const known =
      err instanceof CandidateReviewError ||
      err instanceof CorrectionError ||
      err instanceof RuleError;
    const message = err instanceof Error ? err.message : String(err);
    if (!known) console.error(`[console] ${key} failed:`, err);
    res.writeHead(known ? 400 : 500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: message }));
  }
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log(`  Vendor catalogue console   http://${HOST}:${PORT}`);
  console.log(`  Operator                   ${operator.email ?? operator.id}`);
  console.log(`  Database                   ${maskDbUrl(process.env.DATABASE_URL!)}`);
  console.log('');
  console.log('  Bound to loopback only. Approving writes the shared catalogue.');
  console.log('');
});

/** Enough to tell staging from production apart, without printing a password. */
function maskDbUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return '(unparseable)';
  }
}
