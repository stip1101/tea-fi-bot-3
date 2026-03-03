import {
  type StringSelectMenuInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import { setWorkSubmissionState } from '../../state';
import { getTaskById } from '../../services/task.service';
import { EMOJIS } from '../../config';

export default async function handleTaskSelect(
  interaction: StringSelectMenuInteraction,
  _args: string[]
): Promise<void> {
  const taskId = interaction.values[0];
  if (!taskId) {
    await interaction.reply({ content: `${EMOJIS.CROSS} No task selected.`, ephemeral: true });
    return;
  }

  // Verify task exists and is active
  const task = await getTaskById(taskId);
  if (!task || !task.isActive) {
    await interaction.reply({
      content: `${EMOJIS.CROSS} This task is no longer available. Please try again.`,
      ephemeral: true,
    });
    return;
  }

  // Save state to Redis (keyed by discord user ID for retrieval in modal)
  await setWorkSubmissionState(interaction.user.id, {
    userId: interaction.user.id,
    taskId,
  });

  // Show work submission modal
  const modal = new ModalBuilder()
    .setCustomId('work-submission')
    .setTitle(`${task.name} (${task.xpReward} XP)`);

  const urlInput = new TextInputBuilder()
    .setCustomId('work-url')
    .setLabel('URL (optional)')
    .setPlaceholder('https://x.com/...')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(500);

  const descInput = new TextInputBuilder()
    .setCustomId('work-description')
    .setLabel('Description (optional)')
    .setPlaceholder('Describe your work...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(urlInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(descInput)
  );

  await interaction.showModal(modal);
}
