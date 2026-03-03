import { type ModalSubmitInteraction, type GuildMember, MessageFlags } from 'discord.js';
import { eq, sql } from 'drizzle-orm';
import { db, users, works, xpHistory } from '../../db';
import { WORK_STATUSES, XP_SOURCES } from '../../config/constants';
import { getAdminRoleId } from '../../config/roles';
import { EMOJIS } from '../../config';
import { invalidatePendingCount, invalidateLeaderboardCache } from '../../state/cache';
import { generateId } from '../../utils/id';
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
import { checkAndUpdateRole } from '../../services/role.service';
import { lockAndValidateWork, lockAndValidateUser, getTaskForWork } from '../shared/review-helpers';

export default async function handleApproval(
  interaction: ModalSubmitInteraction,
  args: string[]
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const adminRoleId = getAdminRoleId();
  const member = interaction.member as GuildMember | null;
  if (!(member?.roles?.cache?.has(adminRoleId) ?? false)) {
    await interaction.editReply({ content: `${EMOJIS.CROSS} You do not have permission to approve works.` });
    return;
  }

  const workId = args[0];
  if (!workId) {
    await interaction.editReply({ content: `${EMOJIS.CROSS} Work ID not found.` });
    return;
  }

  const qualityScoreStr = interaction.fields.getTextInputValue('quality-score').trim();
  const bonusXpStr = interaction.fields.getTextInputValue('bonus-xp').trim();
  const reviewNotes = interaction.fields.getTextInputValue('review-notes').trim() || undefined;

  const qualityScore = Number(qualityScoreStr);
  if (!Number.isInteger(qualityScore) || qualityScore < 0 || qualityScore > 100) {
    await interaction.editReply({ content: `${EMOJIS.CROSS} Quality score must be a number between 0 and 100.` });
    return;
  }

  const bonusXp = bonusXpStr ? Number(bonusXpStr) : 0;
  if (isNaN(bonusXp) || bonusXp < 0 || bonusXp > 500) {
    await interaction.editReply({ content: `${EMOJIS.CROSS} Bonus XP must be a number between 0 and 500.` });
    return;
  }

  const now = new Date();
  let newTotalXp = 0;
  let userDiscordId = '';
  let baseXp = 0;
  let workData: ReviewWorkData | undefined;
  let workUserId = '';
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
      workUserId = lockedWork.userId;

      const task = await getTaskForWork(tx, lockedWork.taskId);
      baseXp = task.xpReward;
      taskName = task.name;

      const user = await lockAndValidateUser(tx, lockedWork.userId);
      if (user.isBanned) throw new UserBannedError(user.discordId);

      userDiscordId = user.discordId;

      const totalXpAwarded = baseXp + bonusXp;

      // 1. Update work
      await tx
        .update(works)
        .set({
          status: WORK_STATUSES.APPROVED,
          reviewerId: interaction.user.id,
          reviewedAt: now,
          reviewNotes,
          qualityScore,
          xpAwarded: baseXp,
          bonusXpAwarded: bonusXp,
          updatedAt: now,
        })
        .where(eq(works.id, workId));

      // 2. Update user XP
      const xpResult = await tx
        .update(users)
        .set({
          totalXp: sql`${users.totalXp} + ${totalXpAwarded}`,
          bonusXp: sql`${users.bonusXp} + ${bonusXp}`,
          worksCount: sql`${users.worksCount} + 1`,
          lastActivityAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, user.id))
        .returning({
          newXp: users.totalXp,
          previousXp: sql<number>`${users.totalXp} - ${totalXpAwarded}`,
        });

      if (xpResult[0]) {
        newTotalXp = xpResult[0].newXp;

        // 3. Log base XP
        await tx.insert(xpHistory).values({
          id: generateId(),
          userId: user.id,
          change: baseXp,
          source: XP_SOURCES.WORK_APPROVED,
          previousValue: xpResult[0].previousXp,
          newValue: xpResult[0].previousXp + baseXp,
          workId,
        });

        // 4. Log bonus XP if any
        if (bonusXp > 0) {
          await tx.insert(xpHistory).values({
            id: generateId(),
            userId: user.id,
            change: bonusXp,
            source: XP_SOURCES.BONUS,
            previousValue: xpResult[0].previousXp + baseXp,
            newValue: newTotalXp,
            workId,
            notes: 'Bonus XP from approval',
          });
        }
      }
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
      await interaction.editReply({ content: `${EMOJIS.BANNED} Cannot approve: user has been banned.` });
      return;
    }
    handlerLogger.error({ err: error, workId }, 'Transaction failed during approval');
    await interaction.editReply({ content: `${EMOJIS.CROSS} An error occurred. Please try again.` });
    return;
  }

  // Invalidate cache
  try {
    await Promise.all([invalidatePendingCount(), invalidateLeaderboardCache()]);
  } catch (error) {
    handlerLogger.warn({ err: error }, 'Failed to invalidate cache after approval');
  }

  // Check role promotion
  const guild = interaction.guild;
  if (guild) {
    try {
      await checkAndUpdateRole(workUserId, guild, userDiscordId);
    } catch (error) {
      handlerLogger.warn({ err: error }, 'Failed to check role after approval');
    }
  }

  if (!workData) {
    await interaction.editReply({ content: `${EMOJIS.CROSS} An error occurred. Please try again.` });
    return;
  }

  // Send notifications
  const totalXpAwarded = baseXp + bonusXp;
  const notifications = await sendReviewNotifications({
    client: interaction.client,
    discordId: userDiscordId,
    work: workData,
    taskName,
    isApproval: true,
    qualityScore,
    baseXp,
    bonusXp,
    totalXp: newTotalXp,
    reviewNotes,
  });

  // Update review message buttons
  await disableReviewButtons(interaction.client, workData, true);

  const response = buildReviewResponse(qualityScore, totalXpAwarded, notifications, true);
  await interaction.editReply({ content: response });
}
