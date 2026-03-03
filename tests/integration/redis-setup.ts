/**
 * Redis Integration Test Setup
 *
 * Provides utilities for running integration tests against a real Redis instance.
 * Uses prefix-scoped key deletion for safety — only touches ai_helper:* keys.
 *
 * Requirements:
 * - REDIS_URL environment variable must point to a test Redis instance
 *
 * Usage:
 *   const { redis, cleanup } = await setupTestRedis();
 *   // ... run tests ...
 *   await cleanup();
 */

import Redis from 'ioredis';

interface RedisTestContext {
  redis: Redis;
  cleanup: () => Promise<void>;
}

const RATE_LIMIT_PREFIXES = [
  'ai_helper:rate:',
  'ai_helper:cooldown:',
  'ai_helper:disabled',
];

/**
 * Setup a test Redis connection.
 */
export async function setupTestRedis(): Promise<RedisTestContext> {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error(
      'REDIS_URL environment variable is required for Redis integration tests.\n' +
        'Set it to a test Redis instance, e.g.:\n' +
        'REDIS_URL=redis://localhost:6380 bun test tests/integration/rate-limiter.integration.test.ts'
    );
  }

  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    retryStrategy: () => null, // Fail fast in tests
  });

  // Verify connection
  await redis.ping();

  const cleanup = async () => {
    await clearRateLimitKeys(redis);
    redis.disconnect();
  };

  return { redis, cleanup };
}

/**
 * Clear all rate-limiter keys from Redis.
 * Only deletes keys with known ai_helper:* prefixes — safe for shared Redis.
 */
export async function clearRateLimitKeys(redis: Redis): Promise<void> {
  for (const prefix of RATE_LIMIT_PREFIXES) {
    // Use SCAN to find keys (non-blocking, unlike KEYS in production)
    const stream = redis.scanStream({ match: `${prefix}*`, count: 100 });

    const keysToDelete: string[] = [];
    for await (const keys of stream) {
      keysToDelete.push(...(keys as string[]));
    }

    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
    }
  }

  // Also handle the exact 'ai_helper:disabled' key (no wildcard needed)
  await redis.del('ai_helper:disabled');
}

/**
 * Skip test if REDIS_URL is not set.
 *
 * Returns true (skip) if:
 * - REDIS_URL is not set
 */
export function skipIfNoRedis(): boolean {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.log('\u23ED\uFE0F  Skipping Redis integration tests: REDIS_URL not set');
    return true;
  }

  return false;
}
