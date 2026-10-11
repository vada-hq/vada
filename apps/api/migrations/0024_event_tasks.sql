CREATE TABLE "task_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"task_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"changes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_events_action_valid" CHECK ("task_events"."action" IN ('created','updated','status_changed')),
	CONSTRAINT "task_events_changes_object" CHECK (jsonb_typeof("task_events"."changes") = 'object')
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'todo' NOT NULL,
	"department_id" text,
	"assignee_id" text,
	"due_on" date,
	"completed_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "tasks_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "tasks_title_not_blank" CHECK ("tasks"."title" ~ '[^[:space:]]'),
	CONSTRAINT "tasks_title_length" CHECK (char_length("tasks"."title") <= 100),
	CONSTRAINT "tasks_description_not_blank" CHECK ("tasks"."description" ~ '[^[:space:]]'),
	CONSTRAINT "tasks_description_length" CHECK (char_length("tasks"."description") <= 1000),
	CONSTRAINT "tasks_status_valid" CHECK ("tasks"."status" IN ('todo','doing','done')),
	CONSTRAINT "tasks_due_on_range" CHECK ("tasks"."due_on" BETWEEN '2000-01-01' AND '2999-12-31'),
	CONSTRAINT "tasks_completed_state" CHECK (("tasks"."status" = 'done') = ("tasks"."completed_at" IS NOT NULL)),
	CONSTRAINT "tasks_version_positive" CHECK ("tasks"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_task_same_organization" FOREIGN KEY ("organization_id","task_id") REFERENCES "public"."tasks"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_event_same_organization" FOREIGN KEY ("organization_id","event_id") REFERENCES "public"."events"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_department_same_organization" FOREIGN KEY ("organization_id","department_id") REFERENCES "public"."departments"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_same_organization" FOREIGN KEY ("organization_id","assignee_id") REFERENCES "public"."memberships"("organization_id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_events_task_idx" ON "task_events" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "tasks_event_idx" ON "tasks" USING btree ("organization_id","event_id");--> statement-breakpoint
CREATE INDEX "tasks_assignee_idx" ON "tasks" USING btree ("organization_id","assignee_id");