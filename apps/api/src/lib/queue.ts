import PgBoss from 'pg-boss';

// Supabase uses Supavisor for connection pooling on port 6543, which does not support LISTEN/NOTIFY.
// We must use the direct connection on port 5432.
const connectionString = process.env.DIRECT_URL || (process.env.DATABASE_URL || '').replace(':6543/', ':5432/');

let boss: PgBoss | null = null;

export async function getBoss() {
  if (process.env.NODE_ENV === 'test') {
    return null as any;
  }
  if (!boss) {
    boss = new PgBoss({ connectionString, max: 2 });
    boss.on('error', (error) => console.error('pg-boss error:', error));
    await boss.start();
  }
  return boss;
}

// ---------------------------------------------------------------------------
// Job payload envelope
//
// pg-boss has no per-job name: `boss.send(queue, data)` leaves `job.name` set to
// the *queue* name. Workers here branch on `job.name` expecting a BullMQ-style
// job name, so the name has to travel inside the payload. Two conventions
// already exist in the repo, and both are accepted:
//
//   { __job, __v, data }  - written by createQueue().add()
//   { name, data }        - written by scheduleGlobalJobs() via boss.schedule()
//
// Anything else is treated as a raw payload, with the queue name standing in as
// the job name. That preserves the behaviour single-purpose workers rely on
// (they ignore job.name) and lets jobs enqueued before this change drain safely.
// ---------------------------------------------------------------------------

const ENVELOPE_VERSION = 1;

export function wrapJobPayload(jobName: string, data: any) {
  return { __job: jobName, __v: ENVELOPE_VERSION, data: data ?? {} };
}

export function normaliseJobPayload(
  queueName: string,
  pgBossJobName: string | undefined,
  payload: any
): { name: string; data: any } {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const envelope = payload as Record<string, any>;

    if (typeof envelope.__job === 'string') {
      return { name: envelope.__job, data: envelope.data ?? {} };
    }

    // Legacy boss.schedule() shape. Matched on an exact { name, data } key set so
    // a business payload that merely happens to carry `name` and `data` fields is
    // not mistaken for an envelope.
    const keys = Object.keys(envelope);
    if (
      keys.length === 2 &&
      keys.includes('name') &&
      keys.includes('data') &&
      typeof envelope.name === 'string'
    ) {
      return { name: envelope.name, data: envelope.data ?? {} };
    }
  }

  return { name: pgBossJobName || queueName, data: payload ?? {} };
}

// ---------------------------------------------------------------------------
// Job option translation
//
// Call sites pass BullMQ-shaped options (`attempts`, `backoff`, `delay`) that
// pg-boss ignores outright, so every retry and delay in the repo is currently a
// no-op. Translate the BullMQ vocabulary into pg-boss's and pass pg-boss's own
// option names straight through.
// ---------------------------------------------------------------------------

const PG_BOSS_SEND_OPTIONS = [
  'id', 'priority', 'startAfter', 'singletonKey', 'singletonSeconds',
  'singletonMinutes', 'singletonHours', 'singletonNextSlot',
  'retryLimit', 'retryDelay', 'retryBackoff',
  'expireInSeconds', 'expireInMinutes', 'expireInHours',
  'retentionSeconds', 'retentionMinutes', 'retentionHours', 'retentionDays',
  'deadLetter', 'onComplete',
] as const;

export function translateJobOptions(opts?: any): Record<string, any> {
  if (!opts || typeof opts !== 'object') return {};
  const out: Record<string, any> = {};

  for (const key of PG_BOSS_SEND_OPTIONS) {
    if (opts[key] !== undefined) out[key] = opts[key];
  }

  // BullMQ `delay` is milliseconds; pg-boss `startAfter` is seconds.
  if (out.startAfter === undefined && typeof opts.delay === 'number') {
    out.startAfter = Math.max(0, Math.ceil(opts.delay / 1000));
  }

  // BullMQ `attempts` counts the first try; pg-boss `retryLimit` counts retries.
  if (out.retryLimit === undefined && typeof opts.attempts === 'number') {
    out.retryLimit = Math.max(0, opts.attempts - 1);
  }

  const backoff = opts.backoff;
  if (backoff && typeof backoff === 'object') {
    if (out.retryDelay === undefined && typeof backoff.delay === 'number') {
      out.retryDelay = Math.max(1, Math.ceil(backoff.delay / 1000));
    }
    if (out.retryBackoff === undefined && backoff.type === 'exponential') {
      out.retryBackoff = true;
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Revival gate
//
// Fixing the envelope above brings roughly 25 job branches to life that have
// never executed in production, several of which email customers or fire
// webhooks on a schedule. Ungated, the first deploy emits a burst of backdated
// notifications, so those jobs stay off until explicitly enabled.
//
// WORKERS_ENABLED_JOBS is a comma-separated allowlist of `queue:job`, or a bare
// `job` to match that job on any queue, or `*` for everything. When it is set,
// only listed jobs run. When it is unset, everything runs except the dormant set
// below.
// ---------------------------------------------------------------------------

const DORMANT_JOBS = new Set<string>([
  'compliance:scheduled-reports',
  'dsar-automation:dsar-deadline-monitor',
  'dsar-automation:dsar-verification-reminder',
  'dpia-reminders:dpia-mitigation-reminder-checker',
  'dpia-dispatcher:dpia-dispatcher',
  'impact-assessment:impact-assessment-dispatcher',
  'impact-assessment:match-org-semantic',
  'impact-assessment:match-catchup',
  'impact-assessment:generate-assessment',
  'policies-automation:policy-ropa-sync',
  'regulatory-jobs:scrape',
  'regulatory-jobs:quality-check',
  'vendor-incidents-ingest:ingest-daily',
  'vendor-intelligence:sub-processor-change-detector',
  'vendor-intelligence:breach-alert-monitor',
  'vendor-intelligence:dpa-expiry-checker',
  'vendor-intelligence:dpa-page-change-detector',
  'vendor-intelligence:assessment-reminder-checker',
  'vendor-intelligence:weekly-organization-discovery-trigger',
  'vendor-intelligence:vendor-review-reminder',
  'ropa-reviews:ropa-review-reminder-checker',
  'ropa-reviews-dispatcher:ropa-reviews-dispatcher',
  // Sprint 4. Each of these either emails somebody or fills a queue a customer then
  // has to work through, and the first run against an established register finds
  // real work — forty vendors nothing references, a decade of elapsed retention.
  // That should arrive because an organisation switched the feature on.
  'ropa-discovery:ropa-discovery-dispatch',
  'ropa-discovery:ropa-discovery-scan',
  'ropa-retention:ropa-retention-dispatch',
  'ropa-retention:ropa-retention-scan',
  'ropa-intake:ropa-intake-dispatch',
  'ropa-intake:ropa-intake-reminders',
  'material-change:material-change',
]);

export function parseJobAllowlist(raw = process.env.WORKERS_ENABLED_JOBS): Set<string> | null {
  if (raw === undefined || raw.trim() === '') return null;
  return new Set(raw.split(',').map(s => s.trim()).filter(Boolean));
}

export function isJobEnabled(
  queueName: string,
  jobName: string,
  allowlist: Set<string> | null = parseJobAllowlist()
): boolean {
  const qualified = `${queueName}:${jobName}`;
  if (allowlist) {
    return allowlist.has('*') || allowlist.has(qualified) || allowlist.has(jobName);
  }
  return !DORMANT_JOBS.has(qualified);
}

/**
 * The web entrypoint imports workers/index.js for scheduleGlobalJobs, which pulls
 * in every worker module and registers all of them in the web process. Setting
 * WORKER_ROLE=web makes createWorker a no-op there so long-running jobs — the
 * Puppeteer scans in particular — only ever execute on the worker service.
 * Unset means "register", which is the behaviour every existing deploy has.
 */
export function shouldRegisterWorkers(): boolean {
  return process.env.WORKER_ROLE !== 'web';
}

export function createQueue(name: string) {
  if (process.env.NODE_ENV === 'test') {
    return {
      add: async () => {},
    } as any;
  }
  return {
    add: async (jobName: string, data: any, opts?: any) => {
      const b = await getBoss();
      return b.send(name, wrapJobPayload(jobName, data), translateJobOptions(opts));
    },
  };
}

export type Job<T = any> = { id: string; name: string; data: T };

export function createWorker<T = any, R = any, N extends string = string>(
  name: string,
  processor: (job: Job<T>) => Promise<R>,
  opts?: any
) {
  if (process.env.NODE_ENV === 'test' || !shouldRegisterWorkers()) {
    return {
      on: () => {},
      close: async () => {},
    } as any;
  }

  const start = async () => {
    const b = await getBoss();

    // In pg-boss, work() takes the topic (queue name) and a handler.
    await b.work(name, opts || {}, async (jobs: any) => {
      // pg-boss can fetch in batches if configured, but default is 1.
      const job = Array.isArray(jobs) ? jobs[0] : jobs;
      const { name: jobName, data } = normaliseJobPayload(name, job.name, job.data);

      if (!isJobEnabled(name, jobName)) {
        console.warn(
          `[queue] Skipping disabled job ${name}:${jobName}. ` +
          `Add it to WORKERS_ENABLED_JOBS to enable it.`
        );
        return;
      }

      try {
        // Adapt pg-boss job shape to BullMQ job shape expected by existing workers
        const result = await processor({
          id: job.id,
          name: jobName,
          data: data as T,
        });
        return result;
      } catch (error) {
        console.error(`Worker error for ${name}:`, error);
        throw error;
      }
    });
  };

  start().catch(err => console.error(`Failed to start worker ${name}:`, err));

  return {
    on: (event: string, handler: any) => {
      // Stub to prevent crashes from existing `.on('completed', ...)` etc.
    },
    close: async () => {
      // Optional: stub close if needed
    }
  };
}

export const dataExportQueue = createQueue('data-export');
export const orgEmbeddingsQueue = createQueue('org-embeddings');
export const assessmentPdfQueue = createQueue('assessment-pdf');
