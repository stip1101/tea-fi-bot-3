import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

export type ReviewAction = 'approval' | 'rejection';

export interface ReviewModalOptions {
  suggestedQuality?: number;
}

export function createReviewModal(
  workId: string,
  action: ReviewAction,
  options?: ReviewModalOptions
): ModalBuilder {
  const isApproval = action === 'approval';
  const { suggestedQuality } = options ?? {};

  const modal = new ModalBuilder()
    .setCustomId(`${action}:${workId}`)
    .setTitle(isApproval ? '✅ Approve Work' : '❌ Reject Work');

  const qualityInput = new TextInputBuilder()
    .setCustomId('quality-score')
    .setLabel('Quality Score (0-100)')
    .setPlaceholder(isApproval ? 'Enter quality score (e.g., 85)' : 'Enter quality score for feedback')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(3);

  if (suggestedQuality !== undefined && suggestedQuality > 0) {
    qualityInput.setValue(suggestedQuality.toString());
  }

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(qualityInput));

  // Add Bonus XP field only for approval
  if (isApproval) {
    const bonusXpInput = new TextInputBuilder()
      .setCustomId('bonus-xp')
      .setLabel('Bonus XP (optional, 0-500)')
      .setPlaceholder('0')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(3);

    bonusXpInput.setValue('0');

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(bonusXpInput));
  }

  const notesInput = new TextInputBuilder()
    .setCustomId('review-notes')
    .setLabel(isApproval ? 'Review Notes (Optional)' : 'Rejection Reason (Required)')
    .setPlaceholder(isApproval ? 'Any feedback...' : 'Explain why this work was rejected...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(!isApproval)
    .setMaxLength(1000);

  if (!isApproval) notesInput.setMinLength(10);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(notesInput));

  return modal;
}

export type ReportReviewAction = 'report-approval' | 'report-rejection';

export function createReportReviewModal(
  reportId: string,
  action: ReportReviewAction
): ModalBuilder {
  const isApproval = action === 'report-approval';

  const modal = new ModalBuilder()
    .setCustomId(`${action}:${reportId}`)
    .setTitle(isApproval ? '✅ Approve Report' : '❌ Reject Report');

  const qualityInput = new TextInputBuilder()
    .setCustomId('quality-score')
    .setLabel('Quality Score (0-100)')
    .setPlaceholder(isApproval ? 'Enter quality score (e.g., 85)' : 'Enter quality score for feedback')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(3);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(qualityInput));

  if (isApproval) {
    const bonusXpInput = new TextInputBuilder()
      .setCustomId('bonus-xp')
      .setLabel('Bonus XP (optional, 0-500)')
      .setPlaceholder('0')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(3);

    bonusXpInput.setValue('0');

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(bonusXpInput));
  }

  const notesInput = new TextInputBuilder()
    .setCustomId('review-notes')
    .setLabel(isApproval ? 'Review Notes (Optional)' : 'Rejection Reason (Required)')
    .setPlaceholder(isApproval ? 'Any feedback...' : 'Explain why this report was rejected...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(!isApproval)
    .setMaxLength(1000);

  if (!isApproval) notesInput.setMinLength(10);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(notesInput));

  return modal;
}
