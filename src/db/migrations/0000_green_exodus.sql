CREATE TYPE "public"."teafi_role" AS ENUM('none', 'sprout_leaf', 'green_leaf', 'golden_leaf');--> statement-breakpoint
CREATE TYPE "public"."work_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "local_lead_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"doc_link" text NOT NULL,
	"comment" text,
	"month_year" text NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_history" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"previous_role" "teafi_role" NOT NULL,
	"new_role" "teafi_role" NOT NULL,
	"reason" text NOT NULL,
	"promoted_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"xp_reward" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "twitter_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"work_id" text NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"retweets" integer DEFAULT 0 NOT NULL,
	"replies" integer DEFAULT 0 NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"engagement_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"tweet_created_at" timestamp,
	"scraped_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "twitter_metrics_work_id_unique" UNIQUE("work_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"discord_id" text NOT NULL,
	"role" "teafi_role" DEFAULT 'none' NOT NULL,
	"total_xp" integer DEFAULT 0 NOT NULL,
	"bonus_xp" integer DEFAULT 0 NOT NULL,
	"works_count" integer DEFAULT 0 NOT NULL,
	"is_banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"registered_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_discord_id_unique" UNIQUE("discord_id")
);
--> statement-breakpoint
CREATE TABLE "works" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"task_id" text NOT NULL,
	"url" text,
	"description" text,
	"status" "work_status" DEFAULT 'pending' NOT NULL,
	"reviewer_id" text,
	"reviewed_at" timestamp,
	"review_notes" text,
	"quality_score" integer,
	"xp_awarded" integer,
	"bonus_xp_awarded" integer DEFAULT 0 NOT NULL,
	"ai_analyzed" boolean DEFAULT false NOT NULL,
	"ai_quality_suggestion" integer,
	"ai_justification" text,
	"ai_red_flags" text,
	"review_message_id" text,
	"review_channel_id" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xp_history" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"change" integer NOT NULL,
	"source" text NOT NULL,
	"previous_value" integer NOT NULL,
	"new_value" integer NOT NULL,
	"work_id" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "local_lead_reports" ADD CONSTRAINT "local_lead_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_history" ADD CONSTRAINT "role_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "twitter_metrics" ADD CONSTRAINT "twitter_metrics_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_history" ADD CONSTRAINT "xp_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_history" ADD CONSTRAINT "xp_history_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "local_lead_reports_user_id_idx" ON "local_lead_reports" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "local_lead_reports_user_month_idx" ON "local_lead_reports" USING btree ("user_id","month_year");--> statement-breakpoint
CREATE INDEX "role_history_user_id_idx" ON "role_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tasks_is_active_idx" ON "tasks" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "twitter_metrics_work_id_idx" ON "twitter_metrics" USING btree ("work_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_discord_id_idx" ON "users" USING btree ("discord_id");--> statement-breakpoint
CREATE INDEX "users_total_xp_idx" ON "users" USING btree ("total_xp");--> statement-breakpoint
CREATE INDEX "users_is_banned_idx" ON "users" USING btree ("is_banned");--> statement-breakpoint
CREATE INDEX "users_last_activity_idx" ON "users" USING btree ("last_activity_at");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "works_user_id_idx" ON "works" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "works_task_id_idx" ON "works" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "works_status_idx" ON "works" USING btree ("status");--> statement-breakpoint
CREATE INDEX "works_submitted_at_idx" ON "works" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "works_user_status_idx" ON "works" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "works_reviewer_id_idx" ON "works" USING btree ("reviewer_id");--> statement-breakpoint
CREATE INDEX "works_user_status_submitted_idx" ON "works" USING btree ("user_id","status","submitted_at");--> statement-breakpoint
CREATE INDEX "works_status_submitted_idx" ON "works" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "works_url_unique_idx" ON "works" USING btree ("url");--> statement-breakpoint
CREATE INDEX "xp_history_user_id_idx" ON "xp_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "xp_history_created_at_idx" ON "xp_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "xp_history_user_source_created_idx" ON "xp_history" USING btree ("user_id","source","created_at");