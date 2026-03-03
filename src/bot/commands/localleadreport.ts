import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import type { Command } from '../client';
import { getLocalLeadRoleId } from '../../config/roles';
import { EMOJIS, getChannelIds } from '../../config';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('localleadreport')
    .setDescription(`${EMOJIS.MEMO} Submit your monthly Local Lead report`),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const localLeadRoleId = getLocalLeadRoleId();
    const member = interaction.member as GuildMember | null;

    if (!localLeadRoleId || !(member?.roles?.cache?.has(localLeadRoleId) ?? false)) {
      await interaction.reply({
        content: `${EMOJIS.CROSS} This command is only available for Local Leaders.`,
        ephemeral: true,
      });
      return;
    }

    const { LOCAL_LEAD_CHANNEL_ID } = getChannelIds();
    if (LOCAL_LEAD_CHANNEL_ID && interaction.channelId !== LOCAL_LEAD_CHANNEL_ID) {
      await interaction.reply({
        content: `${EMOJIS.CROSS} This command can only be used in the Local Lead channel.`,
        ephemeral: true,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId('local-lead-report')
      .setTitle('Monthly Local Lead Report');

    const docLinkInput = new TextInputBuilder()
      .setCustomId('doc-link')
      .setLabel('Report Document Link')
      .setPlaceholder('https://docs.google.com/...')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(500);

    const commentInput = new TextInputBuilder()
      .setCustomId('report-comment')
      .setLabel('Comment (optional)')
      .setPlaceholder('Any additional notes...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(500);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(docLinkInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(commentInput)
    );

    await interaction.showModal(modal);
  },
};

export default command;
