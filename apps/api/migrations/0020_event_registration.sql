CREATE TABLE "registration_forms" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text NOT NULL,
	"code" text DEFAULT vada_invite_code() NOT NULL,
	"accepting" boolean DEFAULT true NOT NULL,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone NOT NULL,
	"capacity" integer,
	"notice" text,
	"collect_phone" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registration_forms_event_id_unique" UNIQUE("event_id"),
	CONSTRAINT "registration_forms_code_unique" UNIQUE("code"),
	CONSTRAINT "registration_forms_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "registration_forms_code_format" CHECK ("registration_forms"."code" ~ '^[2-9A-HJ-NP-Z]{8}$'),
	CONSTRAINT "registration_forms_opens_before_closes" CHECK ("registration_forms"."opens_at" IS NULL OR "registration_forms"."opens_at" < "registration_forms"."closes_at"),
	CONSTRAINT "registration_forms_time_range" CHECK (("registration_forms"."opens_at" IS NULL OR "registration_forms"."opens_at" BETWEEN '2000-01-01T00:00+09:00' AND '2999-12-31T23:59+09:00')
    AND "registration_forms"."closes_at" BETWEEN '2000-01-01T00:00+09:00' AND '2999-12-31T23:59+09:00'),
	CONSTRAINT "registration_forms_capacity_range" CHECK ("registration_forms"."capacity" BETWEEN 1 AND 5000),
	CONSTRAINT "registration_forms_notice_not_blank" CHECK ("registration_forms"."notice" ~ '[^[:space:]]'),
	CONSTRAINT "registration_forms_notice_length" CHECK (char_length("registration_forms"."notice") <= 1000),
	CONSTRAINT "registration_forms_version_positive" CHECK ("registration_forms"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"form_id" text NOT NULL,
	"token_hash" text,
	"name" text,
	"student_id" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" text,
	"purged_at" timestamp with time zone,
	CONSTRAINT "registrations_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "registrations_purged_state" CHECK (("registrations"."purged_at" IS NULL AND "registrations"."token_hash" IS NOT NULL AND "registrations"."name" IS NOT NULL
    AND "registrations"."student_id" IS NOT NULL) OR ("registrations"."purged_at" IS NOT NULL AND "registrations"."token_hash" IS NULL AND "registrations"."name" IS NULL
    AND "registrations"."student_id" IS NULL AND "registrations"."phone" IS NULL)),
	CONSTRAINT "registrations_cancel_purges" CHECK ("registrations"."cancelled_at" IS NULL OR "registrations"."purged_at" IS NOT NULL),
	CONSTRAINT "registrations_cancelled_pair" CHECK ("registrations"."cancelled_by" IS NULL OR "registrations"."cancelled_at" IS NOT NULL),
	CONSTRAINT "registrations_token_hash_format" CHECK ("registrations"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "registrations_name_not_blank" CHECK ("registrations"."name" ~ '[^[:space:]]'),
	CONSTRAINT "registrations_name_length" CHECK (char_length("registrations"."name") <= 30),
	CONSTRAINT "registrations_student_id_format" CHECK ("registrations"."student_id" ~ '^[0-9]{6,12}$'),
	CONSTRAINT "registrations_phone_format" CHECK ("registrations"."phone" ~ '^01[0-9]{8,9}$')
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "place" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "registration_forms" ADD CONSTRAINT "registration_forms_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_forms" ADD CONSTRAINT "registration_forms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_forms" ADD CONSTRAINT "registration_forms_event_same_organization" FOREIGN KEY ("organization_id","event_id") REFERENCES "public"."events"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_form_same_organization" FOREIGN KEY ("organization_id","form_id") REFERENCES "public"."registration_forms"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_form_student_active_unique" ON "registrations" USING btree ("form_id","student_id") WHERE "registrations"."purged_at" IS NULL;--> statement-breakpoint
CREATE INDEX "registrations_form_created_idx" ON "registrations" USING btree ("form_id","created_at");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_ends_after_start" CHECK ("events"."ends_at" IS NULL OR ("events"."starts_at" IS NOT NULL AND "events"."ends_at" > "events"."starts_at"));--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_time_range" CHECK (("events"."starts_at" IS NULL OR "events"."starts_at" BETWEEN '2000-01-01T00:00+09:00' AND '2999-12-31T23:59+09:00')
    AND ("events"."ends_at" IS NULL OR "events"."ends_at" BETWEEN '2000-01-01T00:00+09:00' AND '2999-12-31T23:59+09:00'));--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_place_not_blank" CHECK ("events"."place" ~ '[^[:space:]]');--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_place_length" CHECK (char_length("events"."place") <= 100);--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_version_positive" CHECK ("events"."version" >= 1);