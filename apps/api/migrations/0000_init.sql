CREATE TYPE "public"."dues_status" AS ENUM('paid', 'unpaid', 'check');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('planning', 'inProgress', 'wrapUp', 'done');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('chair', 'head', 'member');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"issuer" text,
	"account_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_provider_account" UNIQUE("provider_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "attendance_check_ins" (
	"id" text PRIMARY KEY NOT NULL,
	"qr_id" text NOT NULL,
	"name" text NOT NULL,
	"student_number" text NOT NULL,
	"receipt_hash" text NOT NULL,
	"receipt_expires_at" timestamp with time zone NOT NULL,
	"matched" boolean DEFAULT false NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_check_ins_receipt_hash_unique" UNIQUE("receipt_hash"),
	CONSTRAINT "attendance_once_per_student" UNIQUE("qr_id","student_number")
);
--> statement-breakpoint
CREATE TABLE "attendance_qrs" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"event_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_qrs_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" text,
	"user_id" text,
	"action" text NOT NULL,
	"subject_type" text,
	"subject_id" text,
	"failed" boolean DEFAULT false NOT NULL,
	"ip" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"handles_finance" boolean DEFAULT false NOT NULL,
	CONSTRAINT "departments_org_id" UNIQUE("org_id","id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"title" text NOT NULL,
	"status" "event_status" DEFAULT 'planning' NOT NULL,
	"start_at" timestamp with time zone,
	"place" text,
	"audience" text,
	"fee" text,
	"capacity" text,
	"contact" text,
	"host_department_id" text,
	"host_member_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_org_id" UNIQUE("org_id","id")
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"code" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"regenerated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"student_number" text,
	"college" text,
	"major" text,
	"grade" text,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"executive_title" text,
	"department_id" text,
	"is_department_leader" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_org_id" UNIQUE("org_id","id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text,
	"scope" text,
	"term" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" text NOT NULL,
	"actor_user_id" text,
	"actor_name" text,
	"subject_member_id" text,
	"subject_name" text,
	"change" text NOT NULL,
	"before" text,
	"after" text
);
--> statement-breakpoint
CREATE TABLE "roster_updates" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"kind" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_member_id" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"student_number" text NOT NULL,
	"college" text,
	"department" text,
	"grade" text,
	"dues_status" "dues_status" DEFAULT 'unpaid' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"survey_id" text NOT NULL,
	"name" text NOT NULL,
	"student_number" text NOT NULL,
	"college" text,
	"department" text,
	"grade" text,
	"motivation" text,
	"receipt_hash" text NOT NULL,
	"receipt_expires_at" timestamp with time zone NOT NULL,
	"privacy_consent_at" timestamp with time zone NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "survey_applications_receipt_hash_unique" UNIQUE("receipt_hash"),
	CONSTRAINT "survey_once_per_student" UNIQUE("survey_id","student_number")
);
--> statement-breakpoint
CREATE TABLE "surveys" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"event_id" text NOT NULL,
	"link_token" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"capacity" integer,
	"completion_title" text,
	"dues_check" boolean DEFAULT false NOT NULL,
	"replaced_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "surveys_link_token_unique" UNIQUE("link_token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"name" text,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_check_ins" ADD CONSTRAINT "attendance_check_ins_qr_id_attendance_qrs_id_fk" FOREIGN KEY ("qr_id") REFERENCES "public"."attendance_qrs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_qrs" ADD CONSTRAINT "attendance_qrs_event_same_org" FOREIGN KEY ("org_id","event_id") REFERENCES "public"."events"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_host_department_same_org" FOREIGN KEY ("org_id","host_department_id") REFERENCES "public"."departments"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_host_member_same_org" FOREIGN KEY ("org_id","host_member_id") REFERENCES "public"."members"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_department_same_org" FOREIGN KEY ("org_id","department_id") REFERENCES "public"."departments"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_updates" ADD CONSTRAINT "roster_updates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_updates" ADD CONSTRAINT "roster_updates_updated_by_member_id_members_id_fk" FOREIGN KEY ("updated_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_applications" ADD CONSTRAINT "survey_applications_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_event_same_org" FOREIGN KEY ("org_id","event_id") REFERENCES "public"."events"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "attendance_qrs_event" ON "attendance_qrs" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "audit_logs_at" ON "audit_logs" USING btree ("at");--> statement-breakpoint
CREATE INDEX "audit_logs_org_at" ON "audit_logs" USING btree ("org_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_org_name" ON "departments" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "events_org_status" ON "events" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "invites_org" ON "invites" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "members_org" ON "members" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "members_department" ON "members" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "permission_changes_org_at" ON "permission_changes" USING btree ("org_id","at");--> statement-breakpoint
CREATE INDEX "roster_updates_org_kind" ON "roster_updates" USING btree ("org_id","kind");--> statement-breakpoint
CREATE INDEX "sessions_user" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "students_org_number" ON "students" USING btree ("org_id","student_number");--> statement-breakpoint
CREATE INDEX "students_org_dues" ON "students" USING btree ("org_id","dues_status");--> statement-breakpoint
CREATE INDEX "surveys_event" ON "surveys" USING btree ("event_id");