// Worker service entrypoint.
//
// Importing the barrel registers every worker as a side effect of createWorker().
// Nothing here starts Fastify, so Puppeteer scans and other long jobs run in a
// process that is not also serving HTTP and cannot be slept by the web host.
import 'dotenv/config';

import './index.js';
import { scheduleGlobalJobs } from './index.js';
import { getBoss, shouldRegisterWorkers } from '../lib/queue.js';

const requiredEnvVars = ['DATABASE_URL'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`FATAL: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

if (!shouldRegisterWorkers()) {
  console.error('FATAL: WORKER_ROLE=web on the worker service; it would register no workers.');
  process.exit(1);
}

const start = async () => {
  try {
    await scheduleGlobalJobs();
    console.log('[Workers] Registered workers and scheduled recurring jobs.');
    if (process.env.WORKERS_ENABLED_JOBS) {
      console.log(`[Workers] Job allowlist active: ${process.env.WORKERS_ENABLED_JOBS}`);
    } else {
      console.log('[Workers] No job allowlist set; previously dormant jobs stay disabled.');
    }
  } catch (err) {
    console.error('[Workers] Failed to start:', err);
    process.exit(1);
  }
};

start();

const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    console.log(`[Workers] Received ${signal}, gracefully shutting down...`);
    try {
      const boss = await getBoss();
      if (boss) await boss.stop({ graceful: true, timeout: 10000 });
    } catch (err) {
      console.error('[Workers] Error during shutdown:', err);
    } finally {
      process.exit(0);
    }
  });
});
