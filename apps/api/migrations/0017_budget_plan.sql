CREATE TABLE "budget_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"period_id" text NOT NULL,
	"kind" text NOT NULL,
	"event_id" text,
	"name" text,
	"amount" integer,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_lines_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "budget_lines_event_unique" UNIQUE("event_id"),
	CONSTRAINT "budget_lines_kind_valid" CHECK ("budget_lines"."kind" IN ('income','event','operating')),
	CONSTRAINT "budget_lines_event_kind" CHECK (("budget_lines"."kind" = 'event') = ("budget_lines"."event_id" IS NOT NULL)),
	CONSTRAINT "budget_lines_named_kind" CHECK (("budget_lines"."kind" = 'event') = ("budget_lines"."name" IS NULL)),
	CONSTRAINT "budget_lines_amount_kind" CHECK (("budget_lines"."kind" = 'event') = ("budget_lines"."amount" IS NULL)),
	CONSTRAINT "budget_lines_name_not_blank" CHECK ("budget_lines"."name" ~ '[^[:space:]]'),
	CONSTRAINT "budget_lines_name_length" CHECK (char_length("budget_lines"."name") <= 30),
	CONSTRAINT "budget_lines_amount_nonnegative" CHECK ("budget_lines"."amount" >= 0),
	CONSTRAINT "budget_lines_position_nonnegative" CHECK ("budget_lines"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "budget_period_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"period_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"changes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_period_events_action_valid" CHECK ("budget_period_events"."action" IN ('created','updated')),
	CONSTRAINT "budget_period_events_changes_object" CHECK (jsonb_typeof("budget_period_events"."changes") = 'object')
);
--> statement-breakpoint
CREATE TABLE "budget_periods" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_periods_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "budget_periods_organization_name_unique" UNIQUE("organization_id","name"),
	CONSTRAINT "budget_periods_name_not_blank" CHECK ("budget_periods"."name" ~ '[^[:space:]]'),
	CONSTRAINT "budget_periods_name_length" CHECK (char_length("budget_periods"."name") <= 30),
	CONSTRAINT "budget_periods_dates_range" CHECK ("budget_periods"."starts_on" >= '2000-01-01' AND "budget_periods"."ends_on" <= '2999-12-31'),
	CONSTRAINT "budget_periods_dates_order" CHECK ("budget_periods"."starts_on" <= "budget_periods"."ends_on"),
	CONSTRAINT "budget_periods_version_positive" CHECK ("budget_periods"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "budget_line_id" text;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_period_same_organization" FOREIGN KEY ("organization_id","period_id") REFERENCES "public"."budget_periods"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_event_same_organization" FOREIGN KEY ("organization_id","event_id") REFERENCES "public"."events"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_period_events" ADD CONSTRAINT "budget_period_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_period_events" ADD CONSTRAINT "budget_period_events_period_same_organization" FOREIGN KEY ("organization_id","period_id") REFERENCES "public"."budget_periods"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_periods" ADD CONSTRAINT "budget_periods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_periods" ADD CONSTRAINT "budget_periods_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_lines_period_idx" ON "budget_lines" USING btree ("period_id","kind","position");--> statement-breakpoint
CREATE INDEX "budget_period_events_period_idx" ON "budget_period_events" USING btree ("period_id","created_at");--> statement-breakpoint
CREATE INDEX "budget_periods_organization_starts_idx" ON "budget_periods" USING btree ("organization_id","starts_on");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_budget_line_same_organization" FOREIGN KEY ("organization_id","budget_line_id") REFERENCES "public"."budget_lines"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expenses_budget_line_idx" ON "expenses" USING btree ("organization_id","budget_line_id");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_budget_line_operating_only" CHECK ("expenses"."budget_line_id" IS NULL OR "expenses"."event_id" IS NULL);