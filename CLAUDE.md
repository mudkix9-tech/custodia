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

**Two guards are ROPA-specific and easy to miss.** `check:ropa-i18n` (apps/web) fails on
a hardcoded English string in the register's components *and* on a `t()` key that is not
in `en/ropa.json` — next-intl renders a missing key as its own dotted path, in every
locale, which `check:messages` cannot see because it only compares the three catalogues
against each other. `test:ropa-lifecycle` (apps/api) covers review cadence, the reminder
ladder, approval transitions, snapshot diffing and the pagination cursor codec.

`check:ropa-i18n` is a **text scan**, not a parse, and it is noisy in the safe direction.
Its JSX-text rule matches `>…<`, so a type annotation like `() => Promise<void>` reads as
a text node containing the word "Promise". The fix is to restructure the annotation
(`() => unknown`), not to add an `ALLOWED` entry — that list is for UI copy that really
is meant to stay English, and a stale entry there fails too.

**Two more fixture suites arrived with Sprint 3.** `test:assessments` covers the DPIA
screening verdict, LIA completeness, the TIA's six steps and its self-contradiction
checks, the risk matrix, the content hash and the audit-diff renderer.
`test:ropa-exports` reads each generated workbook back out of its own buffer, because
`tsc` sees a valid `Buffer` whether or not the sheet names collided or an empty sheet
lost its headers.

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
fail on the drift.

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
