import { eq, and, gte, lt, sql, ne } from 'drizzle-orm';
import { db, users, xpHistory, type TeafiRole } from '../db';
import { ROLE_CONFIG } from '../config/roles';
import { XP_SOURCES } from '../config/constants';
import { getMonthlyPool } from '../config';

export interface UserRewardData {
  userId: string;
  discordId: string;
  role: TeafiRole;
  monthlyXp: number;
  multiplier: number;
  weightedXp: number;
  reward: number;
}

export interface MonthlyRewardsResult {
  monthYear: string;
  pool: number;
  pointPrice: number;
  totalWeightedXp: number;
  users: UserRewardData[];
}

function getMonthBounds(monthYear?: string): { start: Date; end: Date } {
  const now = new Date();
  let year: number;
  let month: number;

  if (monthYear) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthYear)) {
      throw new Error(`Invalid month format: "${monthYear}". Expected YYYY-MM.`);
    }
    [year, month] = monthYear.split('-').map(Number) as [number, number];
  } else {
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return { start, end };
}

export function getCurrentMonthYear(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function calculateMonthlyRewards(monthYear?: string): Promise<MonthlyRewardsResult> {
  const resolvedMonth = monthYear || getCurrentMonthYear();
  const { start, end } = getMonthBounds(resolvedMonth);
  const pool = getMonthlyPool();

  // Get all non-banned users with a role (exclude 'none')
  const eligibleUsers = await db
    .select()
    .from(users)
    .where(and(eq(users.isBanned, false), ne(users.role, 'none')));

  // Batch fetch monthly XP for all users in a single query
  const monthlyXpData = await db
    .select({
      userId: xpHistory.userId,
      total: sql<number>`COALESCE(sum(${xpHistory.change}), 0)::int`,
    })
    .from(xpHistory)
    .where(
      and(
        gte(xpHistory.createdAt, start),
        lt(xpHistory.createdAt, end),
        sql`${xpHistory.source} IN (${XP_SOURCES.WORK_APPROVED}, ${XP_SOURCES.BONUS})`
      )
    )
    .groupBy(xpHistory.userId);

  const xpMap = new Map(monthlyXpData.map((r) => [r.userId, r.total]));

  const usersWithMonthlyXp: UserRewardData[] = [];

  for (const user of eligibleUsers) {
    const monthlyXp = xpMap.get(user.id) ?? 0;
    if (monthlyXp <= 0) continue;

    const role = user.role as TeafiRole;
    const multiplier = ROLE_CONFIG[role].multiplier;
    const weightedXp = monthlyXp * multiplier;

    usersWithMonthlyXp.push({
      userId: user.id,
      discordId: user.discordId,
      role,
      monthlyXp,
      multiplier,
      weightedXp,
      reward: 0,
    });
  }

  // Calculate total weighted XP and point price
  const totalWeightedXp = usersWithMonthlyXp.reduce((sum, u) => sum + u.weightedXp, 0);
  const pointPrice = totalWeightedXp > 0 ? pool / totalWeightedXp : 0;

  // Calculate rewards
  for (const user of usersWithMonthlyXp) {
    user.reward = Math.round(user.weightedXp * pointPrice * 100) / 100;
  }

  // Sort by reward descending
  usersWithMonthlyXp.sort((a, b) => b.reward - a.reward);

  return {
    monthYear: resolvedMonth,
    pool,
    pointPrice: Math.round(pointPrice * 10000) / 10000,
    totalWeightedXp: Math.round(totalWeightedXp),
    users: usersWithMonthlyXp,
  };
}

export async function getUserMonthlyXp(userId: string, monthYear?: string): Promise<number> {
  const resolvedMonth = monthYear || getCurrentMonthYear();
  const { start, end } = getMonthBounds(resolvedMonth);

  const result = await db
    .select({ total: sql<number>`COALESCE(sum(${xpHistory.change}), 0)::int` })
    .from(xpHistory)
    .where(
      and(
        eq(xpHistory.userId, userId),
        gte(xpHistory.createdAt, start),
        lt(xpHistory.createdAt, end),
        sql`${xpHistory.source} IN (${XP_SOURCES.WORK_APPROVED}, ${XP_SOURCES.BONUS})`
      )
    );

  return result[0]?.total ?? 0;
}
