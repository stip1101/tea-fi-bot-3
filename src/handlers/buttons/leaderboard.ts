import {
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { getLeaderboard } from '../../services/user.service';
import { COLORS, EMOJIS } from '../../config';
import { ROLE_CONFIG } from '../../config/roles';
import { PAGINATION } from '../../config/constants';
import type { TeafiRole } from '../../db/schema';

type LeaderboardInteraction = ButtonInteraction | ChatInputCommandInteraction;

export default async function handleLeaderboard(
  interaction: LeaderboardInteraction,
  args: string[]
): Promise<void> {
  const page = Math.min(
    Math.max(parseInt(args[0] || '0', 10), 0),
    PAGINATION.LEADERBOARD_MAX_PAGE
  );

  const offset = page * PAGINATION.LEADERBOARD_PAGE_SIZE;
  const { users: leaders, total } = await getLeaderboard(PAGINATION.LEADERBOARD_PAGE_SIZE, offset);

  const totalPages = Math.ceil(total / PAGINATION.LEADERBOARD_PAGE_SIZE);
  const startIndex = offset + 1;
  const endIndex = Math.min(offset + leaders.length, total);

  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle(`${EMOJIS.TROPHY} LEADERBOARD`);

  let leaderboardText = '';

  for (let i = 0; i < leaders.length; i++) {
    const user = leaders[i]!;
    const rank = offset + i + 1;
    const medal =
      rank === 1 ? EMOJIS.GOLD_MEDAL
        : rank === 2 ? EMOJIS.SILVER_MEDAL
          : rank === 3 ? EMOJIS.BRONZE_MEDAL
            : `${rank}.`;
    const roleConfig = ROLE_CONFIG[user.role as TeafiRole];

    leaderboardText += `${medal} ${roleConfig.emoji} **${user.totalXp.toLocaleString()}** XP\n`;
    leaderboardText += `└ <@${user.discordId}>\n\n`;
  }

  if (leaderboardText) {
    embed.setDescription(
      `**═══════════════════════════════════════════**\n\n` +
        `${EMOJIS.STAR} **Top by XP**\n\n` +
        leaderboardText +
        `**═══════════════════════════════════════════**`
    );
  } else {
    embed.setDescription('No data available yet.');
  }

  embed
    .setFooter({ text: `Showing ${startIndex}-${endIndex} of ${total} users • Page ${page + 1}/${totalPages || 1}` })
    .setTimestamp();

  // Pagination buttons
  const prevButton = new ButtonBuilder()
    .setCustomId(`leaderboard:${page - 1}`)
    .setLabel('Previous')
    .setEmoji('◀️')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page === 0);

  const nextButton = new ButtonBuilder()
    .setCustomId(`leaderboard:${page + 1}`)
    .setLabel('Next')
    .setEmoji('▶️')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page >= totalPages - 1 || totalPages === 0);

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton);

  const replyOptions = {
    embeds: [embed],
    components: [buttonRow],
    ephemeral: true,
  };

  if (interaction.isButton()) {
    await interaction.update(replyOptions);
  } else {
    await interaction.reply(replyOptions);
  }
}
