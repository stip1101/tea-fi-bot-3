import {
  type Client,
  type TextChannel,
  EmbedBuilder,
} from 'discord.js';
import { getChannelIds, COLORS, EMOJIS } from '../../config';
import { createTaskLogEmbed, createDMNotificationEmbed } from '../../discord/embeds';
import { handlerLogger } from '../../utils/logger';

export interface ReviewWorkData {
  id: string;
  url: string | null;
  reviewMessageId: string | null;
  reviewChannelId: string | null;
}

export interface ReviewNotificationParams {
  client: Client;
  discordId: string;
  work: ReviewWorkData;
  taskName: string;
  isApproval: boolean;
  qualityScore: number;
  baseXp: number;
  bonusXp: number;
  totalXp: number;
  reviewNotes?: string;
}

export interface NotificationResult {
  taskLog: boolean;
  dm: boolean;
}

export async function sendReviewNotifications(
  params: ReviewNotificationParams
): Promise<NotificationResult> {
  const {
    client,
    discordId,
    work,
    taskName,
    isApproval,
    qualityScore,
    baseXp,
    bonusXp,
    totalXp,
    reviewNotes,
  } = params;

  const result: NotificationResult = { taskLog: false, dm: false };

  let discordUser;
  try {
    discordUser = await client.users.fetch(discordId);
  } catch {
    handlerLogger.error({ userId: discordId }, 'Failed to fetch Discord user');
  }

  // Send task log
  const { TASK_LOG_CHANNEL_ID } = getChannelIds();
  if (TASK_LOG_CHANNEL_ID && discordUser) {
    try {
      const taskLogChannel = (await client.channels.fetch(TASK_LOG_CHANNEL_ID)) as TextChannel;
      if (taskLogChannel) {
        const taskLogEmbed = createTaskLogEmbed(
          discordUser,
          isApproval,
          taskName,
          qualityScore,
          baseXp,
          bonusXp,
          work.id
        );
        await taskLogChannel.send({ embeds: [taskLogEmbed] });
        result.taskLog = true;
      }
    } catch (error) {
      handlerLogger.error({ err: error, workId: work.id }, 'Failed to send task log');
    }
  }

  // Send DM
  if (discordUser) {
    try {
      const dmEmbed = createDMNotificationEmbed(
        isApproval,
        taskName,
        work.url,
        qualityScore,
        baseXp,
        bonusXp,
        totalXp,
        reviewNotes
      );
      await discordUser.send({ embeds: [dmEmbed] });
      result.dm = true;
    } catch (error) {
      handlerLogger.error({ err: error, userId: discordId }, 'Failed to send DM');
    }
  }

  return result;
}

export async function disableReviewButtons(
  client: Client,
  work: ReviewWorkData,
  isApproval: boolean
): Promise<void> {
  if (!work.reviewMessageId || !work.reviewChannelId) return;

  try {
    const reviewChannel = (await client.channels.fetch(work.reviewChannelId)) as TextChannel;
    const reviewMessage = await reviewChannel.messages.fetch(work.reviewMessageId);

    const existingEmbed = reviewMessage.embeds[0];
    const updatedEmbed = existingEmbed
      ? EmbedBuilder.from(existingEmbed).setColor(isApproval ? COLORS.SUCCESS : COLORS.ERROR)
      : null;

    await reviewMessage.edit({
      embeds: updatedEmbed ? [updatedEmbed] : undefined,
      components: [],
    });
  } catch (error) {
    handlerLogger.error({ err: error, workId: work.id }, 'Failed to update review message');
  }
}

export function buildReviewResponse(
  qualityScore: number,
  xpAwarded: number,
  notifications: NotificationResult,
  isApproval: boolean
): string {
  const warnings: string[] = [];
  if (!notifications.taskLog) warnings.push(`${EMOJIS.WARNING} Task log failed`);
  if (!notifications.dm) warnings.push(`${EMOJIS.WARNING} DM to user failed`);

  const warningText = warnings.length > 0 ? `\n\n${warnings.join('\n')}` : '';

  if (isApproval) {
    return `${EMOJIS.CHECK} Work approved!\n\n${EMOJIS.TARGET} Quality: ${qualityScore}%\n${EMOJIS.MONEY} XP awarded: +${xpAwarded}${warningText}`;
  }

  return `${EMOJIS.CROSS} Work rejected.\n\n${EMOJIS.TARGET} Quality: ${qualityScore}%${warningText}`;
}
