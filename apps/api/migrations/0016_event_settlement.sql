CREATE TABLE "event_finance_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"changes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_finance_events_action_valid" CHECK ("event_finance_events"."action" IN ('budget_set','settled','reopened')),
	CONSTRAINT "event_finance_events_changes_object" CHECK (jsonb_typeof("event_finance_events"."changes") = 'object'),
	CONSTRAINT "event_finance_events_reason_when_reopened" CHECK (("event_finance_events"."action" = 'reopened') = ("event_finance_events"."reason" IS NOT NULL)),
	CONSTRAINT "event_finance_events_reason_not_blank" CHECK ("event_finance_events"."reason" ~ '[^[:space:]]'),
	CONSTRAINT "event_finance_events_reason_length" CHECK (char_length("event_finance_events"."reason") <= 200)
);
--> statement-breakpoint
CREATE TABLE "event_finances" (
	"event_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"budget" integer,
	"settled_at" timestamp with time zone,
	"settled_by" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_finances_budget_nonnegative" CHECK ("event_finances"."budget" >= 0),
	CONSTRAINT "event_finances_settled_pair" CHECK (("event_finances"."settled_at" IS NULL) = ("event_finances"."settled_by" IS NULL)),
	CONSTRAINT "event_finances_version_positive" CHECK ("event_finances"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "event_finance_events" ADD CONSTRAINT "event_finance_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_finance_events" ADD CONSTRAINT "event_finance_events_event_same_organization" FOREIGN KEY ("organization_id","event_id") REFERENCES "public"."events"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_finances" ADD CONSTRAINT "event_finances_settled_by_users_id_fk" FOREIGN KEY ("settled_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_finances" ADD CONSTRAINT "event_finances_event_same_organization" FOREIGN KEY ("organization_id","event_id") REFERENCES "public"."events"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_finance_events_event_idx" ON "event_finance_events" USING btree ("event_id","created_at");