/**
 * Calls every tRPC query over real HTTP and reports the ones that throw.
 *
 *   npm run probe --workspace=apps/api                  # against localhost:4000
 *   PROBE_URL=https://api.custodia.io npm run probe     # against a deployed service
 *   PROBE_TOKEN=<session-jwt> npm run probe             # include protected procedures
 *
 * Why this exists: every bug that has reached production-shaped code in this repo was
 * invisible to `tsc`, and the sharpest ones fail on *every* invocation rather than on
 * some unlucky row — so simply calling a procedure once is enough to find them:
 *
 *   - a `with:` key with no relations() block throws while Drizzle *builds* the query,
 *     before any row is read (see the database section of CLAUDE.md);
 *   - a context missing `db` throws on first property access, which is what broke
 *     every publicProcedure until August 2026.
 *
 * Neither needs valid data to surface, which is the point: this probe deliberately
 * sends ids that match nothing. A procedure that answers NOT_FOUND has *run*, and
 * running is what is being tested. Only an INTERNAL_SERVER_ERROR is a failure.
 *
 * It goes over HTTP rather than createCaller() on purpose. An in-process caller
 * builds its own context and would have sailed straight past the missing-`db` bug,
 * which lived in how the Fastify plugin was wired, not in any procedure.
 *
 * Queries only. Mutations are enumerated and reported as skipped: 160 of them write
 * real rows, send real email and notify real regulators, so probing them needs a
 * canary organisation and side-effect suppression — a separate decision, not a flag.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

/** `--flag value`, so the whole invocation stays a static, grantable command line. */
function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// ── Environment must be settled before anything that opens a pool is imported ──
// An ESM import is fully evaluated before any statement in this module body runs, so
// with static imports `db.js` captured DATABASE_URL from apps/api/.env — pointing at
// localhost — before the override below could take effect, and every query went to
// the wrong database. Hence dotenv here and dynamic imports after.
dotenv.config();

// apps/api/.env points at a local database; the repo-root .env carries the deployed
// DATABASE_URL and AUTH_SECRET, which is what minting a token for a deployed service
// needs.
if (process.argv.includes('--prod-env')) {
  const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../..');
  dotenv.config({ path: path.join(repoRoot, '.env'), override: true });
}

// The probe is a client, not a worker host, but importing the router registers workers
// as a module side effect. Without this it starts pg-boss against whichever database
// it just loaded and floods the output with connection errors.
process.env.WORKER_ROLE ??= 'web';

const { appRouter } = await import('../router.js');
const { mintToken, PRODUCTION_COOKIE, DEVELOPMENT_COOKIE } = await import('./mint-probe-token.js');

const BASE_URL = (flag('url') || process.env.PROBE_URL || 'http://localhost:4000').replace(/\/$/, '');
let TOKEN = process.env.PROBE_TOKEN;
const CONCURRENCY = Number(process.env.PROBE_CONCURRENCY || 8);
/** Prints what would be sent and calls nothing. Worth doing once before aiming at a
 *  deployed service, since the inputs below are invented rather than curated. */
const DRY_RUN = process.argv.includes('--dry-run') || process.env.PROBE_DRY_RUN === '1';

/**
 * A syntactically valid id that will not match a row. The probe wants the query to
 * build and execute, not to return anything.
 */
const ABSENT_UUID = '00000000-0000-4000-8000-000000000000';

type Verdict = 'ok' | 'rejected' | 'failed' | 'unsynthesisable';

interface Result {
  path: string;
  verdict: Verdict;
  detail?: string;
  diagnosis?: string;
}

/**
 * Builds the smallest input a schema will accept. Optional keys are left out — the
 * aim is to reach the resolver, not to exercise every branch inside it.
 *
 * Throws `Unsynthesisable` for shapes it cannot invent a value for, so those
 * procedures are reported as skipped rather than silently counted as passing.
 */
class Unsynthesisable extends Error {}

function synthesise(schema: any, depth = 0): unknown {
  if (!schema?._def || depth > 6) throw new Unsynthesisable('too deep');
  const def = schema._def;

  switch (def.typeName) {
    case 'ZodOptional':
    case 'ZodNullable':
    case 'ZodDefault':
      return synthesise(def.innerType, depth + 1);

    case 'ZodEffects':
      return synthesise(def.schema, depth + 1);

    case 'ZodObject': {
      const shape = typeof def.shape === 'function' ? def.shape() : def.shape;
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries<any>(shape)) {
        // Omitting optionals keeps the payload minimal and avoids inventing values
        // that a resolver might branch on in ways the probe cannot predict.
        const kind = child?._def?.typeName;
        if (kind === 'ZodOptional' || kind === 'ZodDefault') continue;
        out[key] = synthesise(child, depth + 1);
      }
      return out;
    }

    case 'ZodString': {
      const checks: Array<{ kind: string }> = def.checks || [];
      if (checks.some((c) => c.kind === 'uuid')) return ABSENT_UUID;
      if (checks.some((c) => c.kind === 'email')) return 'probe@example.invalid';
      if (checks.some((c) => c.kind === 'url')) return 'https://example.invalid';
      if (checks.some((c) => c.kind === 'datetime')) return new Date().toISOString();
      return 'probe';
    }

    case 'ZodNumber':
      return 1;
    case 'ZodBoolean':
      return false;
    case 'ZodDate':
      return new Date().toISOString();
    case 'ZodArray':
      return [];
    case 'ZodEnum':
      return def.values[0];
    case 'ZodNativeEnum':
      return Object.values(def.values)[0];
    case 'ZodLiteral':
      return def.value;
    case 'ZodUnion':
      return synthesise(def.options[0], depth + 1);
    case 'ZodRecord':
    case 'ZodAny':
    case 'ZodUnknown':
      return {};

    default:
      throw new Unsynthesisable(def.typeName ?? 'unknown schema');
  }
}

/**
 * An error code the procedure itself chose. It means the resolver ran and made a
 * decision, which is a pass — the probe supplies ids that match nothing, so
 * NOT_FOUND is the expected answer for most of them.
 */
const CLEAN_REJECTIONS = new Set([
  'BAD_REQUEST',
  'NOT_FOUND',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'PRECONDITION_FAILED',
  'TOO_MANY_REQUESTS',
  'CONFLICT',
  'PAYMENT_REQUIRED',
  // A deliberate "this endpoint is a stub" is a decision the resolver reached, not a
  // crash — clients.getPortalPreview answers this by design.
  'NOT_IMPLEMENTED',
]);

/** Turns a stack trace into the sentence that says which known trap was hit. */
function diagnose(message: string): string | undefined {
  if (/referencedTable/.test(message)) {
    return "a `with:` key resolves to nothing — the target table has no relations() block";
  }
  if (/Cannot read properties of undefined \(reading '(query|select|insert|update|delete|transaction)'\)/.test(message)) {
    return 'ctx.db is undefined — the context factory did not supply it';
  }
  if (/relation ".*" does not exist/.test(message)) {
    return 'the table is missing from this database — migrations may not have run';
  }
  if (/Cannot read properties of undefined \(reading 'organizationId'\)/.test(message)) {
    return 'a table without organizationId was passed to a helper that filters on it';
  }
  if (/no matching decryption secret|Invalid Compact JWE|decryption operation failed/.test(message)) {
    return 'the token could not be decrypted — AUTH_SECRET here differs from the target service, or the salt (cookie name, which follows NODE_ENV) differs';
  }
  if (/^Failed query/.test(message)) {
    // Drizzle got far enough to build and issue SQL, so the procedure and every
    // relation it names resolved. Whatever went wrong is on the database side —
    // unreachable, un-migrated or a permissions problem — not a defect in the code.
    return 'the SQL was built and sent, so the procedure itself is intact — the database rejected or refused it';
  }
  return undefined;
}

/** Keeps one failure to one readable line; Drizzle inlines whole SELECT lists. */
function condense(message: string): string {
  const flat = message.replace(/\s+/g, ' ').trim();
  return flat.length > 160 ? `${flat.slice(0, 160)}…` : flat;
}

async function probe(path: string, input: unknown): Promise<Result> {
  const url = new URL(`${BASE_URL}/api/trpc/${path}`);
  if (input !== undefined) url.searchParams.set('input', JSON.stringify(input));

  let res: Response;
  try {
    res = await fetch(url, {
      headers: TOKEN ? { authorization: `Bearer ${TOKEN}` } : {},
    });
  } catch (err: any) {
    return { path, verdict: 'failed', detail: `no response: ${err?.message ?? err}` };
  }

  const body = await res.text();
  if (res.ok) return { path, verdict: 'ok' };

  let code = `HTTP ${res.status}`;
  let message = body.slice(0, 300);
  try {
    const parsed = JSON.parse(body);
    const err = Array.isArray(parsed) ? parsed[0]?.error : parsed?.error;
    code = err?.data?.code ?? code;
    message = err?.message ?? message;
  } catch {
    // Not JSON — a proxy error page or a crash before tRPC formatted a reply.
  }

  if (CLEAN_REJECTIONS.has(code)) {
    return { path, verdict: 'rejected', detail: code };
  }
  return { path, verdict: 'failed', detail: `${code}: ${condense(message)}`, diagnosis: diagnose(message) };
}

async function main() {
  // Minting in-process keeps the credential off the command line and out of the
  // terminal; the alternative is pasting a token through a shell variable.
  const as = flag('as');
  if (as && !TOKEN) {
    const salt = process.argv.includes('--dev') ? DEVELOPMENT_COOKIE : PRODUCTION_COOKIE;
    // --secret exists because the deployed AUTH_SECRET need not be the one in any local
    // .env. Prefer it over pasting the value into a file, where it outlives the run.
    const { token, user } = await mintToken(as, salt, 3600, flag('secret'));
    TOKEN = token;
    console.log(`minted a 1h token for ${user.email} · role ${user.role} · org ${user.organizationId}`);
  }

  const procedures = (appRouter as any)._def.procedures as Record<string, any>;
  const queries: Array<{ path: string; input: unknown }> = [];
  const unsynthesisable: Result[] = [];
  let mutations = 0;

  for (const [path, procedure] of Object.entries(procedures)) {
    if (procedure._def.type !== 'query') {
      mutations++;
      continue;
    }
    const schema = procedure._def.inputs?.[0];
    if (!schema) {
      queries.push({ path, input: undefined });
      continue;
    }
    try {
      queries.push({ path, input: synthesise(schema) });
    } catch (err: any) {
      unsynthesisable.push({
        path,
        verdict: 'unsynthesisable',
        detail: err instanceof Unsynthesisable ? err.message : String(err),
      });
    }
  }

  console.log(`probe → ${BASE_URL}`);
  console.log(
    `${queries.length} queries to call, ${unsynthesisable.length} with inputs that could not be ` +
    `synthesised, ${mutations} mutations skipped by design.`
  );
  console.log(TOKEN ? 'Authenticated: protected procedures included.\n' : 'No token (pass --as <email>): protected procedures will answer UNAUTHORIZED.\n');

  if (DRY_RUN) {
    for (const { path, input } of queries) {
      console.log(`  ${path}  ${input === undefined ? '(no input)' : JSON.stringify(input)}`);
    }
    console.log('');
    if (unsynthesisable.length > 0) {
      console.log(`NOT PROBED (${unsynthesisable.length}):`);
      for (const r of unsynthesisable) console.log(`  ${r.path} (${r.detail})`);
      console.log('');
    }
    console.log(`Dry run — nothing was called. ${queries.length} of ${queries.length + unsynthesisable.length} queries are probeable.`);
    process.exit(0);
  }

  const results: Result[] = [];
  for (let i = 0; i < queries.length; i += CONCURRENCY) {
    const batch = queries.slice(i, i + CONCURRENCY);
    results.push(...await Promise.all(batch.map((q) => probe(q.path, q.input))));
  }

  const failed = results.filter((r) => r.verdict === 'failed');
  const ok = results.filter((r) => r.verdict === 'ok');
  const rejected = results.filter((r) => r.verdict === 'rejected');

  if (failed.length > 0) {
    console.log(`FAILED (${failed.length}) — these threw rather than answering:\n`);
    for (const r of failed) {
      console.log(`  ${r.path}`);
      console.log(`    ${r.detail}`);
      if (r.diagnosis) console.log(`    → ${r.diagnosis}`);
    }
    console.log('');
  }

  if (unsynthesisable.length > 0) {
    console.log(`NOT PROBED (${unsynthesisable.length}) — no value could be invented for the input:\n`);
    for (const r of unsynthesisable) console.log(`  ${r.path} (${r.detail})`);
    console.log('');
  }

  console.log(
    `${ok.length} answered, ${rejected.length} rejected cleanly (they ran), ` +
    `${failed.length} threw, ${unsynthesisable.length} not probed.`
  );

  // When the token was rejected wholesale, find out *why* rather than leaving the
  // reader to guess at secret drift. isAuthed falls back to the literal string
  // 'secret' when AUTH_SECRET is unset (trpc.ts), so a service deployed without that
  // variable accepts a session anyone on the internet can forge. One request settles
  // it, and a negative answer is the reassuring one.
  const undecryptable = failed.filter((r) => /decryption secret|Compact JWE/.test(r.detail ?? ''));
  if (as && undecryptable.length > 0) {
    const salt = process.argv.includes('--dev') ? DEVELOPMENT_COOKIE : PRODUCTION_COOKIE;
    const { token } = await mintToken(as, salt, 300, 'secret');
    const canary = undecryptable[0]!.path;
    const previous = TOKEN;
    TOKEN = token;
    const result = await probe(canary, queries.find((q) => q.path === canary)?.input);
    TOKEN = previous;

    console.log('');
    if (result.verdict === 'failed' && /decryption secret|Compact JWE/.test(result.detail ?? '')) {
      console.log('AUTH_SECRET differs between here and the target service. The target is not');
      console.log("using the hard-coded 'secret' fallback, which is the good outcome.");
    } else {
      console.log('!! The target accepted a token signed with the literal string \'secret\'.');
      console.log('!! AUTH_SECRET is unset there, so isAuthed fell back to it (trpc.ts) and any');
      console.log('!! caller can forge a session for any user. Set AUTH_SECRET and redeploy.');
    }
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
