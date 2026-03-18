import { openai, aiLogger } from '../ai/openai-client';
import type { TwitterMetrics } from './twitter-scraper';

export interface WorkAnalysisInput {
  workUrl: string | null | undefined;
  taskName: string;
  description: string | null | undefined;
  twitterMetrics: TwitterMetrics | null;
}

export interface WorkAnalysisResult {
  qualitySuggestion: number;
  justification: string;
  redFlags: string | null;
}

const ANALYSIS_TIMEOUT_MS = 30000;

const SYSTEM_PROMPT = `You are an AI content quality analyst for the TeaFi Program. Your task is to analyze content submissions and provide quality assessments.

You MUST respond with ONLY valid JSON in the following format:
{
  "qualitySuggestion": <number 0-100>,
  "justification": "<brief 1-2 sentence explanation>",
  "redFlags": "<null or description of concerns>"
}

Quality Score Guidelines:
- 90-100: Exceptional - viral potential, high-quality visuals, perfect messaging
- 70-89: Good - solid content, clear messaging, decent engagement
- 50-69: Average - meets requirements but lacks standout elements
- 30-49: Below Average - needs improvement in quality or messaging
- 0-29: Poor - low effort, off-brand, or problematic content

Red Flags to detect:
- Fake engagement (unusual like/view ratios)
- Spam patterns
- Off-brand or inappropriate content
- Misleading information
- Bot-like behavior
- Engagement farming

Consider the task context when evaluating quality and relevance.`;

export async function analyzeWorkWithAI(input: WorkAnalysisInput): Promise<WorkAnalysisResult | null> {
  if (!openai) {
    aiLogger.warn('OpenAI client not initialized - skipping AI analysis');
    return null;
  }

  const { workUrl, taskName, description, twitterMetrics } = input;

  let userPrompt = `Analyze this content submission:\n\n`;
  userPrompt += `**Task:** <task_name>${taskName}</task_name>\n`;

  if (workUrl) userPrompt += `**URL:** ${workUrl}\n`;
  if (description) userPrompt += `**Description:**\n<user_input>\n${description}\n</user_input>\n`;

  if (twitterMetrics) {
    userPrompt += `\n**Twitter Metrics:**\n`;
    userPrompt += `- Likes: ${twitterMetrics.likes.toLocaleString()}\n`;
    userPrompt += `- Retweets: ${twitterMetrics.retweets.toLocaleString()}\n`;
    userPrompt += `- Replies: ${twitterMetrics.replies.toLocaleString()}\n`;
    userPrompt += `- Views: ${twitterMetrics.views.toLocaleString()}\n`;
    userPrompt += `- Bookmarks: ${twitterMetrics.bookmarks.toLocaleString()}\n`;
    userPrompt += `- Engagement Rate: ${twitterMetrics.engagementRate}%\n`;
    userPrompt += `- Is Reply: ${twitterMetrics.isReply}\n`;
    if (twitterMetrics.authorUsername) {
      userPrompt += `- Author: @${twitterMetrics.authorUsername}\n`;
    }
    if (twitterMetrics.tweetText) {
      userPrompt += `- Tweet Text: "${twitterMetrics.tweetText.slice(0, 500)}"\n`;
    }
  } else {
    userPrompt += `\n**Note:** No Twitter metrics available.\n`;
  }

  userPrompt += `\nProvide your analysis in JSON format.`;

  try {
    aiLogger.info({ taskName, hasMetrics: !!twitterMetrics }, 'Starting AI work analysis');

    const response = await openai.chat.completions.create(
      {
        model: process.env.AI_ANALYZER_MODEL ?? 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      },
      { timeout: ANALYSIS_TIMEOUT_MS }
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      aiLogger.warn('Empty response from OpenAI');
      return null;
    }

    const parsed = JSON.parse(content) as {
      qualitySuggestion?: number;
      justification?: string;
      redFlags?: string | null;
    };

    const qualitySuggestion = Math.max(0, Math.min(100, parsed.qualitySuggestion ?? 50));

    const result: WorkAnalysisResult = {
      qualitySuggestion,
      justification: parsed.justification?.slice(0, 500) ?? 'Analysis completed.',
      redFlags: parsed.redFlags?.slice(0, 300) ?? null,
    };

    aiLogger.info({ qualitySuggestion }, 'AI analysis completed');
    return result;
  } catch (error) {
    if (error instanceof SyntaxError) {
      aiLogger.error({ err: error }, 'Failed to parse AI response as JSON');
    } else {
      aiLogger.error({ err: error }, 'AI analysis failed');
    }
    return null;
  }
}
