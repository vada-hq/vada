CREATE TABLE "purchase_items" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"position" integer NOT NULL,
	"product_url" text NOT NULL,
	"product_name" text,
	"selected_option" text,
	"option_required" boolean,
	"quantity" integer,
	"packaging_unit" text,
	"estimated_unit_price" integer,
	"product_snapshot" jsonb,
	"product_fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_items_request_position_unique" UNIQUE("request_id","position"),
	CONSTRAINT "purchase_items_position_nonnegative" CHECK ("purchase_items"."position" >= 0),
	CONSTRAINT "purchase_items_url_not_blank" CHECK ("purchase_items"."product_url" ~ '[^[:space:]]'),
	CONSTRAINT "purchase_items_quantity_positive" CHECK ("purchase_items"."quantity" > 0),
	CONSTRAINT "purchase_items_price_nonnegative" CHECK ("purchase_items"."estimated_unit_price" >= 0),
	CONSTRAINT "purchase_items_snapshot_object" CHECK (jsonb_typeof("purchase_items"."product_snapshot") = 'object'),
	CONSTRAINT "purchase_items_snapshot_timestamp_pair" CHECK (("purchase_items"."product_snapshot" IS NULL) = ("purchase_items"."product_fetched_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "purchase_request_history" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"version" integer NOT NULL,
	"changes" jsonb NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_history_request_version_unique" UNIQUE("request_id","version"),
	CONSTRAINT "purchase_history_action_valid" CHECK ("purchase_request_history"."action" IN ('created','updated','discarded','submitted','approved','rejected')),
	CONSTRAINT "purchase_history_version_positive" CHECK ("purchase_request_history"."version" > 0),
	CONSTRAINT "purchase_history_changes_object" CHECK (jsonb_typeof("purchase_request_history"."changes") = 'object'),
	CONSTRAINT "purchase_history_rejection_reason" CHECK ("purchase_request_history"."action" <> 'rejected' OR ("purchase_request_history"."reason" IS NOT NULL AND "purchase_request_history"."reason" ~ '[^[:space:]]'))
);
--> statement-breakpoint
CREATE TABLE "purchase_request_sources" (
	"request_id" text NOT NULL,
	"message_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_request_sources_request_id_message_id_pk" PRIMARY KEY("request_id","message_id")
);
--> statement-breakpoint
CREATE TABLE "purchase_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text NOT NULL,
	"requester_id" text NOT NULL,
	"department_id" text NOT NULL,
	"purpose" text,
	"needed_by" date,
	"estimated_shipping_cost" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"idempotency_key" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_requests_requester_key_unique" UNIQUE("requester_id","idempotency_key"),
	CONSTRAINT "purchase_requests_key_not_blank" CHECK ("purchase_requests"."idempotency_key" ~ '[^[:space:]]'),
	CONSTRAINT "purchase_requests_status_valid" CHECK ("purchase_requests"."status" IN ('draft','discarded','submitted','approved','rejected')),
	CONSTRAINT "purchase_requests_version_positive" CHECK ("purchase_requests"."version" > 0),
	CONSTRAINT "purchase_requests_shipping_nonnegative" CHECK ("purchase_requests"."estimated_shipping_cost" >= 0)
);
--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_request_id_purchase_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."purchase_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_history" ADD CONSTRAINT "purchase_request_history_request_id_purchase_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."purchase_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_history" ADD CONSTRAINT "purchase_request_history_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_sources" ADD CONSTRAINT "purchase_request_sources_request_id_purchase_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."purchase_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_sources" ADD CONSTRAINT "purchase_request_sources_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_event_same_organization" FOREIGN KEY ("organization_id","event_id") REFERENCES "public"."events"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_department_same_organization" FOREIGN KEY ("organization_id","department_id") REFERENCES "public"."departments"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchase_requests_event_created_idx" ON "purchase_requests" USING btree ("event_id","created_at","id");