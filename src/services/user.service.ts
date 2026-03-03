import { eq, sql, desc } from 'drizzle-orm';
import { db, users, works, type User } from '../db';
import { generateId } from '../utils/id';
import { InsufficientXpError } from '../errors';

function mapUserRow(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    discordId: row.discord_id as string,
    role: row.role as User['role'],
    totalXp: row.total_xp as number,
    bonusXp: row.bonus_xp as number,
    worksCount: row.works_count as number,
    isBanned: row.is_banned as boolean,
    banReason: row.ban_reason as string | null,
    lastActivityAt: row.last_activity_at ? new Date(row.last_activity_at as string) : new Date(),
    registeredAt: new Date(row.registered_at as string),
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export interface UserStats {
  totalWorks: number;
  approvedWorks: number;
  rejectedWorks: number;
  pendingWorks: number;
  approvalRate: number;
  avgQualityScore: number;
}

export async function getUserByDiscordId(discordId: string): Promise<User | null> {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.discordId, discordId))
    .limit(1);

  return result[0] ?? null;
}

export async function getUserById(id: string): Promise<User | null> {
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createUser(discordId: string): Promise<User> {
  const id = generateId();

  const result = await db
    .insert(users)
    .values({ id, discordId })
    .returning();

  if (!result[0]) throw new Error('Failed to create user');
  return result[0];
}

export async function updateUser(
  id: string,
  data: Partial<Pick<User, 'isBanned' | 'banReason'>>
): Promise<User | null> {
  const result = await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();

  return result[0] ?? null;
}

export async function updateUserActivity(id: string): Promise<void> {
  await db
    .update(users)
    .set({ lastActivityAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, id));
}

export async function getUserStats(userId: string): Promise<UserStats> {
  const result = await db.execute(sql`
    SELECT
      COUNT(*)::int as total_works,
      COUNT(*) FILTER (WHERE status = 'approved')::int as approved_works,
      COUNT(*) FILTER (WHERE status = 'rejected')::int as rejected_works,
      COUNT(*) FILTER (WHERE status = 'pending')::int as pending_works,
      COALESCE(AVG(quality_score) FILTER (WHERE quality_score IS NOT NULL)::int, 0) as avg_quality
    FROM works
    WHERE user_id = ${userId}
  `);

  const row = result[0] as {
    total_works: number;
    approved_works: number;
    rejected_works: number;
    pending_works: number;
    avg_quality: number;
  } | undefined;

  const approvedWorks = row?.approved_works ?? 0;
  const rejectedWorks = row?.rejected_works ?? 0;
  const reviewed = approvedWorks + rejectedWorks;

  return {
    totalWorks: row?.total_works ?? 0,
    approvedWorks,
    rejectedWorks,
    pendingWorks: row?.pending_works ?? 0,
    approvalRate: reviewed > 0 ? Math.round((approvedWorks / reviewed) * 100) : 0,
    avgQualityScore: row?.avg_quality ?? 0,
  };
}

export async function addXp(
  userId: string,
  amount: number,
  source: string,
  workId?: string,
  notes?: string
): Promise<number> {
  if (amount < 0) {
    const user = await getUserById(userId);
    if (!user) throw new Error('User not found');
    const newTotal = user.totalXp + amount;
    if (newTotal < 0) {
      throw new InsufficientXpError(userId, user.totalXp, Math.abs(amount));
    }
  }

  const { xpHistory } = await import('../db/schema');

  return await db.transaction(async (tx) => {
    const result = await tx
      .update(users)
      .set({
        totalXp: sql`GREATEST(0, ${users.totalXp} + ${amount})`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({ previousValue: sql<number>`${users.totalXp} - ${amount}`, newValue: users.totalXp });

    if (!result[0]) throw new Error('User not found');

    const { previousValue, newValue } = result[0];

    await tx.insert(xpHistory).values({
      id: generateId(),
      userId,
      change: amount,
      source,
      previousValue,
      newValue,
      workId,
      notes,
    });

    return newValue;
  });
}

export async function getLeaderboard(
  limit: number = 10,
  offset: number = 0
): Promise<{ users: User[]; total: number }> {
  const [usersResult, countResult] = await Promise.all([
    db
      .select()
      .from(users)
      .where(eq(users.isBanned, false))
      .orderBy(desc(users.totalXp))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.isBanned, false)),
  ]);

  return {
    users: usersResult,
    total: countResult[0]?.count ?? 0,
  };
}

export async function banUser(userId: string, reason?: string): Promise<void> {
  await db
    .update(users)
    .set({ isBanned: true, banReason: reason, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function unbanUser(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ isBanned: false, banReason: null, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export interface TopPerformerData extends User {
  totalWorks: number;
  approvalRate: number;
}

export async function getTopPerformers(
  limit: number,
  offset: number
): Promise<{ users: TopPerformerData[]; total: number }> {
  const [performersResult, countResult] = await Promise.all([
    db.execute<{
      id: string; discord_id: string; role: string; total_xp: number; bonus_xp: number;
      works_count: number; is_banned: boolean; ban_reason: string | null;
      last_activity_at: Date | null; registered_at: Date; created_at: Date; updated_at: Date;
      total_works: number; approved_works: number; rejected_works: number;
    }>(sql`
      SELECT u.*,
        COUNT(w.id)::int AS total_works,
        COUNT(w.id) FILTER (WHERE w.status = 'approved')::int AS approved_works,
        COUNT(w.id) FILTER (WHERE w.status = 'rejected')::int AS rejected_works
      FROM users u
      LEFT JOIN works w ON w.user_id = u.id
      WHERE u.is_banned = false
      GROUP BY u.id
      ORDER BY u.total_xp DESC
      LIMIT ${limit} OFFSET ${offset}
    `),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.isBanned, false)),
  ]);

  const performers: TopPerformerData[] = performersResult.map((row) => {
    const reviewed = row.approved_works + row.rejected_works;
    return {
      ...mapUserRow(row),
      totalWorks: row.total_works,
      approvalRate: reviewed > 0 ? Math.round((row.approved_works / reviewed) * 100) : 0,
    };
  });

  return {
    users: performers,
    total: countResult[0]?.count ?? 0,
  };
}

export interface ProblemUsersData {
  lowApproval: Array<User & { approvalRate: number; totalWorks: number }>;
  inactive: Array<User & { daysSinceActivity: number }>;
  banned: Array<User & { banReason: string | null }>;
}

export async function getProblemUsers(): Promise<ProblemUsersData> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [usersWithStats, bannedUsers] = await Promise.all([
    db.execute<{
      id: string; discord_id: string; role: string; total_xp: number; bonus_xp: number;
      works_count: number; is_banned: boolean; ban_reason: string | null;
      last_activity_at: Date | null; registered_at: Date; created_at: Date; updated_at: Date;
      total_works: number; approved_works: number; rejected_works: number;
    }>(sql`
      SELECT u.*,
        COUNT(w.id)::int AS total_works,
        COUNT(w.id) FILTER (WHERE w.status = 'approved')::int AS approved_works,
        COUNT(w.id) FILTER (WHERE w.status = 'rejected')::int AS rejected_works
      FROM users u
      LEFT JOIN works w ON w.user_id = u.id
      WHERE u.is_banned = false
      GROUP BY u.id
    `),
    db.select().from(users).where(eq(users.isBanned, true)).limit(10),
  ]);

  const lowApproval: ProblemUsersData['lowApproval'] = [];
  const inactive: ProblemUsersData['inactive'] = [];

  for (const row of usersWithStats) {
    const reviewed = row.approved_works + row.rejected_works;
    if (reviewed >= 5) {
      const approvalRate = Math.round((row.approved_works / reviewed) * 100);
      if (approvalRate < 50) {
        lowApproval.push({ ...mapUserRow(row), approvalRate, totalWorks: row.total_works });
      }
    }

    if (row.last_activity_at && new Date(row.last_activity_at) < thirtyDaysAgo) {
      const daysSinceActivity = Math.floor(
        (Date.now() - new Date(row.last_activity_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      inactive.push({ ...mapUserRow(row), daysSinceActivity });
    }
  }

  lowApproval.sort((a, b) => a.approvalRate - b.approvalRate);
  inactive.sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);

  return {
    lowApproval: lowApproval.slice(0, 10),
    inactive: inactive.slice(0, 10),
    banned: bannedUsers.map((u) => ({ ...u, banReason: u.banReason })),
  };
}
