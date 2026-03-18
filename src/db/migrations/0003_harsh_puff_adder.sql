ALTER TABLE "users" ADD COLUMN "discord_username" text;--> statement-breakpoint
CREATE INDEX "users_discord_username_idx" ON "users" USING btree ("discord_username");