import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type User as DiscordUser,
} from 'discord.js';
import type { User, TeafiRole, LocalLeadReport } from '../db/schema';
import type { UserStats } from '../services/user.service';
import { ROLE_CONFIG } from '../config/roles';
import { COLORS, EMOJIS } from '../config';
import { formatNumber } from '../utils/format';
import { isTwitterUrl } from '../utils/url';

function getRoleDisplay(role: TeafiRole): { name: string; emoji: string; color: number } {
  const config = ROLE_CONFIG[role];
  return { name: config.name, emoji: config.emoji, color: config.color };
}

export function createProfileEmbed(
  discordUser: DiscordUser,
  user: User,
  stats: UserStats
): EmbedBuilder {
  const { name: roleName, emoji: roleEmoji, color } = getRoleDisplay(user.role as TeafiRole);

  const qualityScore = stats.avgQualityScore;
  const qualityBar = createProgressBar(qualityScore);
  const baseXp = user.totalXp - user.bonusXp;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({
      name: discordUser.username,
      iconURL: discordUser.displayAvatarURL({ size: 64 }),
    })
    .setThumbnail(discordUser.displayAvatarURL({ size: 256 }))
    .setTitle(`${EMOJIS.TEA} ══════ TEA CARD ══════ ${EMOJIS.TEA}`)
    .setDescription(
      `\n` +
      `${roleEmoji}  **${roleName}**\n` +
      `\n` +
      `───────────────────────────────────\n`
    )
    .addFields(
      {
        name: `\n${EMOJIS.STAR}  EXPERIENCE`,
        value:
          `\`\`\`\n` +
          `Base XP:    ${baseXp.toLocaleString().padStart(8)}\n` +
          `Bonus XP:   ${user.bonusXp.toLocaleString().padStart(8)}\n` +
          `Total XP:   ${user.totalXp.toLocaleString().padStart(8)}\n` +
          `\`\`\``,
        inline: false,
      },
      {
        name: `\n${EMOJIS.TARGET}  QUALITY SCORE`,
        value:
          `${qualityBar}  **${qualityScore}%**\n` +
          `*Average quality of your reviewed works*`,
        inline: false,
      },
      {
        name: `\n${EMOJIS.CHART}  SUBMISSIONS`,
        value:
          `\`\`\`\n` +
          `Approved: ${stats.approvedWorks.toString().padStart(5)}\n` +
          `Rejected: ${stats.rejectedWorks.toString().padStart(5)}\n` +
          `Pending:  ${stats.pendingWorks.toString().padStart(5)}\n` +
          `Rate:     ${stats.approvalRate.toString().padStart(4)}%\n` +
          `\`\`\``,
        inline: false,
      }
    )
    .setFooter({
      text: `Member since ${user.registeredAt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`,
    })
    .setTimestamp();

  return embed;
}

function createProgressBar(percent: number): string {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  return '▓'.repeat(filled) + '░'.repeat(empty);
}

export function createProfileButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('submit-work')
      .setLabel('Submit Work')
      .setStyle(ButtonStyle.Primary)
      .setEmoji(EMOJIS.TEA),
    new ButtonBuilder()
      .setCustomId('my-works')
      .setLabel('My Works')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(EMOJIS.MEMO),
    new ButtonBuilder()
      .setCustomId('leaderboard')
      .setLabel('Leaderboard')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(EMOJIS.TROPHY)
  );
}

export function createWelcomeEmbed(discordUser: DiscordUser): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${EMOJIS.TEA} Welcome to TeaFi!`)
    .setThumbnail(discordUser.displayAvatarURL({ size: 256 }))
    .setDescription(
      `Hey **${discordUser.username}**! You're now part of the TeaFi community.\n\n` +
      `Start submitting work to earn XP and climb the roles!`
    )
    .addFields(
      {
        name: `${EMOJIS.TARGET} Getting Started`,
        value:
          `1. Submit your first work using the button below\n` +
          `2. Wait for admin review\n` +
          `3. Earn XP and unlock roles!`,
        inline: false,
      },
      {
        name: `${EMOJIS.SEEDLING} Your Starting Role`,
        value: `**Newcomer** — Earn 200 XP to become a Sprout Leaf!`,
        inline: false,
      }
    )
    .setFooter({ text: 'Good luck!' })
    .setTimestamp();
}

export function createReviewEmbed(
  discordUser: DiscordUser,
  user: User,
  work: {
    id: string;
    taskName: string;
    taskXp: number;
    url?: string | null;
    description?: string | null;
  },
  aiAnalysis?: {
    qualitySuggestion?: number | null;
    justification?: string | null;
    redFlags?: string | null;
  },
  twitterMetrics?: {
    likes: number;
    retweets: number;
    replies: number;
    views: number;
    engagementRate: string;
  },
  userStats?: UserStats
): EmbedBuilder {
  const { name: roleName, emoji: roleEmoji } = getRoleDisplay(user.role as TeafiRole);

  const willAnalyzeTwitter = isTwitterUrl(work.url);
  const isAnalyzing = willAnalyzeTwitter && !twitterMetrics && !aiAnalysis;

  const approvalRate = userStats?.approvalRate ?? 0;
  const avgQuality = userStats?.avgQualityScore ?? 0;
  const qualityBar = createProgressBar(avgQuality);

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setAuthor({
      name: discordUser.username,
      iconURL: discordUser.displayAvatarURL({ size: 64 }),
    })
    .setThumbnail(discordUser.displayAvatarURL({ size: 128 }))
    .setTitle(`${EMOJIS.TEA} ═══════ NEW SUBMISSION ═══════ ${EMOJIS.TEA}`)
    .setDescription(
      `${EMOJIS.USER} **MEMBER**\n` +
        `┌─────────────────────────────────────────┐\n` +
        `│  **@${discordUser.username}**\n` +
        `│  ${roleEmoji} **${roleName}**\n` +
        `│  ${EMOJIS.STAR} ${user.totalXp.toLocaleString()} XP\n` +
        `└─────────────────────────────────────────┘`
    );

  if (userStats) {
    embed.addFields({
      name: `${EMOJIS.CHART} MEMBER STATS`,
      value:
        `\`\`\`\n` +
        `Quality Score: ${qualityBar} ${avgQuality}%\n` +
        `Approval Rate: ${approvalRate}%\n` +
        `Total Works:   ${userStats.totalWorks}\n` +
        `\`\`\``,
      inline: false,
    });
  }

  // Task details
  let detailsValue = `${EMOJIS.STAR} Base XP: **${work.taskXp}**\n`;
  if (work.url) detailsValue += `${EMOJIS.LINK} ${work.url}\n`;
  if (work.description) {
    const desc = work.description.length > 200 ? work.description.slice(0, 197) + '...' : work.description;
    detailsValue += `${EMOJIS.MEMO} "${desc}"`;
  }

  embed.addFields({
    name: `${EMOJIS.TEA} ${work.taskName}`,
    value: detailsValue || '*No details provided*',
    inline: false,
  });

  // Twitter Metrics section
  if (twitterMetrics) {
    embed.addFields({
      name: `${EMOJIS.CHART} TWITTER METRICS`,
      value:
        `┌─────────────────────────────────────────┐\n` +
        `│  ${EMOJIS.HEART} **${formatNumber(twitterMetrics.likes)}**  •  ` +
        `${EMOJIS.RETWEET} **${formatNumber(twitterMetrics.retweets)}**  •  ` +
        `${EMOJIS.COMMENT} **${formatNumber(twitterMetrics.replies)}**  •  ` +
        `${EMOJIS.EYE} **${formatNumber(twitterMetrics.views)}**\n` +
        `│  ${EMOJIS.CHART} Engagement Rate: **${twitterMetrics.engagementRate}%**\n` +
        `└─────────────────────────────────────────┘`,
      inline: false,
    });
  } else if (isAnalyzing) {
    embed.addFields({
      name: `${EMOJIS.CHART} TWITTER METRICS`,
      value: `${EMOJIS.PENDING} *Fetching metrics...*`,
      inline: false,
    });
  }

  // AI Analysis section
  if (aiAnalysis) {
    const quality = aiAnalysis.qualitySuggestion ?? 'N/A';
    const qualityBarAI = typeof quality === 'number' ? createQualityBar(quality) : '';

    let aiValue =
      `┌─────────────────────────────────────────┐\n` +
      `│  ${EMOJIS.TARGET} Quality: **${quality}/100** ${qualityBarAI}\n`;

    if (aiAnalysis.justification) {
      const justification = aiAnalysis.justification.length > 150
        ? aiAnalysis.justification.slice(0, 147) + '...'
        : aiAnalysis.justification;
      aiValue += `│  ${EMOJIS.COMMENT} "${justification}"\n`;
    }

    const redFlagsText = aiAnalysis.redFlags || 'None';
    const flagEmoji = aiAnalysis.redFlags ? '🚨' : EMOJIS.CHECK;
    aiValue += `│  ${flagEmoji} Red Flags: ${redFlagsText}\n`;
    aiValue += `└─────────────────────────────────────────┘`;

    embed.addFields({
      name: `${EMOJIS.ROBOT} AI ANALYSIS`,
      value: aiValue,
      inline: false,
    });
  } else if (isAnalyzing) {
    embed.addFields({
      name: `${EMOJIS.ROBOT} AI ANALYSIS`,
      value: `${EMOJIS.PENDING} *Analyzing content...*`,
      inline: false,
    });
  }

  embed.setFooter({
    text: `Work ID: ${work.id} • ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
  });

  return embed;
}

function createQualityBar(score: number): string {
  const filled = Math.round(score / 20);
  const empty = 5 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

export function createReviewButtons(workId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`approve:${workId}`)
      .setLabel('APPROVE')
      .setStyle(ButtonStyle.Success)
      .setEmoji(EMOJIS.CHECK),
    new ButtonBuilder()
      .setCustomId(`reject:${workId}`)
      .setLabel('REJECT')
      .setStyle(ButtonStyle.Danger)
      .setEmoji(EMOJIS.CROSS)
  );
}

export function createTaskLogEmbed(
  discordUser: DiscordUser,
  approved: boolean,
  taskName: string,
  qualityScore: number,
  xpAwarded: number,
  bonusXp: number,
  workId: string
): EmbedBuilder {
  const statusText = approved ? 'earned rewards' : 'needs improvement';

  return new EmbedBuilder()
    .setColor(approved ? COLORS.SUCCESS : COLORS.ERROR)
    .setTitle(approved ? `${EMOJIS.CHECK} Work Approved` : `${EMOJIS.CROSS} Work Rejected`)
    .setThumbnail(discordUser.displayAvatarURL({ size: 128 }))
    .setDescription(
      `**@${discordUser.username}** completed a work and ${statusText}!`
    )
    .addFields(
      {
        name: `${EMOJIS.TEA} Task`,
        value: taskName,
        inline: true,
      },
      {
        name: `${EMOJIS.STAR} Quality`,
        value: `${qualityScore}%`,
        inline: true,
      },
      {
        name: `${EMOJIS.DIAMOND} XP Earned`,
        value: approved
          ? `+${xpAwarded}${bonusXp > 0 ? ` (+${bonusXp} bonus)` : ''}`
          : '0',
        inline: true,
      }
    )
    .setFooter({
      text: `Work ID: ${workId} • ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
    });
}

export function createXpRewardEmbed(
  admin: DiscordUser,
  target: DiscordUser,
  amount: number,
  newTotal: number,
  reason: string
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle(`${EMOJIS.STAR} ═══ XP REWARD ═══ ${EMOJIS.STAR}`)
    .setDescription(
      `<@${admin.id}> awarded XP to <@${target.id}>!\n\n${EMOJIS.MEMO} *"${reason}"*`
    )
    .addFields(
      {
        name: `${EMOJIS.STAR} XP Awarded`,
        value: `**+${amount.toLocaleString()}** XP`,
        inline: true,
      },
      {
        name: `${EMOJIS.CHART} New Total`,
        value: `**${newTotal.toLocaleString()}** XP`,
        inline: true,
      }
    )
    .setThumbnail(target.displayAvatarURL({ size: 128 }))
    .setFooter({
      text: `Awarded by ${admin.username}`,
      iconURL: admin.displayAvatarURL({ size: 32 }),
    })
    .setTimestamp();
}

export function createDMNotificationEmbed(
  approved: boolean,
  taskName: string,
  url: string | null | undefined,
  qualityScore: number,
  baseXp: number,
  bonusXp: number,
  newTotalXp: number,
  reviewNotes?: string
): EmbedBuilder {
  const urlLine = url ? `\n${EMOJIS.LINK} ${url}` : '';
  const totalXpAwarded = baseXp + bonusXp;

  const embed = new EmbedBuilder()
    .setColor(approved ? COLORS.SUCCESS : COLORS.ERROR)
    .setTitle(approved ? `${EMOJIS.CHECK} Your Work Was Approved!` : `${EMOJIS.CROSS} Your Work Was Rejected`)
    .setDescription(
      `**═══════════════════════════════════════════**\n\n` +
        `${EMOJIS.TEA} ${taskName}` +
        urlLine
    )
    .addFields({
      name: `**═══════════════════════════════════════════**\n${EMOJIS.MONEY} ${approved ? 'REWARDS' : 'RESULT'}`,
      value:
        `${EMOJIS.TARGET} Quality Score: **${qualityScore}%**\n` +
        (approved
          ? `${EMOJIS.STAR} Base XP: **+${baseXp}**\n` +
            (bonusXp > 0 ? `${EMOJIS.DIAMOND} Bonus XP: **+${bonusXp}**\n` : '') +
            `${EMOJIS.CHART} Total XP Earned: **+${totalXpAwarded}**\n`
          : '') +
        `${EMOJIS.CHART} Total XP: **${newTotalXp.toLocaleString()}**`,
      inline: false,
    });

  if (reviewNotes) {
    embed.addFields({
      name: `**═══════════════════════════════════════════**\n${EMOJIS.MEMO} REVIEWER NOTES`,
      value: `"${reviewNotes}"`,
      inline: false,
    });
  }

  return embed;
}

export function createLocalLeadReportEmbed(
  discordUser: DiscordUser,
  user: User,
  report: LocalLeadReport
): EmbedBuilder {
  const { name: roleName, emoji: roleEmoji } = getRoleDisplay(user.role as TeafiRole);

  const embed = new EmbedBuilder()
    .setColor(COLORS.SECONDARY)
    .setAuthor({
      name: discordUser.username,
      iconURL: discordUser.displayAvatarURL({ size: 64 }),
    })
    .setThumbnail(discordUser.displayAvatarURL({ size: 128 }))
    .setTitle(`${EMOJIS.FALLEN_LEAF} ══════ MONTHLY REPORT ══════ ${EMOJIS.FALLEN_LEAF}`)
    .setDescription(
      `${EMOJIS.USER} **LOCAL LEAD**\n` +
      `┌─────────────────────────────────────────┐\n` +
      `│  **@${discordUser.username}**\n` +
      `│  ${roleEmoji} **${roleName}**\n` +
      `│  ${EMOJIS.STAR} ${user.totalXp.toLocaleString()} XP\n` +
      `└─────────────────────────────────────────┘`
    )
    .addFields({
      name: `${EMOJIS.CHART} REPORT DETAILS`,
      value:
        `┌─────────────────────────────────────────┐\n` +
        `│  ${EMOJIS.FALLEN_LEAF} Month: **${report.monthYear}**\n` +
        `│  ${EMOJIS.LINK} [Document Link](${report.docLink})\n` +
        `└─────────────────────────────────────────┘`,
      inline: false,
    });

  if (report.comment) {
    embed.addFields({
      name: `${EMOJIS.MEMO} COMMENT`,
      value: `"${report.comment}"`,
      inline: false,
    });
  }

  embed.setFooter({
    text: `Report ID: ${report.id} • ${report.submittedAt.toLocaleDateString('en-GB')} ${report.submittedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
  });

  return embed;
}

export function createReportReviewButtons(reportId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`approve-report:${reportId}`)
      .setLabel('APPROVE')
      .setStyle(ButtonStyle.Success)
      .setEmoji(EMOJIS.CHECK),
    new ButtonBuilder()
      .setCustomId(`reject-report:${reportId}`)
      .setLabel('REJECT')
      .setStyle(ButtonStyle.Danger)
      .setEmoji(EMOJIS.CROSS)
  );
}

export function createReportDMEmbed(
  approved: boolean,
  monthYear: string,
  docLink: string,
  qualityScore: number,
  xpAwarded: number,
  reviewNotes?: string
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(approved ? COLORS.SUCCESS : COLORS.ERROR)
    .setTitle(approved ? `${EMOJIS.CHECK} Your Report Was Approved!` : `${EMOJIS.CROSS} Your Report Was Rejected`)
    .setDescription(
      `**═══════════════════════════════════════════**\n\n` +
      `${EMOJIS.FALLEN_LEAF} Monthly Report — **${monthYear}**\n` +
      `${EMOJIS.LINK} ${docLink}`
    )
    .addFields({
      name: `**═══════════════════════════════════════════**\n${EMOJIS.MONEY} ${approved ? 'RESULT' : 'FEEDBACK'}`,
      value:
        `${EMOJIS.TARGET} Quality Score: **${qualityScore}%**\n` +
        (approved && xpAwarded > 0 ? `${EMOJIS.DIAMOND} Bonus XP: **+${xpAwarded}**\n` : ''),
      inline: false,
    });

  if (reviewNotes) {
    embed.addFields({
      name: `**═══════════════════════════════════════════**\n${EMOJIS.MEMO} REVIEWER NOTES`,
      value: `"${reviewNotes}"`,
      inline: false,
    });
  }

  embed.setTimestamp();
  return embed;
}

export function createReportTaskLogEmbed(
  discordUser: DiscordUser,
  approved: boolean,
  monthYear: string,
  docLink: string,
  qualityScore: number,
  xpAwarded: number,
  reportId: string
): EmbedBuilder {
  const statusText = approved ? 'report approved' : 'report needs revision';

  return new EmbedBuilder()
    .setColor(approved ? COLORS.SUCCESS : COLORS.ERROR)
    .setTitle(approved ? `${EMOJIS.CHECK} Report Approved` : `${EMOJIS.CROSS} Report Rejected`)
    .setThumbnail(discordUser.displayAvatarURL({ size: 128 }))
    .setDescription(
      `**@${discordUser.username}**'s monthly ${statusText}!`
    )
    .addFields(
      {
        name: `${EMOJIS.FALLEN_LEAF} Month`,
        value: monthYear,
        inline: true,
      },
      {
        name: `${EMOJIS.TARGET} Quality`,
        value: `${qualityScore}%`,
        inline: true,
      },
      {
        name: `${EMOJIS.DIAMOND} XP Earned`,
        value: approved && xpAwarded > 0 ? `+${xpAwarded}` : '0',
        inline: true,
      }
    )
    .setFooter({
      text: `Report ID: ${reportId} • ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
    });
}
