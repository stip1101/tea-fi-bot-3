// Work categories
export type WorkCategory = 'local_initiative' | 'community' | 'content_ugc' | 'product_dapps';

// User levels (manual promotion by admins)
export type UserLevel = 'believer' | 'contributor' | 'igniter' | 'local_lead';

// Work status
export type WorkStatus = 'pending' | 'approved' | 'rejected';

// Twitter metrics interface
export interface TwitterMetrics {
  likes: number;
  retweets: number;
  replies: number;
  views: number;
  engagementRate: number;
  tweetCreatedAt: Date;
}

// AI Analysis result
export interface AIAnalysisResult {
  success: boolean;
  analysis?: {
    qualitySuggestion: number;      // 0-100
    engagementSuggestion: number;   // 0-100
    justification: string;          // Brief explanation (2-3 sentences)
    redFlags: string[];             // Array of warnings (if any)
    anomalyDetected: boolean;
    anomalyDescription?: string;
  };
  error?: string;
}

// Karma change reasons
export type KarmaChangeReason =
  | 'approved_high_quality'      // Quality 85%+: +25
  | 'approved_outstanding'       // Quality 95%+: +40
  | 'approved_good'              // Quality 70%+: +15
  | 'approved_low_quality'       // Quality 40-60%: -10
  | 'rejected'                   // Quality <40%: -30
  | 'streak_bonus'               // Every 5 approved in a row: +5
  | 'inactivity_decay';          // 30+ days inactive: -5/week

// Karma thresholds
export const KARMA_THRESHOLDS = {
  MIN: -500,
  MAX: 1000,
  STARTING: 0,
  GRACE_PERIOD_WORKS: 10,
} as const;

// Karma values
export const KARMA_VALUES = {
  APPROVED_OUTSTANDING: 40,      // Quality 95%+
  APPROVED_HIGH_QUALITY: 25,     // Quality 85%+
  APPROVED_GOOD: 15,             // Quality 70%+
  APPROVED_LOW_QUALITY: -10,     // Quality 40-60%
  REJECTED: -30,                 // Quality <40%
  STREAK_BONUS: 5,               // Every 5 approved
  INACTIVITY_DECAY: -5,          // Per week after 30 days
} as const;

// Quality score thresholds
export const QUALITY_THRESHOLDS = {
  OUTSTANDING: 95,
  HIGH_QUALITY: 85,
  GOOD: 70,
  ACCEPTABLE: 60,
  LOW: 40,
} as const;

// User averages for anomaly detection
export interface UserAverages {
  avgLikes: number;
  avgRetweets: number;
  avgReplies: number;
  avgViews: number;
  avgEngagementRate: number;
  count: number;
}
