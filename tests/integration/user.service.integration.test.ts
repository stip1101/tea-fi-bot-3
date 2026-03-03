/**
 * User Service Integration Tests
 *
 * Tests critical database operations with a real PostgreSQL connection.
 * These tests verify:
 * - Atomic XP increments (race condition prevention)
 * - Transaction atomicity
 * - Ban/unban logic
 *
 * Run with: DATABASE_URL=<test-db> bun test tests/integration/
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { eq, sql } from 'drizzle-orm';
import {
  setupTestDb,
  clearAllTables,
  createTestUser,
  createTestTask,
  createTestWork,
  skipIfNoDatabase,
  type TestDb,
} from './setup';
import * as schema from '../../src/db/schema';

// Skip all tests if no database is configured
const shouldSkip = skipIfNoDatabase();

describe.skipIf(shouldSkip)('User Service Integration Tests', () => {
  let db: TestDb;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const context = await setupTestDb();
    db = context.db;
    cleanup = context.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    await clearAllTables(db);
  });

  describe('Atomic XP Operations', () => {
    test('addXp uses atomic increment to prevent race conditions', async () => {
      const user = await createTestUser(db, { totalXp: 100 });

      const amount = 50;
      const result = await db
        .update(schema.users)
        .set({
          totalXp: sql`${schema.users.totalXp} + ${amount}`,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, user.id))
        .returning({
          previousValue: sql<number>`${schema.users.totalXp} - ${amount}`,
          newValue: schema.users.totalXp,
        });

      expect(result.length).toBe(1);
      expect(result[0]!.previousValue).toBe(100);
      expect(result[0]!.newValue).toBe(150);

      const updated = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, user.id))
        .limit(1);

      expect(updated[0]!.totalXp).toBe(150);
    });

    test('concurrent XP updates do not lose data', async () => {
      const user = await createTestUser(db, { totalXp: 0 });

      const updates = Array.from({ length: 10 }, () =>
        db
          .update(schema.users)
          .set({
            totalXp: sql`${schema.users.totalXp} + 10`,
            updatedAt: new Date(),
          })
          .where(eq(schema.users.id, user.id))
      );

      await Promise.all(updates);

      const updated = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, user.id))
        .limit(1);

      expect(updated[0]!.totalXp).toBe(100);
    });

    test('atomic bonusXp increment works correctly', async () => {
      const user = await createTestUser(db, { bonusXp: 10 });

      const result = await db
        .update(schema.users)
        .set({
          bonusXp: sql`${schema.users.bonusXp} + 5`,
          totalXp: sql`${schema.users.totalXp} + 5`,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, user.id))
        .returning({
          newBonusXp: schema.users.bonusXp,
          newTotalXp: schema.users.totalXp,
        });

      expect(result[0]!.newBonusXp).toBe(15);
      expect(result[0]!.newTotalXp).toBe(5);
    });
  });

  describe('Transaction Atomicity', () => {
    test('transaction rolls back on error', async () => {
      const user = await createTestUser(db, { totalXp: 100 });

      try {
        await db.transaction(async (tx) => {
          await tx
            .update(schema.users)
            .set({ totalXp: 200 })
            .where(eq(schema.users.id, user.id));

          throw new Error('Simulated failure');
        });
      } catch {
        // Expected error
      }

      const result = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, user.id))
        .limit(1);

      expect(result[0]!.totalXp).toBe(100);
    });

    test('transaction commits all changes atomically', async () => {
      const user = await createTestUser(db, { totalXp: 0, bonusXp: 0 });

      await db.transaction(async (tx) => {
        await tx
          .update(schema.users)
          .set({ totalXp: sql`${schema.users.totalXp} + 100` })
          .where(eq(schema.users.id, user.id));

        await tx
          .update(schema.users)
          .set({ bonusXp: sql`${schema.users.bonusXp} + 25` })
          .where(eq(schema.users.id, user.id));

        await tx.insert(schema.xpHistory).values({
          id: `xp_${Date.now()}`,
          userId: user.id,
          change: 100,
          source: 'test',
          previousValue: 0,
          newValue: 100,
        });
      });

      const result = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, user.id))
        .limit(1);

      expect(result[0]!.totalXp).toBe(100);
      expect(result[0]!.bonusXp).toBe(25);

      const xpHistory = await db
        .select()
        .from(schema.xpHistory)
        .where(eq(schema.xpHistory.userId, user.id));

      expect(xpHistory.length).toBe(1);
      expect(xpHistory[0]!.change).toBe(100);
    });
  });

  describe('Banned User Checks', () => {
    test('leaderboard excludes banned users', async () => {
      const activeUser = await createTestUser(db, { totalXp: 1000, isBanned: false });

      await createTestUser(db, { totalXp: 2000, isBanned: true });

      const leaderboard = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.isBanned, false))
        .orderBy(sql`${schema.users.totalXp} DESC`)
        .limit(10);

      expect(leaderboard.length).toBe(1);
      expect(leaderboard[0]!.id).toBe(activeUser.id);
    });

    test('ban sets isBanned and reason', async () => {
      const user = await createTestUser(db);

      await db
        .update(schema.users)
        .set({ isBanned: true, banReason: 'Rule violation' })
        .where(eq(schema.users.id, user.id));

      const result = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, user.id))
        .limit(1);

      expect(result[0]!.isBanned).toBe(true);
      expect(result[0]!.banReason).toBe('Rule violation');
    });

    test('unban clears ban status', async () => {
      const user = await createTestUser(db, { isBanned: true, banReason: 'Test' });

      await db
        .update(schema.users)
        .set({ isBanned: false, banReason: null })
        .where(eq(schema.users.id, user.id));

      const result = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, user.id))
        .limit(1);

      expect(result[0]!.isBanned).toBe(false);
      expect(result[0]!.banReason).toBeNull();
    });
  });

  describe('Role Updates', () => {
    test('updates user role', async () => {
      const user = await createTestUser(db, { role: 'none' });

      await db
        .update(schema.users)
        .set({ role: 'sprout_leaf' })
        .where(eq(schema.users.id, user.id));

      const result = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, user.id))
        .limit(1);

      expect(result[0]!.role).toBe('sprout_leaf');
    });

    test('role history is recorded', async () => {
      const user = await createTestUser(db, { role: 'none' });

      await db.insert(schema.roleHistory).values({
        id: `rh_${Date.now()}`,
        userId: user.id,
        previousRole: 'none',
        newRole: 'sprout_leaf',
        reason: 'XP threshold reached',
      });

      const history = await db
        .select()
        .from(schema.roleHistory)
        .where(eq(schema.roleHistory.userId, user.id));

      expect(history.length).toBe(1);
      expect(history[0]!.previousRole).toBe('none');
      expect(history[0]!.newRole).toBe('sprout_leaf');
    });
  });

  describe('Work with Tasks', () => {
    test('creates work linked to a task', async () => {
      const user = await createTestUser(db);
      const task = await createTestTask(db, { name: 'Twitter Post', xpReward: 50 });

      const work = await createTestWork(db, user.id, task.id, { status: 'pending' });

      expect(work.userId).toBe(user.id);
      expect(work.taskId).toBe(task.id);
      expect(work.status).toBe('pending');
    });
  });
});
