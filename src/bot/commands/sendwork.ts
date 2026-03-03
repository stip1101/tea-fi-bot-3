import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../client';
import handleSubmitWork from '../../handlers/buttons/submit-work';
import { EMOJIS } from '../../config';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('sendwork')
    .setDescription(`${EMOJIS.TEA} Submit a new work for review`),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await handleSubmitWork(interaction, []);
  },
};

export default command;
