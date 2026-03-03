import { type ButtonInteraction } from 'discord.js';
import { validateWorkReview } from '../shared/permissions';
import { createReviewModal } from '../shared/modals';

export default async function handleApprove(
  interaction: ButtonInteraction,
  args: string[]
): Promise<void> {
  const workId = args[0] ?? null;

  const validation = await validateWorkReview(interaction, workId);
  if (!validation.success) {
    await interaction.reply({ content: validation.error, ephemeral: true });
    return;
  }

  const modal = createReviewModal(workId!, 'approval');
  await interaction.showModal(modal);
}
