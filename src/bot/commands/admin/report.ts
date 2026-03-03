import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  AttachmentBuilder,
} from 'discord.js';
import type { Command } from '../../client';
import { COLORS } from '../../../config';
import { requireAdmin } from '../../../utils/guards';
import { db, users, works, twitterMetrics, xpHistory, tasks } from '../../../db';
import { eq, sql, gte, and, desc } from 'drizzle-orm';
import { getTotalWorksStats } from '../../../services/work.service';
import { ROLE_CONFIG } from '../../../config/roles';
import type { TeafiRole } from '../../../db/schema';
import { escapeCsvField, buildCsv } from '../../../utils/csv';

export { escapeCsvField, buildCsv };

function formatDate(): string {
  return new Date().toISOString().split('T')[0]!;
}

const TEAFI_ROLES: TeafiRole[] = ['none', 'sprout_leaf', 'green_leaf', 'golden_leaf'];

async function generateSummaryReport(interaction: ChatInputCommandInteraction): Promise<void> {
  const [
    totalUsers,
    activeUsers,
    newUsers,
    bannedUsers,
    worksStats,
    totalXpDistributed,
    xpFromWorksResult,
    weekXpDistributed,
    roleDistribution,
    qualityStats,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(users),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(gte(users.lastActivityAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(gte(users.registeredAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.isBanned, true)),
    getTotalWorksStats(),
    db.select({ total: sql<number>`COALESCE(sum(${users.totalXp}), 0)::int` }).from(users),
    db.select({ total: sql<number>`COALESCE(sum(${works.xpAwarded}) FILTER (WHERE ${works.status} = 'approved'), 0)::int` }).from(works),
    db
      .select({ total: sql<number>`COALESCE(sum(${xpHistory.change}), 0)::int` })
      .from(xpHistory)
      .where(
        and(
          gte(xpHistory.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
          sql`${xpHistory.change} > 0`
        )
      ),
    db
      .select({
        role: users.role,
        count: sql<number>`count(*)::int`,
      })
      .from(users)
      .where(eq(users.isBanned, false))
      .groupBy(users.role),
    db
      .select({
        avgQuality: sql<number>`COALESCE(AVG(${works.qualityScore}) FILTER (WHERE ${works.qualityScore} IS NOT NULL), 0)`,
        approvedCount: sql<number>`COUNT(*) FILTER (WHERE ${works.status} = 'approved')::int`,
        reviewedCount: sql<number>`COUNT(*) FILTER (WHERE ${works.status} IN ('approved', 'rejected'))::int`,
      })
      .from(works),
  ]);

  const totalUsersCount = totalUsers[0]?.count ?? 0;
  const activeUsersCount = activeUsers[0]?.count ?? 0;
  const newUsersCount = newUsers[0]?.count ?? 0;
  const bannedUsersCount = bannedUsers[0]?.count ?? 0;
  const totalXp = totalXpDistributed[0]?.total ?? 0;
  const xpFromWorks = xpFromWorksResult[0]?.total ?? 0;
  const weekXp = weekXpDistributed[0]?.total ?? 0;
  const quality = qualityStats[0] ?? { avgQuality: 0, approvedCount: 0, reviewedCount: 0 };
  const approvalRate = quality.reviewedCount > 0
    ? Math.round((quality.approvedCount / quality.reviewedCount) * 100)
    : 0;
  const avgXpPerWork = worksStats.approved > 0 ? Math.round(xpFromWorks / worksStats.approved) : 0;

  const rows: (string | number | null)[][] = [
    ['Participants', 'Total', totalUsersCount],
    ['Participants', 'Active (30d)', activeUsersCount],
    ['Participants', 'New (7d)', newUsersCount],
    ['Participants', 'Banned', bannedUsersCount],
    ['Works', 'Total', worksStats.total],
    ['Works', 'Pending', worksStats.pending],
    ['Works', 'Approved', worksStats.approved],
    ['Works', 'Rejected', worksStats.rejected],
    ['XP', 'Total User XP', totalXp],
    ['XP', 'XP from Approved Works', xpFromWorks],
    ['XP', 'Weekly (7d)', weekXp],
    ['XP', 'Avg per Approved Work', avgXpPerWork],
  ];

  for (const role of TEAFI_ROLES) {
    const roleRow = roleDistribution.find((r) => r.role === role);
    const config = ROLE_CONFIG[role];
    rows.push(['Role Distribution', config.name, roleRow?.count ?? 0]);
  }

  rows.push(['Quality', 'Average Quality Score', Number(quality.avgQuality).toFixed(1)]);
  rows.push(['Quality', 'Approval Rate', `${approvalRate}%`]);

  const csv = buildCsv(['Section', 'Metric', 'Value'], rows);
  const buffer = Buffer.from(csv, 'utf-8');
  const filename = `program-summary-${formatDate()}.csv`;

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('📊 Program Summary Report')
    .setDescription(
      `Exported **${rows.length}** metrics\n` +
      `Participants: **${totalUsersCount}** | Works: **${worksStats.total}** | XP: **${totalXp.toLocaleString()}**`
    )
    .setTimestamp();

  await interaction.editReply({
    embeds: [embed],
    files: [new AttachmentBuilder(buffer, { name: filename })],
  });
}

async function generateWorksReport(
  interaction: ChatInputCommandInteraction,
  period: string,
): Promise<void> {
  const dateFilter = period === '7d'
    ? gte(works.submittedAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    : period === '30d'
      ? gte(works.submittedAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      : undefined;

  const conditions = dateFilter ? [dateFilter] : [];

  const result = await db
    .select({
      workId: works.id,
      discordId: users.discordId,
      role: users.role,
      taskId: works.taskId,
      url: works.url,
      description: works.description,
      status: works.status,
      qualityScore: works.qualityScore,
      xpAwarded: works.xpAwarded,
      submittedAt: works.submittedAt,
      reviewedAt: works.reviewedAt,
      likes: twitterMetrics.likes,
      retweets: twitterMetrics.retweets,
      views: twitterMetrics.views,
      engagementRate: twitterMetrics.engagementRate,
    })
    .from(works)
    .innerJoin(users, eq(works.userId, users.id))
    .leftJoin(twitterMetrics, eq(works.id, twitterMetrics.workId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(works.submittedAt));

  const taskIds = [...new Set(result.map((r) => r.taskId))];
  const taskRows = taskIds.length > 0
    ? await db.select().from(tasks).where(sql`${tasks.id} IN ${taskIds}`)
    : [];
  const taskMap = new Map(taskRows.map((t) => [t.id, t.name]));

  const headers = [
    'Work ID', 'Discord ID', 'Role', 'Task', 'URL', 'Description',
    'Status', 'Quality Score', 'XP Awarded', 'Submitted At', 'Reviewed At',
    'Likes', 'Retweets', 'Views', 'Engagement Rate',
  ];

  const csvRows = result.map((r) => [
    r.workId,
    r.discordId,
    r.role,
    taskMap.get(r.taskId) ?? r.taskId,
    r.url,
    r.description,
    r.status,
    r.qualityScore,
    r.xpAwarded,
    r.submittedAt?.toISOString() ?? null,
    r.reviewedAt?.toISOString() ?? null,
    r.likes,
    r.retweets,
    r.views,
    r.engagementRate,
  ]);

  const csv = buildCsv(headers, csvRows);
  const buffer = Buffer.from(csv, 'utf-8');
  const periodLabel = period === '7d' ? '7d' : period === '30d' ? '30d' : 'all';
  const filename = `works-export-${periodLabel}-${formatDate()}.csv`;

  const periodText = period === '7d' ? 'Last 7 days' : period === '30d' ? 'Last 30 days' : 'All time';
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('📝 Works Export Report')
    .setDescription(
      `Exported **${result.length}** works\nPeriod: **${periodText}**`
    )
    .setTimestamp();

  await interaction.editReply({
    embeds: [embed],
    files: [new AttachmentBuilder(buffer, { name: filename })],
  });
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('adminreport')
    .setDescription('📊 Export program reports as CSV (Admin only)')
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Report type')
        .setRequired(true)
        .addChoices(
          { name: 'Program Summary', value: 'summary' },
          { name: 'Works Export', value: 'works' },
        )
    )
    .addStringOption((option) =>
      option
        .setName('period')
        .setDescription('Time period (works export only)')
        .setRequired(false)
        .addChoices(
          { name: 'All time', value: 'all' },
          { name: 'Last 7 days', value: '7d' },
          { name: 'Last 30 days', value: '30d' },
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await requireAdmin(interaction))) return;

    const type = interaction.options.getString('type', true);
    const period = interaction.options.getString('period') ?? 'all';

    await interaction.deferReply({ ephemeral: true });

    try {
      if (type === 'summary') {
        await generateSummaryReport(interaction);
      } else {
        await generateWorksReport(interaction, period);
      }
    } catch (error) {
      await interaction.editReply({ content: '❌ Error generating report. Please try again.' });
      throw error;
    }
  },
};

export default command;
