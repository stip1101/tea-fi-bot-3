import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../../client';
import { getUserByDiscordId, addXp } from '../../../services/user.service';
import { requireAdmin } from '../../../utils/guards';
import { createXpRewardEmbed } from '../../../discord/embeds';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('adminset-xp')
    .setDescription('⭐ Award XP to a user (Admin only)')
    .addUserOption((option) =>
      option.setName('user').setDescription('User to reward').setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('amount')
        .setDescription('XP amount to award')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100000)
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for XP reward').setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await requireAdmin(interaction))) return;

    const targetDiscordUser = interaction.options.getUser('user', true);
    const amount = interaction.options.getInteger('amount', true);
    const reason = interaction.options.getString('reason', true);

    const user = await getUserByDiscordId(targetDiscordUser.id);
    if (!user) {
      await interaction.reply({
        content: '❌ This user is not registered in the TeaFi program.',
        ephemeral: true,
      });
      return;
    }

    const newTotal = await addXp(user.id, amount, 'admin_adjustment', undefined, reason);

    const embed = createXpRewardEmbed(
      interaction.user,
      targetDiscordUser,
      amount,
      newTotal,
      reason
    );

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
