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
 *
 * Two passes:
 *
 *   1. Reads and writes keyed on a client-supplied id, checked per *procedure*.
 *   2. `update`/`delete` statements, checked per *statement*.
 *
 * Pass 2 exists because pass 1 proves ownership for a whole procedure body, and
 * tenancy is a property of each statement. `tia.save` satisfied pass 1 — it scopes
 * its transferImpactAssessments and organizationVendors writes correctly — while a
 * third write in the same body updated processing_transfers by vendorId alone.
 * `vendors` is a *shared* catalogue, so one organisation completing a TIA for AWS
 * flipped every other tenant's AWS transfer row to "TIA: Completed". One correct
 * query masking an incorrect one is exactly what a procedure-level scan cannot see.
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
  // The org must come from the session, not the request body. Accepting a bare
  // `eq(x.organizationId, …)` let `integrations.listConnections` through for
  // months: it filtered on `input.organizationId`, which is org-scoped to
  // whichever org the caller names — the opposite of a tenancy check.
  /eq\(\s*\w+\.organizationId\s*,\s*(?!input\.)/,
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
    reason: 'Reads the shared vendor_sub_processors row only to confirm the id exists — sub-processors describe a vendor, not a tenant, same as ::list. The acknowledgement it writes is org-scoped (vendor_sub_proc_acks, keyed on the caller orgId), which is the D46 fix: notifiedAt used to live on the shared row so one tenant acknowledging cleared it for all.',
  },
  'vendors.ts::publishIncident': {
    reason: 'Platform-operator action on the global incident feed, gated on vendors:manage until a real platform-admin role exists.',
  },
};

/**
 * Two catalogue write paths left this guard's sight, and a third left the codebase.
 * The reasoning that used to sit in ALLOWED above is recorded here because it did
 * not stop being true.
 *
 * **Extracted.** `vendors.submitFieldCorrection` and its new sibling
 * `vendors.applyFieldCorrection` are thin wrappers over
 * `lib/vendorCorrections.ts`. The logic moved so the local operator console can
 * call exactly the same code rather than carrying a second copy of a
 * shared-catalogue write — which is the failure VD-7 records one level down, and
 * which had already cost two live defects (known-concerns §21).
 *
 * **Deleted.** The `vendorIntelligence` router is gone entirely. Its
 * candidate-review procedures wrote `vendors` — one row read by every tenant —
 * gated on `vendors:edit`, which `member` carries, so any member of any
 * organisation could approve a candidate into global reference data. It is
 * replaced by `npm run console --workspace=apps/api`, which binds loopback and
 * calls `lib/vendorCandidateReview.ts` directly.
 *
 * This guard is procedure-shaped: it finds `x: protectedProcedure` blocks in
 * `src/routers` and reads their bodies, so a plain function in `src/lib` is not
 * something it can check, and extending it to `src/lib` would mean scanning
 * hundreds of pure functions that never touch a tenant. **What that costs is real
 * and small**: the two correction bodies are no longer re-read on every run.
 *
 * What has not changed is why they are exempt. They write *shared catalogue*
 * tables — `vendors`, `vendor_field_provenance` — which are cross-tenant
 * reference data by design, so there is no org column to scope to and scoping to
 * one would be the bug. The extracted functions take an explicit `db` handle and
 * no org id at all, which makes that structural rather than a matter of
 * remembering. The permission gate stayed on the procedures where it belongs
 * (`vendors:manage`, which no built-in role grants), and `applyCorrectionToColumn`
 * takes no value from the caller — only a vendor and a field — so it can promote
 * a row that already passed `validateAnalystCorrection` and nothing else.
 *
 * A tenant who disagrees about a vendor still gets a `customer` provenance row,
 * which `selectAuthoritativeProvenance` drops from catalogue resolution so it
 * cannot propagate.
 */

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

// ---------------------------------------------------------------------------
// Pass 2 — write statements.
// ---------------------------------------------------------------------------

/** ctx.db.update(<table>) / .delete(<table>), also on a helper's own handle. */
const WRITE_STATEMENT = /\b(?:ctx\.db|db|dbc|tx)\s*\n?\s*\.(update|delete)\(\s*(\w+)\s*\)/g;

/** Anything client-supplied that could steer a predicate. */
const CLIENT_VALUE = /\b(?:input|opts)\.(\w+)/g;

/** An organisation predicate on this statement, sourced from the session. */
const ORG_PREDICATE = /\w+\.organizationId\s*,\s*(?!input\.)/;

/**
 * Scoped to the caller rather than their organisation — sessions, training records.
 * Stricter than an org predicate, so it settles the question on its own.
 */
const USER_PREDICATE = /\w+\.userId\s*,\s*ctx\.user/;

/** A scoping subquery — inArray(child.parentId, db.select(...)). */
const SCOPING_SUBQUERY = /inArray\([\s\S]*?\.select\(/;

/**
 * Proof that this exact id was already resolved to a row the caller owns.
 *
 * The `.id` half is what makes this sound. `tia.save` proves `input.vendorId` with
 * `eq(organizationVendors.vendorId, …)` under an org predicate — which establishes
 * that the caller has that vendor linked, and nothing whatever about who owns the
 * processing_transfers rows that reference it. Matching an org-scoped read against
 * a table's *primary key* says "this row is mine"; matching it against a foreign
 * key into a shared catalogue says only "I have a row pointing at it".
 */
function provenEarlier(prefix: string, value: string): boolean {
  // (a) a preceding org- or user-scoped read that pinned this value to a row's own id.
  const escaped = value.replace('.', String.raw`\.`);
  const pinnedToAnId = new RegExp(String.raw`\b\w+\.id\s*,\s*${escaped}\b`);
  const anchors = /\b\w+\.organizationId\s*,\s*(?!input\.)|\b\w+\.userId\s*,\s*ctx\.user/g;
  for (const m of prefix.matchAll(anchors)) {
    // The anchor may sit on a table joined on the way — vendorSubProcessors proves
    // itself through vendors — so the window, not the table name, is the unit.
    const window = prefix.slice(Math.max(0, m.index! - 600), m.index! + 600);
    if (pinnedToAnId.test(window)) return true;
  }

  // (b) an assertOwned/assertParentOwned naming the value — the helper resolves the
  //     row by its own id and walks to whatever holds organization_id.
  const calls = prefix.match(/assert(?:Owned|ParentOwned|DomainInOrg)\([\s\S]{0,700}?\)\s*;/g) ?? [];
  return calls.some(c => c.includes(value));
}

/**
 * Reviewed exceptions for pass 2. Key is `file::procedure::table`.
 *
 * Every one of these is a write that genuinely cannot carry an organisation
 * predicate. Two of them are data-model bugs held open deliberately and tracked in
 * known-concerns.md; the rest are shared catalogues, platform-operator actions, or
 * flows whose access control is an unguessable token rather than a tenant.
 */
const ALLOWED_WRITES: Record<string, Exception> = {
  'assessments.ts::calculateResults::assessments': {
    reason: 'Public lead-magnet assessment flow; the unguessable id is the access control. Same rationale as the pass-1 entry.',
  },
  'assessments.ts::calculateResults::actionItems': {
    reason: 'Clears and rebuilds the action items of the assessment above, in the same public flow.',
  },
  'clients.ts::unlinkActivity::clientProcessingActivities': {
    reason: 'Anchored on a clientId proved org-owned two statements earlier, so the composite delete cannot reach another tenant\'s link rows.',
  },
  'regulatory.ts::adminPublishUpdate::regulatoryUpdates': {
    reason: 'Global regulatory catalogue, gated on requirePlatformAdmin(). Publishing deliberately fans out to every organisation.',
  },
  'vendors.ts::publishIncident::vendorIncidents': {
    reason: 'Platform-operator action on the global incident feed, gated on vendors:manage until a real platform-admin role exists.',
  },
  'vendors.ts::submitQuestionnaireAnswers::vendorQuestionnaires': {
    reason: 'Vendor-facing questionnaire return path. The recipient has no Custodia account; the unguessable token is the access control.',
  },
  // C32/C33. The four below are the delegated-intake return path, and they are the
  // same shape and the same rationale as the vendor questionnaire above: the
  // respondent is a department head with no Custodia account who is never going to
  // get one, so the unguessable token *is* the access control. Each write is keyed
  // on that token alone, which resolves to exactly one row in one organisation —
  // adding an org predicate would mean the caller naming the org, which is the
  // hole `integrations.listConnections` had.
  'ropaIntake.ts::open::ropaIntakeRequests': {
    reason: 'Token-authenticated intake questionnaire; marks the request opened. No account exists to scope to.',
  },
  'ropaIntake.ts::saveProgress::ropaIntakeRequests': {
    reason: 'Token-authenticated intake questionnaire; saves a partial response. No account exists to scope to.',
  },
  'ropaIntake.ts::submit::ropaIntakeRequests': {
    reason: 'Token-authenticated intake questionnaire; records the submitted answers. Nothing here reaches the register — a reviewer merges field by field.',
  },
  'ropaIntake.ts::decline::ropaIntakeRequests': {
    reason: 'Token-authenticated intake questionnaire; records that the recipient declined.',
  },
};

type WriteFinding = { file: string; line: number; table: string; op: string; values: string[]; key: string };

/** Returns the text inside the parens that open at `open`. */
function balanced(text: string, open: number): string {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') {
      depth--;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  return '';
}

function scanWrites(): { checked: number; findings: WriteFinding[]; staleAllowlist: string[] } {
  const findings: WriteFinding[] = [];
  const seen = new Set<string>();
  let checked = 0;

  for (const file of fs.readdirSync(ROUTERS).filter(f => f.endsWith('.ts')).sort()) {
    const text = fs.readFileSync(path.join(ROUTERS, file), 'utf8');

    // Proof has to come from the same procedure. A helper defined above the router
    // counts as its own body, which is why the fallback is offset 0.
    const bodies: { at: number; name: string }[] = [];
    let at = 0;
    for (const line of text.split('\n')) {
      const proc = PROCEDURE.exec(line);
      const fn = /^(?:async )?function (\w+)/.exec(line);
      if (proc) bodies.push({ at, name: proc[1]! });
      else if (fn) bodies.push({ at, name: fn[1]! });
      at += line.length + 1;
    }

    for (const m of text.matchAll(WRITE_STATEMENT)) {
      const op = m[1]!;
      const table = m[2]!;
      const whereAt = text.indexOf('.where(', m.index! + m[0].length);
      if (whereAt < 0) continue;
      const where = balanced(text, whereAt + '.where'.length);

      // Only a predicate the caller steers can cross a tenant boundary.
      const values = Array.from(new Set(
        Array.from(where.matchAll(CLIENT_VALUE)).map(v => v[0]!)
      ));
      if (values.length === 0) continue;
      checked++;

      const line = text.slice(0, m.index!).split('\n').length;
      // Keyed on the procedure, not the line: a line-numbered allowlist goes stale
      // on any edit above it, and churn is how a reviewed exception stops being read.
      const body = bodies.filter(b => b.at < m.index!).pop();
      const key = `${file}::${body?.name ?? '<top-level>'}::${table}`;
      seen.add(key);

      if (ORG_PREDICATE.test(where)) continue;
      if (USER_PREDICATE.test(where)) continue;
      if (SCOPING_SUBQUERY.test(where)) continue;

      const prefix = text.slice(body?.at ?? 0, m.index!);
      if (values.every(v => provenEarlier(prefix, v))) continue;

      if (ALLOWED_WRITES[key]) continue;
      findings.push({ file, line, table, op, values, key });
    }
  }

  const staleAllowlist = Object.keys(ALLOWED_WRITES).filter(k => !seen.has(k));
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

const writes = scanWrites();

console.log(`Checked ${writes.checked} update/delete statements steered by a client-supplied value.`);

if (writes.staleAllowlist.length > 0) {
  console.log('\nStale write-allowlist entries (statement gone or moved) — remove them:');
  for (const key of writes.staleAllowlist) console.log(`  ${key}`);
}

if (writes.findings.length > 0) {
  console.error(`\n${writes.findings.length} write(s) with no organisation scope:\n`);
  for (const f of writes.findings) {
    console.error(`  ${f.file}:${f.line}  ${f.op}(${f.table})  keyed on ${f.values.join(', ')}`);
    console.error(`    allowlist key: ${f.key}`);
  }
  console.error(
    '\nA write filtered on a foreign key into a *shared* catalogue — vendors above all —\n' +
    'is not scoped by that key. Add an organizationId predicate, scope through the parent\n' +
    'with inArray(child.parentId, db.select()...), or prove the id with assertOwned first.\n'
  );
  process.exit(1);
}

if (writes.staleAllowlist.length > 0) process.exit(1);

console.log('\nOK — every procedure keyed on a client-supplied id proves ownership,');
console.log('and every update/delete it steers is scoped to an organisation.');
