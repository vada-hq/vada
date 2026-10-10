CREATE TABLE "dues_members" (
	"organization_id" text NOT NULL,
	"student_id" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "dues_members_pkey" PRIMARY KEY("organization_id","student_id"),
	CONSTRAINT "dues_members_student_id_format" CHECK ("dues_members"."student_id" ~ '^[0-9]{6,12}$'),
	CONSTRAINT "dues_members_name_not_blank" CHECK ("dues_members"."name" ~ '[^[:space:]]'),
	CONSTRAINT "dues_members_name_length" CHECK (char_length("dues_members"."name") <= 30)
);
--> statement-breakpoint
CREATE TABLE "dues_rosters" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"use_until" date NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"uploaded_by" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dues_rosters_label_not_blank" CHECK ("dues_rosters"."label" ~ '[^[:space:]]'),
	CONSTRAINT "dues_rosters_label_length" CHECK (char_length("dues_rosters"."label") <= 30),
	CONSTRAINT "dues_rosters_use_until_range" CHECK ("dues_rosters"."use_until" BETWEEN '2000-01-01' AND '2999-12-31'),
	CONSTRAINT "dues_rosters_version_positive" CHECK ("dues_rosters"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "fee_account_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"changes" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fee_account_events_changes_object" CHECK (jsonb_typeof("fee_account_events"."changes") = 'object')
);
--> statement-breakpoint
CREATE TABLE "fee_accounts" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"bank" text NOT NULL,
	"account_number" text NOT NULL,
	"holder" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fee_accounts_bank_not_blank" CHECK ("fee_accounts"."bank" ~ '[^[:space:]]'),
	CONSTRAINT "fee_accounts_bank_length" CHECK (char_length("fee_accounts"."bank") <= 20),
	CONSTRAINT "fee_accounts_number_format" CHECK ("fee_accounts"."account_number" ~ '^[0-9]+(-[0-9]+)*$'),
	CONSTRAINT "fee_accounts_number_length" CHECK (char_length("fee_accounts"."account_number") <= 30),
	CONSTRAINT "fee_accounts_number_digits" CHECK (char_length(replace("fee_accounts"."account_number", '-', '')) BETWEEN 8 AND 20),
	CONSTRAINT "fee_accounts_holder_not_blank" CHECK ("fee_accounts"."holder" ~ '[^[:space:]]'),
	CONSTRAINT "fee_accounts_holder_length" CHECK (char_length("fee_accounts"."holder") <= 30),
	CONSTRAINT "fee_accounts_version_positive" CHECK ("fee_accounts"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "registration_forms" ADD COLUMN "fee" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "registration_forms" ADD COLUMN "member_fee" integer;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "dues_member" boolean;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "paid_amount" integer;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "paid_by" text;--> statement-breakpoint
ALTER TABLE "dues_members" ADD CONSTRAINT "dues_members_roster" FOREIGN KEY ("organization_id") REFERENCES "public"."dues_rosters"("organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dues_rosters" ADD CONSTRAINT "dues_rosters_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dues_rosters" ADD CONSTRAINT "dues_rosters_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_account_events" ADD CONSTRAINT "fee_account_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_account_events" ADD CONSTRAINT "fee_account_events_account" FOREIGN KEY ("organization_id") REFERENCES "public"."fee_accounts"("organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_accounts" ADD CONSTRAINT "fee_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_accounts" ADD CONSTRAINT "fee_accounts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fee_account_events_organization_idx" ON "fee_account_events" USING btree ("organization_id","created_at");--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_paid_by_users_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_forms" ADD CONSTRAINT "registration_forms_fee_range" CHECK ("registration_forms"."fee" BETWEEN 0 AND 1000000);--> statement-breakpoint
ALTER TABLE "registration_forms" ADD CONSTRAINT "registration_forms_member_fee_range" CHECK ("registration_forms"."member_fee" IS NULL OR ("registration_forms"."member_fee" >= 0 AND "registration_forms"."member_fee" < "registration_forms"."fee"));--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_paid_triple" CHECK (("registrations"."paid_at" IS NULL) = ("registrations"."paid_amount" IS NULL) AND ("registrations"."paid_at" IS NULL) = ("registrations"."paid_by" IS NULL));--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_paid_amount_range" CHECK ("registrations"."paid_amount" BETWEEN 1 AND 1000000);