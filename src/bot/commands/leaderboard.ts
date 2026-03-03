import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../client';
import handleLeaderboard from '../../handlers/buttons/leaderboard';
import { EMOJIS } from '../../config';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription(`${EMOJIS.TROPHY} View the TeaFi leaderboard`),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await handleLeaderboard(interaction, []);
  },
};

export default command;
