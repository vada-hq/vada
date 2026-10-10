ALTER TABLE "budget_period_events" DROP CONSTRAINT "budget_period_events_action_valid";--> statement-breakpoint
ALTER TABLE "budget_period_events" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "budget_periods" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "budget_periods" ADD COLUMN "closed_by" text;--> statement-breakpoint
ALTER TABLE "incomes" ADD COLUMN "carried_from_period_id" text;--> statement-breakpoint
ALTER TABLE "budget_periods" ADD CONSTRAINT "budget_periods_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_carried_from_same_organization" FOREIGN KEY ("organization_id","carried_from_period_id") REFERENCES "public"."budget_periods"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "incomes_carried_from_active_unique" ON "incomes" USING btree ("carried_from_period_id") WHERE "incomes"."carried_from_period_id" IS NOT NULL AND "incomes"."voided_at" IS NULL;--> statement-breakpoint
ALTER TABLE "budget_period_events" ADD CONSTRAINT "budget_period_events_reason_when_reopened" CHECK (("budget_period_events"."action" = 'reopened') = ("budget_period_events"."reason" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "budget_period_events" ADD CONSTRAINT "budget_period_events_reason_not_blank" CHECK ("budget_period_events"."reason" ~ '[^[:space:]]');--> statement-breakpoint
ALTER TABLE "budget_period_events" ADD CONSTRAINT "budget_period_events_reason_length" CHECK (char_length("budget_period_events"."reason") <= 200);--> statement-breakpoint
ALTER TABLE "budget_period_events" ADD CONSTRAINT "budget_period_events_action_valid" CHECK ("budget_period_events"."action" IN ('created','updated','closed','reopened'));--> statement-breakpoint
ALTER TABLE "budget_periods" ADD CONSTRAINT "budget_periods_closed_pair" CHECK (("budget_periods"."closed_at" IS NULL) = ("budget_periods"."closed_by" IS NULL));--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_carried_from_other_period" CHECK ("incomes"."carried_from_period_id" <> "incomes"."period_id");