import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import type { Command } from '../../client';
import { COLORS, EMOJIS, getMonthlyPool } from '../../../config';
import { getLeaderboard } from '../../../services/user.service';
import { getTotalWorksStats, getPendingWorksCount } from '../../../services/work.service';
import { db, users } from '../../../db';
import { eq, sql, gte } from 'drizzle-orm';
import { ROLE_CONFIG } from '../../../config/roles';
import { requireAdmin } from '../../../utils/guards';
import type { TeafiRole } from '../../../db/schema';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('admindashboard')
    .setDescription(`${EMOJIS.CHART} TeaFi Dashboard`),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await requireAdmin(interaction))) return;

    await interaction.deferReply({ ephemeral: true });

    const [
      totalUsers,
      activeUsers,
      worksStats,
      pendingCount,
      totalXpResult,
      topResult,
      roleDistribution,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(users),
      db.select({ count: sql<number>`count(*)::int` }).from(users)
        .where(gte(users.lastActivityAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))),
      getTotalWorksStats(),
      getPendingWorksCount(),
      db.select({ total: sql<number>`COALESCE(sum(${users.totalXp}), 0)::int` }).from(users),
      getLeaderboard(3),
      db.select({ role: users.role, count: sql<number>`count(*)::int` })
        .from(users).where(eq(users.isBanned, false)).groupBy(users.role),
    ]);

    const pool = getMonthlyPool();
    const roleCounts: Record<string, number> = {};
    for (const row of roleDistribution) roleCounts[row.role] = row.count;

    const roleDistStr = (['none', 'sprout_leaf', 'green_leaf', 'golden_leaf'] as TeafiRole[])
      .map((role) => {
        const config = ROLE_CONFIG[role];
        return `${config.emoji} ${config.name}: **${roleCounts[role] ?? 0}**`;
      }).join('\n');

    const topStr = topResult.users
      .map((user, i) => {
        const medal = i === 0 ? EMOJIS.GOLD_MEDAL : i === 1 ? EMOJIS.SILVER_MEDAL : EMOJIS.BRONZE_MEDAL;
        return `${medal} <@${user.discordId}> — **${user.totalXp.toLocaleString()}** XP`;
      }).join('\n');

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`${EMOJIS.CHART} TEAFI DASHBOARD`)
      .addFields(
        {
          name: `${EMOJIS.USERS} MEMBERS`,
          value: `Total: **${totalUsers[0]?.count ?? 0}**\nActive (30d): **${activeUsers[0]?.count ?? 0}**`,
          inline: true,
        },
        {
          name: `${EMOJIS.MEMO} SUBMISSIONS`,
          value: `Pending: **${pendingCount}**\nApproved: **${worksStats.approved}**\nRejected: **${worksStats.rejected}**`,
          inline: true,
        },
        {
          name: `${EMOJIS.MONEY} POOL`,
          value: `Monthly: **$${pool}**\nTotal XP: **${(totalXpResult[0]?.total ?? 0).toLocaleString()}**`,
          inline: true,
        },
        { name: `${EMOJIS.TROPHY} TOP`, value: topStr || 'No data', inline: false },
        { name: `${EMOJIS.TEA} ROLES`, value: roleDistStr, inline: false },
      )
      .setTimestamp();

    const navButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('dashboard:top:0').setLabel('Top Performers').setEmoji(EMOJIS.TROPHY).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('dashboard:pending:0').setLabel('Pending').setEmoji(EMOJIS.PENDING).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('dashboard:problems:0').setLabel('Problems').setEmoji(EMOJIS.BANNED).setStyle(ButtonStyle.Danger),
    );

    await interaction.editReply({ embeds: [embed], components: [navButtons] });
  },
};

export default command;
