import { Queue, Worker, type ConnectionOptions } from 'bullmq';

const getRedisConnectionOptions = (): ConnectionOptions => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  try {
    const parsed = new URL(redisUrl);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379', 10),
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      // If using rediss:// (TLS), enable the tls option
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
      maxRetriesPerRequest: null,
    };
  } catch (error) {
    console.error('Failed to parse REDIS_URL, falling back to localhost:', error);
    return {
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: null,
    };
  }
};

export const redisConnection = getRedisConnectionOptions();

import { Redis } from 'ioredis';

let sharedQueueRedis: Redis | null = null;
function getSharedQueueRedis() {
  if (!sharedQueueRedis) {
    sharedQueueRedis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });
  }
  return sharedQueueRedis;
}

export function createQueue(name: string) {
  return new Queue(name, { connection: getSharedQueueRedis() });
}

export function createWorker(name: string, processor: any, opts?: any) {
  return new Worker(name, processor, {
    connection: redisConnection,
    ...opts
  });
}

export const dataExportQueue = createQueue('data-export');
export const orgEmbeddingsQueue = createQueue('org-embeddings');
