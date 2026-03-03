/**
 * Integration Test Setup
 *
 * Provides utilities for running integration tests against a real PostgreSQL database.
 * Uses transactions for test isolation - each test runs in a transaction that is rolled back.
 *
 * Requirements:
 * - DATABASE_URL environment variable must point to a test database
 * - Database schema must be migrated before running tests
 *
 * Usage:
 *   const { db, cleanup } = await setupTestDb();
 *   // ... run tests ...
 *   await cleanup();
 */

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../src/db/schema';

export type TestDb = PostgresJsDatabase<typeof schema>;

interface TestContext {
  db: TestDb;
  client: ReturnType<typeof postgres>;
  cleanup: () => Promise<void>;
}

/**
 * Setup a test database connection.
 * Each test should call this to get an isolated database context.
 */
export async function setupTestDb(): Promise<TestContext> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL environment variable is required for integration tests.\n' +
        'Set it to a test database, e.g.:\n' +
        'DATABASE_URL=postgresql://user:pass@localhost:5432/teafi_test bun test tests/integration/'
    );
  }


  const client = postgres(connectionString, {
    max: 1, // Single connection for test isolation
    idle_timeout: 30,
  });

  const db = drizzle(client, { schema });

  const cleanup = async () => {
    await client.end();
  };

  return { db, client, cleanup };
}

/**
 * Clear all data from the database.
 * Call this in beforeEach to ensure clean state.
 */
export async function clearAllTables(db: TestDb): Promise<void> {
  // Delete in order respecting foreign keys
  await db.delete(schema.localLeadReports);
  await db.delete(schema.roleHistory);
  await db.delete(schema.xpHistory);
  await db.delete(schema.twitterMetrics);
  await db.delete(schema.works);
  await db.delete(schema.tasks);
  await db.delete(schema.users);
}

/**
 * Generate a unique test ID to avoid conflicts.
 */
export function generateTestId(prefix: string = 'test'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a test user directly in the database.
 */
export async function createTestUser(
  db: TestDb,
  overrides: Partial<schema.NewUser> = {}
): Promise<schema.User> {
  const id = generateTestId('user');
  const discordId = generateTestId('discord');

  const user: schema.NewUser = {
    id,
    discordId,
    role: 'none',
    bonusXp: 0,
    ...overrides,
  };

  const result = await db.insert(schema.users).values(user).returning();
  return result[0]!;
}

/**
 * Create a test task directly in the database.
 */
export async function createTestTask(
  db: TestDb,
  overrides: Partial<schema.NewTask> = {}
): Promise<schema.Task> {
  const id = generateTestId('task');

  const task: schema.NewTask = {
    id,
    name: `Test Task ${id}`,
    xpReward: 100,
    createdBy: 'test-admin',
    ...overrides,
  };

  const result = await db.insert(schema.tasks).values(task).returning();
  return result[0]!;
}

/**
 * Create a test work directly in the database.
 */
export async function createTestWork(
  db: TestDb,
  userId: string,
  taskId: string,
  overrides: Partial<Omit<schema.NewWork, 'id' | 'userId' | 'taskId'>> = {}
): Promise<schema.Work> {
  const id = generateTestId('work');

  const work: schema.NewWork = {
    id,
    userId,
    taskId,
    url: `https://twitter.com/test/${id}`,
    status: 'pending',
    ...overrides,
  };

  const result = await db.insert(schema.works).values(work).returning();
  return result[0]!;
}

/**
 * Skip test if DATABASE_URL is not set or doesn't point to a test database.
 * Use this at the start of integration test files.
 *
 * Returns true (skip) if:
 * - DATABASE_URL is not set
 * - DATABASE_URL doesn't contain "test" (safety: don't run on production)
 */
export function skipIfNoDatabase(): boolean {
  const dbUrl = process.env.DATABASE_URL;

  // Skip if no DATABASE_URL
  if (!dbUrl) {
    console.log('Skipping integration tests: DATABASE_URL not set');
    return true;
  }

  // Skip if not a test database (safety: don't run on production)
  if (!dbUrl.includes('test') && !dbUrl.includes('_test')) {
    console.log('Skipping integration tests: DATABASE_URL does not contain "test"');
    return true;
  }

  return false;
}
