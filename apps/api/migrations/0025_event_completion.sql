ALTER TABLE "events" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "completed_by" text;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_completed_pair" CHECK (("events"."completed_at" IS NULL) = ("events"."completed_by" IS NULL));