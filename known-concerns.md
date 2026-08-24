# Known Concerns

Everything I flagged while building the consent reconciliation feature (Phases 0–6),
plus what turned up on the way. Collected here so none of it depends on someone
remembering a conversation.

**Date:** 2026-08-08 (revised same day — see "What changed" below)

> **What changed.** Items 1, 4 and 8 have been fixed, and the count in item 1 was
> wrong when first written. The original audit reported **22** procedures; it only
> matched `eq(x.id, input.id)` and so missed every procedure filtering on a
> client-supplied *foreign* key (`input.breachId`, `input.dsarId`, …). The widened
> audit found **47**. All are now resolved: 34 fixed, 13 reviewed and allowlisted as
> genuinely cross-tenant or user-scoped data.

**How things here were verified:** by reading code, by `tsc --noEmit` per workspace, and
by one unit-test run (`scoring.test.ts`, 16/16). **Nothing was run against a live
database, a live queue, a browser, or production data.** Where a claim is inferred rather
than observed, it says so.

Concerns are split into ones I introduced, ones I found, and ones I inherited and left
alone. That distinction matters for deciding who owns each.

---

## Priority

| # | Concern | Severity | Mine? | Status |
|---|---|---|---|---|
| 1 | 47 tRPC procedures let any authenticated user read/write another organisation's rows | **High** | Found | **Fixed** + guarded |
| 2 | Consent Mode false-positive path has no test | **High** | Inherited (Phase 4) | **Fixed** (fixtures) |
| 3 | 19 dormant jobs are one env var away from emailing real customers | **High** | Inherited (Phase 0) | Open |
| 4 | 4 pages broken at runtime under Next 16, invisible to `tsc` | Medium | Found | **Fixed** + guarded |
| 5 | Nothing in this feature has been run end to end | Medium | Mine | **Fixed** — run live, 2 bugs found |
| 6 | Every org's compliance score shifts on deploy | Medium | Mine | Open (by design) |
| 7 | Our own CMP still does not gate anything | Medium | Inherited (product) | Open |
| 8 | No lint, and `tsc` was blind to the bugs that bit here | Medium | Inherited | **Partly fixed** |
| 9 | No alerting; a dead worker stops all scanning silently | Medium | Mine | Open |
| 10 | "Never scanned" is indistinguishable from "clean" in the score | Low | Mine | Open |
| 11 | `consent_tracker_observations` has no retention policy | Low | Mine | Open |
| 12 | Stale artefacts (`REDIS_URL`, `future-roadmap.md`) | Low | Inherited | Open |
| 13 | Sub-processor `notifiedAt` is shared across tenants | Low | Found | Open (data model) |
| 14 | api tests: three styles, only one runs | Low | Found | Open |
| 15 | Registry has no first-party auth-cookie patterns; every customer gets day-one noise | Medium | Found live | Open (product call) |
| 16 | `organization_vendors` has no `transfer_mechanisms` column, but two files read one | Medium | Found | **Fixed** (migration 0050) |
| 17 | No per-org sub-processor list; the table hangs off the shared catalogue row | Medium | Found | Open (data model) |
| 18 | DPF certification is hand-typed in the seed with no source, date or expiry | Medium | Found | Open (P-2 provenance) |
| 19 | Bulk `CASE` updates need explicit casts; Postgres types an all-parameter CASE as `text` | Medium | Found live | **Fixed** |

Run `npm run check` from the repo root for 1, 2, 4 and 8.

---

## 1. Tenant isolation is not enforced by the framework — FIXED

**Status: all 47 resolved.** 34 procedures fixed, 13 reviewed and allowlisted. A guard
script now fails the build on the 48th.

**This was the most serious thing in this document and it was not part of the consent
feature.** I found it because Phase 5 required getting org scoping right, which meant
understanding how the rest of the codebase does it. The answer was: by hand, every time,
with no safety net.

`requirePermission(resource, action)` checks **what a user may do**. It does **not**
constrain **whose data** they may touch. `checkOrgContext(ctx.user)` only asserts the
user *has* an org id. Neither adds a predicate to any query.

### The count was wrong twice before it was right

Worth recording, because it is the reason to distrust a single grep on this kind of question:

| Attempt | Method | Result | Why it was wrong |
|---|---|---|---|
| 1 | `eq(x.id, input.id)`, ±6-line window | 26 | False positives — `vendors.confirmDiscovery` proves ownership 68 lines above the flagged line |
| 2 | Same predicate, scoped to the enclosing procedure | 22 | Still only matched `input.id`; and passed `ropa.update`, which contains `organizationId` only in an *insert* |
| 3 | Any `eq(x.y, input.*Id)`, procedure-scoped, filter-form only | **47** | The one to trust |

Attempt 2 is the number I reported first. It missed every procedure filtering on a
client-supplied **foreign** key — `input.breachId`, `input.dsarId`,
`input.processingActivityId` — which leak identically.

### What was actually wrong

Worst first:

- **`breaches`** — rewrite, approve and mark-sent another organisation's *regulator
  notification*. Also list/create/edit/delete their remediation tasks.
- **`ropa`** — edit or delete another organisation's data categories, recipients and
  transfer records; add rows to their activities.
- **`dpia`** — edit or delete their risks and mitigations.
- **`dsar`** — edit their fulfilment tasks, add tasks to their requests.
- **`integrations.disconnect`** — revoke their OAuth connection.
- **`policies`** — read a policy and its full version history; publish a version.
  `publishVersion` had a second bug: it never checked the version belonged to the policy,
  so a valid policy id plus any version id published someone else's text.
- **`consent.updateBannerConfig`** — reconfigure their live consent banner.
- **`ai.analyzeDpa`** — run a DPA analysis against their vendor record.
- **`clients.getComplianceScore`** — read their client's compliance data.

Two were not leaks but broken code: **`dsar.tasks.list`** and **`dsar.comms.list`** passed
tables with no `organization_id` to `paginatedQuery`, which built `eq(undefined, orgId)`
and threw. Those endpoints were failing, not leaking. `paginatedQuery` now rejects that
case with a named error and takes `null` for callers that have proved ownership elsewhere.

Two were missing authorisation on *shared* data rather than tenancy bugs, so an org filter
was the wrong tool: **`vendors.subProcessors.remove`** (deleting rows every tenant's risk
score derives from) and **`vendors.publishIncident`** (fans an alert out to every
organisation). Both had no permission check at all. `remove` is now restricted to
org-owned vendors; `publishIncident` is gated on `vendors:manage`.

### How it is fixed

`apps/api/src/lib/tenancy.ts` — `assertOwned` / `assertParentOwned`. Most affected tables
carry no `organization_id` of their own and are reachable only through a parent
(`dpia_measures` → `dpia_risks` → `dpias`), so the helper takes a chain of joins and
applies the organisation predicate to the last hop. It throws `NOT_FOUND`, never
`FORBIDDEN`: "this exists but is not yours" confirms the id is real, which is the one
thing a caller probing other tenants' ids does not already know.

### The guard

```bash
npm run check:tenancy --workspace=apps/api
```

`apps/api/src/scripts/check-tenant-scoping.ts` walks every router, finds procedures
filtering on a client-supplied id, and fails unless the procedure proves ownership —
counting `eq(x.organizationId …)`, `assertOwned`, `assertParentOwned` and
`assertDomainInOrg` as proof. Genuine exceptions live in an `ALLOWED` map with a written
reason, and a stale entry also fails, so an exemption cannot outlive the procedure it
covered.

Verified non-vacuous: a synthetic unscoped procedure makes it exit 1.

The 13 allowlisted are user-scoped rows (`training`, `security.revokeSession` — scoped to
`ctx.user.id`, stricter than org), the shared vendor and regulatory catalogues, and the
public lead-assessment flow where an unguessable id is the access control by design.

### Still worth doing

The guard makes the failure loud but the mechanism is still manual. **Postgres row-level
security remains the right answer** — `trpc.ts:178` has a commented-out `SET app.org_id`
where someone started it. RLS makes the failure mode "returns nothing" instead of
"silently crosses tenants". I did not attempt it because I have no database to verify
against, and an RLS policy that is subtly wrong fails closed in production.

## 2. The Consent Mode false-positive path — FIXED

**Status: covered by fixtures.** `npm run test:fixtures --workspace=apps/api`.

Under Consent Mode v2 a tag legitimately loads **before** consent and transmits a denial
signal (`gcs=G100`) instead of an identifier. "A request fired pre-consent" is therefore
not evidence of a violation, and reporting it as one would accuse exactly the customers
who implemented consent correctly. `consent-reconciliation-plan.md` named this as the one
failure capable of discrediting the feature.

`apps/api/src/lib/consentEvaluator.fixtures.test.ts` runs the evaluator against four
scenarios in `src/lib/__fixtures__/consent-scans/`:

| Fixture | Asserts |
|---|---|
| `consent-mode-v2` | Denial signal, no identifier → `consent_mode_only` (info) and **never** `prior_consent_violation`. Also that nothing it emits is critical or high, so a correct site cannot lose score. |
| `no-cmp-ungated` | Identifier pre-consent → `prior_consent_violation` (critical) plus the undeclared-category, consent-mode-gap and undocumented-vendor findings |
| `custodia-own-cmp` | One `cmp_no_enforcement` naming Custodia, replacing the per-host violation set |
| `onetrust-unconfirmed-consent` | `postConsentMethod: unknown` → post-derived findings drop to 0.5 confidence, and a server-side tracker with no cookie is still caught |

37 assertions. There is also a standing check that no finding's evidence carries a query
parameter outside the scanner's allowlist (`gcs`, `gcd`, `id`, `ev`) — verified
non-vacuous by injecting `em=user@example.com` into a fixture and watching it fail.

**Caveat, and it matters:** these are hand-built fixtures modelling four real deployment
shapes, **not recordings from live sites**. The plan asks for real captures. A recording
can be dropped in unchanged as long as it keeps the same keys, and until one is, these
prove the evaluator's logic rather than its behaviour against real traffic.

Still missing: unit tests for the queue-adapter payload normalisation and for
`matchTrackerByDomain`.

## 3. 19 dormant jobs, and an allowlist that inverts when you touch it

Fixing the job-name envelope revived job branches that have never executed in
production. 19 sit in `DORMANT_JOBS` (`apps/api/src/lib/queue.ts`); several email
customers on a schedule.

The trap: `WORKERS_ENABLED_JOBS` **unset** means "everything except the dormant set".
**Set** means "only this list", and `DORMANT_JOBS` stops applying. So enabling one
dormant job silently disables consent scanning and everything else — it logs
`[queue] Skipping disabled job …` and returns, it does not error.

Full list, per-job risk, and the exact string to use in `consent-reconciliation-ops.md`
§3. Before enabling any email job, check how it selects its window: one that queries
"everything overdue" rather than "overdue since last run" will email about every DSAR in
the account's history on first run.

---

## 4. Four pages broken at runtime under Next 16 — FIXED

**Status: all fixed, guarded.** `npm run check:params --workspace=apps/web`.

Next 16 removed synchronous `params` access. A page typed `{ params: { id: string } }`
reads `params.id` as `undefined`; it renders, and its data query gets nothing.

**`tsc` cannot catch this** — the page declares the sync type itself, so there is nothing
to disagree with, and `apps/web` reported 0 errors either way.

Fixed: `consent/[id]`, `dsar/[id]`, `policies/[id]`, `legal/[org_slug]/privacy`,
`[org_slug]/request`. The last two are public — the DSAR request form and the published
privacy notice, the two pages a regulator is most likely to visit.

`apps/web/scripts/check-async-params.mjs` scans the 104 route files (page/layout/route/
template/default and the metadata image conventions) and fails on a plain-object `params`
or `searchParams` annotation. It deliberately does not check client components, which
correctly receive an already-awaited object as a prop. Verified non-vacuous.

## 5. Run end to end against live Supabase — DONE, and it found two bugs

**Status: run on 2026-08-08 against the real Supabase instance** (`aws-0-eu-north-1`,
1 organisation, 3 users, no customers). Migration `0042` applied, tracker registry seeded
with 64 entries, migration `0043` added afterwards for one of the bugs below.

Scanned **trycustodia.com**, as the plan recommended. Three scans, 12–13s each.

### The site itself is clean

Zero third-party trackers. Every request on both passes went to `trycustodia.com` itself
(38 requests, one host). No CMP detected — **we do not run our own consent banner on our
own marketing site**, which is worth a decision of its own.

Three first-party cookies, all flagged `unclassified_cookie`:
`__Host-authjs.csrf-token`, `__Secure-authjs.callback-url`, `pvr_anon_session`.

Those are true findings — the registry genuinely does not know them — but they point at a
product problem, see below.

### Bug A — the scanner counted its own seeded cookies as the site's

Pass 2 seeds all 14 known CMP acceptance cookies to reach a consented state. They came
back out of `page.cookies()` indistinguishable from the site's own, so a spotless site
reported `cookies_found: 17` (3 real + 14 planted) and generated `unclassified_cookie`
findings about cookies **the scanner had placed there**.

Fixed: seeded names are excluded from the inventory, and both passes are merged so a
cookie only set after consent is still counted.

This was invisible to every unit test, because the seeding only happens inside a real
browser.

### Bug B — eleven findings persisted as one row

`UNIQUE (domain_id, finding_type, observed_host)` with `observed_host = ''` for every
`unclassified_cookie` meant the per-cookie findings all shared one key. The evaluator
produced 11; the database kept 1, and which one survived was whichever the upsert loop
wrote last.

A domain with a dozen unclassified cookies would have reported exactly one, silently.

Fixed by migration `0043`: a `subject` column, included in the unique key, holding the
cookie name. The upsert target and the stale-finding sweep both key on it — without the
sweep change, every per-cookie finding but one would have been auto-resolved by the run
that created it.

### Bug C (pre-existing, found first) — consent seeding was failing outright

The very first live scan logged
`Protocol error (Network.setCookies): Invalid cookie fields`. Five of the 14 acceptance
cookies carry `,`, `;` or `"` in their values — the shapes CookieYes, Osano, Usercentrics
and Iubenda actually use — and those are not legal cookie octets, so CDP rejected the
**entire batch**. Pass 2 therefore never reached a consented state, and every
post-consent finding silently sat at 0.5 confidence.

Fixed twice over: the illegal octets are now percent-encoded (leaving `=`, `&`, `:` alone
so the CMP's own parser still recognises the value), and seeding falls back to one call
per cookie so a single bad registry entry can no longer disable pass 2 wholesale.

### What the run also confirmed working

- The full pipeline: scan → observations → evaluator → findings → persistence.
- **Auto-resolution.** The third scan closed the stale collapsed finding from the second,
  with a `resolved_at` date. That is the remediation-tracking mechanism working on real
  data, which was previously only a claim.
- Timings: 12–13s per two-pass scan, against the ~15–20s estimate.

`first-party-only.json` is a recorded fixture of this scan, so bugs A and B cannot
silently return.

### Still not exercised

The tRPC procedures and the Coverage panel have still never been hit by a browser, and no
scan has run through pg-boss — `reconcileDomain` was invoked directly. A site *with*
third-party trackers has not been scanned, so `prior_consent_violation`,
`missing_category` and the Consent Mode discriminator remain proven only by fixtures.

---

## 6. Every organisation's compliance score moves on deploy

A ninth pillar required rebalancing: ropa 0.25→0.23, vendors 0.20→0.19, dpia 0.15→0.14,
training 0.10→0.09, consent 0.05. Weights still sum to 1 (asserted by `scoring.test.ts`
Test 16).

Orgs with no consent domains still move, because the other pillars are diluted even
though the consent pillar returns 100. `complianceReports` is append-only, so the
historical series shows a step change on the deploy date that is an artefact, not a
regression. Worth annotating if anyone tracks score over time.

---

## 7. Our own CMP records consent but does not enforce it

`apps/api/src/routes/cmp.ts:252` — *"For MVP, we'll assume Accept All if cookie exists"*.
The banner stores a `pvr_consent_id` UUID and posts category selections to the server. It
does not block scripts and does not enforce categories client-side.

So on any domain running Custodia's own banner, every tracker fires before the visitor
answers it. The feature handles this honestly — `cmp_no_enforcement` names Custodia as
the cause rather than blaming the customer's configuration — but **the underlying product
gap is real and this feature is what makes it legible.**

Two open questions the code does not answer:

- Is `cmp_no_enforcement` customer-visible in v1? It is currently rendered like any other
  high-severity finding. The recommendation in the plan was to keep it visible, on the
  grounds that hiding it means shipping a compliance tool that stays quiet about a
  compliance gap it created. That is a call worth making deliberately rather than by
  default.
- Adding real gating (script blocking via `type="text/plain"`, tag-manager integration,
  Consent Mode v2 signalling) is its own project and remains tracked only as a P1 note.

---

## 8. The static gates were blind to the bugs that occurred — PARTLY FIXED

**Status: `npm run check` now exists and is green.**

```bash
npm run check     # typecheck both workspaces + both guards + evaluator fixtures
```

What changed:

- **`apps/api` is at 0 type errors, down from 37.** All 37 were in test files, and the
  cause was `"types": []` in `tsconfig.json` suppressing the `@types/jest` that is already
  a devDependency. Two of the errors were real bugs, not noise:
  `consentAnalytics.test.ts` inserted a `country` column that does not exist (it is
  `countryCode`), and `reconsent.test.ts` mocked the module `'db'` while the worker under
  test imports its database handle from `'../db.js'` — so the mock never intercepted
  anything.
- **Both bug classes now have a guard** aimed at them specifically (§1, §4), because
  neither was catchable by a type checker.
- **The evaluator fixtures run in the gate** (§2).

The guards immediately earned their place: the typecheck caught a real error in the
fixture test I had just written.

Still true, and still unaddressed:

- **`npx eslint` cannot run at all.** `apps/web/eslint.config.mjs` throws
  `TypeError: tailwind.configs.flat/recommended is not iterable` on ESLint 9.39.4.
- **`npm run check` is not wired to CI** — there is no CI config in this repo. It has to
  be run by hand until there is.
- **Most `apps/api` tests still never execute** — see §14.

## 9. No alerting on the worker service

The worker has no HTTP endpoint and no heartbeat. If it dies, all scanning stops
silently — no scans, no findings, no staleness warning beyond a last-scan date on the
Coverage panel that a user has to notice themselves.

Related: `consent_scan_runs` rows orphan in `status = 'running'` if the worker is killed
mid-scan (deploy, OOM). Nothing sweeps them. Cosmetic, but they skew the monitoring query
in `consent-reconciliation-ops.md` §6. A `status = 'running' AND started_at < now() -
interval '1 hour'` cleanup would fix both the noise and the missing liveness signal.

---

## 10. "Never scanned" scores the same as "clean"

`calculateConsentScore` returns 100 when an org has no consent domains, matching how
every other pillar treats "nothing to assess". But a domain that exists and has **never
been scanned** also scores 100, because there are no findings.

Absence of findings is not evidence of compliance. The Coverage panel shows "Never
scanned" so the distinction is visible *there*, but the score does not carry it. Do not
read a high consent pillar as evidence of anything.

The same shape applies to a stale scan: a domain last scanned three months ago scores
identically to one scanned yesterday.

---

## 11. `consent_tracker_observations` has no retention policy

One row per (run, host, pass). A busy site yields a few hundred rows per weekly scan.
Nothing prunes it, and there is no partitioning.

Slow-moving at weekly cadence and current domain counts, so this is not urgent — but it
is the table in this feature that grows without bound, and the monthly partitioning
pattern already used for `audit_logs` (`schema.ts:857`) is the obvious answer when it
matters.

Related privacy constraint worth not eroding: **raw tracker URLs are never persisted.**
The scanner strips query strings to an allowlist before storing `sample_url`, because
full tracker URLs carry visitor identifiers and storing them would put our own ROPA and
DPIA in a worse position than our customers'. If anyone extends the scanner, that
allowlist is the thing not to widen casually.

---

## 12. Smaller items

- **`REDIS_URL` is still declared** in `render.yaml` for the web service and consumed by
  nothing since the BullMQ → pg-boss move.
- **`future-roadmap.md` still says BullMQ throughout** and is stale.
- **`loadTrackerRegistry` caches for 10 minutes per process**, so a re-seed takes up to
  10 minutes to take effect in a running worker, or a restart. Easy to misread as "the
  seed didn't work".
- **`listFindings` has no pagination.** Bounded in practice by
  `UNIQUE (domain_id, finding_type, observed_host)`, but a domain with hundreds of
  tracker hosts would need it.
- **The `getCoverage` fold is not unit-testable** — it lives inside the tRPC procedure
  rather than in a pure function. Fine at its current ~40 lines; extract it next to
  `consentEvaluator.ts` if it grows.
- **Evidence renders generically**, so a future finding type with *nested object*
  evidence would display `[object Object]`. Every current finding type uses strings,
  booleans, numbers, and arrays of strings, so this is latent rather than live.

---

## 13. Sub-processor acknowledgement is shared across tenants

`vendorSubProcessors.notifiedAt` lives on the shared vendor row, so one organisation
acknowledging a sub-processor change marks it acknowledged for **every** organisation.

This is a data-model bug, not an access-control one: the flag belongs on a per-org join
table. An organisation filter cannot fix it, and scoping `markNotified` to org-owned
vendors would break the change-notification flow, which exists precisely for global
vendors. Permission-gated for now.

---

## 16. `organization_vendors.transfer_mechanisms` — FIXED (migration 0050)

`lib/vendorRisk.ts:79` unions the org's transfer mechanisms with the catalogue vendor's,
and `constants/gapRules.ts` does the same in `third_country_transfer_no_safeguards`. Only
`vendors` had the column; `organization_vendors` did not, so the org half of both unions
was always empty and `tsc` could not see it — the values arrive as `any` off a `select()`.

The consequence was not cosmetic: an organisation relying on SCCs it signed itself, or on
a DPF certification the catalogue had not recorded, had nowhere to say so. The vendor
scored the full 20/20 location risk and raised an Article 44 gap the org had in fact
closed.

Migration `0050_sticky_anthem` adds the column; `vendors.updateOrgVendor` accepts it,
constrained to `constants/transferMechanisms.ts` rather than free text; and the vendor
detail page has a control for it. **The vocabulary is the load-bearing part** — the risk
engine matches `data_privacy_framework` exactly, so "SCCs" typed by hand scores as no
safeguard at all. That is why both ends validate against the same list.

---

## 19. A bulk `CASE` update needs an explicit cast — FIXED

`recalculateVendorRiskForAllOrgs` writes every organisation's recomputed score in one
statement, as `SET risk_score = CASE id WHEN $1 THEN $2 ... END`. Every branch is a bound
parameter, so Postgres has nothing to infer a type from, resolves the whole expression as
`text`, and refuses the assignment:

```
column "risk_score" is of type integer but expression is of type text   (SQLSTATE 42804)
```

It threw on **every** invocation that had a row to write — which is every sub-processor
add/remove, every questionnaire confirmation and every catalogue-driven recalculation.
`tsc` sees a perfectly good SQL template, no fixture can reach it without a database, and
the callers do not check, so it read as working. Found by running the recalculation script
against the live database rather than by reading the code.

Fixed by casting the CASE results: `(CASE … END)::integer` and `::varchar(20)`. The
`risk_factors` branch already cast each value to `jsonb` and was fine, which is why the
other two were easy to miss.

If you write another bulk `CASE` update, cast it.

---

## 17. Sub-processors cannot be recorded per organisation

`vendor_sub_processors.parent_vendor_id` references the shared catalogue row, so any write
moves every tenant's derived risk score. `addLinked`, `addUnlinked` and `remove` are
therefore restricted to vendors the organisation created itself, and the UI hides those
controls on catalogue vendors rather than offering a button that returns
`NOT_FOUND: Parent vendor not found` about a vendor on the screen.

That is correct but incomplete. An organisation that learns of a sub-processor not on the
vendor's published page — from a DPA annex, or from the vendor directly — has nowhere to
record it. The fix is a per-organisation override table read alongside the shared list.

Related: the sub-processor count feeding the risk score is the shared catalogue count, not
a per-organisation one (audit D47).

---

## 18. DPF certification is asserted by hand in the seed

`lib/vendorRisk.ts` gates US adequacy on the exact string `data_privacy_framework`, worth
15 points of the location factor and the difference between "adequate" and "no DPF
certified" in what the customer reads. That string comes from literals in
`packages/db/src/seed-vendors.ts`: no certified-on date, no source URL, no expiry — and
DPF certifications lapse annually.

That is the same shape as the standalone pipeline's 13-name hardcoded array, which the
audit files as a defect (D19). It is a deliberate stopgap; the durable answer is
`vendor_field_provenance` (audit P-2) fed from the public Data Privacy Framework list.

Two consequences to know now:

- An **absent** `transferMechanisms` on the vertical stub vendors means "not researched",
  not "no safeguards". The risk engine cannot tell those apart and scores both as
  unsafeguarded — conservative, but not honest, and it inflates the high-risk tile.
- Editing the catalogue does **not** move any stored score. `organization_vendors.risk_score`
  is denormalised; run `npm run recalc:vendor-risk --workspace=apps/api -- --apply` after
  `npm run seed:vendors --workspace=packages/db`.

---

## 14. Three test styles in `apps/api`, only one of which runs

- **Standalone `tsx` scripts** — `scoring.test.ts`, `consentEvaluator.fixtures.test.ts`.
  These run.
- **vitest** — `consentAnalytics.test.ts`, `reconsent.test.ts`, `orgEmbeddings.test.ts`,
  `breachIntelligence.test.ts`, and others. **vitest is not installed in `apps/api`**
  (only in `apps/web`), and there is no config. These have never run.
- **jest globals** — `billing.test.ts`. `@types/jest` is a devDependency so it now
  typechecks, but jest itself is not installed. This has never run either.

They all typecheck, which is what makes it easy to believe the suite exists.
`consent-reconciliation-plan.md` lists four of the vitest files as "existing tests" to
regression-check against — none of them can execute today.

Deciding on one runner is a small job with a large payoff, and the vitest files are
probably close to working: `apps/web` already has vitest, so hoisting it to the root and
adding a config for `apps/api` may be most of it.

---

## 15. The registry does not know first-party auth cookies

Every one of the three findings on trycustodia.com was a first-party session or CSRF
cookie: two from NextAuth (`__Host-authjs.csrf-token`, `__Secure-authjs.callback-url`)
and one of our own (`pvr_anon_session`).

They are all `necessary` in any reasonable reading, but `tracker_registry` holds 64
*trackers* and no first-party session patterns, so they land as `uncategorized` and become
medium-severity findings.

**Every customer will hit this on day one**, for their own auth cookies, before the
feature says anything useful about actual tracking. That is the noise that makes people
stop reading a report.

Worth noting the cheap signal available: the `__Host-` and `__Secure-` prefixes are
specified to be first-party, secure, same-site — overwhelmingly session and CSRF cookies.
Framework patterns (`authjs.*`, `next-auth.*`, `PHPSESSID`, `JSESSIONID`, `csrftoken`,
`_session`) are similarly recognisable.

I did not change this: what the feature reports to every customer is a product decision,
not a bug fix. But it should be decided before anyone sees a report.

---

## What I would do first

1. **Run one scan against trycustodia.com** (§5). Everything about this feature is still
   inference. It is the only way to learn whether the tracker registry matches real
   traffic, and if the marketing site carries trackers the first real finding is about us.
2. **Decide the `WORKERS_ENABLED_JOBS` value before deploying** (§3). The allowlist
   inverts when set, and getting it wrong either silences consent scanning or emails
   customers about backdated DSARs.
3. **Wire `npm run check` to CI.** The guards only help if something runs them.
4. **Pick one test runner** (§14), then port the vitest files. Four of them are currently
   cited as regression coverage that does not exist.
5. **Consider RLS** (§1). The guard makes tenancy mistakes loud; RLS would make them
   impossible.
