// @ts-nocheck
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
import { fastifyTRPCPlugin, CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import fastifyCookie from '@fastify/cookie';
import { Context } from './trpc.js';
import { appRouter } from './router.js';
import { emailWorker } from './workers/emails.js';
import { emailSenderWorker } from './workers/emailSenderWorker.js';
import { vendorAssessmentWorker } from './workers/vendorAssessmentWorker.js';
import { impactAssessmentWorker } from './workers/impactAssessmentWorker.js';
import { regulatoryNotificationWorker } from './workers/regulatoryNotificationWorker.js';
import { generateAssessmentPdfWorker } from './workers/generateAssessmentPdf.js';

import { scheduleGlobalJobs } from './workers/index.js';
import cmpRoutes from './routes/cmp.js';
import { ssoRoutes } from './routes/sso.js';
import { complianceWorker } from './workers/compliance.js';
import { paddleWebhookHandler } from './webhooks/paddle.js';
import { inboundEmailWebhookHandler } from './webhooks/inbound.js';
import { pool } from './db.js';
import { getBoss, shouldRegisterWorkers } from './lib/queue.js';

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
  maxParamLength: 5000,
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
    createContext: ({ req, res }: CreateFastifyContextOptions): Context => {
      return { req, res };
    },
  },
});

const start = async () => {
  try {
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
