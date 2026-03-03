import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../client';
import {
  getUserByDiscordId,
  createUser,
  getUserStats,
  updateUserActivity,
} from '../../services/user.service';
import { createProfileEmbed, createProfileButtons, createWelcomeEmbed } from '../../discord/embeds';
import { EMOJIS } from '../../config';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription(`${EMOJIS.TEA} View your TeaFi profile`),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const discordUser = interaction.user;

    let user = await getUserByDiscordId(discordUser.id);

    if (!user) {
      user = await createUser(discordUser.id);

      const welcomeEmbed = createWelcomeEmbed(discordUser);
      const buttons = createProfileButtons();

      await interaction.reply({
        embeds: [welcomeEmbed],
        components: [buttons],
        ephemeral: true,
      });
      return;
    }

    if (user.isBanned) {
      await interaction.reply({
        content: `${EMOJIS.BANNED} Your account has been banned.\n${user.banReason ? `Reason: ${user.banReason}` : ''}`,
        ephemeral: true,
      });
      return;
    }

    await updateUserActivity(user.id);

    const stats = await getUserStats(user.id);

    const embed = createProfileEmbed(discordUser, user, stats);
    const buttons = createProfileButtons();

    await interaction.reply({
      embeds: [embed],
      components: [buttons],
      ephemeral: true,
    });
  },
};

export default command;
