ALTER TABLE "registrations" ADD COLUMN "checked_in_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "checked_in_by" text;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_checked_in_by_users_id_fk" FOREIGN KEY ("checked_in_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_checked_in_pair" CHECK (("registrations"."checked_in_at" IS NULL) = ("registrations"."checked_in_by" IS NULL));--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_cancelled_not_checked_in" CHECK ("registrations"."cancelled_at" IS NULL OR "registrations"."checked_in_at" IS NULL);