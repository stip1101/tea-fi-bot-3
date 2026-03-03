// Work Statuses
export const WORK_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

// XP Sources
export const XP_SOURCES = {
  WORK_APPROVED: 'work_approved',
  BONUS: 'bonus',
  ADMIN_ADJUSTMENT: 'admin_adjustment',
} as const;

export type XpSource = (typeof XP_SOURCES)[keyof typeof XP_SOURCES];

// Rate Limiting
export const RATE_LIMITS = {
  SUBMIT_COOLDOWN_SECONDS: 300,
  MAX_PENDING_WORKS: 3,
} as const;

// Pagination
export const PAGINATION = {
  WORK_PAGE_SIZE: 5,
  WORK_MAX_PAGE: 200,
  LEADERBOARD_DEFAULT_LIMIT: 10,
  LEADERBOARD_PAGE_SIZE: 10,
  LEADERBOARD_MAX_PAGE: 50,
  PENDING_DISPLAY_LIMIT: 15,
  DASHBOARD_PAGE_SIZE: 10,
  DASHBOARD_MAX_PAGE: 50,
  TOP_PERFORMERS_LIMIT: 3,
} as const;

// Time Ranges (in days)
export const TIME_RANGES = {
  ACTIVE_USERS_PERIOD: 30,
  NEW_USERS_PERIOD: 7,
  WEEKLY_STATS_PERIOD: 7,
} as const;
