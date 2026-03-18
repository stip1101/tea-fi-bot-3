ALTER TABLE "twitter_metrics" ADD COLUMN "bookmarks" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "twitter_metrics" ADD COLUMN "is_reply" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "twitter_metrics" ADD COLUMN "in_reply_to_id" text;--> statement-breakpoint
ALTER TABLE "twitter_metrics" ADD COLUMN "tweet_text" text;--> statement-breakpoint
ALTER TABLE "twitter_metrics" ADD COLUMN "author_username" text;