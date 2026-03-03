import { type ModalSubmitInteraction, type GuildMember, type TextChannel, EmbedBuilder, MessageFlags } from 'discord.js';
import { eq, sql } from 'drizzle-orm';
import { db, localLeadReports } from '../../db';
import { getAdminRoleIds } from '../../config/roles';
import { COLORS, EMOJIS } from '../../config';
import { handlerLogger } from '../../utils/logger';
import { sendReportReviewNotifications, buildReportReviewResponse } from '../shared/review-notifications';
import { ReportNotFoundError, ReportAlreadyReviewedError, UserNotFoundError } from '../../errors';

export default async function handleReportRejection(
  interaction: ModalSubmitInteraction,
  args: string[]
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const adminRoleIds = getAdminRoleIds();
  const member = interaction.member as GuildMember | null;
  if (!adminRoleIds.some((id) => member?.roles?.cache?.has(id))) {
    await interaction.editReply({ content: `${EMOJIS.CROSS} You do not have permission to reject reports.` });
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

  const reviewNotes = interaction.fields.getTextInputValue('review-notes').trim() || undefined;
  const now = new Date();

  let userDiscordId = '';
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

      const userResult = await tx.execute<{ discord_id: string }>(
        sql`SELECT discord_id FROM users WHERE id = ${row.user_id}`
      );
      if (!userResult[0]) throw new UserNotFoundError(row.user_id);
      userDiscordId = userResult[0].discord_id;

      await tx
        .update(localLeadReports)
        .set({
          status: 'rejected',
          reviewerId: interaction.user.id,
          reviewedAt: now,
          reviewNotes,
          qualityScore,
          xpAwarded: 0,
        })
        .where(eq(localLeadReports.id, reportId));
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
    handlerLogger.error({ err: error, reportId }, 'Transaction failed during report rejection');
    await interaction.editReply({ content: `${EMOJIS.CROSS} An error occurred. Please try again.` });
    return;
  }

  // Disable review buttons
  if (reviewMessageId && reviewChannelId) {
    try {
      const channel = await interaction.client.channels.fetch(reviewChannelId) as TextChannel;
      const message = await channel.messages.fetch(reviewMessageId);
      const existingEmbed = message.embeds[0];
      const updatedEmbed = existingEmbed
        ? EmbedBuilder.from(existingEmbed).setColor(COLORS.ERROR)
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
    isApproval: false,
    qualityScore,
    xpAwarded: 0,
    reviewNotes,
  });

  const response = buildReportReviewResponse(qualityScore, 0, notifications, false);
  await interaction.editReply({ content: response });
}
