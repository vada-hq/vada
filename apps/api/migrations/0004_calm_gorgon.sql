CREATE TYPE "public"."agenda_status" AS ENUM('pending', 'current', 'done');--> statement-breakpoint
CREATE TYPE "public"."apply_status" AS ENUM('applied', 'waitlisted');--> statement-breakpoint
CREATE TYPE "public"."archive_status" AS ENUM('draft', 'inReview', 'published');--> statement-breakpoint
CREATE TYPE "public"."attendance" AS ENUM('unknown', 'present', 'absent');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('notStarted', 'drafting', 'reviewing', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."meeting_kind" AS ENUM('regular', 'event');--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('draft', 'scheduled', 'inProgress', 'wrapUp', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."minutes_status" AS ENUM('notStarted', 'drafting', 'done');--> statement-breakpoint
CREATE TYPE "public"."pay_status" AS ENUM('unknown', 'paid', 'unpaid');--> statement-breakpoint
CREATE TYPE "public"."purchase_stage" AS ENUM('draft', 'review', 'purchase', 'proof', 'settled');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('none', 'requested', 'received');--> statement-breakpoint
CREATE TYPE "public"."review_result" AS ENUM('approved', 'supplement', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."survey_apply_method" AS ENUM('firstCome', 'approval');--> statement-breakpoint
CREATE TYPE "public"."survey_question_type" AS ENUM('short', 'choice', 'checkbox', 'privacy');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('planned', 'inProgress', 'review', 'done');--> statement-breakpoint
CREATE TABLE "budget_items" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"event_id" text,
	"name" text NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "budget_items_org_id" UNIQUE("org_id","id")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"event_id" text,
	"meeting_id" text,
	"agenda_id" text,
	"task_id" text,
	"category" text,
	"title" text NOT NULL,
	"description" text,
	"status" "document_status" DEFAULT 'notStarted' NOT NULL,
	"updated_by_member_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_org_id" UNIQUE("org_id","id")
);
--> statement-breakpoint
CREATE TABLE "event_archives" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"event_id" text NOT NULL,
	"status" "archive_status" DEFAULT 'draft' NOT NULL,
	"title" text,
	"on_site_operation" text,
	"retro_good" text,
	"retro_issues" text,
	"retro_improvements" text,
	"handover" text,
	"next_owner" text,
	"improvement_department_id" text,
	"author_member_id" text,
	"reviewer_member_id" text,
	"review_comment" text,
	"review_requested_at" timestamp with time zone,
	"handover_drafted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_archives_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "event_archives_once" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "event_staff_departments" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "event_staff_departments_org_id" UNIQUE("org_id","id")
);
--> statement-breakpoint
CREATE TABLE "event_staff_members" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"event_id" text NOT NULL,
	"member_id" text NOT NULL,
	"staff_department_id" text,
	"is_event_leader" boolean DEFAULT false NOT NULL,
	"is_department_leader" boolean DEFAULT false NOT NULL,
	"role_title" text,
	CONSTRAINT "event_staff_members_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "event_staff_members_once" UNIQUE("event_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"event_id" text,
	"department_id" text,
	"budget_item_id" text,
	"purchase_request_id" text,
	"spent_on" timestamp with time zone NOT NULL,
	"title" text NOT NULL,
	"context" text,
	"amount" integer DEFAULT 0 NOT NULL,
	"proof_done" boolean DEFAULT false NOT NULL,
	CONSTRAINT "ledger_entries_org_id" UNIQUE("org_id","id")
);
--> statement-breakpoint
CREATE TABLE "meeting_agendas" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"meeting_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"planned_minutes" integer,
	"status" "agenda_status" DEFAULT 'pending' NOT NULL,
	"discussion_text" text,
	"decision_text" text,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	CONSTRAINT "meeting_agendas_org_id" UNIQUE("org_id","id")
);
--> statement-breakpoint
CREATE TABLE "meeting_participants" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"meeting_id" text NOT NULL,
	"member_id" text NOT NULL,
	"is_host" boolean DEFAULT false NOT NULL,
	"attendance" "attendance" DEFAULT 'unknown' NOT NULL,
	"acknowledged_at" timestamp with time zone,
	CONSTRAINT "meeting_participants_once" UNIQUE("meeting_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"kind" "meeting_kind" DEFAULT 'regular' NOT NULL,
	"event_id" text,
	"title" text NOT NULL,
	"purpose" text,
	"status" "meeting_status" DEFAULT 'scheduled' NOT NULL,
	"minutes_status" "minutes_status" DEFAULT 'notStarted' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"planned_end_at" timestamp with time zone,
	"mode" text,
	"place" text,
	"online_link" text,
	"is_private" boolean DEFAULT false NOT NULL,
	"creator_member_id" text,
	"department_id" text,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"minutes_summary" text,
	"minutes_summary_drafted_at" timestamp with time zone,
	"cancel_reason" text,
	"cancelled_by_member_id" text,
	"cancelled_at" timestamp with time zone,
	"replacement_meeting_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meetings_org_id" UNIQUE("org_id","id")
);
--> statement-breakpoint
CREATE TABLE "payment_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"payment_id" text NOT NULL,
	"label" text NOT NULL,
	"registered_at" timestamp with time zone,
	CONSTRAINT "payment_documents_org_id" UNIQUE("org_id","id")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"request_id" text NOT NULL,
	"vendor" text NOT NULL,
	"paid_on" timestamp with time zone,
	"payer_member_id" text,
	"method" text,
	"paid_amount" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "payments_org_id" UNIQUE("org_id","id")
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"request_id" text NOT NULL,
	"vendor" text NOT NULL,
	"ordered_on" timestamp with time zone,
	"orderer_member_id" text,
	CONSTRAINT "purchase_orders_org_id" UNIQUE("org_id","id")
);
--> statement-breakpoint
CREATE TABLE "purchase_request_items" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"request_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"purchase_type" text,
	"budget_item_id" text,
	"quantity" integer,
	"unit" text,
	"unit_price" integer,
	"vendor" text,
	"product_url" text,
	"option" text,
	"delivery_note" text,
	"quote_status" "quote_status" DEFAULT 'none' NOT NULL,
	"review_result" "review_result",
	"approved_amount" integer,
	"review_note" text,
	"supplement_answers" jsonb,
	"order_id" text,
	"expected_delivery_on" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"payment_id" text,
	CONSTRAINT "purchase_request_items_org_id" UNIQUE("org_id","id")
);
--> statement-breakpoint
CREATE TABLE "purchase_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"event_id" text,
	"code" text,
	"title" text NOT NULL,
	"purpose" text,
	"department_id" text,
	"requester_member_id" text,
	"priority" text,
	"needed_on" timestamp with time zone,
	"stage" "purchase_stage" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_by_member_id" text,
	"reviewed_at" timestamp with time zone,
	"supplement_requested_at" timestamp with time zone,
	"supplement_due_on" timestamp with time zone,
	"evidence_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_requests_org_id" UNIQUE("org_id","id")
);
--> statement-breakpoint
CREATE TABLE "survey_questions" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"survey_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"type" "survey_question_type" NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	CONSTRAINT "survey_questions_org_id" UNIQUE("org_id","id")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"event_id" text,
	"from_meeting_id" text,
	"code" text,
	"title" text NOT NULL,
	"description" text,
	"completion_criteria" text,
	"expected_output" text,
	"status" "task_status" DEFAULT 'planned' NOT NULL,
	"priority" text,
	"department_id" text,
	"assignee_member_id" text,
	"due_date" timestamp with time zone,
	"cycle" text,
	"submitted_at" timestamp with time zone,
	"official_result" text,
	"review_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_org_id" UNIQUE("org_id","id")
);
--> statement-breakpoint
ALTER TABLE "roster_updates" DROP CONSTRAINT "roster_updates_updated_by_member_id_members_id_fk";
--> statement-breakpoint
ALTER TABLE "survey_applications" ADD COLUMN "apply_status" "apply_status" DEFAULT 'applied' NOT NULL;--> statement-breakpoint
ALTER TABLE "survey_applications" ADD COLUMN "pay_status" "pay_status" DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "surveys" ADD COLUMN "apply_method" "survey_apply_method" DEFAULT 'firstCome' NOT NULL;--> statement-breakpoint
ALTER TABLE "surveys" ADD COLUMN "waitlist" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- **차례를 손으로 옮겼다.** 생성기는 유일 제약을 맨 끝에 두는데, 이것을 가리키는
-- 외래키(survey_questions_survey_same_org)가 그보다 앞에 온다 — PostgreSQL이
-- "there is no unique constraint matching given keys"로 옮김을 통째로 거절한다.
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_org_id" UNIQUE("org_id","id");--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_event_same_org" FOREIGN KEY ("org_id","event_id") REFERENCES "public"."events"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_event_same_org" FOREIGN KEY ("org_id","event_id") REFERENCES "public"."events"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_meeting_same_org" FOREIGN KEY ("org_id","meeting_id") REFERENCES "public"."meetings"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_agenda_same_org" FOREIGN KEY ("org_id","agenda_id") REFERENCES "public"."meeting_agendas"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_task_same_org" FOREIGN KEY ("org_id","task_id") REFERENCES "public"."tasks"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_archives" ADD CONSTRAINT "event_archives_event_same_org" FOREIGN KEY ("org_id","event_id") REFERENCES "public"."events"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_archives" ADD CONSTRAINT "event_archives_department_same_org" FOREIGN KEY ("org_id","improvement_department_id") REFERENCES "public"."departments"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_archives" ADD CONSTRAINT "event_archives_author_same_org" FOREIGN KEY ("org_id","author_member_id") REFERENCES "public"."members"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_archives" ADD CONSTRAINT "event_archives_reviewer_same_org" FOREIGN KEY ("org_id","reviewer_member_id") REFERENCES "public"."members"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_staff_departments" ADD CONSTRAINT "event_staff_departments_event_same_org" FOREIGN KEY ("org_id","event_id") REFERENCES "public"."events"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_staff_members" ADD CONSTRAINT "event_staff_members_event_same_org" FOREIGN KEY ("org_id","event_id") REFERENCES "public"."events"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_staff_members" ADD CONSTRAINT "event_staff_members_member_same_org" FOREIGN KEY ("org_id","member_id") REFERENCES "public"."members"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_staff_members" ADD CONSTRAINT "event_staff_members_department_same_org" FOREIGN KEY ("org_id","staff_department_id") REFERENCES "public"."event_staff_departments"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_event_same_org" FOREIGN KEY ("org_id","event_id") REFERENCES "public"."events"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_department_same_org" FOREIGN KEY ("org_id","department_id") REFERENCES "public"."departments"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_budget_same_org" FOREIGN KEY ("org_id","budget_item_id") REFERENCES "public"."budget_items"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_request_same_org" FOREIGN KEY ("org_id","purchase_request_id") REFERENCES "public"."purchase_requests"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_agendas" ADD CONSTRAINT "meeting_agendas_meeting_same_org" FOREIGN KEY ("org_id","meeting_id") REFERENCES "public"."meetings"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_meeting_same_org" FOREIGN KEY ("org_id","meeting_id") REFERENCES "public"."meetings"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_member_same_org" FOREIGN KEY ("org_id","member_id") REFERENCES "public"."members"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_event_same_org" FOREIGN KEY ("org_id","event_id") REFERENCES "public"."events"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_creator_same_org" FOREIGN KEY ("org_id","creator_member_id") REFERENCES "public"."members"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_department_same_org" FOREIGN KEY ("org_id","department_id") REFERENCES "public"."departments"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_documents" ADD CONSTRAINT "payment_documents_payment_same_org" FOREIGN KEY ("org_id","payment_id") REFERENCES "public"."payments"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_request_same_org" FOREIGN KEY ("org_id","request_id") REFERENCES "public"."purchase_requests"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_same_org" FOREIGN KEY ("org_id","payer_member_id") REFERENCES "public"."members"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_request_same_org" FOREIGN KEY ("org_id","request_id") REFERENCES "public"."purchase_requests"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_orderer_same_org" FOREIGN KEY ("org_id","orderer_member_id") REFERENCES "public"."members"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_request_same_org" FOREIGN KEY ("org_id","request_id") REFERENCES "public"."purchase_requests"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_budget_same_org" FOREIGN KEY ("org_id","budget_item_id") REFERENCES "public"."budget_items"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_order_same_org" FOREIGN KEY ("org_id","order_id") REFERENCES "public"."purchase_orders"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_payment_same_org" FOREIGN KEY ("org_id","payment_id") REFERENCES "public"."payments"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_event_same_org" FOREIGN KEY ("org_id","event_id") REFERENCES "public"."events"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_department_same_org" FOREIGN KEY ("org_id","department_id") REFERENCES "public"."departments"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_requester_same_org" FOREIGN KEY ("org_id","requester_member_id") REFERENCES "public"."members"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_questions" ADD CONSTRAINT "survey_questions_survey_same_org" FOREIGN KEY ("org_id","survey_id") REFERENCES "public"."surveys"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_event_same_org" FOREIGN KEY ("org_id","event_id") REFERENCES "public"."events"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_meeting_same_org" FOREIGN KEY ("org_id","from_meeting_id") REFERENCES "public"."meetings"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_department_same_org" FOREIGN KEY ("org_id","department_id") REFERENCES "public"."departments"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_same_org" FOREIGN KEY ("org_id","assignee_member_id") REFERENCES "public"."members"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_items_org_event" ON "budget_items" USING btree ("org_id","event_id");--> statement-breakpoint
CREATE INDEX "documents_event_status" ON "documents" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "documents_meeting" ON "documents" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "documents_task" ON "documents" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "event_archives_org_status" ON "event_archives" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "event_staff_departments_event" ON "event_staff_departments" USING btree ("event_id","sort_order");--> statement-breakpoint
CREATE INDEX "event_staff_members_department" ON "event_staff_members" USING btree ("staff_department_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_org_spent" ON "ledger_entries" USING btree ("org_id","spent_on");--> statement-breakpoint
CREATE INDEX "ledger_entries_event" ON "ledger_entries" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "meeting_agendas_meeting" ON "meeting_agendas" USING btree ("meeting_id","sort_order");--> statement-breakpoint
CREATE INDEX "meeting_participants_member" ON "meeting_participants" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "meetings_org_status" ON "meetings" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "meetings_event" ON "meetings" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "payment_documents_payment" ON "payment_documents" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payments_request" ON "payments" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_request" ON "purchase_orders" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "purchase_request_items_request" ON "purchase_request_items" USING btree ("request_id","sort_order");--> statement-breakpoint
CREATE INDEX "purchase_requests_org_stage" ON "purchase_requests" USING btree ("org_id","stage");--> statement-breakpoint
CREATE INDEX "purchase_requests_event_stage" ON "purchase_requests" USING btree ("event_id","stage");--> statement-breakpoint
CREATE INDEX "survey_questions_survey" ON "survey_questions" USING btree ("survey_id","sort_order");--> statement-breakpoint
CREATE INDEX "tasks_org_status" ON "tasks" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "tasks_event_status" ON "tasks" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "tasks_assignee" ON "tasks" USING btree ("assignee_member_id");--> statement-breakpoint
ALTER TABLE "roster_updates" ADD CONSTRAINT "roster_updates_member_same_org" FOREIGN KEY ("org_id","updated_by_member_id") REFERENCES "public"."members"("org_id","id") ON DELETE set null ON UPDATE no action;
