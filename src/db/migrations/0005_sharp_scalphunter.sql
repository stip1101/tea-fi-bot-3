CREATE TABLE "chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"discord_message_id" text NOT NULL,
	"author_id" text NOT NULL,
	"author_username" text NOT NULL,
	"channel_id" text NOT NULL,
	"content" text NOT NULL,
	"content_length" integer DEFAULT 0 NOT NULL,
	"is_reply" boolean DEFAULT false NOT NULL,
	"reply_to_message_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_messages_discord_message_id_unique" UNIQUE("discord_message_id")
);
--> statement-breakpoint
CREATE INDEX "chat_messages_created_at_idx" ON "chat_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "chat_messages_author_id_idx" ON "chat_messages" USING btree ("author_id");