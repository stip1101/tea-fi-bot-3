import type { Client, TextChannel } from 'discord.js';
import { scrapeTwitterMetrics } from './twitter-scraper';
import { analyzeWorkWithAI } from './ai-work-analyzer';
import { saveTwitterMetrics, updateWorkAiAnalysis, getWorkWithMetrics } from './work.service';
import { getUserById, getUserStats } from './user.service';
import { getTaskById } from './task.service';
import { isTwitterUrl } from '../utils/url';
import { createReviewEmbed, createReviewButtons } from '../discord/embeds';
import { logger } from '../utils/logger';

const analysisLogger = logger.child({ module: 'work-analysis' });

export interface ProcessWorkAnalysisParams {
  workId: string;
  url: string | null | undefined;
  userId: string;
  taskId: string;
  description: string | null | undefined;
  messageId: string;
  channelId: string;
  client: Client;
}

export async function processWorkAnalysis(params: ProcessWorkAnalysisParams): Promise<void> {
  const { workId, url, userId, taskId, description, messageId, channelId, client } = params;

  analysisLogger.info({ workId, hasUrl: !!url }, 'Starting async work analysis');

  try {
    let twitterMetrics = null;

    // Step 1: Scrape Twitter metrics
    if (url && isTwitterUrl(url)) {
      analysisLogger.info({ workId }, 'Scraping Twitter metrics');
      twitterMetrics = await scrapeTwitterMetrics(url);
      if (twitterMetrics) {
        await saveTwitterMetrics(workId, twitterMetrics);
        analysisLogger.info({ workId, metrics: twitterMetrics }, 'Twitter metrics saved');
      }
    }

    // Step 2: Get task name for AI analysis
    const task = await getTaskById(taskId);
    const taskName = task?.name ?? 'Unknown Task';

    // Step 3: AI Analysis
    analysisLogger.info({ workId }, 'Running AI analysis');
    const aiResult = await analyzeWorkWithAI({
      workUrl: url,
      taskName,
      description,
      twitterMetrics,
    });

    if (aiResult) {
      await updateWorkAiAnalysis(workId, {
        qualitySuggestion: aiResult.qualitySuggestion,
        justification: aiResult.justification,
        redFlags: aiResult.redFlags ?? undefined,
      });
      analysisLogger.info({ workId, quality: aiResult.qualitySuggestion }, 'AI analysis saved');
    }

    // Step 4: Update Discord review embed
    await updateReviewMessage(client, channelId, messageId, workId);

    analysisLogger.info({ workId }, 'Work analysis completed successfully');
  } catch (error) {
    analysisLogger.error({ err: error, workId }, 'Work analysis failed');
  }
}

async function updateReviewMessage(
  client: Client,
  channelId: string,
  messageId: string,
  workId: string
): Promise<void> {
  try {
    const workData = await getWorkWithMetrics(workId);
    if (!workData) return;

    const { work, metrics } = workData;
    const user = await getUserById(work.userId);
    if (!user) return;

    const task = await getTaskById(work.taskId);
    const channel = (await client.channels.fetch(channelId)) as TextChannel | null;
    if (!channel) return;

    const message = await channel.messages.fetch(messageId);
    if (!message) return;

    const discordUser = await client.users.fetch(user.discordId);

    const twitterMetrics = metrics
      ? {
          likes: metrics.likes,
          retweets: metrics.retweets,
          replies: metrics.replies,
          views: metrics.views,
          bookmarks: metrics.bookmarks,
          engagementRate: String(metrics.engagementRate),
        }
      : undefined;

    const aiAnalysis = work.aiAnalyzed
      ? {
          qualitySuggestion: work.aiQualitySuggestion,
          justification: work.aiJustification,
          redFlags: work.aiRedFlags,
        }
      : undefined;

    const userStats = await getUserStats(user.id);

    const updatedEmbed = createReviewEmbed(
      discordUser,
      user,
      {
        id: work.id,
        taskName: task?.name ?? 'Unknown Task',
        taskXp: task?.xpReward ?? 0,
        url: work.url,
        description: work.description,
      },
      aiAnalysis,
      twitterMetrics,
      userStats
    );

    await message.edit({
      embeds: [updatedEmbed],
      components: [createReviewButtons(work.id)],
    });

    analysisLogger.info({ workId, messageId }, 'Review message updated with analysis data');
  } catch (error) {
    analysisLogger.error({ err: error, workId, messageId }, 'Failed to update review message');
  }
}
