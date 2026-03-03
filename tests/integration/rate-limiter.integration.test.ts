import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from 'bun:test';
import { setupTestRedis, clearRateLimitKeys, skipIfNoRedis } from './redis-setup';
import type Redis from 'ioredis';

let shouldSkip = skipIfNoRedis();

// Only set up mock and imports if Redis is available
let testRedis: Redis;
let cleanupFn: () => Promise<void>;

// We need to mock the state module BEFORE importing rate-limiter
// so rate-limiter uses our test Redis instead of trying to connect to default
if (!shouldSkip) {
  try {
    const ctx = await setupTestRedis();
    testRedis = ctx.redis;
    cleanupFn = ctx.cleanup;

    mock.module('../../src/state', () => ({
      redis: testRedis,
    }));
  } catch {
    console.log('\u23ED\uFE0F  Skipping Redis integration tests: Redis not reachable');
    shouldSkip = true;
  }
}

// Import after mock setup — these will use testRedis
const {
  acquireRateLimitSlot,
  checkRateLimit,
  resetUserRateLimit,
  getRateLimitStatus,
  isAiHelperDisabled,
  disableAiHelper,
  enableAiHelper,
} = await import('../../src/ai/rate-limiter');

const TEST_USER_ID = '123456789012345678'; // Valid 18-digit Discord ID

describe.skipIf(shouldSkip)('Rate Limiter Integration Tests', () => {
  beforeAll(async () => {
    await clearRateLimitKeys(testRedis);
  });

  afterAll(async () => {
    await cleanupFn();
  });

  beforeEach(async () => {
    await clearRateLimitKeys(testRedis);
  });

  // ─────────────────────────────────────────────────
  // Lua Script — Basic Flow
  // ─────────────────────────────────────────────────

  describe('acquireRateLimitSlot - Lua script basic flow', () => {
    test('allows first request for a user', async () => {
      const result = await acquireRateLimitSlot(TEST_USER_ID);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // 10 max - 0 existing - 1 just used
    });

    test('sets cooldown after allowing request', async () => {
      await acquireRateLimitSlot(TEST_USER_ID);

      const cooldownTtl = await testRedis.ttl(`ai_helper:cooldown:${TEST_USER_ID}`);
      expect(cooldownTtl).toBeGreaterThan(0);
    });

    test('denies request during cooldown', async () => {
      await acquireRateLimitSlot(TEST_USER_ID);

      // Second call immediately — should be blocked by cooldown
      const result = await acquireRateLimitSlot(TEST_USER_ID);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('cooldown');
      expect(result.resetInSeconds).toBeGreaterThan(0);
    });

    test('allows request after cooldown is manually cleared', async () => {
      await acquireRateLimitSlot(TEST_USER_ID);

      // Manually clear cooldown to simulate expiry
      await testRedis.del(`ai_helper:cooldown:${TEST_USER_ID}`);

      const result = await acquireRateLimitSlot(TEST_USER_ID);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(8); // 10 - 1 - 1
    });

    test('denies when AI helper is globally disabled', async () => {
      await disableAiHelper();

      const result = await acquireRateLimitSlot(TEST_USER_ID);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('disabled');
    });
  });

  // ─────────────────────────────────────────────────
  // Lua Script — Rate Window
  // ─────────────────────────────────────────────────

  describe('acquireRateLimitSlot - rate window', () => {
    test('counter increments correctly', async () => {
      // Make 3 requests, clearing cooldown between each
      for (let i = 0; i < 3; i++) {
        const result = await acquireRateLimitSlot(TEST_USER_ID);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(9 - i); // 9, 8, 7
        await testRedis.del(`ai_helper:cooldown:${TEST_USER_ID}`);
      }

      // Verify counter in Redis
      const count = await testRedis.get(`ai_helper:rate:${TEST_USER_ID}`);
      expect(count).toBe('3');
    });

    test('EXPIRE NX does not reset TTL on subsequent requests', async () => {
      // First request sets TTL
      await acquireRateLimitSlot(TEST_USER_ID);
      const firstTtl = await testRedis.ttl(`ai_helper:rate:${TEST_USER_ID}`);
      expect(firstTtl).toBeGreaterThan(0);

      // Wait a tiny bit and make another request
      await testRedis.del(`ai_helper:cooldown:${TEST_USER_ID}`);
      await acquireRateLimitSlot(TEST_USER_ID);
      const secondTtl = await testRedis.ttl(`ai_helper:rate:${TEST_USER_ID}`);

      // TTL should be <= first TTL (not reset)
      expect(secondTtl).toBeLessThanOrEqual(firstTtl);
    });

    test('exhausts all 10 slots then denies', async () => {
      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        const result = await acquireRateLimitSlot(TEST_USER_ID);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(9 - i);
        await testRedis.del(`ai_helper:cooldown:${TEST_USER_ID}`);
      }

      // 11th request should be denied
      await testRedis.del(`ai_helper:cooldown:${TEST_USER_ID}`);
      const result = await acquireRateLimitSlot(TEST_USER_ID);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('rate_limit');
    });

    test('returns resetInSeconds when rate limited', async () => {
      // Exhaust all slots
      for (let i = 0; i < 10; i++) {
        await acquireRateLimitSlot(TEST_USER_ID);
        await testRedis.del(`ai_helper:cooldown:${TEST_USER_ID}`);
      }

      await testRedis.del(`ai_helper:cooldown:${TEST_USER_ID}`);
      const result = await acquireRateLimitSlot(TEST_USER_ID);
      expect(result.allowed).toBe(false);
      expect(result.resetInSeconds).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────
  // checkRateLimit — Read-Only
  // ─────────────────────────────────────────────────

  describe('checkRateLimit - read-only', () => {
    test('returns allowed for fresh user', async () => {
      const result = await checkRateLimit(TEST_USER_ID);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
    });

    test('returns disabled when globally disabled', async () => {
      await disableAiHelper();
      const result = await checkRateLimit(TEST_USER_ID);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('disabled');
    });

    test('returns cooldown with TTL', async () => {
      await testRedis.setex(`ai_helper:cooldown:${TEST_USER_ID}`, 5, '1');
      const result = await checkRateLimit(TEST_USER_ID);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('cooldown');
      expect(result.resetInSeconds).toBeGreaterThan(0);
    });

    test('does not modify any keys', async () => {
      const result = await checkRateLimit(TEST_USER_ID);
      expect(result.allowed).toBe(true);

      // Verify no keys were created
      const rateKey = await testRedis.exists(`ai_helper:rate:${TEST_USER_ID}`);
      const cooldownKey = await testRedis.exists(`ai_helper:cooldown:${TEST_USER_ID}`);
      expect(rateKey).toBe(0);
      expect(cooldownKey).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────
  // resetUserRateLimit
  // ─────────────────────────────────────────────────

  describe('resetUserRateLimit', () => {
    test('clears both rate and cooldown keys', async () => {
      // Set up some state
      await acquireRateLimitSlot(TEST_USER_ID);

      // Verify keys exist
      const rateBefore = await testRedis.exists(`ai_helper:rate:${TEST_USER_ID}`);
      const cooldownBefore = await testRedis.exists(`ai_helper:cooldown:${TEST_USER_ID}`);
      expect(rateBefore).toBe(1);
      expect(cooldownBefore).toBe(1);

      // Reset
      await resetUserRateLimit(TEST_USER_ID);

      const rateAfter = await testRedis.exists(`ai_helper:rate:${TEST_USER_ID}`);
      const cooldownAfter = await testRedis.exists(`ai_helper:cooldown:${TEST_USER_ID}`);
      expect(rateAfter).toBe(0);
      expect(cooldownAfter).toBe(0);
    });

    test('user can make requests again after reset', async () => {
      // Exhaust all slots
      for (let i = 0; i < 10; i++) {
        await acquireRateLimitSlot(TEST_USER_ID);
        await testRedis.del(`ai_helper:cooldown:${TEST_USER_ID}`);
      }

      // Verify blocked
      await testRedis.del(`ai_helper:cooldown:${TEST_USER_ID}`);
      const blocked = await acquireRateLimitSlot(TEST_USER_ID);
      expect(blocked.allowed).toBe(false);

      // Reset and retry
      await resetUserRateLimit(TEST_USER_ID);
      const result = await acquireRateLimitSlot(TEST_USER_ID);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });
  });

  // ─────────────────────────────────────────────────
  // getRateLimitStatus
  // ─────────────────────────────────────────────────

  describe('getRateLimitStatus', () => {
    test('returns zeros for fresh user', async () => {
      const status = await getRateLimitStatus(TEST_USER_ID);
      expect(status.requestsUsed).toBe(0);
      expect(status.cooldownActive).toBe(false);
      expect(status.resetInSeconds).toBe(0);
    });

    test('reflects actual request count', async () => {
      // Make 3 requests
      for (let i = 0; i < 3; i++) {
        await acquireRateLimitSlot(TEST_USER_ID);
        await testRedis.del(`ai_helper:cooldown:${TEST_USER_ID}`);
      }

      const status = await getRateLimitStatus(TEST_USER_ID);
      expect(status.requestsUsed).toBe(3);
      expect(status.requestsLimit).toBe(10);
    });

    test('shows cooldown active after request', async () => {
      await acquireRateLimitSlot(TEST_USER_ID);
      const status = await getRateLimitStatus(TEST_USER_ID);
      expect(status.cooldownActive).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────
  // Global Toggle
  // ─────────────────────────────────────────────────

  describe('Global toggle', () => {
    test('disable blocks all acquireRateLimitSlot calls', async () => {
      await disableAiHelper();
      const result = await acquireRateLimitSlot(TEST_USER_ID);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('disabled');
    });

    test('enable restores normal operation', async () => {
      await disableAiHelper();
      await enableAiHelper();
      const result = await acquireRateLimitSlot(TEST_USER_ID);
      expect(result.allowed).toBe(true);
    });
  });
});
