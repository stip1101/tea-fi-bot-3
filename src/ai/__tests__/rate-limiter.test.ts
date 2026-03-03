/**
 * Rate Limiter Tests
 * Priority 1 - Security Critical
 *
 * Tests for atomic rate limiting, cooldown management, and user ID validation
 */

import { describe, it, expect, beforeEach, mock, afterEach } from 'bun:test';
import {
  createMockRedis,
  createMockRedisState,
  type MockRedisState,
} from './mocks/redis.mock';
import { generateValidUserId } from './mocks/discord.mock';

// Create mock state
let redisState: MockRedisState;

// Silent logger mock
const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: () => silentLogger,
};

// Mock modules before importing rate-limiter
mock.module('../../state', () => {
  redisState = createMockRedisState();
  return {
    redis: createMockRedis(redisState),
  };
});

mock.module('../../utils/logger', () => ({
  logger: silentLogger,
}));

mock.module('../openai-client', () => ({
  openai: null,
  aiLogger: silentLogger,
}));

// Import after mocking
import {
  acquireRateLimitSlot,
  checkRateLimit,
  isAiHelperDisabled,
  disableAiHelper,
  enableAiHelper,
  resetUserRateLimit,
  getRateLimitStatus,
} from '../rate-limiter';

describe('Rate Limiter', () => {
  beforeEach(() => {
    // Reset mock state before each test
    redisState.data.clear();
    redisState.ttls.clear();
    redisState.evalResult = null;
    redisState.shouldThrow = false;
  });

  describe('validateUserId', () => {
    it('should accept valid 17-digit user ID', async () => {
      const userId = generateValidUserId(17);
      expect(userId).toHaveLength(17);

      const result = await acquireRateLimitSlot(userId);
      expect(result.allowed).toBe(true);
    });

    it('should accept valid 18-digit user ID', async () => {
      const userId = generateValidUserId(18);
      expect(userId).toHaveLength(18);

      const result = await acquireRateLimitSlot(userId);
      expect(result.allowed).toBe(true);
    });

    it('should accept valid 19-digit user ID', async () => {
      const userId = generateValidUserId(19);
      expect(userId).toHaveLength(19);

      const result = await acquireRateLimitSlot(userId);
      expect(result.allowed).toBe(true);
    });

    it('should reject user ID with less than 17 digits', async () => {
      const shortId = '1234567890123456'; // 16 digits
      expect(() => acquireRateLimitSlot(shortId)).toThrow('Invalid user ID format');
    });

    it('should reject user ID with more than 19 digits', async () => {
      const longId = '12345678901234567890'; // 20 digits
      expect(() => acquireRateLimitSlot(longId)).toThrow('Invalid user ID format');
    });

    it('should reject non-numeric user ID', async () => {
      const invalidId = 'abc12345678901234';
      expect(() => acquireRateLimitSlot(invalidId)).toThrow('Invalid user ID format');
    });

    it('should reject empty user ID', async () => {
      expect(() => acquireRateLimitSlot('')).toThrow('Invalid user ID format');
    });

    it('should reject user ID with special characters', async () => {
      const invalidId = '12345678901234567!';
      expect(() => acquireRateLimitSlot(invalidId)).toThrow('Invalid user ID format');
    });

    it('should reject user ID with spaces', async () => {
      const invalidId = '123456789 01234567';
      expect(() => acquireRateLimitSlot(invalidId)).toThrow('Invalid user ID format');
    });

    it('should reject user ID with leading zeros that makes it look valid but has wrong length', async () => {
      // This tests the regex properly - leading zeros are valid
      const validWithZeros = '012345678901234567'; // 18 digits starting with 0
      const result = await acquireRateLimitSlot(validWithZeros);
      expect(result.allowed).toBe(true);
    });
  });

  describe('acquireRateLimitSlot', () => {
    const validUserId = '123456789012345678';

    it('should allow request when under rate limit', async () => {
      redisState.evalResult = [1, 'ok', 9]; // allowed, 9 remaining

      const result = await acquireRateLimitSlot(validUserId);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(result.reason).toBeUndefined();
    });

    it('should reject when AI helper is disabled', async () => {
      redisState.evalResult = [0, 'disabled', 0];

      const result = await acquireRateLimitSlot(validUserId);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('disabled');
    });

    it('should reject when user is in cooldown', async () => {
      redisState.evalResult = [0, 'cooldown', 5]; // 5 seconds remaining

      const result = await acquireRateLimitSlot(validUserId);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('cooldown');
      expect(result.resetInSeconds).toBe(5);
    });

    it('should reject when rate limit exceeded', async () => {
      redisState.evalResult = [0, 'rate_limit', 30]; // 30 seconds until reset

      const result = await acquireRateLimitSlot(validUserId);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('rate_limit');
      expect(result.remaining).toBe(0);
      expect(result.resetInSeconds).toBe(30);
    });

    it('should fail closed on Redis error', async () => {
      redisState.shouldThrow = true;

      const result = await acquireRateLimitSlot(validUserId);

      // Fail closed: deny request when Redis is unavailable
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('rate_limit');
    });

    it('should return undefined resetInSeconds when value is 0', async () => {
      redisState.evalResult = [0, 'rate_limit', 0];

      const result = await acquireRateLimitSlot(validUserId);

      expect(result.allowed).toBe(false);
      expect(result.resetInSeconds).toBeUndefined();
    });
  });

  describe('checkRateLimit (legacy)', () => {
    const validUserId = '123456789012345678';

    it('should return allowed when all checks pass', async () => {
      // No disabled flag, no cooldown, no rate limit
      const result = await checkRateLimit(validUserId);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10); // Default limit
    });

    it('should reject when globally disabled', async () => {
      redisState.data.set('ai_helper:disabled', '1');

      const result = await checkRateLimit(validUserId);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('disabled');
    });

    it('should reject when user is in cooldown', async () => {
      redisState.data.set(`ai_helper:cooldown:${validUserId}`, '1');
      redisState.ttls.set(`ai_helper:cooldown:${validUserId}`, 3);

      const result = await checkRateLimit(validUserId);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('cooldown');
      expect(result.resetInSeconds).toBe(3);
    });

    it('should reject when rate limit exceeded', async () => {
      redisState.data.set(`ai_helper:rate:${validUserId}`, '10'); // At limit
      redisState.ttls.set(`ai_helper:rate:${validUserId}`, 45);

      const result = await checkRateLimit(validUserId);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('rate_limit');
      expect(result.remaining).toBe(0);
      expect(result.resetInSeconds).toBe(45);
    });

    it('should fail closed on Redis error', async () => {
      redisState.shouldThrow = true;

      const result = await checkRateLimit(validUserId);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('disabled');
    });

    it('should validate user ID format', async () => {
      expect(() => checkRateLimit('invalid')).toThrow('Invalid user ID format');
    });
  });

  describe('isAiHelperDisabled', () => {
    it('should return true when disabled key is "1"', async () => {
      redisState.data.set('ai_helper:disabled', '1');

      const result = await isAiHelperDisabled();

      expect(result).toBe(true);
    });

    it('should return false when disabled key is not set', async () => {
      const result = await isAiHelperDisabled();

      expect(result).toBe(false);
    });

    it('should return false when disabled key has different value', async () => {
      redisState.data.set('ai_helper:disabled', '0');

      const result = await isAiHelperDisabled();

      expect(result).toBe(false);
    });

    it('should return true on Redis error (fail closed)', async () => {
      redisState.shouldThrow = true;

      const result = await isAiHelperDisabled();

      expect(result).toBe(true);
    });
  });

  describe('disableAiHelper', () => {
    it('should set disabled key to "1"', async () => {
      await disableAiHelper();

      expect(redisState.data.get('ai_helper:disabled')).toBe('1');
    });
  });

  describe('enableAiHelper', () => {
    it('should delete disabled key', async () => {
      redisState.data.set('ai_helper:disabled', '1');

      await enableAiHelper();

      expect(redisState.data.has('ai_helper:disabled')).toBe(false);
    });
  });

  describe('resetUserRateLimit', () => {
    const validUserId = '123456789012345678';

    it('should delete rate and cooldown keys', async () => {
      redisState.data.set(`ai_helper:rate:${validUserId}`, '5');
      redisState.data.set(`ai_helper:cooldown:${validUserId}`, '1');

      await resetUserRateLimit(validUserId);

      expect(redisState.data.has(`ai_helper:rate:${validUserId}`)).toBe(false);
      expect(redisState.data.has(`ai_helper:cooldown:${validUserId}`)).toBe(false);
    });

    it('should validate user ID format', async () => {
      expect(() => resetUserRateLimit('invalid')).toThrow('Invalid user ID format');
    });

    it('should handle non-existent keys gracefully', async () => {
      // Should not throw even if keys don't exist
      await expect(resetUserRateLimit(validUserId)).resolves.toBeUndefined();
    });
  });

  describe('getRateLimitStatus', () => {
    const validUserId = '123456789012345678';

    it('should return correct status with no usage', async () => {
      const status = await getRateLimitStatus(validUserId);

      expect(status.requestsUsed).toBe(0);
      expect(status.requestsLimit).toBe(10);
      expect(status.cooldownActive).toBe(false);
      expect(status.resetInSeconds).toBe(0);
    });

    it('should return correct status with partial usage', async () => {
      redisState.data.set(`ai_helper:rate:${validUserId}`, '3');
      redisState.ttls.set(`ai_helper:rate:${validUserId}`, 45);

      const status = await getRateLimitStatus(validUserId);

      expect(status.requestsUsed).toBe(3);
      expect(status.cooldownActive).toBe(false);
      expect(status.resetInSeconds).toBe(45);
    });

    it('should return correct status with active cooldown', async () => {
      redisState.data.set(`ai_helper:cooldown:${validUserId}`, '1');
      redisState.ttls.set(`ai_helper:cooldown:${validUserId}`, 3);

      const status = await getRateLimitStatus(validUserId);

      expect(status.cooldownActive).toBe(true);
    });

    it('should handle Redis error gracefully', async () => {
      redisState.shouldThrow = true;

      const status = await getRateLimitStatus(validUserId);

      expect(status.requestsUsed).toBe(0);
      expect(status.requestsLimit).toBe(10);
      expect(status.cooldownActive).toBe(false);
      expect(status.resetInSeconds).toBe(0);
    });

    it('should validate user ID format', async () => {
      expect(() => getRateLimitStatus('invalid')).toThrow('Invalid user ID format');
    });
  });
});
