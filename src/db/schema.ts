import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
  decimal,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ==================== ENUMS ====================

export const teafiRoleEnum = pgEnum('teafi_role', ['none', 'sprout_leaf', 'green_leaf', 'golden_leaf']);

export const workStatusEnum = pgEnum('work_status', ['pending', 'approved', 'rejected']);

// ==================== TABLES ====================

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    discordId: text('discord_id').notNull().unique(),
    discordUsername: text('discord_username'),

    // Role
    role: teafiRoleEnum('role').notNull().default('none'),

    // Stats
    totalXp: integer('total_xp').notNull().default(0),
    bonusXp: integer('bonus_xp').notNull().default(0),
    worksCount: integer('works_count').notNull().default(0),

    // Ban
    isBanned: boolean('is_banned').notNull().default(false),
    banReason: text('ban_reason'),

    // Timestamps
    lastActivityAt: timestamp('last_activity_at').notNull().defaultNow(),
    registeredAt: timestamp('registered_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_discord_id_idx').on(table.discordId),
    index('users_discord_username_idx').on(table.discordUsername),
    index('users_total_xp_idx').on(table.totalXp),
    index('users_is_banned_idx').on(table.isBanned),
    index('users_last_activity_idx').on(table.lastActivityAt),
    index('users_role_idx').on(table.role),
  ]
);

export const tasks = pgTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    xpReward: integer('xp_reward').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('tasks_is_active_idx').on(table.isActive)]
);

export const works = pgTable(
  'works',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id),

    // Work details
    url: text('url'),
    description: text('description'),

    // Review
    status: workStatusEnum('status').notNull().default('pending'),
    reviewerId: text('reviewer_id'),
    reviewedAt: timestamp('reviewed_at'),
    reviewNotes: text('review_notes'),

    // Scores
    qualityScore: integer('quality_score'),
    xpAwarded: integer('xp_awarded'),
    bonusXpAwarded: integer('bonus_xp_awarded').notNull().default(0),

    // AI Analysis
    aiAnalyzed: boolean('ai_analyzed').notNull().default(false),
    aiQualitySuggestion: integer('ai_quality_suggestion'),
    aiJustification: text('ai_justification'),
    aiRedFlags: text('ai_red_flags'),

    // Discord message tracking
    reviewMessageId: text('review_message_id'),
    reviewChannelId: text('review_channel_id'),

    // Timestamps
    submittedAt: timestamp('submitted_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('works_user_id_idx').on(table.userId),
    index('works_task_id_idx').on(table.taskId),
    index('works_status_idx').on(table.status),
    index('works_submitted_at_idx').on(table.submittedAt),
    index('works_user_status_idx').on(table.userId, table.status),
    index('works_reviewer_id_idx').on(table.reviewerId),
    index('works_user_status_submitted_idx').on(table.userId, table.status, table.submittedAt),
    index('works_status_submitted_idx').on(table.status, table.submittedAt),
    uniqueIndex('works_url_unique_idx').on(table.url),
  ]
);

export const twitterMetrics = pgTable(
  'twitter_metrics',
  {
    id: text('id').primaryKey(),
    workId: text('work_id')
      .notNull()
      .references(() => works.id)
      .unique(),

    likes: integer('likes').notNull().default(0),
    retweets: integer('retweets').notNull().default(0),
    replies: integer('replies').notNull().default(0),
    views: integer('views').notNull().default(0),
    bookmarks: integer('bookmarks').notNull().default(0),
    engagementRate: decimal('engagement_rate', { precision: 5, scale: 2 }).notNull().default('0'),

    isReply: boolean('is_reply').notNull().default(false),
    inReplyToId: text('in_reply_to_id'),
    tweetText: text('tweet_text'),
    authorUsername: text('author_username'),

    tweetCreatedAt: timestamp('tweet_created_at'),
    scrapedAt: timestamp('scraped_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('twitter_metrics_work_id_idx').on(table.workId)]
);

export const xpHistory = pgTable(
  'xp_history',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),

    change: integer('change').notNull(),
    source: text('source').notNull(),
    previousValue: integer('previous_value').notNull(),
    newValue: integer('new_value').notNull(),

    workId: text('work_id').references(() => works.id),
    notes: text('notes'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('xp_history_user_id_idx').on(table.userId),
    index('xp_history_created_at_idx').on(table.createdAt),
    index('xp_history_user_source_created_idx').on(table.userId, table.source, table.createdAt),
  ]
);

export const roleHistory = pgTable(
  'role_history',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),

    previousRole: teafiRoleEnum('previous_role').notNull(),
    newRole: teafiRoleEnum('new_role').notNull(),
    reason: text('reason').notNull(),

    promotedBy: text('promoted_by'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('role_history_user_id_idx').on(table.userId)]
);

export const localLeadReports = pgTable(
  'local_lead_reports',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),

    docLink: text('doc_link').notNull(),
    comment: text('comment'),
    monthYear: text('month_year').notNull(), // "2026-02"

    status: text('status').notNull().default('pending'), // pending | approved | rejected
    reviewerId: text('reviewer_id'),
    reviewedAt: timestamp('reviewed_at'),
    reviewNotes: text('review_notes'),
    qualityScore: integer('quality_score'),
    xpAwarded: integer('xp_awarded'),
    reviewMessageId: text('review_message_id'),
    reviewChannelId: text('review_channel_id'),

    submittedAt: timestamp('submitted_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('local_lead_reports_user_id_idx').on(table.userId),
    uniqueIndex('local_lead_reports_user_month_idx').on(table.userId, table.monthYear),
  ]
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: text('id').primaryKey(),
    discordMessageId: text('discord_message_id').notNull().unique(),
    authorId: text('author_id').notNull(),
    authorUsername: text('author_username').notNull(),
    channelId: text('channel_id').notNull(),
    content: text('content').notNull(),
    contentLength: integer('content_length').notNull().default(0),
    isReply: boolean('is_reply').notNull().default(false),
    replyToMessageId: text('reply_to_message_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('chat_messages_created_at_idx').on(table.createdAt),
    index('chat_messages_author_id_idx').on(table.authorId),
  ]
);

// ==================== RELATIONS ====================

export const usersRelations = relations(users, ({ many }) => ({
  works: many(works),
  xpHistory: many(xpHistory),
  roleHistory: many(roleHistory),
  localLeadReports: many(localLeadReports),
}));

export const tasksRelations = relations(tasks, ({ many }) => ({
  works: many(works),
}));

export const worksRelations = relations(works, ({ one }) => ({
  user: one(users, {
    fields: [works.userId],
    references: [users.id],
  }),
  task: one(tasks, {
    fields: [works.taskId],
    references: [tasks.id],
  }),
  twitterMetrics: one(twitterMetrics, {
    fields: [works.id],
    references: [twitterMetrics.workId],
  }),
}));

export const twitterMetricsRelations = relations(twitterMetrics, ({ one }) => ({
  work: one(works, {
    fields: [twitterMetrics.workId],
    references: [works.id],
  }),
}));

export const xpHistoryRelations = relations(xpHistory, ({ one }) => ({
  user: one(users, {
    fields: [xpHistory.userId],
    references: [users.id],
  }),
  work: one(works, {
    fields: [xpHistory.workId],
    references: [works.id],
  }),
}));

export const roleHistoryRelations = relations(roleHistory, ({ one }) => ({
  user: one(users, {
    fields: [roleHistory.userId],
    references: [users.id],
  }),
}));

export const localLeadReportsRelations = relations(localLeadReports, ({ one }) => ({
  user: one(users, {
    fields: [localLeadReports.userId],
    references: [users.id],
  }),
}));

// ==================== TYPE EXPORTS ====================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Work = typeof works.$inferSelect;
export type NewWork = typeof works.$inferInsert;
export type TwitterMetric = typeof twitterMetrics.$inferSelect;
export type XpHistoryEntry = typeof xpHistory.$inferSelect;
export type RoleHistoryEntry = typeof roleHistory.$inferSelect;
export type LocalLeadReport = typeof localLeadReports.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;

export type TeafiRole = 'none' | 'sprout_leaf' | 'green_leaf' | 'golden_leaf';
export type WorkStatus = 'pending' | 'approved' | 'rejected';
