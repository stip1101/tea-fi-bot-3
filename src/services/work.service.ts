import { eq, and, desc, gte, sql } from 'drizzle-orm';
import { db, works, users, twitterMetrics, tasks, type Work, type WorkStatus } from '../db';
import { generateWorkId, generateId } from '../utils/id';
import { RATE_LIMITS } from '../config/constants';

export type { Work, WorkStatus };

export function normalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    let hostname = url.hostname.toLowerCase();
    if (hostname.startsWith('www.')) hostname = hostname.slice(4);
    if (hostname === 'twitter.com') hostname = 'x.com';
    let normalized = `${url.protocol}//${hostname}`;
    if (url.port) normalized += `:${url.port}`;
    let path = url.pathname;
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    normalized += path;
    if (url.search) {
      const params = new URLSearchParams(url.search);
      const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'fbclid', 'gclid', 's', 't'];
      for (const param of trackingParams) params.delete(param);
      const sortedParams = new URLSearchParams([...params.entries()].sort());
      const search = sortedParams.toString();
      if (search) normalized += `?${search}`;
    }
    return normalized;
  } catch {
    return rawUrl;
  }
}

export class PendingLimitExceededError extends Error {
  constructor(public pendingCount: number, public maxPending: number) {
    super(`Pending limit exceeded: ${pendingCount}/${maxPending}`);
  }
}

export class DuplicateUrlError extends Error {
  constructor(public duplicateUrl: string) {
    super(`Duplicate URL: ${duplicateUrl}`);
  }
}

export async function createWorkAtomic(
  userId: string,
  taskId: string,
  url?: string,
  description?: string,
): Promise<Work> {
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`);

      const pendingResult = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(works)
        .where(and(eq(works.userId, userId), eq(works.status, 'pending')));

      const pendingCount = pendingResult[0]?.count ?? 0;

      if (pendingCount >= RATE_LIMITS.MAX_PENDING_WORKS) {
        throw new PendingLimitExceededError(pendingCount, RATE_LIMITS.MAX_PENDING_WORKS);
      }

      if (url) {
        const duplicateResult = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(works)
          .where(eq(works.url, url));
        if ((duplicateResult[0]?.count ?? 0) > 0) {
          throw new DuplicateUrlError(url);
        }
      }

      const id = generateWorkId();
      const result = await tx
        .insert(works)
        .values({ id, userId, taskId, url, description, status: 'pending' })
        .returning();

      if (!result[0]) throw new Error('Failed to create work');
      return result[0];
    });
  } catch (error: unknown) {
    if (error instanceof PendingLimitExceededError || error instanceof DuplicateUrlError) throw error;
    if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === '23505' && url) {
      throw new DuplicateUrlError(url);
    }
    throw error;
  }
}

export async function getWorkById(id: string): Promise<Work | null> {
  const result = await db.select().from(works).where(eq(works.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getWorkWithMetrics(id: string): Promise<{
  work: Work;
  metrics: typeof twitterMetrics.$inferSelect | null;
} | null> {
  const result = await db
    .select()
    .from(works)
    .leftJoin(twitterMetrics, eq(works.id, twitterMetrics.workId))
    .where(eq(works.id, id))
    .limit(1);

  if (!result[0]) return null;
  return { work: result[0].works, metrics: result[0].twitter_metrics };
}

export async function updateWork(
  id: string,
  data: Partial<Pick<Work, 'status' | 'reviewerId' | 'reviewedAt' | 'reviewNotes' | 'qualityScore' | 'xpAwarded' | 'bonusXpAwarded'>>
): Promise<Work | null> {
  const result = await db
    .update(works)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(works.id, id))
    .returning();

  return result[0] ?? null;
}

export async function updateWorkAiAnalysis(
  id: string,
  analysis: {
    qualitySuggestion?: number;
    justification?: string;
    redFlags?: string;
  }
): Promise<void> {
  await db
    .update(works)
    .set({
      aiAnalyzed: true,
      aiQualitySuggestion: analysis.qualitySuggestion,
      aiJustification: analysis.justification,
      aiRedFlags: analysis.redFlags,
      updatedAt: new Date(),
    })
    .where(eq(works.id, id));
}

export async function updateWorkReviewMessage(
  id: string,
  messageId: string,
  channelId: string
): Promise<void> {
  await db
    .update(works)
    .set({ reviewMessageId: messageId, reviewChannelId: channelId, updatedAt: new Date() })
    .where(eq(works.id, id));
}

export async function saveTwitterMetrics(
  workId: string,
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    views: number;
    engagementRate: string;
    tweetCreatedAt?: Date;
  }
): Promise<void> {
  await db.insert(twitterMetrics).values({
    id: generateId(),
    workId,
    likes: metrics.likes,
    retweets: metrics.retweets,
    replies: metrics.replies,
    views: metrics.views,
    engagementRate: metrics.engagementRate,
    tweetCreatedAt: metrics.tweetCreatedAt,
  });
}

export async function getUserWorks(
  userId: string,
  options: { status?: WorkStatus; limit?: number; offset?: number } = {}
): Promise<Work[]> {
  const { status, limit = 10, offset = 0 } = options;

  return db
    .select()
    .from(works)
    .where(status ? and(eq(works.userId, userId), eq(works.status, status)) : eq(works.userId, userId))
    .orderBy(desc(works.submittedAt))
    .limit(limit)
    .offset(offset);
}

export async function getPendingWorks(limit: number = 20): Promise<(Work & { user: typeof users.$inferSelect })[]> {
  const result = await db
    .select()
    .from(works)
    .innerJoin(users, eq(works.userId, users.id))
    .where(eq(works.status, 'pending'))
    .orderBy(works.submittedAt)
    .limit(limit);

  return result.map((r) => ({ ...r.works, user: r.users }));
}

export async function getPendingWorksCount(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(works)
    .where(eq(works.status, 'pending'));
  return result[0]?.count ?? 0;
}

export async function getRecentWorksCount(days: number = 7): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(works)
    .where(gte(works.submittedAt, cutoff));
  return result[0]?.count ?? 0;
}

export async function getTotalWorksStats(): Promise<{
  total: number; pending: number; approved: number; rejected: number;
}> {
  const result = await db
    .select({ status: works.status, count: sql<number>`count(*)::int` })
    .from(works)
    .groupBy(works.status);

  const stats = { total: 0, pending: 0, approved: 0, rejected: 0 };
  for (const row of result) {
    stats.total += row.count;
    if (row.status === 'pending') stats.pending = row.count;
    if (row.status === 'approved') stats.approved = row.count;
    if (row.status === 'rejected') stats.rejected = row.count;
  }
  return stats;
}

export async function workExistsByUrl(url: string): Promise<boolean> {
  const normalized = normalizeUrl(url);
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(works)
    .where(eq(works.url, normalized));
  return (result[0]?.count ?? 0) > 0;
}

export async function getUserWorkCountByStatus(userId: string, status: WorkStatus): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(works)
    .where(and(eq(works.userId, userId), eq(works.status, status)));
  return result[0]?.count ?? 0;
}

export async function getPendingWorksPaginated(
  limit: number,
  offset: number
): Promise<{ works: (Work & { user: typeof users.$inferSelect })[]; total: number }> {
  const [worksResult, countResult] = await Promise.all([
    db
      .select()
      .from(works)
      .innerJoin(users, eq(works.userId, users.id))
      .where(eq(works.status, 'pending'))
      .orderBy(works.submittedAt)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(works)
      .where(eq(works.status, 'pending')),
  ]);

  return {
    works: worksResult.map((r) => ({ ...r.works, user: r.users })),
    total: countResult[0]?.count ?? 0,
  };
}
