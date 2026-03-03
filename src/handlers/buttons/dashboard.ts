import {
  type ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type GuildMember,
} from 'discord.js';
import { getAdminRoleId, ROLE_CONFIG } from '../../config/roles';
import { COLORS, EMOJIS, getMonthlyPool } from '../../config';
import { PAGINATION } from '../../config/constants';
import {
  getTopPerformers,
  getProblemUsers,
  getLeaderboard,
} from '../../services/user.service';
import {
  getPendingWorksPaginated,
  getTotalWorksStats,
  getPendingWorksCount,
} from '../../services/work.service';
import { getTasksByIds } from '../../services/task.service';
import { getReportsByMonth } from '../../services/local-lead.service';
import { getCurrentMonthYear } from '../../services/reward.service';
import { db, users } from '../../db';
import { eq, sql, gte, and } from 'drizzle-orm';
import type { TeafiRole } from '../../db/schema';

type DashboardPageType = 'overview' | 'top' | 'pending' | 'problems' | 'reports';

function isAdmin(interaction: ButtonInteraction): boolean {
  const adminRoleId = getAdminRoleId();
  const member = interaction.member as GuildMember | null;
  return member?.roles?.cache?.has(adminRoleId) ?? false;
}

export default async function handleDashboard(
  interaction: ButtonInteraction,
  args: string[]
): Promise<void> {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: `${EMOJIS.CROSS} No permission.`, ephemeral: true });
    return;
  }

  const pageType = (args[0] as DashboardPageType) || 'overview';
  const page = Math.min(Math.max(parseInt(args[1] || '0', 10), 0), PAGINATION.DASHBOARD_MAX_PAGE);

  await interaction.deferUpdate();

  let embed: EmbedBuilder;
  let components: ActionRowBuilder<ButtonBuilder>[];

  switch (pageType) {
    case 'overview': ({ embed, components } = await buildOverviewPage()); break;
    case 'top': ({ embed, components } = await buildTopPerformersPage(page)); break;
    case 'pending': ({ embed, components } = await buildPendingWorksPage(page)); break;
    case 'problems': ({ embed, components } = await buildProblemUsersPage()); break;
    case 'reports': ({ embed, components } = await buildLocalLeadReportsPage(page)); break;
    default: ({ embed, components } = await buildOverviewPage());
  }

  await interaction.editReply({ embeds: [embed], components });
}

async function buildOverviewPage(): Promise<{
  embed: EmbedBuilder;
  components: ActionRowBuilder<ButtonBuilder>[];
}> {
  const [
    totalUsers,
    activeUsers,
    newUsers,
    bannedUsers,
    worksStats,
    pendingCount,
    totalXpDistributed,
    weekXpDistributed,
    topPerformersResult,
    roleDistribution,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(users),
    db.select({ count: sql<number>`count(*)::int` }).from(users)
      .where(gte(users.lastActivityAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))),
    db.select({ count: sql<number>`count(*)::int` }).from(users)
      .where(gte(users.registeredAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))),
    db.select({ count: sql<number>`count(*)::int` }).from(users)
      .where(eq(users.isBanned, true)),
    getTotalWorksStats(),
    getPendingWorksCount(),
    db.select({ total: sql<number>`COALESCE(sum(${users.totalXp}), 0)::int` }).from(users),
    (async () => {
      const { xpHistory } = await import('../../db/schema');
      const result = await db
        .select({ total: sql<number>`COALESCE(sum(${xpHistory.change}), 0)::int` })
        .from(xpHistory)
        .where(and(
          gte(xpHistory.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
          sql`${xpHistory.change} > 0`
        ));
      return result[0]?.total ?? 0;
    })(),
    getLeaderboard(3),
    db.select({ role: users.role, count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.isBanned, false))
      .groupBy(users.role),
  ]);

  const totalUsersCount = totalUsers[0]?.count ?? 0;
  const activeUsersCount = activeUsers[0]?.count ?? 0;
  const newUsersCount = newUsers[0]?.count ?? 0;
  const bannedUsersCount = bannedUsers[0]?.count ?? 0;
  const totalXp = totalXpDistributed[0]?.total ?? 0;
  const topPerformers = topPerformersResult.users;
  const pool = getMonthlyPool();

  const roleCounts: Record<string, number> = {};
  for (const row of roleDistribution) roleCounts[row.role] = row.count;

  const roleDistStr = (['none', 'sprout_leaf', 'green_leaf', 'golden_leaf'] as TeafiRole[])
    .map((role) => {
      const config = ROLE_CONFIG[role];
      return `${config.emoji} ${config.name}: **${roleCounts[role] ?? 0}**`;
    }).join('\n');

  const topStr = topPerformers
    .map((user, i) => {
      const medal = i === 0 ? EMOJIS.GOLD_MEDAL : i === 1 ? EMOJIS.SILVER_MEDAL : EMOJIS.BRONZE_MEDAL;
      return `${medal} <@${user.discordId}> — **${user.totalXp.toLocaleString()}** XP`;
    })
    .join('\n');

  const avgXpPerWork = worksStats.approved > 0 ? Math.round(totalXp / worksStats.approved) : 0;

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${EMOJIS.CHART} TEAFI DASHBOARD`)
    .setDescription(`**═══════════════════════════════════════════**`)
    .addFields(
      {
        name: `${EMOJIS.USERS} MEMBERS`,
        value:
          `Total: **${totalUsersCount}**\n` +
          `Active (30d): **${activeUsersCount}**\n` +
          `New (7d): **${newUsersCount}**\n` +
          `${EMOJIS.BANNED} Banned: **${bannedUsersCount}**`,
        inline: true,
      },
      {
        name: `${EMOJIS.MEMO} SUBMISSIONS`,
        value:
          `Total: **${worksStats.total}**\n` +
          `${EMOJIS.PENDING} Pending: **${pendingCount}**\n` +
          `${EMOJIS.CHECK} Approved: **${worksStats.approved}**\n` +
          `${EMOJIS.CROSS} Rejected: **${worksStats.rejected}**`,
        inline: true,
      },
      { name: '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550', value: '\u200B', inline: false },
      {
        name: `${EMOJIS.MONEY} XP & REWARDS`,
        value:
          `Total XP: **${totalXp.toLocaleString()}**\n` +
          `This week: **${weekXpDistributed.toLocaleString()}**\n` +
          `Avg/work: **${avgXpPerWork}**\n` +
          `Monthly Pool: **$${pool}**`,
        inline: true,
      },
      {
        name: `${EMOJIS.TROPHY} TOP PERFORMERS`,
        value: topStr || 'No data yet',
        inline: true,
      },
      { name: '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550', value: '\u200B', inline: false },
      {
        name: `${EMOJIS.TEA} ROLE DISTRIBUTION`,
        value: roleDistStr || 'No data',
        inline: false,
      }
    )
    .setFooter({ text: 'Last updated' })
    .setTimestamp();

  const navButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('dashboard:top:0').setLabel('Top Performers').setEmoji(EMOJIS.TROPHY).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('dashboard:pending:0').setLabel('Pending Works').setEmoji(EMOJIS.PENDING).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('dashboard:reports:0').setLabel('Reports').setEmoji(EMOJIS.FALLEN_LEAF).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('dashboard:problems:0').setLabel('Problem Users').setEmoji(EMOJIS.BANNED).setStyle(ButtonStyle.Danger),
  );

  return { embed, components: [navButtons] };
}

async function buildTopPerformersPage(page: number): Promise<{
  embed: EmbedBuilder;
  components: ActionRowBuilder<ButtonBuilder>[];
}> {
  const offset = page * PAGINATION.DASHBOARD_PAGE_SIZE;
  const { users: performers, total } = await getTopPerformers(PAGINATION.DASHBOARD_PAGE_SIZE, offset);

  const totalPages = Math.ceil(total / PAGINATION.DASHBOARD_PAGE_SIZE);
  const startIndex = offset + 1;
  const endIndex = Math.min(offset + performers.length, total);

  let performersText = '';
  for (let i = 0; i < performers.length; i++) {
    const user = performers[i]!;
    const rank = offset + i + 1;
    const roleConfig = ROLE_CONFIG[user.role as TeafiRole];

    performersText += `**${rank}.** ${roleConfig.emoji} **${user.totalXp.toLocaleString()}** XP — <@${user.discordId}>\n`;
    performersText += `\u2514 ${user.totalWorks} works \u2022 ${user.approvalRate}% approval\n\n`;
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle(`${EMOJIS.TROPHY} TOP PERFORMERS — Page ${page + 1}`)
    .setDescription(
      `**═══════════════════════════════════════════**\n\n` +
      (performersText || 'No performers found.') +
      `**═══════════════════════════════════════════**`
    )
    .setFooter({ text: `Showing ${startIndex}-${endIndex} of ${total} \u2022 Page ${page + 1}/${totalPages || 1}` })
    .setTimestamp();

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('dashboard:overview:0').setLabel('Overview').setEmoji('\uD83C\uDFE0').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`dashboard:top:${page - 1}`).setLabel('Previous').setEmoji('\u25C0\uFE0F').setStyle(ButtonStyle.Primary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId(`dashboard:top:${page + 1}`).setLabel('Next').setEmoji('\u25B6\uFE0F').setStyle(ButtonStyle.Primary).setDisabled(page >= totalPages - 1 || totalPages === 0),
  );

  return { embed, components: [navRow] };
}

async function buildPendingWorksPage(page: number): Promise<{
  embed: EmbedBuilder;
  components: ActionRowBuilder<ButtonBuilder>[];
}> {
  const offset = page * PAGINATION.DASHBOARD_PAGE_SIZE;
  const { works: pendingWorks, total } = await getPendingWorksPaginated(PAGINATION.DASHBOARD_PAGE_SIZE, offset);

  const totalPages = Math.ceil(total / PAGINATION.DASHBOARD_PAGE_SIZE);
  const startIndex = offset + 1;
  const endIndex = Math.min(offset + pendingWorks.length, total);

  const taskIds = [...new Set(pendingWorks.map((w) => w.taskId))];
  const tasksMap = await getTasksByIds(taskIds);

  let worksText = '';
  for (const work of pendingWorks) {
    const task = tasksMap.get(work.taskId);
    const taskLabel = task?.name ?? 'Unknown Task';
    const timeAgo = formatTimeAgo(work.submittedAt);

    worksText += `\u2022 \`${work.id}\` ${EMOJIS.TEA} ${taskLabel}\n`;
    worksText += `\u2514 <@${work.user.discordId}> \u2022 submitted ${timeAgo}\n\n`;
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${EMOJIS.PENDING} PENDING WORKS — Page ${page + 1}`)
    .setDescription(
      `**═══════════════════════════════════════════**\n\n` +
      (worksText || 'No pending works!') +
      `**═══════════════════════════════════════════**`
    )
    .setFooter({ text: `Showing ${startIndex}-${endIndex} of ${total} \u2022 Page ${page + 1}/${totalPages || 1}` })
    .setTimestamp();

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('dashboard:overview:0').setLabel('Overview').setEmoji('\uD83C\uDFE0').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`dashboard:pending:${page - 1}`).setLabel('Previous').setEmoji('\u25C0\uFE0F').setStyle(ButtonStyle.Primary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId(`dashboard:pending:${page + 1}`).setLabel('Next').setEmoji('\u25B6\uFE0F').setStyle(ButtonStyle.Primary).setDisabled(page >= totalPages - 1 || totalPages === 0),
  );

  return { embed, components: [navRow] };
}

async function buildProblemUsersPage(): Promise<{
  embed: EmbedBuilder;
  components: ActionRowBuilder<ButtonBuilder>[];
}> {
  const problems = await getProblemUsers();

  let lowApprovalText = '';
  for (const user of problems.lowApproval) {
    lowApprovalText += `\u2022 <@${user.discordId}> — **${user.approvalRate}%** approval (${user.totalWorks} works)\n`;
  }

  let inactiveText = '';
  for (const user of problems.inactive) {
    inactiveText += `\u2022 <@${user.discordId}> — last active **${user.daysSinceActivity}** days ago\n`;
  }

  let bannedText = '';
  for (const user of problems.banned) {
    bannedText += `\u2022 <@${user.discordId}>${user.banReason ? ` — "${user.banReason}"` : ''}\n`;
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.ERROR)
    .setTitle(`${EMOJIS.BANNED} PROBLEM USERS`)
    .setDescription(`**═══════════════════════════════════════════**`)
    .addFields(
      { name: `${EMOJIS.WARNING} LOW APPROVAL RATE (<50%)`, value: lowApprovalText || 'None', inline: false },
      { name: `${EMOJIS.CLOCK} INACTIVE (>30 days)`, value: inactiveText || 'None', inline: false },
      { name: `${EMOJIS.BANNED} BANNED`, value: bannedText || 'None', inline: false },
    )
    .setFooter({ text: 'Problem users require attention' })
    .setTimestamp();

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('dashboard:overview:0').setLabel('Overview').setEmoji('\uD83C\uDFE0').setStyle(ButtonStyle.Secondary),
  );

  return { embed, components: [navRow] };
}

async function buildLocalLeadReportsPage(page: number): Promise<{
  embed: EmbedBuilder;
  components: ActionRowBuilder<ButtonBuilder>[];
}> {
  const monthYear = getCurrentMonthYear();
  const offset = page * PAGINATION.DASHBOARD_PAGE_SIZE;
  const { reports, total } = await getReportsByMonth(monthYear, PAGINATION.DASHBOARD_PAGE_SIZE, offset);

  const totalPages = Math.ceil(total / PAGINATION.DASHBOARD_PAGE_SIZE);
  const startIndex = offset + 1;
  const endIndex = Math.min(offset + reports.length, total);

  let reportsText = '';
  for (const report of reports) {
    const timeAgo = formatTimeAgo(report.submittedAt);
    reportsText += `${EMOJIS.FALLEN_LEAF} <@${report.discordId}>\n`;
    reportsText += `\u2514 ${EMOJIS.LINK} [Document](${report.docLink}) \u2022 ${timeAgo}\n`;
    if (report.comment) {
      const comment = report.comment.length > 80 ? report.comment.slice(0, 77) + '...' : report.comment;
      reportsText += `\u2514 ${EMOJIS.MEMO} "${comment}"\n`;
    }
    reportsText += '\n';
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle(`${EMOJIS.FALLEN_LEAF} LOCAL LEAD REPORTS — ${monthYear}`)
    .setDescription(
      `**═══════════════════════════════════════════**\n\n` +
      (reportsText || 'No reports for this month.') +
      `**═══════════════════════════════════════════**`
    )
    .setFooter({ text: `Showing ${total > 0 ? startIndex : 0}-${endIndex} of ${total} \u2022 Page ${page + 1}/${totalPages || 1}` })
    .setTimestamp();

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('dashboard:overview:0').setLabel('Overview').setEmoji('\uD83C\uDFE0').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`dashboard:reports:${page - 1}`).setLabel('Previous').setEmoji('\u25C0\uFE0F').setStyle(ButtonStyle.Primary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId(`dashboard:reports:${page + 1}`).setLabel('Next').setEmoji('\u25B6\uFE0F').setStyle(ButtonStyle.Primary).setDisabled(page >= totalPages - 1 || totalPages === 0),
  );

  return { embed, components: [navRow] };
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}
