import { type ModalSubmitInteraction, type GuildMember, type TextChannel, EmbedBuilder, MessageFlags } from 'discord.js';
import { eq, sql } from 'drizzle-orm';
import { db, localLeadReports } from '../../db';
import { getAdminRoleId } from '../../config/roles';
import { COLORS, EMOJIS } from '../../config';
import { handlerLogger } from '../../utils/logger';
import { createReportDMEmbed } from '../../discord/embeds';

export default async function handleReportRejection(
  interaction: ModalSubmitInteraction,
  args: string[]
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const adminRoleId = getAdminRoleId();
  const member = interaction.member as GuildMember | null;
  if (!(member?.roles?.cache?.has(adminRoleId) ?? false)) {
    await interaction.editReply({ content: `${EMOJIS.CROSS} You do not have permission to reject reports.` });
    return;
  }

  const reportId = args[0];
  if (!reportId) {
    await interaction.editReply({ content: `${EMOJIS.CROSS} Report ID not found.` });
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
      if (!row) {
        throw new Error('REPORT_NOT_FOUND');
      }
      if (row.status !== 'pending') {
        throw new Error(`ALREADY_REVIEWED:${row.status}`);
      }

      reviewMessageId = row.review_message_id;
      reviewChannelId = row.review_channel_id;
      reportMonthYear = row.month_year;
      reportDocLink = row.doc_link;

      const userResult = await tx.execute<{ discord_id: string }>(
        sql`SELECT discord_id FROM users WHERE id = ${row.user_id}`
      );
      if (!userResult[0]) throw new Error('USER_NOT_FOUND');
      userDiscordId = userResult[0].discord_id;

      await tx
        .update(localLeadReports)
        .set({
          status: 'rejected',
          reviewerId: interaction.user.id,
          reviewedAt: now,
          reviewNotes,
        })
        .where(eq(localLeadReports.id, reportId));
    });
  } catch (error) {
    const msg = (error as Error).message;
    if (msg === 'REPORT_NOT_FOUND') {
      await interaction.editReply({ content: `${EMOJIS.CROSS} Report not found.` });
      return;
    }
    if (msg.startsWith('ALREADY_REVIEWED:')) {
      const status = msg.split(':')[1];
      await interaction.editReply({ content: `${EMOJIS.CROSS} This report has already been ${status}.` });
      return;
    }
    if (msg === 'USER_NOT_FOUND') {
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

  // Send DM
  let dmSent = false;
  if (userDiscordId) {
    try {
      const discordUser = await interaction.client.users.fetch(userDiscordId);
      const dmEmbed = createReportDMEmbed(false, reportMonthYear, reportDocLink, reviewNotes);
      await discordUser.send({ embeds: [dmEmbed] });
      dmSent = true;
    } catch (error) {
      handlerLogger.warn({ err: error, userId: userDiscordId }, 'Failed to send report rejection DM');
    }
  }

  let response = `${EMOJIS.CROSS} Report rejected.`;
  if (!dmSent) response += `\n\n${EMOJIS.WARNING} DM to user failed`;

  await interaction.editReply({ content: response });
}
