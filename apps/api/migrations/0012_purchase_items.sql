CREATE TABLE "purchase_generations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text NOT NULL,
	"requester_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"links" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_generations_requester_key_unique" UNIQUE("requester_id","idempotency_key"),
	CONSTRAINT "purchase_generations_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "purchase_generations_key_not_blank" CHECK ("purchase_generations"."idempotency_key" ~ '[^[:space:]]'),
	CONSTRAINT "purchase_generations_key_length" CHECK (char_length("purchase_generations"."idempotency_key") <= 128),
	CONSTRAINT "purchase_generations_links_array" CHECK (jsonb_typeof("purchase_generations"."links") = 'array')
);
--> statement-breakpoint
CREATE TABLE "purchase_item_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"item_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"reason" text,
	"changes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"batch_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_item_events_action_valid" CHECK ("purchase_item_events"."action" IN ('submitted','approved','rejected','cancelled','approval_revoked','needed_by_changed','purchased','purchase_undone','received','receipt_undone','re_added')),
	CONSTRAINT "purchase_item_events_reason" CHECK (("purchase_item_events"."action" = 'rejected') = ("purchase_item_events"."reason" IS NOT NULL)),
	CONSTRAINT "purchase_item_events_reason_not_blank" CHECK ("purchase_item_events"."reason" ~ '[^[:space:]]'),
	CONSTRAINT "purchase_item_events_reason_length" CHECK (char_length("purchase_item_events"."reason") <= 500),
	CONSTRAINT "purchase_item_events_changes_object" CHECK (jsonb_typeof("purchase_item_events"."changes") = 'object')
);
--> statement-breakpoint
CREATE TABLE "purchase_item_sources" (
	"item_id" text NOT NULL,
	"message_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_item_sources_item_id_message_id_pk" PRIMARY KEY("item_id","message_id")
);
--> statement-breakpoint
CREATE TABLE "purchase_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text NOT NULL,
	"requester_id" text NOT NULL,
	"department_id" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_submissions_organization_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
ALTER TABLE "purchase_items" ALTER COLUMN "request_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_items" ALTER COLUMN "position" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "shipment_items" ALTER COLUMN "request_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "event_id" text;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "requester_id" text;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "generation_id" text;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "submission_id" text;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "needed_by" date;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "warnings" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "decided_by" text;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "decision_reason" text;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "purchased_by" text;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "purchased_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "received_by" text;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "received_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- 참조 대상의 복합 고유키를 외래키보다 먼저 생성한다.
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_organization_id_unique" UNIQUE("organization_id","id");--> statement-breakpoint
ALTER TABLE "purchase_generations" ADD CONSTRAINT "purchase_generations_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_generations" ADD CONSTRAINT "purchase_generations_event_same_organization" FOREIGN KEY ("organization_id","event_id") REFERENCES "public"."events"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_item_events" ADD CONSTRAINT "purchase_item_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_item_events" ADD CONSTRAINT "purchase_item_events_item_same_organization" FOREIGN KEY ("organization_id","item_id") REFERENCES "public"."purchase_items"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_item_sources" ADD CONSTRAINT "purchase_item_sources_item_id_purchase_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."purchase_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_item_sources" ADD CONSTRAINT "purchase_item_sources_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_submissions" ADD CONSTRAINT "purchase_submissions_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_submissions" ADD CONSTRAINT "purchase_submissions_event_same_organization" FOREIGN KEY ("organization_id","event_id") REFERENCES "public"."events"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_submissions" ADD CONSTRAINT "purchase_submissions_department_same_organization" FOREIGN KEY ("organization_id","department_id") REFERENCES "public"."departments"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchase_item_events_item_idx" ON "purchase_item_events" USING btree ("item_id","created_at");--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchased_by_users_id_fk" FOREIGN KEY ("purchased_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_event_same_organization" FOREIGN KEY ("organization_id","event_id") REFERENCES "public"."events"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_generation_same_organization" FOREIGN KEY ("organization_id","generation_id") REFERENCES "public"."purchase_generations"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_submission_same_organization" FOREIGN KEY ("organization_id","submission_id") REFERENCES "public"."purchase_submissions"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchase_items_event_created_idx" ON "purchase_items" USING btree ("event_id","created_at","id");--> statement-breakpoint
CREATE INDEX "purchase_items_organization_status_idx" ON "purchase_items" USING btree ("organization_id","status");--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_status_valid" CHECK ("purchase_items"."status" IN ('draft','pending','approved','rejected','cancelled'));--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_draft_unsubmitted" CHECK (("purchase_items"."status" = 'draft') = ("purchase_items"."submission_id" IS NULL));--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_decision_pair" CHECK (("purchase_items"."decided_at" IS NULL) = ("purchase_items"."decided_by" IS NULL));--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_decided_status" CHECK (("purchase_items"."status" IN ('approved','rejected')) = ("purchase_items"."decided_at" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_rejection_reason" CHECK (("purchase_items"."status" = 'rejected') = ("purchase_items"."decision_reason" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_reason_not_blank" CHECK ("purchase_items"."decision_reason" ~ '[^[:space:]]');--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_reason_length" CHECK (char_length("purchase_items"."decision_reason") <= 500);--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_note_not_blank" CHECK ("purchase_items"."note" ~ '[^[:space:]]');--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_note_length" CHECK (char_length("purchase_items"."note") <= 200);--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_warnings_array" CHECK (jsonb_typeof("purchase_items"."warnings") = 'array');--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_version_positive" CHECK ("purchase_items"."version" > 0);--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_pair" CHECK (("purchase_items"."purchased_at" IS NULL) = ("purchase_items"."purchased_by" IS NULL));--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_approved" CHECK ("purchase_items"."purchased_at" IS NULL OR "purchase_items"."status" = 'approved');--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_receipt_pair" CHECK (("purchase_items"."received_at" IS NULL) = ("purchase_items"."received_by" IS NULL));--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_receipt_purchased" CHECK ("purchase_items"."received_at" IS NULL OR "purchase_items"."purchased_at" IS NOT NULL);

--> statement-breakpoint
-- 옛 요청서를 품목 단위로 옮긴다. 옛 표는 배포 뒤 0013에서 지운다.
-- 폐기된 초안의 품목은 새 구조에 맞는 상태가 없어 옮기지 않는다.
DELETE FROM "purchase_items" WHERE "request_id" IN (SELECT "id" FROM "purchase_requests" WHERE "status" = 'discarded');
--> statement-breakpoint
INSERT INTO "purchase_generations" ("id", "organization_id", "event_id", "requester_id", "idempotency_key", "links", "created_at")
SELECT r."id", r."organization_id", r."event_id", r."requester_id", r."idempotency_key",
  COALESCE(
    (SELECT h."changes" -> 'inputLinks' FROM "purchase_request_history" h
      WHERE h."request_id" = r."id" AND h."action" = 'created' AND jsonb_typeof(h."changes" -> 'inputLinks') = 'array' LIMIT 1),
    (SELECT COALESCE(jsonb_agg(i."product_url" ORDER BY i."position"), '[]'::jsonb) FROM "purchase_items" i WHERE i."request_id" = r."id")),
  r."created_at"
FROM "purchase_requests" r WHERE r."status" <> 'discarded';
--> statement-breakpoint
INSERT INTO "purchase_submissions" ("id", "organization_id", "event_id", "requester_id", "department_id", "submitted_at")
SELECT r."id", r."organization_id", r."event_id", r."requester_id", r."department_id",
  COALESCE((SELECT max(h."created_at") FROM "purchase_request_history" h WHERE h."request_id" = r."id" AND h."action" = 'submitted'), r."updated_at")
FROM "purchase_requests" r WHERE r."status" IN ('submitted', 'approved', 'rejected');
--> statement-breakpoint
UPDATE "purchase_items" i SET
  "organization_id" = r."organization_id", "event_id" = r."event_id", "requester_id" = r."requester_id", "generation_id" = r."id",
  "submission_id" = CASE WHEN r."status" = 'draft' THEN NULL ELSE r."id" END,
  "status" = CASE WHEN r."status" = 'submitted' THEN 'pending' ELSE r."status" END,
  "note" = r."purpose", "needed_by" = r."needed_by",
  "warnings" = COALESCE((SELECT h."changes" -> 'warnings' FROM "purchase_request_history" h
    WHERE h."request_id" = r."id" AND h."action" = 'created' AND jsonb_typeof(h."changes" -> 'warnings') = 'array' LIMIT 1), '[]'::jsonb),
  "decided_by" = (SELECT h."actor_id" FROM "purchase_request_history" h
    WHERE h."request_id" = r."id" AND r."status" IN ('approved', 'rejected') AND h."action" = r."status" ORDER BY h."version" DESC LIMIT 1),
  "decided_at" = (SELECT h."created_at" FROM "purchase_request_history" h
    WHERE h."request_id" = r."id" AND r."status" IN ('approved', 'rejected') AND h."action" = r."status" ORDER BY h."version" DESC LIMIT 1),
  "decision_reason" = (SELECT h."reason" FROM "purchase_request_history" h
    WHERE h."request_id" = r."id" AND r."status" = 'rejected' AND h."action" = 'rejected' ORDER BY h."version" DESC LIMIT 1),
  "updated_at" = r."updated_at"
FROM "purchase_requests" r WHERE i."request_id" = r."id";
--> statement-breakpoint
INSERT INTO "purchase_item_events" ("id", "organization_id", "item_id", "actor_id", "action", "reason", "changes", "batch_id", "created_at")
SELECT gen_random_uuid()::text, i."organization_id", i."id", h."actor_id", h."action",
  CASE WHEN h."action" = 'rejected' THEN h."reason" END, '{}'::jsonb, h."request_id", h."created_at"
FROM "purchase_request_history" h JOIN "purchase_items" i ON i."request_id" = h."request_id"
WHERE h."action" IN ('submitted', 'approved', 'rejected');
--> statement-breakpoint
INSERT INTO "purchase_item_sources" ("item_id", "message_id", "created_at")
SELECT i."id", s."message_id", s."created_at" FROM "purchase_request_sources" s JOIN "purchase_items" i ON i."request_id" = s."request_id";
--> statement-breakpoint
ALTER TABLE "purchase_items" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_items" ALTER COLUMN "event_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_items" ALTER COLUMN "requester_id" SET NOT NULL;
