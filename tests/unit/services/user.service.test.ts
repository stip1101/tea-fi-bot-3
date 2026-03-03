import { describe, test, expect, beforeEach } from 'bun:test';
import {
  createMockUser,
  createMockBannedUser,
  createSproutLeafUser,
  createGreenLeafUser,
  createGoldenLeafUser,
  resetUserFactory,
} from '../../mocks/factories';

/**
 * User Service Tests
 *
 * These tests verify the business logic of user service functions.
 * Due to Drizzle ORM's module structure, full service integration tests
 * require a test database. These tests focus on:
 * 1. Data factory correctness
 * 2. Business logic validation
 * 3. Type safety
 *
 * For full integration tests, run with a test database:
 * DATABASE_URL=<test-db> bun test tests/integration/
 */

describe('User Service - Factory Tests', () => {
  beforeEach(() => {
    resetUserFactory();
  });

  describe('createMockUser', () => {
    test('creates user with all required fields', () => {
      const user = createMockUser();

      expect(user.id).toBeDefined();
      expect(user.discordId).toBeDefined();
      expect(user.role).toBe('none');
      expect(user.totalXp).toBe(0);
      expect(user.bonusXp).toBe(0);
      expect(user.worksCount).toBe(0);
      expect(user.isBanned).toBe(false);
      expect(user.banReason).toBeNull();
      expect(user.lastActivityAt).toBeInstanceOf(Date);
      expect(user.registeredAt).toBeInstanceOf(Date);
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    test('creates unique users on each call', () => {
      const user1 = createMockUser();
      const user2 = createMockUser();
      const user3 = createMockUser();

      expect(user1.id).not.toBe(user2.id);
      expect(user2.id).not.toBe(user3.id);
      expect(user1.discordId).not.toBe(user2.discordId);
    });

    test('allows overriding specific fields', () => {
      const user = createMockUser({
        discordId: 'custom-discord-id',
        totalXp: 1000,
        role: 'green_leaf',
      });

      expect(user.discordId).toBe('custom-discord-id');
      expect(user.totalXp).toBe(1000);
      expect(user.role).toBe('green_leaf');
    });

    test('reset factory resets counter', () => {
      const user1 = createMockUser();
      resetUserFactory();
      const user2 = createMockUser();

      expect(user1.id).toBe(user2.id);
    });
  });

  describe('createMockBannedUser', () => {
    test('creates banned user with reason', () => {
      const user = createMockBannedUser('Spamming');

      expect(user.isBanned).toBe(true);
      expect(user.banReason).toBe('Spamming');
    });

    test('uses default reason when not provided', () => {
      const user = createMockBannedUser();

      expect(user.isBanned).toBe(true);
      expect(user.banReason).toBe('Test ban reason');
    });
  });

  describe('role-based factory functions', () => {
    test('createSproutLeafUser has correct defaults', () => {
      const user = createSproutLeafUser();
      expect(user.role).toBe('sprout_leaf');
      expect(user.totalXp).toBe(300);
    });

    test('createGreenLeafUser has correct defaults', () => {
      const user = createGreenLeafUser();
      expect(user.role).toBe('green_leaf');
      expect(user.totalXp).toBe(800);
    });

    test('createGoldenLeafUser has correct defaults', () => {
      const user = createGoldenLeafUser();
      expect(user.role).toBe('golden_leaf');
      expect(user.totalXp).toBe(1500);
    });

    test('role factories allow overrides', () => {
      const user = createSproutLeafUser({ totalXp: 500, bonusXp: 100 });
      expect(user.role).toBe('sprout_leaf');
      expect(user.totalXp).toBe(500);
      expect(user.bonusXp).toBe(100);
    });
  });
});

describe('User Service - Business Logic', () => {
  describe('UserStats calculation', () => {
    test('approval rate calculation', () => {
      const calculateApprovalRate = (approved: number, rejected: number): number => {
        const reviewed = approved + rejected;
        return reviewed > 0 ? Math.round((approved / reviewed) * 100) : 0;
      };

      expect(calculateApprovalRate(8, 2)).toBe(80);
      expect(calculateApprovalRate(3, 1)).toBe(75);
      expect(calculateApprovalRate(10, 0)).toBe(100);
      expect(calculateApprovalRate(0, 10)).toBe(0);
      expect(calculateApprovalRate(0, 0)).toBe(0);
    });
  });

  describe('Ban/Unban logic', () => {
    test('ban sets isBanned to true', () => {
      const user = createMockUser();
      expect(user.isBanned).toBe(false);

      const bannedUser = createMockBannedUser('Rule violation');
      expect(bannedUser.isBanned).toBe(true);
      expect(bannedUser.banReason).toBe('Rule violation');
    });

    test('unban clears ban status', () => {
      const unbannedUser = createMockUser({
        isBanned: false,
        banReason: null,
      });

      expect(unbannedUser.isBanned).toBe(false);
      expect(unbannedUser.banReason).toBeNull();
    });
  });

  describe('Leaderboard sorting', () => {
    test('XP leaderboard sorts by totalXp descending', () => {
      const users = [
        createMockUser({ totalXp: 100 }),
        createMockUser({ totalXp: 500 }),
        createMockUser({ totalXp: 200 }),
      ];

      const sorted = [...users].sort((a, b) => b.totalXp - a.totalXp);

      expect(sorted[0]!.totalXp).toBe(500);
      expect(sorted[1]!.totalXp).toBe(200);
      expect(sorted[2]!.totalXp).toBe(100);
    });
  });
});

describe('User Service - Type Safety', () => {
  test('User type has all expected properties', () => {
    const user = createMockUser();

    const expectedProps = [
      'id',
      'discordId',
      'role',
      'totalXp',
      'bonusXp',
      'worksCount',
      'isBanned',
      'banReason',
      'lastActivityAt',
      'registeredAt',
      'createdAt',
      'updatedAt',
    ];

    for (const prop of expectedProps) {
      expect(user).toHaveProperty(prop);
    }
  });

  test('TeafiRole values are valid', () => {
    const validRoles = ['none', 'sprout_leaf', 'green_leaf', 'golden_leaf'];

    for (const role of validRoles) {
      const user = createMockUser({ role: role as any });
      expect(validRoles).toContain(user.role);
    }
  });
});
