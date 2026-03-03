import { type ModalSubmitInteraction, type GuildMember, MessageFlags } from 'discord.js';
import { eq } from 'drizzle-orm';
import { db, users, works } from '../../db';
import { WORK_STATUSES } from '../../config/constants';
import { getAdminRoleIds } from '../../config/roles';
import { EMOJIS } from '../../config';
import { invalidatePendingCount, invalidateLeaderboardCache } from '../../state/cache';
import { handlerLogger } from '../../utils/logger';
import {
  sendReviewNotifications,
  disableReviewButtons,
  buildReviewResponse,
  type ReviewWorkData,
} from '../shared/review-notifications';
import {
  WorkAlreadyReviewedError,
  UserNotFoundError,
  WorkNotFoundError,
  UserBannedError,
} from '../../errors';
import { lockAndValidateWork, lockAndValidateUser, getTaskForWork } from '../shared/review-helpers';

export default async function handleRejection(
  interaction: ModalSubmitInteraction,
  args: string[]
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const adminRoleIds = getAdminRoleIds();
  const member = interaction.member as GuildMember | null;
  if (!adminRoleIds.some((id) => member?.roles?.cache?.has(id))) {
    await interaction.editReply({ content: `${EMOJIS.CROSS} You do not have permission to reject works.` });
    return;
  }

  const workId = args[0];
  if (!workId) {
    await interaction.editReply({ content: `${EMOJIS.CROSS} Work ID not found.` });
    return;
  }

  const qualityScoreStr = interaction.fields.getTextInputValue('quality-score').trim();
  const reviewNotes = interaction.fields.getTextInputValue('review-notes').trim() || undefined;

  const qualityScore = Number(qualityScoreStr);
  if (!Number.isInteger(qualityScore) || qualityScore < 0 || qualityScore > 100) {
    await interaction.editReply({ content: `${EMOJIS.CROSS} Quality score must be a number between 0 and 100.` });
    return;
  }

  const now = new Date();
  let userDiscordId = '';
  let userTotalXp = 0;
  let workData: ReviewWorkData | undefined;
  let taskName = '';

  try {
    await db.transaction(async (tx) => {
      const lockedWork = await lockAndValidateWork(tx, workId);

      workData = {
        id: lockedWork.id,
        url: lockedWork.url,
        reviewMessageId: lockedWork.reviewMessageId,
        reviewChannelId: lockedWork.reviewChannelId,
      };

      const task = await getTaskForWork(tx, lockedWork.taskId);
      taskName = task.name;

      const user = await lockAndValidateUser(tx, lockedWork.userId);
      if (user.isBanned) throw new UserBannedError(user.discordId);

      userDiscordId = user.discordId;
      userTotalXp = user.totalXp;

      // Update work status
      await tx
        .update(works)
        .set({
          status: WORK_STATUSES.REJECTED,
          reviewerId: interaction.user.id,
          reviewedAt: now,
          reviewNotes,
          qualityScore,
          xpAwarded: 0,
          updatedAt: now,
        })
        .where(eq(works.id, workId));

      // Update user activity (no worksCount increment on rejection)
      await tx
        .update(users)
        .set({
          lastActivityAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, user.id));
    });
  } catch (error) {
    if (error instanceof WorkAlreadyReviewedError) {
      await interaction.editReply({ content: `${EMOJIS.CROSS} This work has already been ${error.currentStatus}.` });
      return;
    }
    if (error instanceof WorkNotFoundError) {
      await interaction.editReply({ content: `${EMOJIS.CROSS} Work not found.` });
      return;
    }
    if (error instanceof UserNotFoundError) {
      await interaction.editReply({ content: `${EMOJIS.CROSS} User not found.` });
      return;
    }
    if (error instanceof UserBannedError) {
      await interaction.editReply({ content: `${EMOJIS.CROSS} Cannot reject: user has been banned.` });
      return;
    }
    handlerLogger.error({ err: error, workId }, 'Transaction failed during rejection');
    await interaction.editReply({ content: `${EMOJIS.CROSS} An error occurred. Please try again.` });
    return;
  }

  try {
    await Promise.all([invalidatePendingCount(), invalidateLeaderboardCache()]);
  } catch (error) {
    handlerLogger.warn({ err: error }, 'Failed to invalidate cache after rejection');
  }

  if (!workData) {
    await interaction.editReply({ content: `${EMOJIS.CROSS} An error occurred. Please try again.` });
    return;
  }

  const notifications = await sendReviewNotifications({
    client: interaction.client,
    discordId: userDiscordId,
    work: workData,
    taskName,
    isApproval: false,
    qualityScore,
    baseXp: 0,
    bonusXp: 0,
    totalXp: userTotalXp,
    reviewNotes,
  });

  await disableReviewButtons(interaction.client, workData, false);

  const response = buildReviewResponse(qualityScore, 0, notifications, false);
  await interaction.editReply({ content: response });
}
