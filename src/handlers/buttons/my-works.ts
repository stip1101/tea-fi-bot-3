import {
  type ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { getUserByDiscordId, getUserStats } from '../../services/user.service';
import { getUserWorks } from '../../services/work.service';
import { getTasksByIds } from '../../services/task.service';
import { COLORS, EMOJIS } from '../../config';
import { PAGINATION } from '../../config/constants';

export default async function handleMyWorks(
  interaction: ButtonInteraction,
  args: string[]
): Promise<void> {
  const rawPage = parseInt(args[0] || '0', 10);
  const page = Math.max(0, Math.min(rawPage, PAGINATION.WORK_MAX_PAGE));

  const user = await getUserByDiscordId(interaction.user.id);
  if (!user) {
    await interaction.reply({
      content: `${EMOJIS.CROSS} You need to create a profile first. Use \`/profile\` command.`,
      ephemeral: true,
    });
    return;
  }

  const stats = await getUserStats(user.id);
  const works = await getUserWorks(user.id, {
    limit: PAGINATION.WORK_PAGE_SIZE,
    offset: page * PAGINATION.WORK_PAGE_SIZE,
  });

  if (works.length === 0 && page === 0) {
    await interaction.reply({
      content: `${EMOJIS.MEMO} You haven't submitted any works yet. Click "Submit Work" to get started!`,
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setAuthor({
      name: `${interaction.user.username}'s Works`,
      iconURL: interaction.user.displayAvatarURL({ size: 64 }),
    })
    .setDescription(
      `**═══════════════════════════════════════════**\n\n` +
        `${EMOJIS.CHECK} ${stats.approvedWorks} approved  •  ` +
        `${EMOJIS.CROSS} ${stats.rejectedWorks} rejected  •  ` +
        `${EMOJIS.PENDING} ${stats.pendingWorks} pending\n\n` +
        `**═══════════════════════════════════════════**`
    );

  const taskIds = [...new Set(works.map((w) => w.taskId))];
  const tasksMap = await getTasksByIds(taskIds);

  for (const work of works) {
    const statusEmoji =
      work.status === 'approved' ? EMOJIS.CHECK : work.status === 'rejected' ? EMOJIS.CROSS : EMOJIS.PENDING;
    const statusText = work.status.charAt(0).toUpperCase() + work.status.slice(1);

    const task = tasksMap.get(work.taskId);
    const taskLabel = task ? `${EMOJIS.TEA} ${task.name}` : `${EMOJIS.TEA} Task`;

    embed.addFields({
      name: `${statusEmoji} ${taskLabel}`,
      value:
        (work.url ? `${EMOJIS.LINK} [Link](${work.url})\n` : '') +
        `Status: **${statusText}**` +
        (work.xpAwarded ? ` • XP: **+${work.xpAwarded}**` : '') +
        (work.bonusXpAwarded > 0 ? ` (+${work.bonusXpAwarded} bonus)` : '') +
        `\n📅 ${work.submittedAt.toLocaleDateString()}`,
      inline: false,
    });
  }

  const hasMore = works.length === PAGINATION.WORK_PAGE_SIZE;
  const hasPrev = page > 0;
  const row = new ActionRowBuilder<ButtonBuilder>();

  if (hasPrev) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`my-works:${page - 1}`)
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('◀️')
    );
  }
  if (hasMore) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`my-works:${page + 1}`)
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('▶️')
    );
  }

  const components = row.components.length > 0 ? [row] : [];

  await interaction.reply({
    embeds: [embed],
    components,
    ephemeral: true,
  });
}
