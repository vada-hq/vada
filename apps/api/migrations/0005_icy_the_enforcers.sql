-- 참조 대상의 복합 고유키를 외래키보다 먼저 생성한다.
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_request_id_unique" UNIQUE("request_id","id");--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_organization_id_unique" UNIQUE("organization_id","id");--> statement-breakpoint
CREATE TABLE "shipment_items" (
	"id" text PRIMARY KEY NOT NULL,
	"shipment_id" text NOT NULL,
	"purchase_item_id" text NOT NULL,
	"request_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"linked_by" text NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unlinked_by" text,
	"unlinked_at" timestamp with time zone,
	CONSTRAINT "shipment_items_unlink_pair" CHECK (("shipment_items"."unlinked_at" IS NULL) = ("shipment_items"."unlinked_by" IS NULL)),
	CONSTRAINT "shipment_items_unlink_time" CHECK ("shipment_items"."unlinked_at" >= "shipment_items"."linked_at")
);
--> statement-breakpoint
CREATE TABLE "shipment_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"shipment_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipment_jobs_kind_valid" CHECK ("shipment_jobs"."kind" IN ('register','refresh','unregister')),
	CONSTRAINT "shipment_jobs_status_valid" CHECK ("shipment_jobs"."status" IN ('pending','running','completed','failed')),
	CONSTRAINT "shipment_jobs_attempts_nonnegative" CHECK ("shipment_jobs"."attempts" >= 0),
	CONSTRAINT "shipment_jobs_running_lease" CHECK (("shipment_jobs"."status" = 'running') = ("shipment_jobs"."locked_until" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"carrier_id" text NOT NULL,
	"tracking_number" text NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	"provider_status" text,
	"last_event_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"last_error_code" text,
	"tracking_active" boolean DEFAULT true NOT NULL,
	"webhook_expires_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipments_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "shipments_organization_carrier_number_unique" UNIQUE("organization_id","carrier_id","tracking_number"),
	CONSTRAINT "shipments_carrier_not_blank" CHECK ("shipments"."carrier_id" ~ '[^[:space:]]'),
	CONSTRAINT "shipments_number_not_blank" CHECK ("shipments"."tracking_number" ~ '[^[:space:]]'),
	CONSTRAINT "shipments_status_valid" CHECK ("shipments"."status" IN ('unknown','pending','in_transit','delivered','exception'))
);
--> statement-breakpoint
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_linked_by_users_id_fk" FOREIGN KEY ("linked_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_unlinked_by_users_id_fk" FOREIGN KEY ("unlinked_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_shipment_same_organization" FOREIGN KEY ("organization_id","shipment_id") REFERENCES "public"."shipments"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_request_same_organization" FOREIGN KEY ("organization_id","request_id") REFERENCES "public"."purchase_requests"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_item_same_request" FOREIGN KEY ("request_id","purchase_item_id") REFERENCES "public"."purchase_items"("request_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_jobs" ADD CONSTRAINT "shipment_jobs_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shipment_items_active_pair_unique" ON "shipment_items" USING btree ("shipment_id","purchase_item_id") WHERE "shipment_items"."unlinked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "shipment_items_request_idx" ON "shipment_items" USING btree ("request_id","purchase_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shipment_jobs_pending_unique" ON "shipment_jobs" USING btree ("shipment_id","kind") WHERE "shipment_jobs"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "shipment_jobs_running_unique" ON "shipment_jobs" USING btree ("shipment_id","kind") WHERE "shipment_jobs"."status" = 'running';--> statement-breakpoint
CREATE INDEX "shipment_jobs_due_idx" ON "shipment_jobs" USING btree ("run_after","id") WHERE "shipment_jobs"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "shipment_jobs_lease_idx" ON "shipment_jobs" USING btree ("locked_until","id") WHERE "shipment_jobs"."status" = 'running';--> statement-breakpoint
CREATE INDEX "shipments_renewal_idx" ON "shipments" USING btree ("webhook_expires_at","id") WHERE "shipments"."tracking_active" = true;
