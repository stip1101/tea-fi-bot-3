import { redis } from './index';
import type { User } from '../db/schema';
import { stateLogger } from '../utils/logger';

const CACHE_TTL = {
  USER_PROFILE: 60,
  LEADERBOARD: 120,
  PENDING_COUNT: 30,
};

function safeJsonParse<T>(data: string | null): T | null {
  if (!data) return null;
  try {
    return JSON.parse(data) as T;
  } catch (error) {
    stateLogger.error({ err: error }, 'JSON parse error in cache');
    return null;
  }
}

export async function getCachedUser(discordId: string): Promise<User | null> {
  const cached = await redis.get(`user:${discordId}`);
  return safeJsonParse<User>(cached);
}

export async function setCachedUser(discordId: string, user: User): Promise<void> {
  await redis.setex(`user:${discordId}`, CACHE_TTL.USER_PROFILE, JSON.stringify(user));
}

export async function invalidateUserCache(discordId: string): Promise<void> {
  await redis.del(`user:${discordId}`);
}

export async function getCachedLeaderboard(): Promise<User[] | null> {
  const cached = await redis.get('leaderboard:xp');
  return safeJsonParse<User[]>(cached);
}

export async function setCachedLeaderboard(data: User[]): Promise<void> {
  await redis.setex('leaderboard:xp', CACHE_TTL.LEADERBOARD, JSON.stringify(data));
}

export async function invalidateLeaderboardCache(): Promise<void> {
  await redis.del('leaderboard:xp');
}

export async function getCachedPendingCount(): Promise<number | null> {
  const cached = await redis.get('pending_count');
  return cached ? parseInt(cached, 10) : null;
}

export async function setCachedPendingCount(count: number): Promise<void> {
  await redis.setex('pending_count', CACHE_TTL.PENDING_COUNT, count.toString());
}

export async function invalidatePendingCount(): Promise<void> {
  await redis.del('pending_count');
}
