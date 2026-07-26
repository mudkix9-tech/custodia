import { createRedisClient } from 'db';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';

import type { Redis } from 'ioredis';

let sharedQueueRedis: Redis | null = null;
function getSharedQueueRedis() {
  if (process.env.NODE_ENV === 'test') {
    return null as any;
  }
  if (!sharedQueueRedis) {
    sharedQueueRedis = createRedisClient({
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });
  }
  return sharedQueueRedis;
}

export function createQueue(name: string) {
  if (process.env.NODE_ENV === 'test') {
    return null as any;
  }
  return new Queue(name, { connection: getSharedQueueRedis() });
}

export function createWorker<T = any, R = any, N extends string = string>(
  name: string, 
  processor: import('bullmq').Processor<T, R, N>, 
  opts?: Partial<import('bullmq').WorkerOptions>
) {
  if (process.env.NODE_ENV === 'test') {
    return null as any;
  }
  return new Worker(name, processor, {
    connection: createRedisClient({ maxRetriesPerRequest: null }),
    drainDelay: opts?.drainDelay ?? 30, // default 30s instead of BullMQ's 5s
    ...opts,
  });
}

export const dataExportQueue = process.env.NODE_ENV === 'test' ? null as any : createQueue('data-export');
export const orgEmbeddingsQueue = process.env.NODE_ENV === 'test' ? null as any : createQueue('org-embeddings');
