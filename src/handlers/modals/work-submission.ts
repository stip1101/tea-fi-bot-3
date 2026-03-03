import { type ModalSubmitInteraction, type TextChannel, MessageFlags } from 'discord.js';
import { getWorkSubmissionState, deleteWorkSubmissionState, redis } from '../../state';
import { getUserByDiscordId, getUserStats } from '../../services/user.service';
import { getTaskById } from '../../services/task.service';
import {
  createWorkAtomic,
  updateWorkReviewMessage,
  normalizeUrl,
  PendingLimitExceededError,
  DuplicateUrlError,
} from '../../services/work.service';
import { processWorkAnalysis } from '../../services/work-analysis.service';
import { createReviewEmbed, createReviewButtons } from '../../discord/embeds';
import { getChannelIds, EMOJIS } from '../../config';
import { RATE_LIMITS } from '../../config/constants';
import { handlerLogger } from '../../utils/logger';
import { isValidUrl } from '../../utils/url';

async function releaseLock(userId: string): Promise<void> {
  await redis.del(`submit_lock:${userId}`);
}

export default async function handleWorkSubmission(
  interaction: ModalSubmitInteraction,
  _args: string[]
): Promise<void> {
  const discordId = interaction.user.id;

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const urlRaw = interaction.fields.getTextInputValue('work-url').trim();
    const description = interaction.fields.getTextInputValue('work-description').trim() || undefined;

    // Get state from Redis
    const state = await getWorkSubmissionState(discordId);
    if (!state) {
      await interaction.editReply({
        content: `${EMOJIS.CROSS} Session expired. Please try again by clicking "Submit Work".`,
      });
      return;
    }

    // Validate URL
    if (urlRaw && !isValidUrl(urlRaw)) {
      await interaction.editReply({ content: `${EMOJIS.CROSS} Please provide a valid URL.` });
      return;
    }

    const url = urlRaw ? normalizeUrl(urlRaw) : undefined;

    // Require at least URL or description
    if (!url && !description) {
      await interaction.editReply({
        content: `${EMOJIS.CROSS} Please provide either a URL or a description.`,
      });
      return;
    }

    // Get user
    const user = await getUserByDiscordId(discordId);
    if (!user) {
      await interaction.editReply({ content: `${EMOJIS.CROSS} User not found. Please use \`/profile\` first.` });
      return;
    }

    if (user.isBanned) {
      await interaction.editReply({ content: `${EMOJIS.BANNED} Your account has been banned.` });
      return;
    }

    // Get task info
    const task = await getTaskById(state.taskId);
    if (!task) {
      await interaction.editReply({ content: `${EMOJIS.CROSS} Task not found. Please try again.` });
      return;
    }

    // Create work atomically
    let work;
    try {
      work = await createWorkAtomic(user.id, state.taskId, url, description);
    } catch (error) {
      if (error instanceof PendingLimitExceededError) {
        await interaction.editReply({
          content: `${EMOJIS.MEMO} You have ${error.pendingCount} pending works (max ${error.maxPending}). Please wait for review.`,
        });
        return;
      }
      if (error instanceof DuplicateUrlError) {
        await interaction.editReply({
          content: `${EMOJIS.CROSS} This URL has already been submitted. Please submit a different work.`,
        });
        return;
      }
      throw error;
    }

    // Set submission cooldown
    await redis.setex(`submit_cooldown:${discordId}`, RATE_LIMITS.SUBMIT_COOLDOWN_SECONDS, '1');

    // Clear state
    await deleteWorkSubmissionState(discordId);

    // Send to review channel
    const { REVIEW_CHANNEL_ID } = getChannelIds();

    if (REVIEW_CHANNEL_ID) {
      try {
        const reviewChannel = (await interaction.client.channels.fetch(REVIEW_CHANNEL_ID)) as TextChannel;

        if (reviewChannel) {
          const userStats = await getUserStats(user.id);

          const reviewEmbed = createReviewEmbed(
            interaction.user,
            user,
            {
              id: work.id,
              taskName: task.name,
              taskXp: task.xpReward,
              url: work.url,
              description: work.description,
            },
            undefined,
            undefined,
            userStats
          );

          const reviewButtons = createReviewButtons(work.id);
          const reviewMessage = await reviewChannel.send({
            embeds: [reviewEmbed],
            components: [reviewButtons],
          });

          await updateWorkReviewMessage(work.id, reviewMessage.id, REVIEW_CHANNEL_ID);

          // Trigger async analysis
          processWorkAnalysis({
            workId: work.id,
            url: work.url,
            userId: user.id,
            taskId: state.taskId,
            description: work.description,
            messageId: reviewMessage.id,
            channelId: REVIEW_CHANNEL_ID,
            client: interaction.client,
          }).catch((err) => {
            handlerLogger.error({ err, workId: work.id }, 'Background work analysis failed');
          });
        }
      } catch (error) {
        handlerLogger.error({ err: error }, 'Failed to send to review channel');
      }
    }

    // Confirm to user
    const urlLine = url ? `${EMOJIS.LINK} URL: ${url}\n` : '';
    await interaction.editReply({
      content:
        `${EMOJIS.CHECK} **Work submitted successfully!**\n\n` +
        `${EMOJIS.TEA} Task: ${task.name}\n` +
        urlLine +
        `${EMOJIS.STAR} Base XP: ${task.xpReward}\n` +
        `ID: \`${work.id}\`\n\n` +
        `Your submission is now pending review. You'll receive a DM when it's reviewed.`,
    });
  } finally {
    await releaseLock(discordId);
  }
}

export { isValidUrl } from '../../utils/url';
