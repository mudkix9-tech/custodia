# Custodia — Working Notes

GDPR compliance platform. npm-workspaces monorepo: `apps/api` (Fastify + tRPC),
`apps/web` (Next.js), `packages/db` (Drizzle schema, imported everywhere as `db`).

This file records the things that are **not** obvious from reading the code and that
have cost time before. Product context lives in `custodia-complete-memory(1).md`.
Open defects and risks — including a tenant-isolation gap affecting 22 procedures —
are in `known-concerns.md`; read it before adding a tRPC procedure.

---

## Verification — what actually gates anything

Run everything with:

```bash
npm run check     # typecheck both workspaces + tenancy/relations/params guards + evaluator fixtures
```

**Both workspaces are at 0 type errors. Keep them there.** (`apps/api` carried a
37-error "baseline" until August 2026; all 37 were in test files, caused by `"types": []`
in `tsconfig.json` suppressing the `@types/jest` that was already installed. Two were real
bugs hiding in the noise.)

**There is no root `tsconfig.json`,** so a bare `tsc --noEmit` at the root checks nothing
and exits 0. Anything treating that as CI is testing nothing — use `npm run check`.

The guards exist because every bug that has reached production-shaped code in this repo
was invisible to `tsc`: see the multi-tenancy, database and `apps/web` sections below.

**Two guards are module-specific and easy to miss.** `check:ropa-i18n` and
`check:vendor-i18n` (apps/web) both run `scripts/check-module-i18n.mjs`, which takes the
module name as its argument — each entry in its `MODULES` table names a catalogue and the
directories that resolve against it. They fail on a hardcoded English string in that
module's components *and* on a `t()` key that is not in the catalogue — next-intl renders
a missing key as its own dotted path, in every locale, which `check:messages` cannot see
because it only compares the three catalogues against each other. **A module absent from
that table has no i18n check at all**, which is how seven of the eight vendor components
sat at zero `useTranslations` for a year. Add new surfaces to the module's `targets`.
`test:ropa-lifecycle` (apps/api) covers review cadence, the reminder ladder, approval
transitions, snapshot diffing and the pagination cursor codec.

It is a **text scan**, not a parse, and it is noisy in the safe direction. Its JSX-text
rule matches `>…<`, so a type annotation like `() => Promise<void>` reads as a text node
containing the word "Promise". The fix is to restructure the annotation (`() => unknown`),
not to add an `ALLOWED` entry — that list is for UI copy that really is meant to stay
English, and a stale entry there fails too. Its key check only sees single-quoted keys, so
a dynamic `t(`status.${row.status}`)` is **not** verified: add those keys by hand and
check them yourself.

**Two more fixture suites arrived with Sprint 3.** `test:assessments` covers the DPIA
screening verdict, LIA completeness, the TIA's six steps and its self-contradiction
checks, the risk matrix, the content hash and the audit-diff renderer.
`test:ropa-exports` reads each generated workbook back out of its own buffer, because
`tsc` sees a valid `Buffer` whether or not the sheet names collided or an empty sheet
lost its headers.

**Two more arrived with Sprint 4.** `test:retention` covers disposal-date arithmetic
(calendar-aware, so 31 January plus a month is 28 February and not 3 March), the
period parser, schedule validation, legal-hold expiry, and the three data maps.
`test:ropa-intelligence` covers material-change classification, the privacy-notice /
DSAR-scope / blast-radius builders, AI-draft validation and the intake mapping.
Everything in those two returns a *plausible* value when it is wrong — a disposal
date out by a month reads exactly like a correct one, and a notice that omits its
transfers section because no mechanism was recorded is a published Art. 13(1)(f)
hole. Fixtures are the only thing that can tell them apart.

**`test:vendors` arrived with the vendor module's Sprint 0.** It covers the sub-processor
snapshot normaliser and the diff that reads it, the monthly AI window, the DPF location
factor, the DPA status vocabulary and the CSV quoting rules. Two things it protects are
worth knowing before you touch them. The snapshot cleaner must collapse **horizontal**
whitespace only (`[^\S\n]+`): `\s` includes `\n`, the reviewer's diff splits on `\n`, and
collapsing both turns every Art. 28(2) change into "1 addition, 1 removal" over two
unreadable blobs. And `organizations.ai_last_reset_at` is **one** window with **two**
counters on it — `ai_queries_used` and `ai_dpas_analyzed` — so whichever path notices the
month has rolled over must clear both (`aiWindowReset()` in `constants/aiQuota.ts`);
clearing one turns the other back into a lifetime counter, silently.

**Editing the vendor catalogue does not move any customer's score.**
`organization_vendors.risk_score` is denormalised and written at link time, so a seed
change — backfilling `data_privacy_framework`, say, which is what stops every US vendor
scoring the full location risk — is inert until the derived rows are recomputed:

```bash
npm run seed:vendors     --workspace=packages/db
npm run recalc:vendor-risk --workspace=apps/api -- --apply   # dry run without --apply
```

**`npx eslint` cannot run at all.** `apps/web/eslint.config.mjs` throws
`TypeError: tailwind.configs.flat/recommended is not iterable` on ESLint 9.39.4.
Pre-existing plugin incompatibility. **No code in this repo has been lint-checked**, so
`tsc` is the only static gate — and see the Next.js note below for what it misses.

**`apps/api` has three test styles and only one of them runs.** Standalone `tsx`
scripts execute; the vitest files do not (vitest is installed in `apps/web` only) and
`billing.test.ts` needs jest, which is not installed at all. They all typecheck, which is
what makes it easy to believe the suite exists. Write new tests in the standalone style:

```bash
npm run test:fixtures --workspace=apps/api    # pure, no env needed
npm run test:scoring  --workspace=apps/api    # needs DATABASE_URL set (never dialled)
```

Standalone tests mock `db.query.*` and restore in a `finally`. `NODE_ENV=test` makes
`createQueue`/`createWorker` no-ops and `getBoss()` return null. `DATABASE_URL` must be
*set* for anything importing `db.js` (it throws on import) but is never connected to if
every query is mocked.

**Consequence for new code in `apps/api`:** if you add a function that reads the
database, use `db.query.<table>.findMany()` rather than `db.select().from()` wherever the
surrounding file already does. `db.query` is what the existing tests can mock; a
`db.select()` call silently escapes the mock and tries to open a real connection.

---

## Multi-tenancy — the sharpest edge in this codebase

`requirePermission('resource', 'action')` checks **what the user may do**. It does
**not** scope anything to an organisation, and neither does `checkOrgContext`, which only
asserts the user has an org id. Org filtering is manual, per query, in every procedure.

An audit in August 2026 found **47 procedures** with no ownership check — including ones
that let any authenticated user rewrite and approve another organisation's regulator
breach notification. All are fixed. Do not add the 48th.

For a table that carries `organization_id`:

```ts
const [row] = await ctx.db.select().from(consentDomains)
  .where(and(
    eq(consentDomains.id, input.id),
    eq(consentDomains.organizationId, ctx.user!.orgId),
  ));
```

For a child table that does not — most of them — use `src/lib/tenancy.ts`, which walks
the chain to whatever holds `organization_id`:

```ts
await assertOwned(ctx.db, {
  table: dpiaMeasures,
  id: input.id,
  orgId: ctx.user!.orgId,
  label: 'Measure',
  via: [
    { table: dpiaRisks, on: eq(dpiaMeasures.dpiaRiskId, dpiaRisks.id) },
    { table: dpias, on: eq(dpiaRisks.dpiaId, dpias.id) },
  ],
});
```

It throws `NOT_FOUND`, never `FORBIDDEN` — "this exists but is not yours" confirms the id
is real, which is the one thing a caller probing other tenants' ids does not already know.

This applies to client-supplied **foreign** keys too (`input.breachId`, `input.dsarId`),
not just `input.id`. That distinction is exactly what the first version of the audit
missed, which is why it reported 22 instead of 47.

`npm run check:tenancy --workspace=apps/api` runs two passes. The first fails on any
procedure that filters on a client-supplied id without proving ownership. The second
checks `update`/`delete` **per statement**, because the first proves ownership for a
whole procedure body and tenancy is a property of each query: `tia.save` scoped two of
its three writes correctly and updated `processing_transfers` by `vendorId` alone, which
— `vendors` being a *shared* catalogue — let one organisation's completed TIA flip every
other tenant's transfer row to "TIA: Completed".

A write passes pass 2 if its own `where` carries an organisation or user predicate or a
scoping subquery, or if an earlier statement in the same body pinned the value to a row's
**own id** under such a predicate. That last distinction is the point: proving
`organizationVendors.vendorId = input.vendorId` says you have the vendor linked, not that
the rows you are about to update are yours.

Genuine exceptions (shared vendor and regulatory catalogues, user-scoped rows, the public
assessment flow, token-authenticated vendor returns) go in `ALLOWED` (pass 1, keyed
`file::procedure`) or `ALLOWED_WRITES` (pass 2, keyed `file::procedure::table`) **with a
reason**; a stale entry in either fails too.

`ctx.user.orgId` is already the *effective* org after impersonation (`trpc.ts` resolves
`effectiveOrgId`), so all of this is safe for admin/support paths.

`paginatedQuery(table, orgId, …)` filters on `table.organizationId`. Pass `null` — never
an org id — for a table that has no such column, and prove ownership through the parent
first. It throws a named error rather than building `eq(undefined, …)`, which is what two
DSAR endpoints were silently doing.

## Background jobs (pg-boss)

Not BullMQ. `future-roadmap.md` still says BullMQ throughout and is stale.

**Job names travel inside the payload.** pg-boss has no per-job name — `boss.send(queue,
data)` leaves `job.name` set to the *queue* name. `apps/api/src/lib/queue.ts` wraps an
envelope so workers can branch on a real job name. Three shapes are accepted:

| Shape | Written by |
|---|---|
| `{ __job, __v, data }` | `createQueue().add(jobName, data, opts)` |
| `{ name, data }` | `boss.schedule()` via `wrapJobPayload()` |
| anything else | treated as a raw payload; queue name stands in as job name |

Use `createQueue(q).add(jobName, data, opts)` to enqueue and `wrapJobPayload(jobName, {})`
inside `scheduleGlobalJobs()`. Never call `boss.send()` directly — the envelope is the
only reason multiplexed workers route correctly.

`translateJobOptions()` converts BullMQ-shaped options to pg-boss ones: `delay` (ms) →
`startAfter` (s), `attempts` → `retryLimit` (minus one), `backoff` → `retryDelay` /
`retryBackoff`. Pass pg-boss names (`singletonKey`, `startAfter`, `retryLimit`) directly
and they go through untouched.

**One service in production, though the code still supports a split.** `WORKER_ROLE=web`
makes `createWorker()` a no-op, which is how an API-only process would avoid running
Puppeteer. **Nothing sets it today.** What is deployed is a single Northflank service,
`custodia-backend`, built from `apps/api/Dockerfile` and started with `npm run start`, so
one container serves Fastify *and* registers every worker, Chromium included — the browser
cluster and the request path share one 512MB box. `index.ts` calls `scheduleGlobalJobs()`
after `listen()` when `shouldRegisterWorkers()` is true, which on that service it is.

`render.yaml`'s `custodia-api` / `custodia-workers` split describes infrastructure that
has never existed; nothing runs on Render. `npm run start:workers` →
`apps/api/src/workers/main.ts` remains the worker-only entrypoint if the two are ever
separated. Importing the worker barrel is what registers workers — that is a side effect
of `createWorker()` at module scope, so importing a worker module from a router (to get
its queue handle) is safe but not free of that coupling.

**`WORKERS_ENABLED_JOBS` is an allowlist that inverts the default.** Unset: everything
runs except the 19 entries in `DORMANT_JOBS`. Set: *only* what is listed runs and
`DORMANT_JOBS` is ignored — so enabling one job disables everything else, silently
(`[queue] Skipping disabled job …`). Full detail in `consent-reconciliation-ops.md` §3.

New recurring job checklist: add the worker, export it from `workers/index.ts`, add a
`boss.schedule()` line with `wrapJobPayload`, and decide whether it belongs in
`DORMANT_JOBS` (it does if it emails or notifies customers).

---

## The ROPA register — two things that will surprise you

**`processing_activities.completeness_score` is denormalised and the API keeps it in
step.** The score is a pure function of the activity and its four child tables
(`lib/ropaCompleteness.ts`), and the editor still computes it live; the stored column
exists so the register can *filter and sort* on it without loading every activity's
children on every list request. `refreshCompleteness()` in `routers/ropa.ts` is called
at the end of each mutation that can move it — fourteen call sites, the same shape as
`syncDataSubjectMirror`. Add a fifteenth if you add a mutation that touches an
activity's subjects, categories, recipients or transfers, or the filter starts
reporting yesterday.

Like the subject-category mirror, it deliberately does **not** touch `updated_at`: the
register sorts on that column and the editor's optimistic lock compares against it, so
a background recompute would re-order the list (D1) and CONFLICT the next autosave of a
record nobody else had touched (D45).

**`paginatedQuery`'s cursor records the type of its sort value.** It used to guess by
trying `new Date(value)`, which was right for every caller until the register gained
`name` and `completenessScore` sorts: an activity called "2024" parses as a date, a
score of 85 parses as 85ms past the epoch, and the list then silently ends after one
page. The codec lives in `utils/cursor.ts` rather than `utils/pagination.ts` so that
encoding a cursor does not import `db.js` — which throws without `DATABASE_URL` and
would make the codec untestable by the standalone fixtures.

---

## Assessments and exports — Sprint 3

**There is one Article 30 document, and it is built server-side.** `lib/ropaArticle30.ts`
produces the dataset; `lib/ropaExportFormats.ts` renders it as XLSX, CSV, EDPB JSON and
the four regulator packs; `apps/web/src/lib/pdf/templates/ropaRegister.tsx` renders the
PDF. Add a format by adding a renderer over the same dataset — never by reading
`processing_activities` again. The module used to have three divergent Article 30
documents and the one a customer received depended on which button they pressed.

`REGULATOR_TEMPLATES` is **data, not code**: adding the Italian Garante's template is a
table entry with a column list. Headers are in the authority's own language on purpose.

**The negative assertions are English in every locale, deliberately.** They are content
of the record rather than UI copy — "No personal data under this activity is transferred
to a third country" is a *statement the controller makes*, and a locale-shifting
assertion is a different assertion. Do not route them through the catalogue; J101 is
where translating the whole document belongs.

**An export must not inherit the register's sort.** `buildRegisterFilters` adds
`next_review_at IS NOT NULL` when sorting by review date, because a NULL compares false
against a cursor and a paginated list would end early. An export does not paginate, so
that predicate silently drops every activity with no review date. Every export procedure
goes through `exportFilters()`, which normalises the sort away. Do not call
`buildRegisterFilters` directly from a new export.

**The audit middleware resolves the parent from the mutation's *result*, not its input.**
A child row is addressed by its own id, so `ropa.dataCategories.update` cannot say which
activity changed until the row comes back. `trpc.ts` reads `parentResourceId` after
`next()`, and `ropa.history.list` filters on `resourceId OR parentResourceId`. A new
child router needs an entry in `CHILD_TABLE_BY_PATH` (`lib/auditTrail.ts`) or its edits
stay invisible in the History tab.

**A draft LIA is enough to publish; `do_not_proceed` is not.** `blocksPublication` on the
`legitimateInterestAssessment` requirement is computed rather than constant — see the
comment in `ropaCompleteness.ts`. `loadBundle` now runs a fifth query for the LIA, and
`completenessBatch` does not; if the two ever disagree about a legitimate-interests
record, that is why.

---

## Population, retention and intelligence — Sprint 4

**Five sub-routers hang off `ropa`, in their own files.** `routers/ropa.ts` was already
4,800 lines, so `ropa.retention`, `ropa.intake`, `ropa.discovery`, `ropa.draft` and
`ropa.insights` live in `routers/ropaRetention.ts`, `ropaIntake.ts`, `ropaDiscovery.ts`
(which exports two routers) and `ropaInsights.ts`. The tenancy guard scans every file in
`src/routers`, so the split costs nothing in coverage.

**Retention has two sources of truth and the schedule wins.** `retentionAnswer()` in
`lib/retention.ts` resolves Art. 30(1)(f) from a `retention_schedules` row where one is
attached and from the free-text `retention_period` where it is not, and it *says which*
in `source`. The free-text columns on the activity and the category are deliberately
kept — attaching a schedule is an upgrade, not a migration.

**`computeDisposalDate` returns a reason, not a nullable date.** `no_period` ("nobody
decided how long") and `no_anchor` ("the clock has not started") are different findings
that send someone to fix different things, and `no_anchor` is the *ordinary* state of a
correct employment schedule until an employment ends. Only `collection` starts its own
clock; every other trigger waits for `processing_activities.retention_anchor_at`.

**Nothing in the retention module deletes anything.** The nightly scan writes a `due`
row into `retention_disposals` and stops; a person records what was disposed of, in
which systems, over how many records. A product that executed its customers' retention
policy would be destroying evidence on a schedule, on the strength of a period somebody
typed into a form. `disposalDueKey()` is what makes the scan idempotent — it is a
function of the *obligation*, so re-running finds yesterday's row.

**P125's evaluation is rules-first, and the model may only ever raise.** `evaluateMaterialChange`
(pure, in `lib/materialChange.ts`) decides three consequences separately — re-consent,
notice update, DPIA re-assessment — because they do not travel together: a new data
category on a consent activity needs fresh consent, the same change on a contract
activity needs an Art. 13(3) notice update and no consent at all. A model is asked
exactly one question, whether a *rewritten purpose* describes different processing, and
`applyNarrativeVerdict` can only upgrade a verdict the rules already found possible. A
model that could clear "a third-country transfer was added" would have a veto over
Chapter V. `workers/reconsent.ts` is untouched and still runs.

**Delegated intake never writes to the register.** `ropa.intake.open/saveProgress/submit/decline`
are `publicProcedure`s keyed on an unguessable token — the respondent has no account —
and all four are in the tenancy guard's `ALLOWED_WRITES` for the same reason
`vendors.submitQuestionnaireAnswers` is. What comes back sits in `answers` until a
reviewer accepts it field by field through `merge`. `mapAnswersToFields` deliberately
produces **no candidate** for "I am not sure": a guess that arrives labelled as an
answer is worse than a gap.

**Discovery follows the `consent_findings` upsert-and-resolve pattern.**
`UNIQUE (organization_id, source, source_key)` means a scan bumps `last_seen_at`,
anything the run did not touch flips to `resolved`, and re-running is free. Dismissal
survives both halves — a signal a human judged must not come back next week with a
fresh id and the same text.

**The webhook queue name was wrong, and that is why no webhook had ever been
delivered.** `utils/webhookDispatcher.ts` enqueued on `webhooks`; `workers/webhooks.ts`
consumes `webhook-deliveries`. Every delivery row ever written sat at `pending`,
including the test button, which reported success because *enqueueing* succeeded. Both
are `webhook-deliveries` now. ROPA events are emitted explicitly from
`lib/ropaEvents.ts` rather than by wiring `TRPC_PATH_TO_EVENT` into the audit
middleware: an event is a public contract, emitted where the code knows what happened,
not where a string matched.

**`routes/v1` is registered.** `server.register(v1Routes, { prefix: '/api/v1' })` in
`index.ts` — the file carried a "NOT REGISTERED" banner, so the *vendors* endpoint was
unreachable too. `routes/v1/ropa.ts` is read-and-append by design: no PATCH, no DELETE,
because an Article 30 record carries an optimistic lock, a publication gate, a
completeness recompute, a version snapshot, an approval state and a subject-category
mirror, and a REST write that bypassed any one of them would leave the register in a
state the editor cannot represent.

**The ROPA compliance pillar reads `completeness_score`.** `calculateRopaScore` scored
`!lawfulBasis` and `!purpose` at fifty points each, so 23% of the headline number could
not detect a register with no retention, no subjects, no recipients and no transfers
(D19). It now averages the denormalised score and applies a multiplier for open
*critical* ROPA gaps, capped at four so a register with thirty findings still
distinguishes bad from worse.

**Three new dispatchers, all in `DORMANT_JOBS`.** `ropa-discovery`, `ropa-retention`
and `ropa-intake` each fan out one job per organisation, and each either emails someone
or fills a queue a customer then has to work through. The first run against an
established register finds real work — forty vendors nothing references, a decade of
elapsed retention — and that should arrive because an organisation switched the feature
on. `material-change` is dormant for the same reason.

---

## Database

Schema is one file: `packages/db/src/schema.ts`. The package is imported as `db`
(`import { consentFindings } from 'db'`) and exports tables, relations, and the Drizzle
instance's schema in one namespace.

```bash
npm run generate --workspace=packages/db     # drizzle-kit generate → drizzle/NNNN_*.sql
npm run migrate  --workspace=packages/db     # apply
npm run check:schema --workspace=packages/db # fails if schema.ts and drizzle/ have drifted
```

Edit `schema.ts` and generate. Never hand-write a migration file — `check:schema` will
fail on the drift. **`check:schema` asks git**, so a generated-but-uncommitted migration
reports as drift; commit the `.sql`, its `meta/NNNN_snapshot.json` and `meta/_journal.json`
together.

**The migration state is not what the journal implies, and `drizzle-kit` will not tell
you.** Checked against the live database on 21 August 2026:

- **Three applied migrations no longer match their own files.** `0039`, `0042` and `0043`
  have hashes in `drizzle.__drizzle_migrations` that do not match the SHA-256 of the
  `.sql` on disk, so somebody edited them after they ran. Every object they create is
  present in the database, so nothing is *missing* — but the committed file no longer
  describes what was applied, and a database rebuilt from `drizzle/` would differ from
  production. This is silent: the postgres-js migrator chooses what to run by comparing
  timestamps, **not hashes**, so a hash mismatch never causes a re-run and never errors.
- **`meta/_journal.json` has 39 entries for 53 `.sql` files**, with idx 20–30 missing
  entirely. The migrator only runs what the journal lists, so those eleven files are
  inert. Again invisible on a database that already has them.

Neither matters to the running system and both matter to disaster recovery, so the thing
not to do is assume `npm run migrate` on a fresh database reproduces production.

**Postgres truncates identifiers at 63 characters, and drizzle-kit composes foreign-key
names as `<table>_<column>_<reftable>_<refcolumn>_fk`.** `0049` tripped this four times —
anything referencing `processing_activities` from a table with a long name of its own. It
emits a NOTICE, not an error, and no names collided; the consequence is that the
constraint name in the database is *not* the one in the `.sql`, so a hand-written
`DROP CONSTRAINT` copied out of a migration file will not find its target. Check for
collisions after adding foreign keys to a long-named table:

```sql
SELECT conname, count(*) FROM pg_constraint WHERE connamespace = 'public'::regnamespace
GROUP BY conname HAVING count(*) > 1;
```

**`with:` in a relational query is not typechecked.** For a table with no
`relations()` block, Drizzle widens the `with` key type and `tsc` accepts any name.
At runtime the dialect looks the key up, gets `undefined`, and throws
`Cannot read properties of undefined (reading 'referencedTable')` while *building* the
query — so the caller fails on every invocation, not on some unlucky row. Fourteen call
sites across nine files were in that state until August 2026, including the nightly
`gap-scanner` and every webhook delivery. The same throw covers a `many()` whose target
declares no `one()` back, because that is what Drizzle infers the join from.

`npm run check:relations --workspace=apps/api` resolves every `with` key against
`schema.ts`. Relations are TS-only metadata — adding one is not a schema change and
`check:schema` stays clean.

**Unique constraints carry logic here, not just integrity.** The pattern used by
`consent_findings` and specced for `integration_signals`: a `UNIQUE` on the natural key
means an upsert bumps `last_seen_at`, and anything a completed run did **not** touch
flips to `resolved`. That gives idempotent re-runs, disappearance detection, and dated
remediation evidence with no extra code. When a column is part of such a key it must be
`NOT NULL` — Postgres treats NULLs in a unique constraint as distinct, which would let
rows duplicate on every run (hence `observed_host` defaulting to `''`).

---

## `apps/web`

**Read `apps/web/AGENTS.md` first.** Next 16 differs from training data; the bundled docs
at `node_modules/next/dist/docs/` are the authority.

The one that bites hardest: **synchronous `params` access was removed in Next 16.** A
page typed `{ params: { id: string } }` reads `params.id` as `undefined` at runtime. The
page renders, the data query gets no id, and **`tsc` does not catch it** — the page
declares the sync type itself, so there is nothing to disagree with. Correct form:

```tsx
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  ...
}
```

`npm run check:params --workspace=apps/web` fails on any route file that declares
`params` or `searchParams` as a plain object. It skips client components, which correctly
receive an already-awaited object as a prop.

**Styling** is Tailwind v4 with hard-coded hex for the dark surfaces — `#0D0F11` panel,
`#08090A` recessed, `#F4F5F6` / `#9BA1A6` / `#6E747A` text, `#C9A227` accent,
`border-white/10`, `rounded-2xl`, `shadow-panel-elevated`. Match the neighbouring file
rather than introducing theme tokens.

**i18n** is `next-intl` with per-namespace JSON in `src/messages/{en,de,fr}/`. Adding a
key means adding it to all three. Missing keys render as the raw key path.

**A component declared inside a render is a new component type on every render.** React
compares types to decide between updating and remounting, so a `const Field = (...) =>`
written inside a page component is torn down and rebuilt on each pass — and a controlled
input that remounts loses focus. The form then accepts one character per click.
`components/ropa/fields.tsx` holds the shared controls; a panel that needs to close over
its own `form`/`set` wraps them in a thin local function and **calls** it —
`{Text({ field, label })}` — rather than rendering `<Text/>`, which inlines the elements
with no new type. Invisible to `tsc`, invisible to a screenshot, obvious on the second
keystroke.

Several older client components carry `// @ts-nocheck`. Do not add it to new files — the
web workspace is at 0 errors and new code should be genuinely typechecked.

---

## Style

Match the file you are in. Comments explain *why* a non-obvious choice was made, not what
the line does; the existing code is fairly heavily commented in that register and thin,
uncommented additions read as foreign. British spelling in prose and comments
("organisation", "normalise", "behaviour").
