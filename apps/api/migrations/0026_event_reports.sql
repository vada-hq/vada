CREATE TABLE "event_reports" (
	"event_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"operations" text,
	"went_well" text,
	"shortfalls" text,
	"improvements" text,
	"handover" text,
	"facts" jsonb,
	"published_at" timestamp with time zone,
	"published_by" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_reports_status_valid" CHECK ("event_reports"."status" IN ('draft','published')),
	CONSTRAINT "event_reports_published_state" CHECK (("event_reports"."status" = 'published') = ("event_reports"."published_at" IS NOT NULL)
    AND ("event_reports"."published_at" IS NULL) = ("event_reports"."published_by" IS NULL) AND ("event_reports"."published_at" IS NULL) = ("event_reports"."facts" IS NULL)),
	CONSTRAINT "event_reports_published_complete" CHECK ("event_reports"."status" <> 'published' OR ("event_reports"."operations" IS NOT NULL AND "event_reports"."went_well" IS NOT NULL
    AND "event_reports"."shortfalls" IS NOT NULL AND "event_reports"."improvements" IS NOT NULL AND "event_reports"."handover" IS NOT NULL)),
	CONSTRAINT "event_reports_operations_not_blank" CHECK ("event_reports"."operations" ~ '[^[:space:]]'),
	CONSTRAINT "event_reports_operations_length" CHECK (char_length("event_reports"."operations") <= 2000),
	CONSTRAINT "event_reports_went_well_not_blank" CHECK ("event_reports"."went_well" ~ '[^[:space:]]'),
	CONSTRAINT "event_reports_went_well_length" CHECK (char_length("event_reports"."went_well") <= 2000),
	CONSTRAINT "event_reports_shortfalls_not_blank" CHECK ("event_reports"."shortfalls" ~ '[^[:space:]]'),
	CONSTRAINT "event_reports_shortfalls_length" CHECK (char_length("event_reports"."shortfalls") <= 2000),
	CONSTRAINT "event_reports_improvements_not_blank" CHECK ("event_reports"."improvements" ~ '[^[:space:]]'),
	CONSTRAINT "event_reports_improvements_length" CHECK (char_length("event_reports"."improvements") <= 2000),
	CONSTRAINT "event_reports_handover_not_blank" CHECK ("event_reports"."handover" ~ '[^[:space:]]'),
	CONSTRAINT "event_reports_handover_length" CHECK (char_length("event_reports"."handover") <= 2000),
	CONSTRAINT "event_reports_facts_object" CHECK (jsonb_typeof("event_reports"."facts") = 'object'),
	CONSTRAINT "event_reports_version_positive" CHECK ("event_reports"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "owner_department_id" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "event_reports" ADD CONSTRAINT "event_reports_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_reports" ADD CONSTRAINT "event_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_reports" ADD CONSTRAINT "event_reports_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_reports" ADD CONSTRAINT "event_reports_event_same_organization" FOREIGN KEY ("organization_id","event_id") REFERENCES "public"."events"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_owner_department_same_organization" FOREIGN KEY ("organization_id","owner_department_id") REFERENCES "public"."departments"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_owner_same_organization" FOREIGN KEY ("organization_id","owner_id") REFERENCES "public"."memberships"("organization_id","user_id") ON DELETE restrict ON UPDATE no action;