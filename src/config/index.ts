export * from './roles';

export const COLORS = {
  PRIMARY: 0xE91E63,    // Tea Pink (main brand color)
  SECONDARY: 0xF48FB1,  // Light Pink
  GOLD: 0xFFD700,       // Gold for Golden Leaf
  SUCCESS: 0x4CAF50,    // Green for approvals
  ERROR: 0xF44336,      // Red for rejections
  INFO: 0xE91E63,       // Pink for info embeds
  SPROUT: 0x8BC34A,     // Light green for Sprout Leaf
  GREEN_LEAF: 0x4CAF50,  // Green for Green Leaf
  GOLDEN_LEAF: 0xFFD700, // Gold for Golden Leaf
};

export const EMOJIS = {
  TEA: '🍵',
  LEAF: '🍃',
  HERB: '🌿',
  FALLEN_LEAF: '🍂',
  SEEDLING: '🌱',
  STAR: '⭐',
  CHECK: '✅',
  CROSS: '❌',
  PENDING: '⏳',
  USER: '👤',
  USERS: '👥',
  LINK: '🔗',
  CHART: '📊',
  FOLDER: '📁',
  MEMO: '📝',
  INBOX: '📥',
  ROBOT: '🤖',
  WARNING: '⚠️',
  CLOCK: '🕐',
  HEART: '❤️',
  RETWEET: '🔄',
  COMMENT: '💬',
  EYE: '👁️',
  BANNED: '🚫',
  GOLD_MEDAL: '🥇',
  SILVER_MEDAL: '🥈',
  BRONZE_MEDAL: '🥉',
  TROPHY: '🏆',
  TARGET: '🎯',
  FIRE: '🔥',
  MONEY: '💰',
  DIAMOND: '💎',
};

export function getChannelIds() {
  return {
    REVIEW_CHANNEL_ID: process.env.REVIEW_CHANNEL_ID || '',
    TASK_LOG_CHANNEL_ID: process.env.TASK_LOG_CHANNEL_ID || '',
    WORK_CHANNEL_ID: process.env.WORK_CHANNEL_ID || '',
    LOCAL_LEAD_REVIEW_CHANNEL_ID: process.env.LOCAL_LEAD_REVIEW_CHANNEL_ID || '',
  };
}

export function getMonthlyPool(): number {
  return parseInt(process.env.MONTHLY_POOL || '2500', 10);
}
