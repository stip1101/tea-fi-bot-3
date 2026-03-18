import axios from 'axios';
import { logger } from '../utils/logger';
import { extractTweetId } from '../utils/url';

const twitterLogger = logger.child({ module: 'twitter-scraper' });

const API_BASE = 'https://api.twitterapi.io/twitter/tweets';
const TIMEOUT_MS = 15000;

export interface TwitterMetrics {
  likes: number;
  retweets: number;
  replies: number;
  views: number;
  bookmarks: number;
  engagementRate: string;
  tweetCreatedAt?: Date;
  isReply: boolean;
  inReplyToId: string | null;
  tweetText: string | null;
  authorUsername: string | null;
}

function calculateEngagementRate(
  likes: number,
  retweets: number,
  replies: number,
  views: number
): string {
  if (views === 0) return '0.00';
  return (((likes + retweets + replies) / views) * 100).toFixed(2);
}

function getApiKey(): string | null {
  const key = process.env.TWITTER_API_KEY;
  if (!key) {
    twitterLogger.warn('TWITTER_API_KEY not configured');
    return null;
  }
  return key;
}

function parseTweetData(tweet: any): TwitterMetrics {
  const likes = tweet.likeCount ?? 0;
  const retweets = tweet.retweetCount ?? 0;
  const replies = tweet.replyCount ?? 0;
  const views = tweet.viewCount ?? 0;
  const bookmarks = tweet.bookmarkCount ?? 0;

  return {
    likes,
    retweets,
    replies,
    views,
    bookmarks,
    engagementRate: calculateEngagementRate(likes, retweets, replies, views),
    tweetCreatedAt: tweet.createdAt ? new Date(tweet.createdAt) : undefined,
    isReply: tweet.isReply ?? false,
    inReplyToId: tweet.inReplyToId ?? null,
    tweetText: tweet.text ?? null,
    authorUsername: tweet.author?.userName ?? null,
  };
}

function handleAxiosError(error: any, context: string): void {
  if (!axios.isAxiosError(error)) {
    twitterLogger.error({ err: error, context }, 'Unexpected error');
    return;
  }
  const status = error.response?.status;
  if (status === 400) twitterLogger.error({ context }, 'Bad request - check tweet IDs');
  else if (status === 401) twitterLogger.error({ context }, 'Auth failed - check TWITTER_API_KEY');
  else if (status === 429) twitterLogger.warn({ context }, 'Rate limit hit');
  else twitterLogger.error({ err: error.message, context, status }, 'Failed to fetch metrics');
}

export async function scrapeTwitterMetrics(url: string): Promise<TwitterMetrics | null> {
  const tweetId = extractTweetId(url);
  if (!tweetId) {
    twitterLogger.warn({ url }, 'Could not extract tweet ID from URL');
    return null;
  }

  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const response = await axios.get(API_BASE, {
      params: { tweet_ids: tweetId },
      headers: { 'x-api-key': apiKey },
      timeout: TIMEOUT_MS,
    });

    if (response.data?.status !== 'success' || !response.data?.tweets?.length) {
      twitterLogger.warn({ tweetId }, 'No tweet data in API response');
      return null;
    }

    const metrics = parseTweetData(response.data.tweets[0]);
    twitterLogger.info(
      { tweetId, likes: metrics.likes, retweets: metrics.retweets, views: metrics.views, engagementRate: metrics.engagementRate },
      'Successfully scraped Twitter metrics'
    );
    return metrics;
  } catch (error) {
    handleAxiosError(error, `scrapeTwitterMetrics(${tweetId})`);
    return null;
  }
}

export async function scrapeMultipleTweets(
  tweetIds: string[]
): Promise<Map<string, TwitterMetrics>> {
  const result = new Map<string, TwitterMetrics>();
  if (tweetIds.length === 0) return result;

  const apiKey = getApiKey();
  if (!apiKey) return result;

  try {
    const response = await axios.get(API_BASE, {
      params: { tweet_ids: tweetIds.join(',') },
      headers: { 'x-api-key': apiKey },
      timeout: TIMEOUT_MS,
    });

    if (response.data?.status !== 'success' || !response.data?.tweets?.length) return result;

    for (const tweet of response.data.tweets) {
      if (!tweet.id) continue;
      result.set(String(tweet.id), parseTweetData(tweet));
    }

    twitterLogger.info({ requested: tweetIds.length, received: result.size }, 'Batch scrape completed');
    return result;
  } catch (error) {
    handleAxiosError(error, `scrapeMultipleTweets(${tweetIds.length} tweets)`);
    return result;
  }
}
