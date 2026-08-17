# Ops Runbook — Consent / Tracker Reconciliation

**Covers:** the queue substrate fix (Phase 0), the new worker service, and the consent
reconciliation feature (Phases 1–6) from `consent-reconciliation-plan.md`.

**Date:** 2026-08-08
**Status of verification:** the schema, the seed, and the scan path have now been
exercised against the live Supabase instance (2026-08-08) — see `known-concerns.md` §5,
which records the three bugs that run exposed. **Still unverified: pg-boss dispatch, the
tRPC procedures, the Coverage panel in a browser, and any site that actually carries
third-party trackers.** Treat first deploy as the first real test of those.

---

## 0. The one-paragraph version

This deploy adds a **second Render service** (paid), **revives ~19 background jobs that
have never executed in production**, and **changes every organisation's compliance
score**. None of those are side effects of the consent feature — they are the cost of
fixing the queue adapter that the consent feature needed. Deploy on a day when someone
is watching, and not on a Friday.

---

## 1. Deploy order

These steps are ordered by dependency. Skipping step 3 gives you a feature that runs,
finds nothing, and reports "no problems" — the worst possible failure mode for a
compliance tool.

| # | Step | Command | If skipped |
|---|---|---|---|
| 1 | Apply migrations `0042` and `0043` | `npm run migrate --workspace=packages/db` | Scans fail on missing tables; without `0043` all per-cookie findings collapse onto one row |
| 2 | Deploy code (both services) | Render deploy from `main` | — |
| 3 | **Seed the tracker registry** | `npm run seed:trackers --workspace=packages/db` | Registry is empty → every host matches nothing → Coverage panel is blank and reports zero findings while the site is full of trackers |
| 4 | Set `WORKERS_ENABLED_JOBS` (see §3) | Render dashboard | Dormant jobs stay off (safe); consent scans still run |
| 5 | Trigger one manual scan | Coverage tab → "Run reconciliation" | Nothing runs until Monday 05:00 UTC |

**Migration `0042_familiar_banshee.sql`** creates `tracker_registry`,
`consent_scan_runs`, `consent_tracker_observations`, `consent_findings`.
**`0043_silent_grim_reaper.sql`** adds `consent_findings.subject` and widens the unique
key to include it — without it, every `unclassified_cookie` on a domain shares the key
`(domain, type, '')` and all but one are silently overwritten. Both are additive (0043
drops and recreates one unique constraint), so they are safe to apply ahead of the code
deploy.

Both were applied to live Supabase on 2026-08-08. Note drizzle's migrator selects work by
**timestamp against the newest applied row**, not by hash — the journal here holds 32
entries against 43 applied rows, so a migration with an older `when` than the last applied
one would be skipped in silence. Worth checking before assuming a migration ran.

**The seed is idempotent** and carries 64 tracker entries
(`packages/db/src/seed-data/trackers.json`). Re-run it whenever that file changes.
`loadTrackerRegistry()` caches for 10 minutes per process, so a re-seed takes up to
10 minutes to be reflected in a running worker, or restart the service.

---

## 2. Where the workers actually run

**One service, not two.** Production is a single Northflank service, `custodia-backend`,
built from `apps/api/Dockerfile` and started with `npm run start`. `WORKER_ROLE` is unset
on it, so that one container serves Fastify, registers every worker, and runs Chromium.

The two-service split below was planned and written into `render.yaml`, but never
deployed — nothing runs on Render. Treat the table as a design note, not as infrastructure:

| Service | Type | Plan | `WORKER_ROLE` | Runs |
|---|---|---|---|---|
| `custodia-api` | web | free | `web` | Fastify only. Registers **no** workers, schedules **no** cron. |
| `custodia-workers` | worker | **starter** | unset | All workers + `scheduleGlobalJobs()`. No HTTP. |

What follows from one service being what is live:

- The browser cluster shares its container with the request path — `nf-compute-20`, 0.2
  vCPU and 512MB for Fastify, all 28 workers and Chromium together. The reasoning behind
  `maxConcurrency: 1` in `browserPool.ts` still holds, for a different host than the
  comment once named.
- Chromium dying under memory pressure is the expected failure mode, not an exotic one.
  `browserPool.ts` discards and relaunches the pool when that happens; see §6 for the log
  line and what a run of them means.
- `scheduleGlobalJobs()` runs in the process that serves requests, from `index.ts` after
  `listen()`.
- The service does have an HTTP health check, so the `consent_scan_runs` signal in §6 is a
  supplement rather than the only liveness evidence.

`WORKER_ROLE=web` is what makes `createWorker()` a no-op
(`apps/api/src/lib/queue.ts` → `shouldRegisterWorkers()`). **If you add a second service,
set `WORKER_ROLE=web` on whichever one should not process jobs** — splitting them is a
platform change only, no code change.

The worker-only entrypoint is `apps/api/src/workers/main.ts` (`npm run start:workers`),
unused in the current deployment. It imports the worker barrel — which registers every
worker as a side effect of `createWorker()` — then calls `scheduleGlobalJobs()`. It exits
with a fatal error if `WORKER_ROLE=web` is set on it, because that combination would
register nothing and silently do no work.

---

## 3. `WORKERS_ENABLED_JOBS` — read this before setting it

Fixing the job-name envelope in `queue.ts` revived job branches that have **never run in
production**. Several of them send customer-facing email on a schedule, and they will
fire against backdated data on first execution.

The allowlist has two modes, and they behave in opposite directions:

- **Unset (recommended for first deploy).** Everything runs **except** the 19 jobs in
  the `DORMANT_JOBS` set in `apps/api/src/lib/queue.ts`. Consent scanning runs. The
  risky email jobs stay off.
- **Set.** Only what is listed runs. `DORMANT_JOBS` is ignored entirely. Format is
  comma-separated `queue:job`, or a bare `job` to match on any queue, or `*` for
  everything.

> **The trap:** setting `WORKERS_ENABLED_JOBS` to enable one dormant job silently
> disables *everything else*, including consent scanning. If you set it at all, you must
> list every job you want, including:
> ```
> consent-scan:weekly-reconcile-dispatch,consent-scan:reconcile-domain
> ```
> A disabled job logs `[queue] Skipping disabled job <queue>:<job>` and returns — it does
> not error, so this failure is quiet.

### The 19 dormant jobs

Enable these **one at a time**, and check what each one sends before you do:

```
compliance:scheduled-reports
dsar-automation:dsar-deadline-monitor          ← sends customer email
dsar-automation:dsar-verification-reminder     ← sends customer email
dpia-reminders:dpia-mitigation-reminder-checker ← sends customer email
dpia-dispatcher:dpia-dispatcher
impact-assessment:impact-assessment-dispatcher
impact-assessment:match-org-semantic
impact-assessment:match-catchup
impact-assessment:generate-assessment
policies-automation:policy-ropa-sync
regulatory-jobs:scrape
regulatory-jobs:quality-check
vendor-incidents-ingest:ingest-daily
vendor-intelligence:sub-processor-change-detector  ← notifies customers
vendor-intelligence:breach-alert-monitor           ← notifies customers
vendor-intelligence:dpa-expiry-checker             ← notifies customers
vendor-intelligence:assessment-reminder-checker    ← sends customer email
vendor-intelligence:dpa-page-change-detector
vendor-intelligence:weekly-organization-discovery-trigger
```

Before enabling any email job, check how it selects its window. A deadline monitor that
queries "everything overdue" rather than "overdue since last run" will email about every
DSAR in the history of the account on its first execution.

---

## 4. Schedule

All times UTC. Defined in `scheduleGlobalJobs()` (`apps/api/src/workers/index.ts`).

| Queue | Cron | Job name |
|---|---|---|
| `consent-rollup` | `0 1 * * *` | `daily-rollup` |
| `gap-scanner` | `0 2 * * *` | `daily-scan` |
| `compliance-score` | `0 3 * * *` | `daily-calculation` |
| `consent-rollup-drift-check` | `0 4 * * 0` | `weekly-drift-check` |
| **`consent-scan`** | **`0 5 * * 1`** | **`weekly-reconcile-dispatch`** |
| `dpia-dispatcher` | `0 7 * * *` | `dpia-dispatcher` *(dormant)* |
| `trial-expiry` | `0 8 * * *` | `daily-trial-expiry` |
| `maintenance-jobs` | `0 * * * *` | `rate-limit-cleanup` |
| `impact-assessment` | `*/15 * * * *` | `impact-assessment-dispatcher` *(dormant)* |

`pg-boss.schedule()` is keyed by queue name and is idempotent, so repeated boots do not
duplicate schedules.

### How the weekly consent dispatch behaves

Monday 05:00 UTC, `dispatchDueDomains()` selects every `consent_domains` row whose last
scan is older than its `scanFrequency` (`daily` 1d / `weekly` 7d — the default /
`biweekly` 14d / `monthly` 30d) and enqueues one `reconcile-domain` job per domain with:

- `singletonKey = domainId` — one in-flight scan per domain, so a slow scan cannot stack
  behind itself, and the manual "Run reconciliation" button cannot pile up duplicates.
- `startAfter = sha1(domainId) % 10800` seconds — a deterministic offset spreading the
  dispatch across a **3-hour window**. Deterministic rather than random so a domain lands
  in the same slot every week instead of reshuffling the queue.

**Throughput ceiling.** The browser cluster is `maxConcurrency: 1` and each scan is two
full page loads (~15–20s). That is roughly **3–4 domains per minute**, so the 3-hour
window absorbs on the order of a few hundred domains. Past that, jobs queue and the
window stops meaning anything. Revisit `maxConcurrency` in
`apps/api/src/lib/browserPool.ts` when domain count actually approaches that — not
before, since the value was tuned for the old 512MB free tier and the worker service now
has more headroom.

---

## 5. Compliance score change

`calculateComplianceScore()` gained a ninth pillar. Weights were rebalanced to keep the
total at 1.0:

| Pillar | Before | After |
|---|---|---|
| ropa | 0.25 | **0.23** |
| vendors | 0.20 | **0.19** |
| dpia | 0.15 | **0.14** |
| training | 0.10 | **0.09** |
| **consent** | — | **0.05** |
| policies / dsar / breach / transfers | 0.10 / 0.10 / 0.05 / 0.05 | unchanged |

**Every organisation's score moves on the next `compliance-score` run (03:00 UTC daily),
whether or not they use the consent module.** The move is small for orgs with no
findings, because the consent pillar returns 100 when there are no consent domains — but
it is not zero, because the other pillars are diluted.

`complianceReports` rows are append-only snapshots, so the historical series will show a
step change on the deploy date. If anyone is tracking score over time, that step is an
artefact, not a regression. Consider annotating it.

The consent pillar deducts **25 per open critical** and **10 per open high**, floors at
0, and ignores findings below 0.7 confidence. Medium/low findings and `info` findings
never affect the score. See `consent-reconciliation-decisions.md` §2 for why.

---

## 6. Monitoring

There is no dashboard for this yet. The tables are the monitoring surface.

**Are scans running at all?**
```sql
SELECT status, count(*), max(started_at)
FROM consent_scan_runs
WHERE started_at > now() - interval '8 days'
GROUP BY status;
```
Expect one `ok` row per active domain per week. A growing `running` count with no
`finished_at` means scans are starting and dying — check the service logs for Puppeteer
crashes. `[browserPool] Discarding browser cluster: …` is the pool recovering from a dead
Chromium: one line is routine, one per scan means the container is out of memory.

**Are scans producing usable results?**
```sql
SELECT post_consent_method, count(*)
FROM consent_scan_runs
WHERE status = 'ok' AND started_at > now() - interval '8 days'
GROUP BY post_consent_method;
```
A high share of `unknown` means pass 2 could not reach a consented state on those
domains. Every finding drawn from the post-consent set then drops to 0.5 confidence and
is shown as "Needs verification" — real but unproven. If `unknown` dominates, the CMP
registry (`apps/api/src/lib/cmpRegistry.ts`) needs more acceptance-cookie shapes, not
more scanning.

**Is the registry actually populated?**
```sql
SELECT count(*) FROM tracker_registry WHERE is_active = true;   -- expect 64
```
Zero here is the silent-failure case from §1 step 3.

**Is the registry matching anything?**
```sql
SELECT count(*) FILTER (WHERE tracker_key IS NOT NULL) AS matched,
       count(*)                                        AS total
FROM consent_tracker_observations
WHERE observed_at > now() - interval '8 days';
```
A matched count of 0 with a non-zero total means the registry is seeded but its
`match_domains` patterns are not hitting real hosts — worth inspecting before trusting
any "no findings" result.

**Log lines to grep on the worker service:**
- `[Consent Scan] <domain>: cmp=… method=… pre=… post=… findings=…` — one per successful scan
- `[Consent Scan] Dispatched N domain scans.` — the Monday dispatch
- `[Consent Scan] Failed for <domain>: <message>` — per-domain failure
- `[queue] Skipping disabled job …` — the allowlist trap from §3

---

## 7. Data retention and privacy

This feature writes about the customer's *site*, not about their *visitors*, and that
distinction has to be maintained deliberately.

- **Raw tracker URLs are never persisted.** The scanner strips query strings to an
  allowlist before storing `sample_url`. Full tracker URLs carry visitor identifiers;
  storing them would put our own ROPA and DPIA in a worse position than our customers'.
  If you extend the scanner, do not widen that allowlist without thinking about what
  ends up in `consent_tracker_observations.sample_url`.
- **`consent_findings.evidence` is sanitised jsonb** — hosts, cookie *names*, category
  names, `gcs` values. No cookie values, no identifiers.
- **`consent_tracker_observations` is the growth table.** One row per (run, host, pass).
  A busy site yields a few hundred rows per scan. Nothing prunes it today. At weekly
  cadence this is slow-moving, but it has no retention policy — add one before it
  matters, and consider the monthly partitioning pattern already used for `audit_logs`.

---

## 8. Rollback

The feature is additive and degrades cleanly.

- **Disable scanning only:** set `WORKERS_ENABLED_JOBS` to a list that omits the
  `consent-scan:*` jobs. Existing findings stay visible and stop being refreshed. Note
  the §3 trap — this also disables everything else not on the list.
- **Hide the surface:** revert the `coverage` tab entry in
  `apps/web/src/components/consent/ConsentWorkspaceClient.tsx`. The tRPC procedures can
  stay; they are read-only apart from `resolveFinding` and `runReconciliation`.
- **Revert the score change:** restore the previous `PILLAR_WEIGHTS` and drop the
  `consent` pillar from `apps/api/src/lib/scoring.ts`. Also remove the consent
  `PillarCard` from `apps/web/src/app/[locale]/(app)/audit/page.tsx`.
- **Do not roll back migration `0042` to fix a bug.** It is additive; leaving the tables
  in place costs nothing and dropping them destroys finding history, including the
  `resolved_at` dates that are the remediation evidence.

The one thing that is genuinely hard to undo is **revived workers that have already sent
email**. That is why the allowlist exists.

---

## 9. Known operational gaps

Carried forward honestly rather than left to be discovered.

1. **No alerting.** A worker service that dies stops all scanning silently. There is no
   heartbeat, no Sentry breadcrumb on scan failure beyond `console.error`, and no
   customer-visible staleness warning on the Coverage panel beyond the last-scan date.
2. **`consent_scan_runs` rows can be orphaned in `running`** if the worker is killed
   mid-scan (deploy, OOM). Nothing sweeps them. They are cosmetic, but they will skew the
   §6 status query. A `started_at < now() - interval '1 hour' AND status = 'running'`
   cleanup is the obvious fix.
3. **Never scanned looks identical to clean, in the score.** An org whose domains have
   never been scanned scores 100 on the consent pillar. The Coverage panel is the only
   place that distinction is visible ("Never scanned"). Do not read a high consent pillar
   as evidence of anything.
4. **`npx eslint` cannot run in this repo** (`apps/web/eslint.config.mjs` throws on
   ESLint 9.39.4). None of this code has been lint-checked. `tsc --noEmit` per workspace
   is the only static gate.
5. **Four pages still read Next 16 `params` synchronously** and are broken at runtime:
   `dsar/[id]`, `policies/[id]`, `legal/[org_slug]/privacy`, `[org_slug]/request`.
   Unrelated to this feature, but they will not be caught by `tsc`.
