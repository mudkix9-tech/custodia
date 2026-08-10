/**
 * Fails when a tRPC procedure filters on a client-supplied id without proving the
 * row belongs to the caller's organisation.
 *
 *   npm run check:tenancy --workspace=apps/api
 *
 * Why this exists: `requirePermission()` checks what a user may do, never whose
 * data they may do it to, and org filtering is hand-written in every procedure.
 * Forgetting it is silent — it typechecks, it lints (if lint ran), and it passes
 * every test, because the query is perfectly valid. It just returns other tenants'
 * rows. An audit in August 2026 found 47 procedures in that state.
 *
 * This is a text scan, not a type-aware analysis. It is deliberately noisy in the
 * safe direction: anything it cannot prove, it reports, and genuine exceptions are
 * listed in ALLOWED below with a reason. Adding to that list should feel like a
 * decision, which is the point.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROUTERS = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../routers');

/** eq(<table>.<column>, input.<something ending in id>) */
const ID_PREDICATE = /eq\(\s*(\w+)\.(\w+)\s*,\s*input\.(\w*[iI]d)\b/;
const PROCEDURE = /^\s{2,8}(\w+):\s*(protectedProcedure|publicProcedure)/;

/**
 * Anything here counts as proof of ownership. The helpers resolve tenancy through
 * a parent, so the organisation predicate lives inside them rather than in the
 * procedure body — a plain grep for `organizationId` cannot see it.
 */
const OWNERSHIP_PROOFS = [
  /eq\(\s*\w+\.organizationId/,
  /assertOwned\(/,
  /assertParentOwned\(/,
  /assertDomainInOrg\(/,
];

type Exception = { reason: string };

/**
 * Reviewed exceptions. Key is `file::procedure`.
 *
 * Two legitimate shapes appear here: rows scoped to a *user* rather than an
 * organisation (stricter, so fine), and rows in the shared vendor / regulatory
 * catalogues that genuinely are cross-tenant reference data.
 */
const ALLOWED: Record<string, Exception> = {
  'assessments.ts::calculateResults': {
    reason: 'Public lead-magnet assessment flow; the unguessable id is the access control, and getResults is deliberately a publicProcedure over the same data.',
  },
  'assessments.ts::getResults': {
    reason: 'publicProcedure by design — shareable results link for the marketing assessment.',
  },
  'security.ts::revokeSession': {
    reason: 'Scoped to eq(activeSessions.userId, ctx.user.id), which is stricter than an org filter.',
  },
  'training.ts::startModule': {
    reason: 'Scoped to eq(trainingCompletions.userId, ctx.user.id).',
  },
  'training.ts::trackProgress': {
    reason: 'Scoped to eq(trainingCompletions.userId, ctx.user.id).',
  },
  'training.ts::submitQuiz': {
    reason: 'Scoped to eq(trainingCompletions.userId, ctx.user.id).',
  },
  'regulatory.ts::adminPublishUpdate': {
    reason: 'Global regulatory catalogue, gated on requireRole("owner").',
  },
  'vendors.ts::getById': {
    reason: 'Shared vendor catalogue. Global rows are cross-tenant reference data by design; see known-concerns.md for the custom-vendor caveat.',
  },
  'vendors.ts::getPrivacyAlternatives': {
    reason: 'Reads the global vendor catalogue only.',
  },
  'vendors.ts::linkVendor': {
    reason: 'Reads the global catalogue to attach a vendor to the caller org; the write it performs is org-scoped.',
  },
  'vendors.ts::list': {
    reason: 'Sub-processor records describe a vendor, not a tenant. Permission-gated read of shared reference data.',
  },
  'vendors.ts::markNotified': {
    reason: 'notifiedAt lives on the shared row — a data-model bug tracked in known-concerns.md. Permission-gated; scoping it to org-owned vendors would break change notifications for global vendors.',
  },
  'vendors.ts::publishIncident': {
    reason: 'Platform-operator action on the global incident feed, gated on vendors:manage until a real platform-admin role exists.',
  },
};

type Finding = { file: string; procedure: string; line: number; tables: string[] };

function scan(): { checked: number; findings: Finding[]; staleAllowlist: string[] } {
  const findings: Finding[] = [];
  const seen = new Set<string>();
  let checked = 0;

  for (const file of fs.readdirSync(ROUTERS).filter(f => f.endsWith('.ts')).sort()) {
    const lines = fs.readFileSync(path.join(ROUTERS, file), 'utf8').split('\n');
    const starts = lines.flatMap((l, i) => (PROCEDURE.test(l) ? [i] : []));

    for (let n = 0; n < starts.length; n++) {
      const lo = starts[n]!;
      const hi = starts[n + 1] ?? lines.length;
      const body = lines.slice(lo, hi);
      const text = body.join('\n');

      const hit = body.find(l => ID_PREDICATE.test(l));
      if (!hit) continue;
      checked++;

      const procedure = PROCEDURE.exec(lines[lo]!)![1]!;
      const key = `${file}::${procedure}`;
      seen.add(key);

      if (OWNERSHIP_PROOFS.some(rx => rx.test(text))) continue;
      if (ALLOWED[key]) continue;

      const tables = Array.from(
        new Set(body.flatMap(l => {
          const m = ID_PREDICATE.exec(l);
          return m ? [m[1]!] : [];
        }))
      );
      findings.push({ file, procedure, line: lo + 1, tables });
    }
  }

  // An allowlist entry that no longer matches anything is a stale exemption, and a
  // stale exemption is how a real finding gets waved through later.
  const staleAllowlist = Object.keys(ALLOWED).filter(k => !seen.has(k));
  return { checked, findings, staleAllowlist };
}

const { checked, findings, staleAllowlist } = scan();

console.log(`Checked ${checked} procedures that filter on a client-supplied id.`);
console.log(`Reviewed exceptions: ${Object.keys(ALLOWED).length}`);

if (staleAllowlist.length > 0) {
  console.log('\nStale allowlist entries (procedure gone or renamed) — remove them:');
  for (const key of staleAllowlist) console.log(`  ${key}`);
}

if (findings.length > 0) {
  console.error(`\n${findings.length} procedure(s) with no proof of organisation ownership:\n`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  ${f.procedure}  (${f.tables.join(', ')})`);
  }
  console.error(
    '\nFix by filtering on organizationId, or by proving ownership through the parent\n' +
    'with assertOwned/assertParentOwned from src/lib/tenancy.ts. If it is genuinely\n' +
    'cross-tenant data, add it to ALLOWED in this file with a reason.\n'
  );
  process.exit(1);
}

if (staleAllowlist.length > 0) process.exit(1);

console.log('\nOK — every procedure keyed on a client-supplied id proves ownership.');
