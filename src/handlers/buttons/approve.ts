import { type ButtonInteraction } from 'discord.js';
import { validateWorkReview } from '../shared/permissions';
import { createReviewModal } from '../shared/modals';
import { getTaskById } from '../../services/task.service';

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

  const task = await getTaskById(validation.work.taskId);
  const modal = createReviewModal(workId!, 'approval', {
    maxBaseXp: task?.xpReward ?? 0,
  });
  await interaction.showModal(modal);
}
