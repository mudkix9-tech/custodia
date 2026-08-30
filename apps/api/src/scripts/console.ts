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
const { users, vendors } = await import('db');
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
const { reverifyVendor } = await import('../lib/vendorIntelligence.js');

// ---------------------------------------------------------------------------
// logging
// ---------------------------------------------------------------------------

/**
 * Everything this console does, said out loud in the terminal that started it.
 *
 * Not decoration. The console is one person driving a pipeline that takes
 * minutes per vendor and talks to somebody else's servers; a button that reports
 * "queued" and then shows nothing is indistinguishable from a button that does
 * nothing, which is exactly how the re-probe key read before this.
 */
const stamp = () => new Date().toTimeString().slice(0, 8);
const log = (line: string) => console.log(`  ${stamp()}  ${line}`);
const warn = (line: string) => console.warn(`  ${stamp()}  ${line}`);

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

  /**
   * Re-probe one catalogue vendor, here, now, watching it happen.
   *
   * This used to enqueue a pg-boss job and return `{ queued: true }`. That was
   * the wrong shape for a button a person presses and waits on: the job went to
   * a queue whose worker is not running locally and, judging by the 1,342
   * `impact-assessment` jobs sitting in `created`, not reliably running anywhere
   * — so the honest description of the old behaviour is that pressing `r` did
   * nothing observable, for ever.
   *
   * Probing in-process is a change of position from "probing stays server-side",
   * and it is the right one for *this* path. That argument was about a
   * self-identifying crawler's traffic being defensible, and it still is: one
   * vendor at a time, on demand, robots.txt honoured, one request per second,
   * capped at `MAX_PROBES_PER_TARGET`. What it is not is a bulk sweep — that is
   * still `/api/enrich`, which still queues, because volume is the thing worth
   * keeping off a laptop.
   */
  'POST /api/reverify': async (body) => {
    const vendorId = String(body.vendorId);
    const [vendor] = await db
      .select({ id: vendors.id, name: vendors.name, website: vendors.website })
      .from(vendors)
      .where(eq(vendors.id, vendorId));
    if (!vendor) throw new Error('No such vendor');

    const lines: string[] = [];
    const started = Date.now();
    const capture = (line: string) => {
      lines.push(line);
      log(line);
    };

    const outcome = await reverifyVendor(vendor as any, capture);
    const seconds = ((Date.now() - started) / 1000).toFixed(0);
    log(`re-probe of ${vendor.name} finished in ${seconds}s`);

    return { ok: outcome.ok, changes: outcome.changes, seconds: Number(seconds), log: lines };
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
    warn(`404 ${key}`);
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: `No route for ${key}` }));
    return;
  }

  const started = Date.now();
  try {
    const body = req.method === 'POST' ? await readBody(req) : {};
    if (req.method === 'POST') log(`${url}  ${describe(url, body)}`);

    const result = await handler(body);

    // Reads are logged with their size, writes with what they did: a queue that
    // came back empty and a queue that failed to load look the same in a browser.
    const ms = Date.now() - started;
    log(`${url}  ${summarise(url, result)}  (${ms}ms)`);

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
    // A refusal is the tool working and reads as such; anything else gets the
    // stack, because the operator is the only person who will ever see it.
    if (known) warn(`${url}  refused: ${message}`);
    else console.error(`  ${stamp()}  ${url} FAILED:`, err);
    res.writeHead(known ? 400 : 500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: message }));
  }
});

/**
 * A port already in use is nearly always the last console still running, and a
 * raw `EADDRINUSE` stack is the least useful way to say so.
 */
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    refuse(
      `port ${PORT} is already in use.`,
      'Another console is almost certainly still running. Close it, or start this ' +
        'one on a different port with CONSOLE_PORT=7332.',
    );
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log(`  Vendor catalogue console   http://${HOST}:${PORT}`);
  console.log(`  Operator                   ${operator.email ?? operator.id}`);
  console.log(`  Database                   ${maskDbUrl(process.env.DATABASE_URL!)}`);
  console.log('');
  console.log('  Bound to loopback only. Approving writes the shared catalogue.');
  console.log('  Everything you do appears below.');
  console.log('');
});

/** What a request was asking for, in one line. */
function describe(url: string, body: any): string {
  switch (url) {
    case '/api/approve': {
      const rejected = Object.entries(body.overrides ?? {})
        .filter(([, v]) => v === null)
        .map(([k]) => k);
      return `candidate ${short(body.id)}${rejected.length ? ` (rejecting ${rejected.join(', ')})` : ''}`;
    }
    case '/api/reject': return `candidate ${short(body.id)} — "${body.reason ?? 'no reason'}"`;
    case '/api/correct': return `${body.fieldName} on vendor ${short(body.vendorId)}`;
    case '/api/apply': return `${body.fieldName} -> catalogue column, vendor ${short(body.vendorId)}`;
    case '/api/rules': return `teach ${body.kind} ${body.fieldName ?? body.docType ?? ''} ${body.url ?? ''}`.trim();
    case '/api/rules/delete': return `forget rule ${short(body.ruleId)}`;
    case '/api/reverify': return `re-probe vendor ${short(body.vendorId)}`;
    case '/api/enrich': return `queue ${(body.targets ?? []).length} target(s) for the worker`;
    case '/api/derive': return `derive locator from ${Number(body.end) - Number(body.start)} selected chars`;
    default: return '';
  }
}

/** What came back, so an empty answer is distinguishable from a failed one. */
function summarise(url: string, result: any): string {
  if (Array.isArray(result)) return `-> ${result.length} row(s)`;
  switch (url) {
    case '/api/evidence':
      return `-> ${result?.documents?.length ?? 0} stored page(s), ${result?.rules?.length ?? 0} rule(s)`;
    case '/api/approve': return `-> approved, now ${result?.status ?? '?'}`;
    case '/api/reject': return `-> rejected`;
    case '/api/apply': return `-> wrote ${result?.column}, ${result?.rescored ?? 0} score(s) recalculated`;
    case '/api/correct': return `-> analyst provenance written`;
    case '/api/rules': return `-> rule ${short(result?.id)} saved`;
    case '/api/rules/delete': return `-> forgotten`;
    case '/api/derive':
      return result?.locator
        ? `-> anchored after "${result.locator.before}"`
        : `-> refused: ${result?.problem ?? 'no locator'}`;
    case '/api/reverify':
      return `-> ${result?.ok ? 'ok' : 'failed'}, ${result?.changes?.length ?? 0} change(s)`;
    default: return '-> ok';
  }
}

const short = (id: unknown) => String(id ?? '').slice(0, 8);

/** Enough to tell staging from production apart, without printing a password. */
function maskDbUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return '(unparseable)';
  }
}
