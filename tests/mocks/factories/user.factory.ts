import type { User, TeafiRole } from '../../../src/db/schema';

let userCounter = 0;

/**
 * Creates a mock User object with all required fields.
 * Uses sensible defaults that can be overridden.
 */
export function createMockUser(overrides?: Partial<User>): User {
  userCounter++;
  const now = new Date();

  const defaultUser: User = {
    id: `user-${userCounter}`,
    discordId: `discord-${userCounter}`,

    // Role
    role: 'none' as TeafiRole,

    // Stats
    totalXp: 0,
    bonusXp: 0,
    worksCount: 0,

    // Ban
    isBanned: false,
    banReason: null,

    // Timestamps
    lastActivityAt: now,
    registeredAt: now,
    createdAt: now,
    updatedAt: now,
  };

  return { ...defaultUser, ...overrides };
}

/**
 * Creates a mock banned User.
 */
export function createMockBannedUser(reason?: string, overrides?: Partial<User>): User {
  return createMockUser({
    isBanned: true,
    banReason: reason ?? 'Test ban reason',
    ...overrides,
  });
}

/**
 * Creates a mock Sprout Leaf user.
 */
export function createSproutLeafUser(overrides?: Partial<User>): User {
  return createMockUser({
    role: 'sprout_leaf',
    totalXp: 300,
    ...overrides,
  });
}

/**
 * Creates a mock Green Leaf user.
 */
export function createGreenLeafUser(overrides?: Partial<User>): User {
  return createMockUser({
    role: 'green_leaf',
    totalXp: 800,
    ...overrides,
  });
}

/**
 * Creates a mock Golden Leaf user.
 */
export function createGoldenLeafUser(overrides?: Partial<User>): User {
  return createMockUser({
    role: 'golden_leaf',
    totalXp: 1500,
    ...overrides,
  });
}

/**
 * Resets the user counter for clean test isolation.
 */
export function resetUserFactory(): void {
  userCounter = 0;
}
