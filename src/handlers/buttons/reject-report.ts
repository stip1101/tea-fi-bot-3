import { type ButtonInteraction, type GuildMember } from 'discord.js';
import { getAdminRoleId } from '../../config/roles';
import { EMOJIS } from '../../config';
import { getReportById } from '../../services/local-lead.service';
import { createReportReviewModal } from '../shared/modals';

export default async function handleRejectReport(
  interaction: ButtonInteraction,
  args: string[]
): Promise<void> {
  const reportId = args[0] ?? null;

  const adminRoleId = getAdminRoleId();
  const member = interaction.member as GuildMember | null;
  if (!(member?.roles?.cache?.has(adminRoleId) ?? false)) {
    await interaction.reply({ content: `${EMOJIS.CROSS} You do not have permission to review reports.`, ephemeral: true });
    return;
  }

  if (!reportId) {
    await interaction.reply({ content: `${EMOJIS.CROSS} Report ID not found.`, ephemeral: true });
    return;
  }

  const report = await getReportById(reportId);
  if (!report) {
    await interaction.reply({ content: `${EMOJIS.CROSS} Report not found.`, ephemeral: true });
    return;
  }
  if (report.status !== 'pending') {
    await interaction.reply({ content: `${EMOJIS.CROSS} This report has already been ${report.status}.`, ephemeral: true });
    return;
  }

  const modal = createReportReviewModal(reportId, 'report-rejection');
  await interaction.showModal(modal);
}
