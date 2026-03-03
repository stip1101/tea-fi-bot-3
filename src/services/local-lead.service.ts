import { eq, and, sql } from 'drizzle-orm';
import { db, localLeadReports, users, type LocalLeadReport } from '../db';
import { generateId } from '../utils/id';
import { getCurrentMonthYear } from './reward.service';

export async function submitReport(
  userId: string,
  docLink: string,
  comment?: string
): Promise<LocalLeadReport> {
  const monthYear = getCurrentMonthYear();

  const result = await db
    .insert(localLeadReports)
    .values({
      id: generateId(),
      userId,
      docLink,
      comment,
      monthYear,
    })
    .returning();

  if (!result[0]) throw new Error('Failed to submit report');
  return result[0];
}

export async function getUserReportForMonth(
  userId: string,
  monthYear?: string
): Promise<LocalLeadReport | null> {
  const resolved = monthYear || getCurrentMonthYear();

  const result = await db
    .select()
    .from(localLeadReports)
    .where(and(eq(localLeadReports.userId, userId), eq(localLeadReports.monthYear, resolved)))
    .limit(1);

  return result[0] ?? null;
}

export async function getReportById(id: string): Promise<LocalLeadReport | null> {
  const result = await db
    .select()
    .from(localLeadReports)
    .where(eq(localLeadReports.id, id))
    .limit(1);

  return result[0] ?? null;
}

export async function updateReportReviewMessage(
  reportId: string,
  reviewMessageId: string,
  reviewChannelId: string
): Promise<void> {
  await db
    .update(localLeadReports)
    .set({ reviewMessageId, reviewChannelId })
    .where(eq(localLeadReports.id, reportId));
}

export interface ReportWithUser extends LocalLeadReport {
  discordId: string;
}

export async function getReportsByMonth(
  monthYear?: string,
  limit?: number,
  offset?: number
): Promise<{ reports: ReportWithUser[]; total: number }> {
  const resolved = monthYear || getCurrentMonthYear();

  const baseWhere = and(
    eq(localLeadReports.monthYear, resolved),
    eq(localLeadReports.status, 'pending')
  );

  const [reportsResult, countResult] = await Promise.all([
    db
      .select({
        id: localLeadReports.id,
        userId: localLeadReports.userId,
        docLink: localLeadReports.docLink,
        comment: localLeadReports.comment,
        monthYear: localLeadReports.monthYear,
        status: localLeadReports.status,
        reviewerId: localLeadReports.reviewerId,
        reviewedAt: localLeadReports.reviewedAt,
        reviewNotes: localLeadReports.reviewNotes,
        reviewMessageId: localLeadReports.reviewMessageId,
        reviewChannelId: localLeadReports.reviewChannelId,
        submittedAt: localLeadReports.submittedAt,
        createdAt: localLeadReports.createdAt,
        discordId: users.discordId,
      })
      .from(localLeadReports)
      .innerJoin(users, eq(localLeadReports.userId, users.id))
      .where(baseWhere)
      .orderBy(localLeadReports.submittedAt)
      .limit(limit ?? 100)
      .offset(offset ?? 0),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(localLeadReports)
      .where(baseWhere),
  ]);

  return {
    reports: reportsResult,
    total: countResult[0]?.count ?? 0,
  };
}
