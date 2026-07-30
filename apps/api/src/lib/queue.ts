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

export function createQueue(name: string) {
  if (process.env.NODE_ENV === 'test') {
    return {
      add: async () => {},
    } as any;
  }
  return {
    add: async (jobName: string, data: any, opts?: any) => {
      const b = await getBoss();
      return b.send(name, data, opts);
    },
  };
}

export type Job<T = any> = { id: string; name: string; data: T };

export function createWorker<T = any, R = any, N extends string = string>(
  name: string,
  processor: (job: Job<T>) => Promise<R>,
  opts?: any
) {
  if (process.env.NODE_ENV === 'test') {
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
      
      try {
        // Adapt pg-boss job shape to BullMQ job shape expected by existing workers
        const result = await processor({
          id: job.id,
          name: job.name, // in pg-boss, this is the topic name (which is our queue name)
          data: job.data as T,
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
