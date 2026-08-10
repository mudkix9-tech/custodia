# Implementation Plan — Consent / Tracker Reconciliation

**Feature:** brainstorm §13, ideas #122–#125 — join the existing cookie scanner and the existing third-party network scanner so detected trackers are checked against the consent banner's declared categories and actual gating behaviour.

**Why this one first:** zero new integrations, zero new OAuth scopes, no domain-wide-delegation flow, no customer re-consent. Both data sources exist and are already wired to Puppeteer. It also acts as the cheapest pilot for the evaluator layer in `custodia-complete-memory(1).md` §35.

**Date:** 2026-08-08

---

## 0. Correction to earlier notes

An earlier claim in `custodia-complete-memory(1).md` §35 — *"No `boss.schedule()` call exists anywhere in the repo"* — **is wrong**. It came from a `grep` truncated by `head -40`. `scheduleGlobalJobs()` exists in `apps/api/src/workers/index.ts` and is invoked at `apps/api/src/index.ts:162`. Six recurring jobs are scheduled. The corrected substrate picture is below and supersedes that line.

---

## 1. Substrate state (verified by reading, not by running)

| Component | State |
|---|---|
| `scheduleGlobalJobs()` (`workers/index.ts`) | **Works.** Schedules 6 cron jobs, called at `index.ts:162` |
| `gap-scanner`, `compliance-score`, `consent-rollup`, `consent-rollup-drift-check`, `trial-expiry` | **Work.** Single-purpose workers that ignore `job.name` |
| `impact-assessment`, `maintenance-jobs` | **Broken.** Scheduled, but the worker branches on `job.name` and never matches |
| `cookie-scanner` (`workers/cmp.ts`) | **Broken twice** — dead branch *and* a Puppeteer API removed two majors ago |
| `vendor-discovery` (`workers/vendors.ts`) | **Broken.** Dead branch. Never scheduled either — only enqueued from onboarding |
| Worker process | **None.** `render.yaml` has one `type: web` on `plan: free`, which sleeps |

### Defect A — the queue adapter drops the job name, and there are two competing conventions

`apps/api/src/lib/queue.ts:21-32`: `createQueue(name).add(jobName, data, opts)` accepts `jobName` and discards it, calling `boss.send(name, data, opts)`. pg-boss then sets `job.name` to the *queue* name.

Meanwhile `scheduleGlobalJobs()` passes `{ name: 'daily-scan', data: {} }` as the pg-boss **payload** — clearly intending it to become `job.name` / `job.data`. The adapter unwraps neither. So today:

- `createQueue().add()` callers lose the job name entirely
- `boss.schedule()` callers get `job.data = { name, data: {} }` instead of their actual data
- every worker branching on `job.name` compares a queue name against a job name

Affected: `cmp.ts:33` (`cookie-scanner`), `vendors.ts:24` (`vendor-discovery`, `sub-processor-change-detector`), `compliance.ts:22,259`, `dsar.ts:29,88,127`, `dpiaReminders.ts:25,152`, `policies.ts:11`, `rateLimitCleanup.ts:6`, `regulatoryScraper.ts:259,261`, `impactAssessmentWorker.ts:20,30,64,83`, `incidents.ts:298`.

Also: `dpiaReminders.ts:22` and `:151` both register on the **same** `'dpia-reminders'` queue — pg-boss will round-robin between them.

### Defect B — `page.waitForTimeout` was removed in Puppeteer v22; repo is on 24.42.0

`apps/api/src/lib/browserPool.ts:69`, inside `scanDomain()` — the cookie scanner's only entry point. Every call throws `TypeError: page.waitForTimeout is not a function`, retries twice per the cluster's `retryLimit`, then fails into `cmp.ts`'s `catch` and logs. Silent.

`scanDomainForThirdParties()` does **not** use it and is unaffected.

### Defect C — third-party cookie flag is wrong

`parseCookieHeaders()` (`browserPool.ts:33-47`) returns `domain: ''` for every `Set-Cookie` header it parses. `cmp.ts:47` then computes `isThirdParty: bc.domain ? !bc.domain.includes(domainData.domain) : false` — so every header-set cookie is recorded as first-party. Only `page.cookies()` entries carry a real domain. #124 depends on this field being correct.

---

## 2. The finding that will shape v1

`apps/api/src/routes/cmp.ts` — the served banner script — stores only `pvr_consent_id` (a UUID) as a cookie. Category selections go to the server into `consentRecords.categoriesAccepted`. Line 252 reads:

```js
// Or it would be stored in localStorage. For MVP, we'll assume Accept All if cookie exists.
```

**The Custodia banner records consent; it does not gate anything.** There is no script blocking, no category enforcement client-side. So on any site using Custodia's own CMP, the prior-consent test (#123) will correctly report that every tracker fires before consent — and the cause will be Custodia's own script, not the customer's configuration.

Two honest options:

- **(A) Ship detection first (recommended).** The check is CMP-agnostic and immediately valuable against Cookiebot / OneTrust / Usercentrics / Iubenda, which is what most prospects actually run. For domains on Custodia's own CMP, emit a distinct finding type (`cmp_no_enforcement`) that names the real cause instead of blaming the customer. The feature's first output is then a true, useful statement about a gap in our own product.
- **(B) Add category gating to `routes/cmp.ts` first.** Correct long-term, but it is its own project (script blocking via `type="text/plain"`, tag-manager integration, Consent Mode v2 signalling) and it blocks this build for weeks.

**Decision: (A).** Track (B) as a separate P1 — it is a real product gap regardless of this feature, and this feature is what proves it.

---

## Phase 0 — Unblock the substrate

**Size: S (~1 day). Nothing below works without it.**

### 0.1 Normalise the queue adapter — `apps/api/src/lib/queue.ts`

Accept both existing conventions, change no call sites.

```ts
// createQueue().add()
add: async (jobName: string, data: any, opts?: any) => {
  const b = await getBoss();
  return b.send(name, { __job: jobName, __v: 1, data }, opts);
}

// createWorker() adapter, replacing the current job shaping
const payload = job.data ?? {};
const isWrapped = payload && typeof payload === 'object'
  && ('__job' in payload || ('name' in payload && 'data' in payload));

const result = await processor({
  id: job.id,
  name: isWrapped ? (payload.__job ?? payload.name) : job.name,   // falls back to queue name
  data: isWrapped ? (payload.data ?? {}) : payload,
});
```

Handles all three shapes: `{__job, data}` (new `add()`), `{name, data}` (existing `scheduleGlobalJobs`), and raw payloads (anything legacy in flight). The fallback to `job.name` preserves today's behaviour for single-purpose workers, so **no existing worker needs editing**.

Also fix the duplicate registration: `dpiaReminders.ts:151` should register on its own queue (`'dpia-dispatcher'`), with a matching `boss.schedule()` entry.

⚠️ **This revives ~8 workers that have never run in production.** They will fire against real data on first deploy — DSAR deadline emails, DPIA reminders, sub-processor change notifications. Deploy behind an env flag (`WORKERS_ENABLED_JOBS` allowlist) and enable them one at a time, or the first deploy sends a burst of backdated notifications to real customers.

### 0.2 Fix the scanner — `apps/api/src/lib/browserPool.ts:69`

```ts
await new Promise(r => setTimeout(r, 3000));
```

While in the file, fix Defect C: have `parseCookieHeaders` parse the `Domain=` attribute (falling back to the request host) so `isThirdParty` is computable.

### 0.3 Worker process — `render.yaml`

Add a second service so scanning doesn't run in (or get slept with) the web dyno:

```yaml
- type: worker
  name: custodia-workers
  env: node
  plan: starter          # Puppeteer + the 512MB cluster limit make free unviable
  startCommand: npm run start:workers --workspace=apps/api
```

Needs a `start:workers` script and an entrypoint that imports the workers and calls `scheduleGlobalJobs()` **without** starting Fastify. Guard `scheduleGlobalJobs()` so only the worker service schedules (pg-boss `schedule` is idempotent by queue name, but two schedulers racing on boot is avoidable noise). `getBrowserCluster()`'s `maxConcurrency: 1` comment about Render's 512MB free tier stops applying once this moves to its own paid service — leave the value alone for now and revisit under load.

### 0.4 Regression check

Existing tests: `reconsent.test.ts`, `orgEmbeddings.test.ts`, `breachIntelligence.test.ts`, `consentAnalytics.test.ts`. `createWorker`/`createQueue` are already no-ops under `NODE_ENV=test`, so add a direct unit test for the adapter's shape-normalisation instead — all three payload forms in, correct `{name, data}` out.

---

## Phase 1 — Tracker registry

**Size: S. Replaces the 11-entry hardcoded map and serves both modules.**

New seed file `packages/db/src/seed-data/trackers.json`:

```json
{
  "tracker_key": "meta_pixel",
  "provider": "Meta",
  "match_domains": ["connect.facebook.net", "facebook.com/tr", "facebook.net"],
  "cookie_prefixes": ["_fbp", "_fbc", "fr"],
  "required_category": "marketing",
  "consent_mode_supported": true,
  "consent_signal_params": ["dpo", "ldu"],
  "vendor_slug": "meta"
}
```

New table `tracker_registry` (same columns), seeded via the existing `packages/db/src/seeds` pattern. Target ~60 entries for v1: Meta, Google Ads/Analytics/GTM/DoubleClick, LinkedIn, TikTok, X, Hotjar, Clarity, FullStory, Intercom, HubSpot, Segment, Mixpanel, Amplitude, Stripe, Klaviyo, Criteo, Taboola, Outbrain, Pinterest, Snap, Reddit.

Then:
- `classifyCookie()` (`cmp.ts:24`) reads `cookie_prefixes` from the registry instead of `KNOWN_COOKIES`. Keep the function signature; swap the source and cache per worker run.
- New `matchTrackerByDomain(host)` using the same root-domain normalisation as `findMatchedVendor` (`vendors.ts:774-790`) — extract that `getRootDomain` helper into `lib/domains.ts` and have both call it rather than duplicating.
- Link to `vendors` via `vendor_slug` so a tracker finding can deep-link to the vendor record and its DPA status.

---

## Phase 2 — Two-pass scanner

**Size: M. The core mechanic.**

New export in `browserPool.ts`, leaving `scanDomain` and `scanDomainForThirdParties` in place so nothing else breaks:

```ts
export type ScanPass = 'pre_consent' | 'post_consent';

export type PassResult = {
  pass: ScanPass;
  requests: Array<{
    host: string;
    url: string;                    // query string stripped except allowlisted params
    resourceType: string;
    carriedIdentifiers: boolean;    // request sent cookies, or identifier-shaped params
    consentSignal: 'granted' | 'denied' | 'absent';
  }>;
  cookies: Array<{ name: string; domain: string; path: string; isThirdParty: boolean }>;
};

export async function scanDomainTwoPass(
  url: string,
  opts: { consentCookies?: Array<{name,value,domain,path}>; waitMs?: number }
): Promise<{ pre: PassResult; post: PassResult }>;
```

Implementation notes:

- **Both passes in one `cluster.execute`**, using a fresh `BrowserContext` per pass so pass 1 cannot leak cookies into pass 2. `maxConcurrency: 1` means two passes roughly double wall-clock per domain (~15–20s) — acceptable weekly, and the reason this must not run in the web dyno.
- **Pass 2 seeding:** `page.setCookie(...consentCookies)` before `goto`. For Custodia-CMP domains, seed `pvr_consent_id`. For third-party CMPs, seed their known acceptance cookie (`CookieConsent`, `OptanonConsent`, `usercentrics`…) — add a `cmp_registry` alongside the tracker registry mapping CMP → acceptance cookie shape. Where the CMP is unknown, run pass 2 with a best-effort "Accept all" click via common button selectors, and record `post_consent_method: 'unknown'` so the evaluator can lower confidence.
- **`carriedIdentifiers`** is the Consent Mode discriminator and the most important field in this plan. Set true when the request sent a `Cookie` header, or the URL carries identifier-shaped params (`_fbp`, `cid`, `uid`, `em`, `external_id`). False when the tag loaded but transmitted nothing identifying.
- **`consentSignal`** parses Google's `gcs` param (`G100` = denied, `G111`/`G101` = granted) and Meta's equivalents. `absent` means no signal at all.
- **Never persist raw URLs.** Strip query strings down to an allowlist (`gcs`, `gcd`, `id`, `ev`) before storing. Full URLs contain user identifiers, which is exactly what §35's "no personal data in signals" rule forbids — and storing them would make our own ROPA harder to defend.

---

## Phase 3 — Schema

**Size: S. One migration via `drizzle-kit generate` → `packages/db/drizzle/0042_*.sql`.**

```sql
consent_scan_runs (
  id uuid pk, organization_id uuid not null, domain_id uuid not null → consent_domains cascade,
  started_at, finished_at, status varchar(20),          -- running|ok|failed
  cmp_detected varchar(50), post_consent_method varchar(20),
  pre_request_count int, post_request_count int, cookies_found int,
  findings_open int, error text
)

consent_tracker_observations (
  id uuid pk, scan_run_id uuid not null → consent_scan_runs cascade,
  domain_id uuid not null, observed_host varchar(255) not null,
  tracker_key varchar(100), provider varchar(255), required_category varchar(50),
  matched_vendor_id uuid → vendors set null,
  pass varchar(20) not null, resource_type varchar(30),
  carried_identifiers boolean default false,
  consent_signal varchar(20), request_count int default 1,
  UNIQUE (scan_run_id, observed_host, pass)
)

consent_findings (
  id uuid pk, organization_id uuid not null, domain_id uuid not null → consent_domains cascade,
  finding_type varchar(50) not null,
  severity varchar(20) not null,
  tracker_key varchar(100), provider varchar(255),
  observed_host varchar(255), required_category varchar(50),
  evidence jsonb,                                        -- sanitised: hosts, cookie names, gcs values
  confidence numeric(3,2),
  state varchar(20) default 'open',                      -- open|resolved|dismissed|false_positive
  first_seen_at, last_seen_at, resolved_at,
  resolved_by uuid → users set null,
  first_scan_run_id uuid, last_scan_run_id uuid,
  UNIQUE (domain_id, finding_type, observed_host)
)
```

That `UNIQUE` on `consent_findings` is the same trick as the architecture spec's signal table: upsert bumps `last_seen_at`, and anything not touched by a completed scan flips to `resolved`. Remediation tracking falls out for free — fix the banner, next scan closes the finding, and the closure is dated evidence.

`consent_scan_runs` is deliberately the pilot for `integration_collection_runs`. Findings cite `last_scan_run_id`, so every claim is traceable to a dated, successful scan.

---

## Phase 4 — Evaluator

**Size: M. Keep it a pure function — this is the layer being prototyped.**

`apps/api/src/lib/consentEvaluator.ts`:

```ts
export function evaluateConsentScan(
  run: ScanRun,
  observations: Observation[],
  domain: { categories: string[]; gcmV2Enabled: boolean; tcfEnabled: boolean; cmp: string },
  cookies: ConsentCookie[]
): Finding[]
```

Pure in / pure out, no DB access — so it is trivially unit-testable against recorded fixtures. The worker persists the result.

Findings emitted:

| Type | Severity | Rule |
|---|---|---|
| `missing_category` | high | observation has `required_category` not present in `consentDomains.categories` |
| `prior_consent_violation` | critical | pass=`pre_consent`, category ≠ `necessary`, **and** `carried_identifiers = true` |
| `consent_mode_only` | info | fires pre-consent but `consent_signal='denied'` and no identifiers — **correct behaviour, recorded not flagged** |
| `cmp_no_enforcement` | high | domain uses Custodia CMP and ≥1 non-necessary tracker fires pre-consent with identifiers → names our own script as the cause (see §2) |
| `unclassified_cookie` | medium | `consentCookies.category='uncategorized'` with a matching tracker in the registry → auto-classify, or flag if unknown |
| `untracked_cookie` | medium | tracker seen on the network with no corresponding cookie row (server-side/CAPI) |
| `consent_mode_gap` | medium | Meta/Google Ads present while `gcmV2Enabled=false`; IAB vendors while `tcfEnabled=false` |
| `vendor_undocumented` | low | tracker matched a vendor absent from the org's register → cross-link to `vendorDiscoveries` |

`confidence` drops to 0.5 when `post_consent_method='unknown'` (pass 2 couldn't reliably accept), and the UI must not present sub-0.7 findings as definitive.

New worker branch `consent-reconcile` in `workers/cmp.ts`, or a new `workers/consentScan.ts` on its own queue — prefer the latter, since `cmp-automation` is already multiplexed and the new job is long-running.

---

## Phase 5 — Surface

**Size: M.**

tRPC, in `routers/consent.ts` alongside the existing `scanCookies` (`consent.ts:76`), reusing `requirePermission('ropa', …)`:

- `listFindings({ domainId, state?, severity? })`
- `getFinding({ id })` — observations + sanitised evidence
- `resolveFinding({ id, resolution: 'dismissed'|'false_positive', note })`
- `runReconciliation({ domainId })` — enqueue, mirroring `scanCookies`
- `getScanRuns({ domainId })` — freshness/health

UI on the existing consent domain detail page: a "Coverage" panel showing declared categories vs observed trackers, findings grouped by severity, and per-finding evidence (host, category, pass, consent signal). Add the open critical/high count to the compliance score inputs — `complianceScore` worker already runs daily and works.

Cross-links: finding → vendor record (via `vendor_slug`), and `vendorDiscoveries` rows gain a "required consent category" column from the registry.

---

## Phase 6 — Scheduling

**Size: XS.** In `scheduleGlobalJobs()` (`workers/index.ts`), using the now-correct `{ name, data }` convention:

```ts
await boss.schedule('consent-scan', '0 5 * * 1', { name: 'weekly-reconcile-dispatch', data: {} });
```

Dispatcher selects domains where `scanFrequency` is due (`consentDomains.scanFrequency` already exists, default `'weekly'`) and enqueues one job per domain with pg-boss `singletonKey = domainId`, spreading them with a jitter delay derived from `hash(domainId)` so a single-concurrency browser cluster isn't hit by 200 domains at 05:00.

---

## Testing

- **Unit:** queue adapter shape normalisation (all 3 payload forms); `matchTrackerByDomain`; `evaluateConsentScan` against recorded fixtures — including the Consent Mode case that must *not* produce a violation.
- **Fixture-based:** capture real two-pass output from 3–4 public sites (one Cookiebot, one OneTrust, one no-CMP, one Consent Mode v2) as JSON, and run the evaluator against them in CI. No live network in tests.
- **Manual pre-launch:** run against trycustodia.com itself. If the marketing site carries any tracker, this feature's first real finding is about us — worth knowing before a prospect finds it.
- Note `npx eslint` cannot run in this repo (`apps/web/eslint.config.mjs` throws on ESLint 9.39.4, per memory §34), so none of this will be lint-checked. `tsc --noEmit` is the only static gate.

---

## Sequencing

| Phase | Size | Depends on |
|---|---|---|
| 0 Unblock substrate | S (~1d) | — |
| 1 Tracker registry | S (~1d) | — (parallel with 0) |
| 2 Two-pass scanner | M (~2–3d) | 0.2 |
| 3 Schema | S (~0.5d) | — |
| 4 Evaluator | M (~2d) | 1, 2, 3 |
| 5 Surface | M (~2–3d) | 4 |
| 6 Scheduling | XS | 0.1, 0.3 |

Roughly **8–11 working days** solo. Phase 0 alone is worth shipping on its own — it revives eight workers that have never run.

**Demo-ready checkpoint:** end of Phase 4. A CLI-invoked scan producing real findings against a real domain is enough to validate the whole thesis before building any UI.

---

## Risks and open questions

1. **Reviving dormant workers is the biggest deploy risk in Phase 0.** Eight workers begin firing against production data simultaneously, some of which send customer-facing email. Ship behind a per-job allowlist env var and enable incrementally. Do not deploy 0.1 on a Friday.
2. **Consent Mode false positives** are the one thing that would discredit the feature. The `carried_identifiers` discriminator must be right before any finding is shown to a customer. If it can't be made reliable, ship `missing_category` (#122) alone and hold `prior_consent_violation` (#123) — #122 is still novel and is unambiguous.
3. **Our own CMP doesn't enforce anything** (§2). Decide explicitly whether `cmp_no_enforcement` is customer-visible in v1 or internal-only until the script gains gating. Recommendation: customer-visible, phrased as a Custodia limitation, because hiding it means shipping a compliance tool that stays quiet about a compliance gap it created.
4. **Puppeteer concurrency.** `maxConcurrency: 1` plus doubled page loads caps throughput at roughly 3–4 domains/minute. Fine at current scale; becomes a queue backlog at a few hundred domains. Revisit only when real.
5. **Unverified assumptions.** Everything here is derived from reading the code — Defects A, B, and C have not been observed at runtime. Confirm each against a live queue and a real scan before building on top of them. Defect B in particular should be a two-minute check.
6. **Unknown:** whether any customer currently relies on the (broken) `cookie-scanner` path succeeding. It fails silently today, so `consentCookies` rows may be stale or absent org-wide. Check row counts and `lastScanAt` distribution before assuming the table has usable data.
