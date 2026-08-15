---
name: background-job
description: How background jobs work in Custodia and how to add one — pg-boss (not BullMQ), the payload envelope that carries job names, the WORKERS_ENABLED_JOBS allowlist that inverts the default when set, DORMANT_JOBS, the WORKER_ROLE split between the API and worker services, and the BullMQ-shaped option translation. Use when adding or debugging a worker, scheduling a recurring job, enqueuing work from a router, or when a job silently never runs.
---

# Background jobs

**pg-boss, not BullMQ.** `future-roadmap.md` says BullMQ throughout and is stale. The
API surface deliberately *looks* like BullMQ (`createQueue().add()`, `attempts`,
`backoff`) because it was migrated in place — that resemblance is the trap.

Everything lives in `apps/api/src/lib/queue.ts` and `apps/api/src/workers/`.

## The envelope, and why it exists

pg-boss has **no per-job name**. `boss.send(queue, data)` leaves `job.name` set to the
*queue* name, so a queue serving several job types cannot tell them apart.
`lib/queue.ts` wraps an envelope so multiplexed workers can branch on a real job name.

Three shapes are accepted on the way in:

| Shape | Written by |
|---|---|
| `{ __job, __v, data }` | `createQueue(q).add(jobName, data, opts)` |
| `{ name, data }` | `boss.schedule()` via `wrapJobPayload()` |
| anything else | treated as a raw payload; the queue name stands in as the job name |

**Never call `boss.send()` directly.** The envelope is the only reason multiplexed
workers route correctly. Use:

```ts
await myQueue.add('job-name', { orgId }, { delay: 5000 });     // enqueue
await boss.schedule('queue', '0 2 * * *', wrapJobPayload('job-name', {}));  // recurring
```

## Adding a recurring job — the checklist

1. **Write the worker** in `apps/api/src/workers/<area>.ts`:

   ```ts
   import { createWorker } from '../lib/queue.js';
   import { db } from '../db.js';

   export const myWorker = createWorker('my-queue', async (job: any) => {
     const { orgId } = job.data;
     // job.name is the real job name, recovered from the envelope
   });
   ```

2. **Export it from the barrel**, `apps/api/src/workers/index.ts`. Registration is a
   side effect of `createWorker()` at module scope, so an unexported worker never
   registers.

3. **Export a queue handle** from the same barrel if routers need to enqueue:

   ```ts
   export const myQueue = createQueue('my-queue');
   ```

4. **Schedule it** inside `scheduleGlobalJobs()` in `workers/index.ts`:

   ```ts
   await boss.schedule('my-queue', '0 2 * * *', wrapJobPayload('daily-thing', {}));
   ```

5. **Decide whether it belongs in `DORMANT_JOBS`.** It does if it emails or notifies
   customers. See below.

6. `npm run check` — and if the worker uses `with:` in a relational query, confirm
   `check:relations` passes. The nightly `gap-scanner` was broken for months by
   exactly that.

Existing schedule, for reference on cadence conventions:

| Queue | Cron | Job |
|---|---|---|
| `gap-scanner` | `0 2 * * *` | `daily-scan` |
| `compliance-score` | `0 3 * * *` | `daily-calculation` |
| `consent-rollup` | `0 1 * * *` | `daily-rollup` |
| `consent-rollup-drift-check` | `0 4 * * 0` | `weekly-drift-check` |
| `impact-assessment` | `*/15 * * * *` | `impact-assessment-dispatcher` |
| `trial-expiry` | `0 8 * * *` | `daily-trial-expiry` |
| `maintenance-jobs` | `0 * * * *` | `rate-limit-cleanup` |
| `dpia-dispatcher` | `0 7 * * *` | `dpia-dispatcher` |
| `consent-scan` | `0 5 * * 1` | `weekly-reconcile-dispatch` |

## Why your job did not run

Work through these in order.

### 1. `WORKERS_ENABLED_JOBS` is set

**This allowlist inverts the default.** Unset: everything runs *except* the 19
entries in `DORMANT_JOBS`. Set: **only** what is listed runs and `DORMANT_JOBS` is
ignored entirely — so enabling one job disables every other job, silently, with a
single `[queue] Skipping disabled job …` line.

Entries are matched as `queue:job`, bare `job`, or `*` for everything. Full detail in
`consent-reconciliation-ops.md` §3.

### 2. It is in `DORMANT_JOBS`

19 entries in `lib/queue.ts`, mostly things that email or notify customers:
scheduled compliance reports, DSAR deadline and verification reminders, DPIA
reminders and dispatch, the whole `impact-assessment` family, policy/ROPA sync,
regulatory scraping and quality checks, vendor incident ingest, and six
`vendor-intelligence:*` monitors.

Dormancy is a product decision, not a bug. Do not un-dormant one to make a test pass.

### 3. `WORKER_ROLE=web`

`createWorker()` is a no-op when `WORKER_ROLE=web`. That is how `custodia-api` avoids
running Puppeteer. Only `custodia-workers` (`npm run start:workers`, role unset)
executes anything.

The API process still imports the worker barrel — it needs `scheduleGlobalJobs` — so
every worker module is loaded there and simply does not register. Importing a worker
module from a router to get its queue handle is therefore safe, but it is real
coupling: the import pulls the whole module in.

### 4. `NODE_ENV=test`

`createQueue` returns `{ add: async () => {} }`, `createWorker` is a no-op, and
`getBoss()` returns null. Enqueues from a test are swallowed by design.

## Option translation

`translateJobOptions()` accepts BullMQ-shaped options and converts them:

| You pass | pg-boss receives |
|---|---|
| `delay` (ms) | `startAfter` (seconds) |
| `attempts` | `retryLimit` (minus one) |
| `backoff` | `retryDelay` / `retryBackoff` |

Native pg-boss names — `singletonKey`, `startAfter`, `retryLimit`, `retryDelay` —
pass through untouched. Prefer them in new code; the BullMQ shapes exist for the
migrated call sites.

`singletonKey` is the tool for "only one of these per org in flight", which most
fan-out dispatchers want.

## The dispatcher pattern

Several jobs are a global tick that fans out per organisation
(`dpia-dispatcher`, `impact-assessment-dispatcher`, `weekly-reconcile-dispatch`).
The dispatcher is scheduled; the per-org worker is enqueued by it. When adding a
per-org job, follow this rather than scheduling a job that loops every org inline —
one slow org otherwise blocks the rest.

`gap-scanner` is the counter-example: it loops orgs inline and accepts an optional
`orgId` to scan just one. Match whichever the surrounding area already does.

## Enqueuing from a router

```ts
import { orgEmbeddingsQueue } from '../workers/index.js';

await orgEmbeddingsQueue.add('embed-dpia', {
  orgId: ctx.user!.orgId, entityType: 'dpia', entityId: updated.id, action: 'upsert',
});
```

Do this **after** the write has returned, and after ownership has been proved — see
`trpc-procedure`. A job that fans out on an id the caller did not own is a
cross-tenant hole with a delay on it.

## No alerting

`known-concerns.md` §9: there is no alerting on the worker service. A job that starts
throwing every night will do so quietly. If a job matters, have it write a row
(a run record, a finding, a `last_seen_at` bump) that something else can notice —
the `consent_findings` reconciliation pattern in `db-schema-change` is the house
idiom for exactly this.

## Related

`verify-and-ship` · `trpc-procedure` · `db-schema-change` · `custodia-map`
