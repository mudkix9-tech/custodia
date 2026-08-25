import 'dotenv/config';
import fastify, { FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
  }
}

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import * as Sentry from '@sentry/node';
import { randomUUID } from 'crypto';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import fastifyCookie from '@fastify/cookie';
import { createContext } from './trpc.js';
import { appRouter } from './router.js';
import { emailWorker } from './workers/emails.js';
import { impactAssessmentWorker } from './workers/impactAssessmentWorker.js';
import { regulatoryNotificationWorker } from './workers/regulatoryNotificationWorker.js';
import { generateAssessmentPdfWorker } from './workers/generateAssessmentPdf.js';

import { scheduleGlobalJobs } from './workers/index.js';
import cmpRoutes from './routes/cmp.js';
import { ssoRoutes } from './routes/sso.js';
import v1Routes from './routes/v1/index.js';
import { complianceWorker } from './workers/compliance.js';
import { paddleWebhookHandler } from './webhooks/paddle.js';
import { inboundEmailWebhookHandler } from './webhooks/inbound.js';
import { pool } from './db.js';
import { getBoss, shouldRegisterWorkers } from './lib/queue.js';
import { assertSecretsConfigured } from './lib/secrets.js';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  beforeSend(event) {
    if (event.message) {
      event.message = event.message.replace(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        '[EMAIL_REDACTED]'
      );
    }
    return event;
  },
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
});


// Validate essential environment variables
const requiredEnvVars = ['DATABASE_URL'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`FATAL: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const server = fastify({
  routerOptions: {
    maxParamLength: 5000,
  },
  /**
   * Fastify's default is 1 MiB, which several procedures quietly exceed: a
   * base64-encoded DPA (`ai.analyzeDpa`) and a vendor register spreadsheet
   * (`vendors.importCsv`) are both routinely larger than that, and the rejection
   * happens in the HTTP layer before tRPC or Zod sees the call — so the client
   * receives `FST_ERR_CTP_BODY_TOO_LARGE` rather than anything about the file it
   * just chose. Raised once, here, so the Zod `.max()` on those inputs is the
   * limit that actually speaks to the user; each of them stays well under this.
   */
  bodyLimit: 12 * 1024 * 1024,
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined
  },
});

Sentry.setupFastifyErrorHandler(server);

server.addHook('onRequest', async (request) => {
  request.correlationId = (request.headers['x-correlation-id'] as string) || randomUUID();
  request.log = request.log.child({ 
    correlationId: request.correlationId,
    // Note: Request.user might not be defined until after trpc context resolution,
    // but correlationId will be bound to the log here.
  });
});

server.register(helmet, {
  contentSecurityPolicy: false,
});

server.register(rateLimit, {
  max: 1000, // global rate limit
  timeWindow: '1 minute'
});

// We need rawBody for Stripe/Paddle webhooks.
server.register(import('fastify-raw-body'), {
  field: 'rawBody',
  global: false,
  encoding: 'utf8',
  runFirst: true
});

server.register(cors, {
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    /^https:\/\/.*\.custodia\.io$/,
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
});

server.register(fastifyCookie);

// Register webhook and REST routes
server.register(cmpRoutes);
server.register(paddleWebhookHandler);
server.register(inboundEmailWebhookHandler);

// O119. The public REST API. Every route inside is behind apiKeyAuthMiddleware,
// which resolves the organisation from the key — no endpoint takes an org id, so a
// key can only ever address its own tenant. Registered here for the first time:
// routes/v1/index.ts carried a "NOT REGISTERED" banner and nothing mounted it, so
// the vendors endpoint documented in the product was unreachable as well (D40).
server.register(v1Routes, { prefix: '/api/v1' });

// Health checks
server.get('/api/health', async (request, reply) => {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    checks: { database: 'unknown', redis: 'unknown' },
  };

  try {
    const { db } = await import('./db.js');
    const { sql } = await import('drizzle-orm');
    await db.execute(sql`SELECT 1`);
    checks.checks.database = 'ok';
  } catch (e) {
    checks.checks.database = 'error';
    checks.status = 'degraded';
  }



  const httpStatus = checks.status === 'ok' ? 200 : 503;
  return reply.code(httpStatus).send(checks);
});

server.get('/api/health/ready', async (request, reply) => {
  return reply.code(200).send({ ready: true });
});

server.register(fastifyTRPCPlugin, {
  prefix: '/api/trpc',
  trpcOptions: {
    router: appRouter,
    // Built in trpc.ts so there is exactly one definition. The inline version that
    // used to live here packed only { req, res }, so ctx.db was undefined on every
    // publicProcedure — isAuthed is the only other thing that ever sets it, and
    // public procedures never reach it. The client portal, the public DSAR form and
    // the vendor questionnaire all threw on every call as a result.
    createContext,
  },
});

const start = async () => {
  try {
    // Before the socket opens, not on first use: a burned or missing signing key
    // otherwise surfaces as scattered auth failures in production instead of a
    // deployment that refuses to go live.
    assertSecretsConfigured();

    const port = parseInt(process.env.PORT || '4000', 10);
    const host = process.env.HOST || '0.0.0.0';
    const address = await server.listen({ port, host });
    console.log(`API Server listening on ${address}`);
    // Scheduling belongs to the worker service (see apps/api/src/workers/main.ts).
    // The web role skips it so two schedulers are not racing on boot.
    if (process.env.NODE_ENV !== 'test' && shouldRegisterWorkers()) {
      console.log('Workers initialized');
      // Schedule all background workers centrally
      await scheduleGlobalJobs();
    }
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};


const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    console.log(`Received ${signal}, gracefully shutting down...`);
    // Ideally close BullMQ workers, fastify, etc.
    try {
      await server.close();
      console.log('Server closed.');
      
      const boss = await getBoss();
      if (boss) {
        console.log('Stopping pg-boss...');
        await boss.stop({ graceful: true, timeout: 10000 });
        console.log('pg-boss stopped.');
      }
      
      console.log('Closing database pool...');
      await pool.end();
      console.log('Database pool closed.');

      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown', err);
      process.exit(1);
    }
  });
});

start();
