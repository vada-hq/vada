ALTER TABLE "event_archives" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_archives" ADD COLUMN "published_by_member_id" text;--> statement-breakpoint
ALTER TABLE "event_archives" ADD COLUMN "frozen" jsonb;--> statement-breakpoint
ALTER TABLE "event_archives" ADD CONSTRAINT "event_archives_publisher_same_org" FOREIGN KEY ("org_id","published_by_member_id") REFERENCES "public"."members"("org_id","id") ON DELETE set null ON UPDATE no action;