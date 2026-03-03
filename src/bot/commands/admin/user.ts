import { SlashCommandBuilder, type ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { Command } from '../../client';
import { COLORS, EMOJIS } from '../../../config';
import { getUserByDiscordId, getUserStats } from '../../../services/user.service';
import { ROLE_CONFIG } from '../../../config/roles';
import { requireAdmin } from '../../../utils/guards';
import { formatRole } from '../../../utils/format';
import type { TeafiRole } from '../../../db/schema';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('adminuser')
    .setDescription('👤 View detailed info about a user (Admin only)')
    .addUserOption((option) =>
      option.setName('user').setDescription('User to view').setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await requireAdmin(interaction))) return;

    const targetDiscordUser = interaction.options.getUser('user', true);

    const user = await getUserByDiscordId(targetDiscordUser.id);
    if (!user) {
      await interaction.reply({
        content: '❌ This user is not registered in the TeaFi program.',
        ephemeral: true,
      });
      return;
    }

    const stats = await getUserStats(user.id);
    const role = user.role as TeafiRole;
    const roleConfig = ROLE_CONFIG[role];
    const baseXp = user.totalXp - user.bonusXp;

    const embed = new EmbedBuilder()
      .setColor(user.isBanned ? COLORS.ERROR : roleConfig.color)
      .setTitle(`${EMOJIS.USER} User Details`)
      .setThumbnail(targetDiscordUser.displayAvatarURL({ size: 256 }))
      .setDescription(
        `**═══════════════════════════════════════════**\n\n` +
          `${EMOJIS.USER} <@${user.discordId}>\n` +
          `${user.isBanned ? `${EMOJIS.BANNED} **BANNED**${user.banReason ? `: ${user.banReason}` : ''}\n` : ''}` +
          `\n**═══════════════════════════════════════════**`
      )
      .addFields(
        {
          name: 'Basic Info',
          value:
            `ID: \`${user.id}\`\n` +
            `Discord ID: \`${user.discordId}\`\n` +
            `Role: ${formatRole(role)}`,
          inline: false,
        },
        {
          name: `${EMOJIS.STAR} Experience`,
          value:
            `Base XP: **${baseXp.toLocaleString()}**\n` +
            `Bonus XP: **${user.bonusXp.toLocaleString()}**\n` +
            `Total XP: **${user.totalXp.toLocaleString()}**`,
          inline: true,
        },
        {
          name: `${EMOJIS.CHART} Work Stats`,
          value:
            `Total: **${stats.totalWorks}**\n` +
            `${EMOJIS.CHECK} Approved: **${stats.approvedWorks}**\n` +
            `${EMOJIS.CROSS} Rejected: **${stats.rejectedWorks}**\n` +
            `${EMOJIS.PENDING} Pending: **${stats.pendingWorks}**\n` +
            `Approval Rate: **${stats.approvalRate}%**`,
          inline: true,
        },
        {
          name: 'Timestamps',
          value:
            `Registered: ${user.registeredAt.toLocaleDateString()}\n` +
            `Last Active: ${user.lastActivityAt.toLocaleDateString()}`,
          inline: false,
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export default command;
