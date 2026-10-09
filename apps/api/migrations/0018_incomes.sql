CREATE TABLE "income_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"income_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"changes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "income_events_action_valid" CHECK ("income_events"."action" IN ('created','updated','voided')),
	CONSTRAINT "income_events_changes_object" CHECK (jsonb_typeof("income_events"."changes") = 'object')
);
--> statement-breakpoint
CREATE TABLE "incomes" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"period_id" text NOT NULL,
	"budget_line_id" text,
	"description" text NOT NULL,
	"amount" integer NOT NULL,
	"received_on" date NOT NULL,
	"note" text,
	"recorded_by" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" text,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "incomes_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "incomes_description_not_blank" CHECK ("incomes"."description" ~ '[^[:space:]]'),
	CONSTRAINT "incomes_description_length" CHECK (char_length("incomes"."description") <= 100),
	CONSTRAINT "incomes_amount_positive" CHECK ("incomes"."amount" >= 1),
	CONSTRAINT "incomes_received_on_range" CHECK ("incomes"."received_on" BETWEEN '2000-01-01' AND '2999-12-31'),
	CONSTRAINT "incomes_note_not_blank" CHECK ("incomes"."note" ~ '[^[:space:]]'),
	CONSTRAINT "incomes_note_length" CHECK (char_length("incomes"."note") <= 200),
	CONSTRAINT "incomes_version_positive" CHECK ("incomes"."version" >= 1),
	CONSTRAINT "incomes_void_triple" CHECK (("incomes"."voided_at" IS NULL) = ("incomes"."voided_by" IS NULL) AND ("incomes"."voided_at" IS NULL) = ("incomes"."void_reason" IS NULL)),
	CONSTRAINT "incomes_void_reason_not_blank" CHECK ("incomes"."void_reason" ~ '[^[:space:]]'),
	CONSTRAINT "incomes_void_reason_length" CHECK (char_length("incomes"."void_reason") <= 200)
);
--> statement-breakpoint
ALTER TABLE "income_events" ADD CONSTRAINT "income_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_events" ADD CONSTRAINT "income_events_income_same_organization" FOREIGN KEY ("organization_id","income_id") REFERENCES "public"."incomes"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_period_same_organization" FOREIGN KEY ("organization_id","period_id") REFERENCES "public"."budget_periods"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_budget_line_same_organization" FOREIGN KEY ("organization_id","budget_line_id") REFERENCES "public"."budget_lines"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "income_events_income_idx" ON "income_events" USING btree ("income_id","created_at");--> statement-breakpoint
CREATE INDEX "incomes_period_received_idx" ON "incomes" USING btree ("period_id","received_on");--> statement-breakpoint
CREATE INDEX "incomes_budget_line_idx" ON "incomes" USING btree ("organization_id","budget_line_id");