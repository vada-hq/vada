CREATE TABLE "event_retrospectives" (
	"event_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"content" jsonb NOT NULL,
	"based_on_completed_at" timestamp with time zone NOT NULL,
	"generated_by" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_by" text,
	"confirmed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "event_retrospectives_content_object" CHECK (jsonb_typeof("event_retrospectives"."content") = 'object'),
	CONSTRAINT "event_retrospectives_content_size" CHECK (octet_length("event_retrospectives"."content"::text) <= 131072),
	CONSTRAINT "event_retrospectives_confirmed_pair" CHECK (("event_retrospectives"."confirmed_by" IS NULL) = ("event_retrospectives"."confirmed_at" IS NULL)),
	CONSTRAINT "event_retrospectives_version_positive" CHECK ("event_retrospectives"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "event_retrospectives" ADD CONSTRAINT "event_retrospectives_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_retrospectives" ADD CONSTRAINT "event_retrospectives_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_retrospectives" ADD CONSTRAINT "event_retrospectives_event_same_organization" FOREIGN KEY ("organization_id","event_id") REFERENCES "public"."events"("organization_id","id") ON DELETE restrict ON UPDATE no action;