ALTER TABLE "local_lead_reports" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "local_lead_reports" ADD COLUMN "reviewer_id" text;--> statement-breakpoint
ALTER TABLE "local_lead_reports" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "local_lead_reports" ADD COLUMN "review_notes" text;--> statement-breakpoint
ALTER TABLE "local_lead_reports" ADD COLUMN "review_message_id" text;--> statement-breakpoint
ALTER TABLE "local_lead_reports" ADD COLUMN "review_channel_id" text;