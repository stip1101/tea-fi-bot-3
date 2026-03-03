import type { WorkCategory, UserLevel } from '../types';

// Embed colors
export const COLORS = {
  PRIMARY: 0x5865f2,    // Discord blurple
  SUCCESS: 0x00ff00,    // Green
  ERROR: 0xff0000,      // Red
  WARNING: 0xffcc00,    // Yellow
  INFO: 0x00ccff,       // Cyan
  PENDING: 0xffa500,    // Orange
} as const;

// Level configuration
export const LEVEL_CONFIG: Record<UserLevel, { emoji: string; name: string; color: number }> = {
  believer: {
    emoji: '\u{1F331}',
    name: 'Believer',
    color: 0x7ed321,
  },
  contributor: {
    emoji: '\u2B50',
    name: 'Contributor',
    color: 0x4a90e2,
  },
  igniter: {
    emoji: '\u{1F525}',
    name: 'Igniter',
    color: 0xf5a623,
  },
  local_lead: {
    emoji: '\u{1F451}',
    name: 'Local Lead',
    color: 0x9013fe,
  },
};

// Category options for select menu
export const CATEGORY_OPTIONS: Array<{
  value: WorkCategory;
  label: string;
  description: string;
  emoji: string;
}> = [
  {
    value: 'local_initiative',
    label: 'Local Initiative',
    description: 'Meetups, events, local community building',
    emoji: '\u{1F30D}',
  },
  {
    value: 'community',
    label: 'Community',
    description: 'Discord moderation, community support',
    emoji: '\u{1F4AC}',
  },
  {
    value: 'content_ugc',
    label: 'Content/UGC',
    description: 'Tweets, threads, videos, memes',
    emoji: '\u{1F4DD}',
  },
  {
    value: 'product_dapps',
    label: 'Product/dApps',
    description: 'Building tools, integrations, dApps',
    emoji: '\u{1F6E0}\uFE0F',
  },
];

// Karma emoji indicators
export function getKarmaEmoji(karma: number): string {
  if (karma >= 800) return '\u{1F31F}'; // Exceptional
  if (karma >= 500) return '\u2B50';    // Excellent
  if (karma >= 200) return '\u2728';    // Good
  if (karma >= 0) return '\u{1F535}';   // Neutral
  if (karma >= -200) return '\u26A0\uFE0F'; // Warning
  if (karma >= -400) return '\u{1F534}'; // Critical
  return '\u{1F480}';                    // Danger
}

// Karma status text
export function getKarmaStatus(karma: number): string {
  if (karma >= 800) return 'Exceptional';
  if (karma >= 500) return 'Excellent';
  if (karma >= 200) return 'Good';
  if (karma >= 0) return 'Neutral';
  if (karma >= -200) return 'Low';
  if (karma >= -400) return 'Critical';
  return 'Danger';
}

// Format number with K/M suffixes
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

// Category labels
export const CATEGORY_LABELS: Record<WorkCategory, string> = {
  local_initiative: 'Local Initiative',
  community: 'Community',
  content_ugc: 'Content/UGC',
  product_dapps: 'Product/dApps',
};

// Category emojis
export const CATEGORY_EMOJIS: Record<WorkCategory, string> = {
  local_initiative: '\u{1F30D}',
  community: '\u{1F4AC}',
  content_ugc: '\u{1F4DD}',
  product_dapps: '\u{1F6E0}\uFE0F',
};
