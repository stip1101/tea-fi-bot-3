import { SlashCommandBuilder, type ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { Command } from '../../client';
import { COLORS, EMOJIS } from '../../../config';
import { getPendingWorks } from '../../../services/work.service';
import { getTaskById } from '../../../services/task.service';
import { ROLE_CONFIG } from '../../../config/roles';
import { requireAdmin } from '../../../utils/guards';
import { formatRole } from '../../../utils/format';
import type { TeafiRole } from '../../../db/schema';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('adminpending')
    .setDescription('⏳ View pending works (Admin only)'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await requireAdmin(interaction))) return;

    await interaction.deferReply({ ephemeral: true });

    const pendingWorks = await getPendingWorks(15);

    if (pendingWorks.length === 0) {
      await interaction.editReply({
        content: '✅ No pending works to review!',
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(`${EMOJIS.PENDING} Pending Works (${pendingWorks.length})`)
      .setDescription(`**═══════════════════════════════════════════**`);

    for (const work of pendingWorks.slice(0, 10)) {
      const role = work.user.role as TeafiRole;
      const roleConfig = ROLE_CONFIG[role];
      const task = await getTaskById(work.taskId);
      const taskName = task?.name ?? 'Unknown Task';
      const timeAgo = getTimeAgo(work.submittedAt);

      embed.addFields({
        name: `${EMOJIS.TEA} ${taskName}`,
        value:
          `<@${work.user.discordId}> (${roleConfig.emoji} ${roleConfig.name})\n` +
          `🔗 [Link](${work.url})\n` +
          `🆔 \`${work.id}\` • ${timeAgo}`,
        inline: true,
      });
    }

    if (pendingWorks.length > 10) {
      embed.setFooter({ text: `Showing 10 of ${pendingWorks.length} pending works` });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default command;
