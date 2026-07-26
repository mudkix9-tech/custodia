import { Redis, type RedisOptions } from 'ioredis';

/**
 * Centralized utility to create Redis connections with Upstash Serverless Redis compatibility.
 * Upstash uses the `rediss://` URL scheme (TLS encrypted).
 * `ioredis` requires explicit TLS configuration `{ tls: {} }` to successfully connect over `rediss://`
 * when using managed standard certificates.
 */
export function createRedisClient(options: RedisOptions = {}): Redis {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  let isTls = false;
  
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'rediss:') {
      isTls = true;
    }
  } catch (err) {
    // Fallback if URL parsing fails
    if (url.startsWith('rediss://')) {
      isTls = true;
    }
  }

  const defaultOptions: RedisOptions = {
    // Inject TLS config if rediss:// scheme is used (AWS ElastiCache standard TLS)
    tls: isTls ? {} : undefined,
    // By default, retry up to 2 seconds between attempts
    retryStrategy: (times) => Math.min(times * 50, 2000),
  };

  const finalOptions = {
    ...defaultOptions,
    ...options,
  };

  const client = new Redis(url, finalOptions);

  // Centralized connection error logging
  client.on('error', (err) => {
    console.error(`[Redis Error] Connection failed:`, err);
  });
  
  client.on('reconnecting', () => {
    console.warn(`[Redis] Attempting to reconnect...`);
  });

  return client;
}
