import { createWorker } from '../lib/queue.js';
import { db } from '../db.js';
import { sql } from 'drizzle-orm';

const cleanupWorker = createWorker('maintenance-jobs', async job => {
  if (job.name === 'rate-limit-cleanup') {
    try {
      const result = await db.execute(sql`
        DELETE FROM rate_limits WHERE expires_at < NOW()
      `);
      console.log(`[Rate Limit Cleanup] Deleted ${result.rowCount} expired rate limit records.`);
    } catch (err: any) {
      console.error('[Rate Limit Cleanup] Error:', err.message);
    }
  }
});

export { cleanupWorker };
