import axios from 'axios';
import { logger } from '../utils/logger';
import { extractTweetId } from '../utils/url';

const twitterLogger = logger.child({ module: 'twitter-scraper' });

export interface TwitterMetrics {
  likes: number;
  retweets: number;
  replies: number;
  views: number;
  engagementRate: string;
  tweetCreatedAt?: Date;
}

const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;

const GRAPHQL_ENDPOINT = 'https://x.com/i/api/graphql/xOhkmRac04YFZmOzU9PJHg/TweetDetail';

// GraphQL features required for the TweetDetail query
const GRAPHQL_FEATURES = {
  creator_subscriptions_tweet_preview_api_enabled: true,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  creator_subscriptions_quote_tweet_preview_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  rweb_video_timestamps_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  rweb_tipjar_consumption_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_enhance_cards_enabled: false,
  premium_content_api_read_enabled: false,
  responsive_web_media_download_video_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: false,
  responsive_web_grok_share_attachment_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  tweetypie_unmention_optimization_enabled: true,
};

function calculateEngagementRate(
  likes: number,
  retweets: number,
  replies: number,
  views: number
): string {
  if (views === 0) return '0.00';
  const engagement = ((likes + retweets + replies) / views) * 100;
  return engagement.toFixed(2);
}

// Extract metrics from tweet result object (works with different response structures)
function extractMetricsFromResult(tweetResult: any, tweetId: string): TwitterMetrics | null {
  // Handle TweetWithVisibilityResults wrapper
  const actualResult = tweetResult?.tweet || tweetResult;

  // Handle tombstone (deleted/restricted) tweets
  if (actualResult?.__typename === 'TweetTombstone') {
    twitterLogger.warn({ tweetId }, 'Tweet is tombstoned (deleted or restricted)');
    return null;
  }

  const legacy = actualResult?.legacy;

  if (!legacy) {
    twitterLogger.warn({ tweetId, typename: actualResult?.__typename }, 'No legacy data in tweet result');
    return null;
  }

  // Extract metrics
  const likes = legacy.favorite_count ?? 0;
  const retweets = legacy.retweet_count ?? 0;
  const replies = legacy.reply_count ?? 0;

  // Views are in actualResult.views.count (as string)
  const viewsStr = actualResult.views?.count;
  const views = viewsStr ? parseInt(viewsStr, 10) : 0;

  const metrics: TwitterMetrics = {
    likes,
    retweets,
    replies,
    views,
    engagementRate: calculateEngagementRate(likes, retweets, replies, views),
    tweetCreatedAt: legacy.created_at ? new Date(legacy.created_at) : undefined,
  };

  twitterLogger.info(
    { tweetId, likes, retweets, replies, views, engagementRate: metrics.engagementRate },
    'Successfully scraped Twitter metrics via GraphQL'
  );

  return metrics;
}

export async function scrapeTwitterMetrics(url: string): Promise<TwitterMetrics | null> {
  if (!BEARER_TOKEN) {
    twitterLogger.warn('TWITTER_BEARER_TOKEN not configured, cannot fetch metrics');
    return null;
  }

  const tweetId = extractTweetId(url);

  if (!tweetId) {
    twitterLogger.warn({ url }, 'Could not extract tweet ID from URL');
    return null;
  }

  const cookies = process.env.TWITTER_COOKIES;
  if (!cookies) {
    twitterLogger.warn('TWITTER_COOKIES not configured, cannot fetch metrics');
    return null;
  }

  // Extract ct0 (CSRF token) from cookies
  const ct0Match = cookies.match(/ct0=([^;]+)/);
  const ct0Token = ct0Match?.[1];

  if (!ct0Token) {
    twitterLogger.warn('ct0 token not found in TWITTER_COOKIES');
    return null;
  }

  const variables = {
    focalTweetId: tweetId,
    with_rux_injections: false,
    rankingMode: 'Relevance',
    includePromotedContent: true,
    withCommunity: true,
    withQuickPromoteEligibilityTweetFields: true,
    withBirdwatchNotes: true,
    withVoice: true,
  };

  const fieldToggles = {
    withArticleRichContentState: true,
    withArticlePlainText: false,
    withGrokAnalyze: false,
    withDisallowedReplyControls: false,
  };

  try {
    const response = await axios.get(GRAPHQL_ENDPOINT, {
      params: {
        variables: JSON.stringify(variables),
        features: JSON.stringify(GRAPHQL_FEATURES),
        fieldToggles: JSON.stringify(fieldToggles),
      },
      headers: {
        Authorization: `Bearer ${BEARER_TOKEN}`,
        'x-csrf-token': ct0Token,
        'x-twitter-auth-type': 'OAuth2Session',
        'x-twitter-active-user': 'yes',
        'x-twitter-client-language': 'en',
        Cookie: cookies,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: 'https://x.com/',
        Origin: 'https://x.com',
      },
      timeout: 15000,
    });

    // Navigate the GraphQL response structure to find the tweet
    // Twitter API returns data under "threaded_conversation_with_injections" for TweetDetail endpoint
    const conversationData =
      response.data?.data?.threaded_conversation_with_injections ||
      response.data?.data?.tweetDetail;

    const instructions = conversationData?.instructions;

    if (!instructions) {
      twitterLogger.warn(
        { tweetId, dataKeys: Object.keys(response.data?.data || {}) },
        'No instructions in GraphQL response'
      );
      return null;
    }

    // Find the TimelineAddEntries instruction
    const addEntriesInstruction = instructions.find(
      (instruction: { type: string }) => instruction.type === 'TimelineAddEntries'
    );

    if (!addEntriesInstruction?.entries) {
      twitterLogger.warn({ tweetId }, 'No entries found in GraphQL response');
      return null;
    }

    // Find the tweet entry
    const tweetEntry = addEntriesInstruction.entries.find(
      (entry: { entryId: string }) => entry.entryId === `tweet-${tweetId}`
    );

    if (!tweetEntry) {
      twitterLogger.warn({ tweetId }, 'Tweet entry not found in GraphQL response');
      return null;
    }

    // Extract tweet result - handle both regular and tombstone tweets
    const tweetResult =
      tweetEntry.content?.itemContent?.tweet_results?.result;

    if (!tweetResult) {
      twitterLogger.warn({ tweetId }, 'Tweet result not found in entry');
      return null;
    }

    return extractMetricsFromResult(tweetResult, tweetId);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;

      if (status === 401) {
        twitterLogger.error(
          { tweetId },
          'Twitter authentication failed - check TWITTER_COOKIES validity'
        );
      } else if (status === 403) {
        twitterLogger.error(
          { tweetId },
          'Twitter access forbidden - cookies may have expired'
        );
      } else if (status === 404) {
        twitterLogger.warn({ tweetId }, 'Tweet not found (404)');
      } else if (status === 429) {
        twitterLogger.warn({ tweetId }, 'Twitter rate limit hit');
      } else {
        twitterLogger.error(
          { err: error.message, tweetId, status },
          'Failed to fetch Twitter metrics via GraphQL'
        );
      }
    } else {
      twitterLogger.error({ err: error, tweetId }, 'Unexpected error scraping Twitter');
    }

    return null;
  }
}
