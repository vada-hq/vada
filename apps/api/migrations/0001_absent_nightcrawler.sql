CREATE TYPE "public"."event_capacity_type" AS ENUM('unlimited', 'limited', 'undecided');--> statement-breakpoint
CREATE TYPE "public"."event_fee_type" AS ENUM('free', 'fixed', 'duesConditional', 'undecided');--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "intro" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "purpose" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "end_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "end_unset" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "place_unset" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "place_detail" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "fee_type" "event_fee_type" DEFAULT 'undecided' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "paid_amount" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "unpaid_amount" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "pay_guide" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "capacity_type" "event_capacity_type" DEFAULT 'undecided' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "capacity_count" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "notice" text;