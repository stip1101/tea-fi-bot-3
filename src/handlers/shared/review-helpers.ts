import { sql } from 'drizzle-orm';
import type { DbTransaction } from '../../db';
import { WORK_STATUSES } from '../../config/constants';
import { WorkNotFoundError, WorkAlreadyReviewedError, UserNotFoundError } from '../../errors';

export interface LockedWorkData {
  id: string;
  userId: string;
  taskId: string;
  url: string | null;
  description: string | null;
  status: string;
  reviewMessageId: string | null;
  reviewChannelId: string | null;
}

export interface LockedUserData {
  id: string;
  discordId: string;
  totalXp: number;
  isBanned: boolean;
}

export async function lockAndValidateWork(
  tx: DbTransaction,
  workId: string
): Promise<LockedWorkData> {
  const result = await tx.execute<{
    id: string;
    user_id: string;
    status: string;
    task_id: string;
    url: string | null;
    description: string | null;
    review_message_id: string | null;
    review_channel_id: string | null;
  }>(sql`SELECT id, user_id, status, task_id, url, description, review_message_id, review_channel_id FROM works WHERE id = ${workId} FOR UPDATE`);

  const row = result[0];
  if (!row) throw new WorkNotFoundError(workId);
  if (row.status !== WORK_STATUSES.PENDING) {
    throw new WorkAlreadyReviewedError(workId, row.status);
  }

  return {
    id: row.id,
    userId: row.user_id,
    taskId: row.task_id,
    url: row.url,
    description: row.description,
    status: row.status,
    reviewMessageId: row.review_message_id,
    reviewChannelId: row.review_channel_id,
  };
}

export async function lockAndValidateUser(
  tx: DbTransaction,
  userId: string
): Promise<LockedUserData> {
  const result = await tx.execute<{
    id: string;
    discord_id: string;
    total_xp: number;
    is_banned: boolean;
  }>(sql`SELECT id, discord_id, total_xp, is_banned FROM users WHERE id = ${userId} FOR UPDATE`);

  const row = result[0];
  if (!row) throw new UserNotFoundError(userId);

  return {
    id: row.id,
    discordId: row.discord_id,
    totalXp: row.total_xp,
    isBanned: row.is_banned,
  };
}

export async function getTaskForWork(
  tx: DbTransaction,
  taskId: string
): Promise<{ name: string; xpReward: number }> {
  const result = await tx.execute<{ name: string; xp_reward: number }>(
    sql`SELECT name, xp_reward FROM tasks WHERE id = ${taskId}`
  );
  return {
    name: result[0]?.name ?? 'Unknown Task',
    xpReward: result[0]?.xp_reward ?? 0,
  };
}
