import { type ModalSubmitInteraction, type GuildMember, type TextChannel, EmbedBuilder, MessageFlags } from 'discord.js';
import { eq, sql } from 'drizzle-orm';
import { db, localLeadReports, users, xpHistory } from '../../db';
import { XP_SOURCES } from '../../config/constants';
import { getAdminRoleIds } from '../../config/roles';
import { COLORS, EMOJIS } from '../../config';
import { generateId } from '../../utils/id';
import { handlerLogger } from '../../utils/logger';
import { sendReportReviewNotifications, buildReportReviewResponse } from '../shared/review-notifications';
import { checkAndUpdateRole } from '../../services/role.service';
import { invalidateLeaderboardCache } from '../../state/cache';
import { ReportNotFoundError, ReportAlreadyReviewedError, UserNotFoundError } from '../../errors';

export default async function handleReportApproval(
  interaction: ModalSubmitInteraction,
  args: string[]
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const adminRoleIds = getAdminRoleIds();
  const member = interaction.member as GuildMember | null;
  if (!adminRoleIds.some((id) => member?.roles?.cache?.has(id))) {
    await interaction.editReply({ content: `${EMOJIS.CROSS} You do not have permission to approve reports.` });
    return;
  }

  const reportId = args[0];
  if (!reportId) {
    await interaction.editReply({ content: `${EMOJIS.CROSS} Report ID not found.` });
    return;
  }

  // Extract and validate fields
  const qualityScoreStr = interaction.fields.getTextInputValue('quality-score').trim();
  const qualityScore = Number(qualityScoreStr);
  if (!Number.isInteger(qualityScore) || qualityScore < 0 || qualityScore > 100) {
    await interaction.editReply({ content: `${EMOJIS.CROSS} Quality score must be a number between 0 and 100.` });
    return;
  }

  const bonusXpStr = interaction.fields.getTextInputValue('bonus-xp').trim() || '0';
  const bonusXp = Number(bonusXpStr);
  if (isNaN(bonusXp) || bonusXp < 0 || bonusXp > 500) {
    await interaction.editReply({ content: `${EMOJIS.CROSS} Bonus XP must be a number between 0 and 500.` });
    return;
  }

  const reviewNotes = interaction.fields.getTextInputValue('review-notes').trim() || undefined;
  const now = new Date();

  let userDiscordId = '';
  let userId = '';
  let reportMonthYear = '';
  let reportDocLink = '';
  let reviewMessageId: string | null = null;
  let reviewChannelId: string | null = null;

  try {
    await db.transaction(async (tx) => {
      const result = await tx.execute<{
        id: string; user_id: string; status: string; month_year: string; doc_link: string;
        review_message_id: string | null; review_channel_id: string | null;
      }>(sql`SELECT id, user_id, status, month_year, doc_link, review_message_id, review_channel_id FROM local_lead_reports WHERE id = ${reportId} FOR UPDATE`);

      const row = result[0];
      if (!row) throw new ReportNotFoundError(reportId);
      if (row.status !== 'pending') throw new ReportAlreadyReviewedError(reportId, row.status);

      reviewMessageId = row.review_message_id;
      reviewChannelId = row.review_channel_id;
      reportMonthYear = row.month_year;
      reportDocLink = row.doc_link;
      userId = row.user_id;

      const userResult = await tx.execute<{ discord_id: string }>(
        sql`SELECT discord_id FROM users WHERE id = ${row.user_id}`
      );
      if (!userResult[0]) throw new UserNotFoundError(row.user_id);
      userDiscordId = userResult[0].discord_id;

      // Update report
      await tx
        .update(localLeadReports)
        .set({
          status: 'approved',
          reviewerId: interaction.user.id,
          reviewedAt: now,
          reviewNotes,
          qualityScore,
          xpAwarded: bonusXp,
        })
        .where(eq(localLeadReports.id, reportId));

      // Award XP if bonusXp > 0
      if (bonusXp > 0) {
        const xpResult = await tx
          .update(users)
          .set({
            totalXp: sql`${users.totalXp} + ${bonusXp}`,
            bonusXp: sql`${users.bonusXp} + ${bonusXp}`,
            lastActivityAt: now,
            updatedAt: now,
          })
          .where(eq(users.id, row.user_id))
          .returning({
            newXp: users.totalXp,
            previousXp: sql<number>`${users.totalXp} - ${bonusXp}`,
          });

        if (xpResult[0]) {
          await tx.insert(xpHistory).values({
            id: generateId(),
            userId: row.user_id,
            change: bonusXp,
            source: XP_SOURCES.REPORT_APPROVED,
            previousValue: xpResult[0].previousXp,
            newValue: xpResult[0].newXp,
            notes: `Report approved (${reportMonthYear})`,
          });
        }
      }
    });
  } catch (error) {
    if (error instanceof ReportNotFoundError) {
      await interaction.editReply({ content: `${EMOJIS.CROSS} Report not found.` });
      return;
    }
    if (error instanceof ReportAlreadyReviewedError) {
      await interaction.editReply({ content: `${EMOJIS.CROSS} This report has already been ${error.currentStatus}.` });
      return;
    }
    if (error instanceof UserNotFoundError) {
      await interaction.editReply({ content: `${EMOJIS.CROSS} User not found.` });
      return;
    }
    handlerLogger.error({ err: error, reportId }, 'Transaction failed during report approval');
    await interaction.editReply({ content: `${EMOJIS.CROSS} An error occurred. Please try again.` });
    return;
  }

  // Invalidate caches + check role promotion if XP was awarded
  if (bonusXp > 0) {
    try {
      await invalidateLeaderboardCache();
    } catch (error) {
      handlerLogger.warn({ err: error }, 'Failed to invalidate cache after report approval');
    }
    if (interaction.guild) {
      try {
        await checkAndUpdateRole(userId, interaction.guild, userDiscordId);
      } catch (error) {
        handlerLogger.warn({ err: error, userId }, 'Failed to check role after report approval');
      }
    }
  }

  // Disable review buttons
  if (reviewMessageId && reviewChannelId) {
    try {
      const channel = await interaction.client.channels.fetch(reviewChannelId) as TextChannel;
      const message = await channel.messages.fetch(reviewMessageId);
      const existingEmbed = message.embeds[0];
      const updatedEmbed = existingEmbed
        ? EmbedBuilder.from(existingEmbed).setColor(COLORS.SUCCESS)
        : null;
      await message.edit({ embeds: updatedEmbed ? [updatedEmbed] : undefined, components: [] });
    } catch (error) {
      handlerLogger.warn({ err: error, reportId }, 'Failed to update report review message');
    }
  }

  // Send notifications (task log + DM)
  const notifications = await sendReportReviewNotifications({
    client: interaction.client,
    discordId: userDiscordId,
    reportId,
    monthYear: reportMonthYear,
    docLink: reportDocLink,
    isApproval: true,
    qualityScore,
    xpAwarded: bonusXp,
    reviewNotes,
  });

  const response = buildReportReviewResponse(qualityScore, bonusXp, notifications, true);
  await interaction.editReply({ content: response });
}
