import { type ModalSubmitInteraction, type GuildMember, type TextChannel, MessageFlags } from 'discord.js';
import { getUserByDiscordId } from '../../services/user.service';
import { submitReport, getUserReportForMonth, updateReportReviewMessage } from '../../services/local-lead.service';
import { getCurrentMonthYear } from '../../services/reward.service';
import { EMOJIS, getChannelIds } from '../../config';
import { createLocalLeadReportEmbed, createReportReviewButtons } from '../../discord/embeds';
import { handlerLogger } from '../../utils/logger';

export default async function handleLocalLeadReport(
  interaction: ModalSubmitInteraction,
  _args: string[]
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const localLeadRoleId = process.env.LOCAL_LEAD_ROLE_ID;
  if (!localLeadRoleId) {
    await interaction.editReply({ content: `${EMOJIS.CROSS} This feature is not configured.` });
    return;
  }
  const member = interaction.member as GuildMember | null;
  if (!member?.roles?.cache?.has(localLeadRoleId)) {
    await interaction.editReply({ content: `${EMOJIS.CROSS} Only Local Leads can submit reports.` });
    return;
  }

  const docLink = interaction.fields.getTextInputValue('doc-link').trim();
  const comment = interaction.fields.getTextInputValue('report-comment').trim() || undefined;

  if (!docLink) {
    await interaction.editReply({ content: `${EMOJIS.CROSS} Document link is required.` });
    return;
  }

  try {
    new URL(docLink);
  } catch {
    await interaction.editReply({ content: `${EMOJIS.CROSS} Please provide a valid URL.` });
    return;
  }

  const user = await getUserByDiscordId(interaction.user.id);
  if (!user) {
    await interaction.editReply({ content: `${EMOJIS.CROSS} User not found. Please use \`/profile\` first.` });
    return;
  }

  // Check for duplicate
  const existing = await getUserReportForMonth(user.id);
  if (existing) {
    const monthYear = getCurrentMonthYear();
    await interaction.editReply({
      content: `${EMOJIS.CROSS} You have already submitted a report for ${monthYear}.`,
    });
    return;
  }

  const report = await submitReport(user.id, docLink, comment);

  try {
    const { LOCAL_LEAD_REVIEW_CHANNEL_ID } = getChannelIds();
    if (LOCAL_LEAD_REVIEW_CHANNEL_ID) {
      const channel = await interaction.client.channels.fetch(LOCAL_LEAD_REVIEW_CHANNEL_ID) as TextChannel | null;
      if (channel) {
        const embed = createLocalLeadReportEmbed(interaction.user, report);
        const reviewButtons = createReportReviewButtons(report.id);
        const msg = await channel.send({ embeds: [embed], components: [reviewButtons] });
        await updateReportReviewMessage(report.id, msg.id, channel.id);
      }
    }
  } catch (error) {
    handlerLogger.warn({ err: error }, 'Failed to send local lead report to review channel');
  }

  await interaction.editReply({
    content: `${EMOJIS.CHECK} **Report submitted successfully!**\n\n${EMOJIS.LINK} ${docLink}\n\nThank you for your Local Lead report!`,
  });
}
