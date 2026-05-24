import { Queue, Worker, type ConnectionOptions } from 'bullmq';

export const redisConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

export function createQueue(name: string) {
  return new Queue(name, { connection: redisConnection });
}

export function createWorker(name: string, processor: any, opts?: any) {
  return new Worker(name, processor, {
    connection: redisConnection,
    ...opts
  });
}

export const dataExportQueue = createQueue('data-export');
