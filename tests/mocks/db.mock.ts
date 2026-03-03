import { mock } from 'bun:test';

/**
 * Mock data storage for simulating database operations.
 * Each table is stored as a Map with ID as key.
 */
interface MockStore {
  users: Map<string, any>;
  works: Map<string, any>;
  twitterMetrics: Map<string, any>;
  xpHistory: Map<string, any>;
  reputations: Map<string, any>;
  levelHistory: Map<string, any>;
}

let mockStore: MockStore = createEmptyStore();
let mockQueryResult: any[] = [];
let mockInsertResult: any[] = [];
let currentTable: keyof MockStore | null = null;

function createEmptyStore(): MockStore {
  return {
    users: new Map(),
    works: new Map(),
    twitterMetrics: new Map(),
    xpHistory: new Map(),
    reputations: new Map(),
    levelHistory: new Map(),
  };
}

/**
 * Set the data that will be returned by the next select query.
 */
export function setMockQueryResult(result: any[]): void {
  mockQueryResult = result;
}

/**
 * Set the data that will be returned by the next insert.
 */
export function setMockInsertResult(result: any[]): void {
  mockInsertResult = result;
}

/**
 * Add data to the mock store for a specific table.
 */
export function addToMockStore(table: keyof MockStore, id: string, data: any): void {
  mockStore[table].set(id, { ...data, id });
}

/**
 * Get data from the mock store.
 */
export function getFromMockStore(table: keyof MockStore, id: string): any | undefined {
  return mockStore[table].get(id);
}

/**
 * Get all data from a table.
 */
export function getAllFromMockStore(table: keyof MockStore): any[] {
  return Array.from(mockStore[table].values());
}

/**
 * Clear all mock data and reset state.
 */
export function clearMockStore(): void {
  mockStore = createEmptyStore();
  mockQueryResult = [];
  mockInsertResult = [];
  currentTable = null;
}

/**
 * Evaluate a condition against a row.
 * Supports basic eq, and, gte, lte operations.
 */
function evaluateCondition(row: any, condition: any): boolean {
  if (!condition) return true;

  // Handle raw SQL conditions (simplified - always true for now)
  if (condition.queryChunks || condition.sql) {
    return true;
  }

  // Handle eq condition: { type: 'eq', left: { name: 'fieldName' }, right: value }
  if (condition.type === 'eq' || condition.operator === '=') {
    const fieldName = condition.left?.name || condition.leftColumn?.name;
    const value = condition.right;
    if (fieldName && row[fieldName] !== undefined) {
      return row[fieldName] === value;
    }
  }

  // Handle and condition: { type: 'and', conditions: [...] }
  if (condition.type === 'and' || Array.isArray(condition)) {
    const conditions = condition.conditions || condition;
    return conditions.every((c: any) => evaluateCondition(row, c));
  }

  // Handle gte condition
  if (condition.type === 'gte' || condition.operator === '>=') {
    const fieldName = condition.left?.name || condition.leftColumn?.name;
    const value = condition.right;
    if (fieldName && row[fieldName] !== undefined) {
      return row[fieldName] >= value;
    }
  }

  // Handle lte condition
  if (condition.type === 'lte' || condition.operator === '<=') {
    const fieldName = condition.left?.name || condition.leftColumn?.name;
    const value = condition.right;
    if (fieldName && row[fieldName] !== undefined) {
      return row[fieldName] <= value;
    }
  }

  // Default: if we can't parse the condition, return true (lenient mode)
  return true;
}

/**
 * Get table name from Drizzle table object.
 */
function getTableName(table: any): keyof MockStore | null {
  // Table objects have different structures depending on how they're created
  const name =
    table?.['_']?.name ||
    table?._.name ||
    table?.[Symbol.for('drizzle:Name')] ||
    table?.name ||
    null;

  // Map SQL table names to our store keys
  const tableMap: Record<string, keyof MockStore> = {
    users: 'users',
    works: 'works',
    twitter_metrics: 'twitterMetrics',
    xp_history: 'xpHistory',
    reputations: 'reputations',
    level_history: 'levelHistory',
  };

  return tableMap[name as string] || null;
}

/**
 * Create a chainable query builder that mimics Drizzle's API.
 * Now supports actual filtering via where() conditions.
 */
function createQueryBuilder() {
  let queryTable: keyof MockStore | null = null;
  let whereCondition: any = null;
  let limitValue: number | null = null;

  const getFilteredResults = (): any[] => {
    // If explicit mockQueryResult is set, use it
    if (mockQueryResult.length > 0) {
      let results = [...mockQueryResult];
      if (whereCondition) {
        results = results.filter((row) => evaluateCondition(row, whereCondition));
      }
      if (limitValue !== null) {
        results = results.slice(0, limitValue);
      }
      return results;
    }

    // Otherwise, query from mock store
    if (queryTable && mockStore[queryTable]) {
      let results = Array.from(mockStore[queryTable].values());
      if (whereCondition) {
        results = results.filter((row) => evaluateCondition(row, whereCondition));
      }
      if (limitValue !== null) {
        results = results.slice(0, limitValue);
      }
      return results;
    }

    return [];
  };

  const builder = {
    select: () => builder,
    from: (table: any) => {
      queryTable = getTableName(table) || currentTable;
      return builder;
    },
    where: (condition: any) => {
      whereCondition = condition;
      return builder;
    },
    limit: (n: number) => {
      limitValue = n;
      return builder;
    },
    offset: () => builder,
    orderBy: () => builder,
    groupBy: () => builder,
    having: () => builder,
    leftJoin: () => builder,
    innerJoin: () => builder,
    then: (resolve: (value: any[]) => void) => {
      const results = getFilteredResults();
      resolve(results);
      return Promise.resolve(results);
    },
    [Symbol.toStringTag]: 'Promise',
  };

  // Make it thenable for async/await
  Object.defineProperty(builder, 'then', {
    value: (resolve: (value: any[]) => void, reject?: (reason: any) => void) => {
      const results = getFilteredResults();
      return Promise.resolve(results).then(resolve, reject);
    },
  });

  return builder;
}

/**
 * Create a chainable insert builder.
 */
function createInsertBuilder(table?: any) {
  const insertTable = getTableName(table);

  const builder = {
    values: (data: any) => {
      const items = Array.isArray(data) ? data : [data];
      mockInsertResult = items;

      // Actually store in mock store
      if (insertTable) {
        for (const item of items) {
          if (item.id) {
            mockStore[insertTable].set(item.id, item);
          }
        }
      }

      return builder;
    },
    returning: () => builder,
    onConflictDoNothing: () => builder,
    onConflictDoUpdate: () => builder,
    then: (resolve: (value: any[]) => void) => {
      resolve(mockInsertResult);
      return Promise.resolve(mockInsertResult);
    },
  };

  Object.defineProperty(builder, 'then', {
    value: (resolve: (value: any[]) => void, reject?: (reason: any) => void) => {
      return Promise.resolve(mockInsertResult).then(resolve, reject);
    },
  });

  return builder;
}

/**
 * Create a chainable update builder.
 * Now supports filtering and actual store updates.
 */
function createUpdateBuilder(table?: any) {
  const updateTable = getTableName(table);
  let updateData: any = {};
  let whereCondition: any = null;

  const getUpdatedResults = (): any[] => {
    // If explicit mockInsertResult is set, use it as base
    if (mockInsertResult.length > 0) {
      return mockInsertResult.map((item) => ({ ...item, ...updateData }));
    }

    // If explicit mockQueryResult is set for returning
    if (mockQueryResult.length > 0) {
      let results = [...mockQueryResult];
      if (whereCondition) {
        results = results.filter((row) => evaluateCondition(row, whereCondition));
      }
      return results.map((item) => ({ ...item, ...updateData }));
    }

    // Otherwise, update in mock store
    if (updateTable && mockStore[updateTable]) {
      const results: any[] = [];
      mockStore[updateTable].forEach((item, id) => {
        if (!whereCondition || evaluateCondition(item, whereCondition)) {
          const updated = { ...item, ...updateData };
          mockStore[updateTable].set(id, updated);
          results.push(updated);
        }
      });
      return results;
    }

    return [];
  };

  const builder = {
    set: (data: any) => {
      updateData = data;
      return builder;
    },
    where: (condition: any) => {
      whereCondition = condition;
      return builder;
    },
    returning: (fields?: any) => builder,
    then: (resolve: (value: any[]) => void) => {
      const result = getUpdatedResults();
      resolve(result);
      return Promise.resolve(result);
    },
  };

  Object.defineProperty(builder, 'then', {
    value: (resolve: (value: any[]) => void, reject?: (reason: any) => void) => {
      const result = getUpdatedResults();
      return Promise.resolve(result).then(resolve, reject);
    },
  });

  return builder;
}

/**
 * Create a chainable delete builder.
 */
function createDeleteBuilder(table?: any) {
  const deleteTable = getTableName(table);
  let whereCondition: any = null;

  const builder = {
    where: (condition: any) => {
      whereCondition = condition;
      return builder;
    },
    returning: () => builder,
    then: (resolve: (value: any[]) => void) => {
      const deleted: any[] = [];

      if (deleteTable && mockStore[deleteTable]) {
        mockStore[deleteTable].forEach((item, id) => {
          if (!whereCondition || evaluateCondition(item, whereCondition)) {
            deleted.push(item);
            mockStore[deleteTable].delete(id);
          }
        });
      }

      resolve(deleted.length > 0 ? deleted : mockQueryResult);
      return Promise.resolve(deleted.length > 0 ? deleted : mockQueryResult);
    },
  };

  Object.defineProperty(builder, 'then', {
    value: (resolve: (value: any[]) => void, reject?: (reason: any) => void) => {
      const deleted: any[] = [];

      if (deleteTable && mockStore[deleteTable]) {
        mockStore[deleteTable].forEach((item, id) => {
          if (!whereCondition || evaluateCondition(item, whereCondition)) {
            deleted.push(item);
            mockStore[deleteTable].delete(id);
          }
        });
      }

      return Promise.resolve(deleted.length > 0 ? deleted : mockQueryResult).then(resolve, reject);
    },
  });

  return builder;
}

/**
 * Create a transaction mock that executes all operations atomically.
 */
async function mockTransaction<T>(callback: (tx: typeof mockDb) => Promise<T>): Promise<T> {
  // Store current state for rollback on error
  const snapshot = {
    users: new Map(mockStore.users),
    works: new Map(mockStore.works),
    twitterMetrics: new Map(mockStore.twitterMetrics),
    xpHistory: new Map(mockStore.xpHistory),
    reputations: new Map(mockStore.reputations),
    levelHistory: new Map(mockStore.levelHistory),
  };

  try {
    return await callback(mockDb);
  } catch (error) {
    // Rollback on error
    mockStore = snapshot;
    throw error;
  }
}

/**
 * Mock database object that mimics Drizzle ORM's API.
 */
export const mockDb = {
  select: (fields?: any) => createQueryBuilder(),
  insert: (table: any) => createInsertBuilder(table),
  update: (table: any) => createUpdateBuilder(table),
  delete: (table: any) => createDeleteBuilder(table),
  execute: async (sql: any) => mockQueryResult,
  transaction: mockTransaction,
  query: new Proxy(
    {},
    {
      get: () => ({
        findFirst: async () => mockQueryResult[0] ?? null,
        findMany: async () => mockQueryResult,
      }),
    }
  ),
};

/**
 * Setup the database mock module.
 * Call this before importing any service that uses the database.
 */
export function setupDbMock(): void {
  mock.module('../../../src/db/index', () => ({
    db: mockDb,
    users: { _: { name: 'users' } },
    works: { _: { name: 'works' } },
    twitterMetrics: { _: { name: 'twitter_metrics' } },
    xpHistory: { _: { name: 'xp_history' } },
    reputations: { _: { name: 'reputations' } },
    levelHistory: { _: { name: 'level_history' } },
  }));
}
