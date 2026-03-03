import { SlashCommandBuilder, type ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { Command } from '../client';
import { getUserByDiscordId } from '../../services/user.service';
import { calculateMonthlyRewards, getUserMonthlyXp, getCurrentMonthYear } from '../../services/reward.service';
import { ROLE_CONFIG } from '../../config/roles';
import { COLORS, EMOJIS, getMonthlyPool } from '../../config';
import type { TeafiRole } from '../../db/schema';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('rewards')
    .setDescription(`${EMOJIS.MONEY} View your monthly reward estimate`),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const user = await getUserByDiscordId(interaction.user.id);

    if (!user) {
      await interaction.reply({
        content: `${EMOJIS.CROSS} You need to create a profile first. Use \`/profile\` command.`,
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const monthYear = getCurrentMonthYear();
    const role = user.role as TeafiRole;
    const roleConfig = ROLE_CONFIG[role];
    const monthlyXp = await getUserMonthlyXp(user.id, monthYear);

    if (role === 'none') {
      await interaction.editReply({
        content:
          `${EMOJIS.SEEDLING} You need at least **200 XP** to be eligible for the monthly reward pool.\n\n` +
          `Current XP: **${user.totalXp}**\n` +
          `Monthly XP: **${monthlyXp}**\n\n` +
          `Keep submitting work to reach **Sprout Leaf** status!`,
      });
      return;
    }

    const rewards = await calculateMonthlyRewards(monthYear);
    const myReward = rewards.users.find((u) => u.userId === user.id);

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`${EMOJIS.MONEY} Monthly Reward Estimate`)
      .setDescription(
        `**Month:** ${monthYear}\n` +
        `**Pool:** $${rewards.pool.toLocaleString()}\n\n` +
        `${roleConfig.emoji} **${roleConfig.name}** (${roleConfig.multiplier}x multiplier)`
      )
      .addFields(
        {
          name: `${EMOJIS.STAR} Your Monthly XP`,
          value: `**${monthlyXp.toLocaleString()}** XP`,
          inline: true,
        },
        {
          name: `${EMOJIS.CHART} Weighted XP`,
          value: `**${(myReward?.weightedXp ?? 0).toLocaleString()}** XP`,
          inline: true,
        },
        {
          name: `${EMOJIS.MONEY} Est. Reward`,
          value: `**$${(myReward?.reward ?? 0).toFixed(2)}**`,
          inline: true,
        }
      )
      .setFooter({ text: 'Estimates update in real-time based on all participants' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
