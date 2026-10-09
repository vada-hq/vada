CREATE TABLE "expense_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"expense_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"changes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_events_action_valid" CHECK ("expense_events"."action" IN ('created','updated','voided','receipt_added','receipt_removed')),
	CONSTRAINT "expense_events_changes_object" CHECK (jsonb_typeof("expense_events"."changes") = 'object')
);
--> statement-breakpoint
CREATE TABLE "expense_items" (
	"purchase_item_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"expense_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"expense_id" text NOT NULL,
	"object_key" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "expense_receipts_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "expense_receipts_object_key_length" CHECK (char_length("expense_receipts"."object_key") <= 300),
	CONSTRAINT "expense_receipts_file_name_not_blank" CHECK ("expense_receipts"."file_name" ~ '[^[:space:]]'),
	CONSTRAINT "expense_receipts_file_name_length" CHECK (char_length("expense_receipts"."file_name") <= 200),
	CONSTRAINT "expense_receipts_content_type_valid" CHECK ("expense_receipts"."content_type" IN ('image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf')),
	CONSTRAINT "expense_receipts_size_range" CHECK ("expense_receipts"."size_bytes" BETWEEN 1 AND 10485760),
	CONSTRAINT "expense_receipts_kind_valid" CHECK ("expense_receipts"."kind" IN ('receipt','statement','tax_invoice','other')),
	CONSTRAINT "expense_receipts_status_valid" CHECK ("expense_receipts"."status" IN ('pending','ready')),
	CONSTRAINT "expense_receipts_ready_confirmed" CHECK (("expense_receipts"."status" = 'ready') = ("expense_receipts"."confirmed_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text,
	"vendor" text NOT NULL,
	"description" text NOT NULL,
	"amount" integer NOT NULL,
	"paid_on" date NOT NULL,
	"method" text NOT NULL,
	"payer_id" text NOT NULL,
	"note" text,
	"recorded_by" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" text,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "expenses_vendor_not_blank" CHECK ("expenses"."vendor" ~ '[^[:space:]]'),
	CONSTRAINT "expenses_vendor_length" CHECK (char_length("expenses"."vendor") <= 100),
	CONSTRAINT "expenses_description_not_blank" CHECK ("expenses"."description" ~ '[^[:space:]]'),
	CONSTRAINT "expenses_description_length" CHECK (char_length("expenses"."description") <= 200),
	CONSTRAINT "expenses_amount_nonnegative" CHECK ("expenses"."amount" >= 0),
	CONSTRAINT "expenses_paid_on_range" CHECK ("expenses"."paid_on" BETWEEN '2000-01-01' AND '2999-12-31'),
	CONSTRAINT "expenses_method_valid" CHECK ("expenses"."method" IN ('council_card','transfer','cash','personal')),
	CONSTRAINT "expenses_note_not_blank" CHECK ("expenses"."note" ~ '[^[:space:]]'),
	CONSTRAINT "expenses_note_length" CHECK (char_length("expenses"."note") <= 200),
	CONSTRAINT "expenses_version_positive" CHECK ("expenses"."version" >= 1),
	CONSTRAINT "expenses_void_triple" CHECK (("expenses"."voided_at" IS NULL) = ("expenses"."voided_by" IS NULL) AND ("expenses"."voided_at" IS NULL) = ("expenses"."void_reason" IS NULL)),
	CONSTRAINT "expenses_void_reason_not_blank" CHECK ("expenses"."void_reason" ~ '[^[:space:]]'),
	CONSTRAINT "expenses_void_reason_length" CHECK (char_length("expenses"."void_reason") <= 200)
);
--> statement-breakpoint
ALTER TABLE "expense_events" ADD CONSTRAINT "expense_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_events" ADD CONSTRAINT "expense_events_expense_same_organization" FOREIGN KEY ("organization_id","expense_id") REFERENCES "public"."expenses"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_expense_same_organization" FOREIGN KEY ("organization_id","expense_id") REFERENCES "public"."expenses"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_item_same_organization" FOREIGN KEY ("organization_id","purchase_item_id") REFERENCES "public"."purchase_items"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_receipts" ADD CONSTRAINT "expense_receipts_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_receipts" ADD CONSTRAINT "expense_receipts_expense_same_organization" FOREIGN KEY ("organization_id","expense_id") REFERENCES "public"."expenses"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_payer_id_users_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_event_same_organization" FOREIGN KEY ("organization_id","event_id") REFERENCES "public"."events"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_events_expense_idx" ON "expense_events" USING btree ("expense_id","created_at");--> statement-breakpoint
CREATE INDEX "expense_items_expense_idx" ON "expense_items" USING btree ("organization_id","expense_id");--> statement-breakpoint
CREATE INDEX "expense_receipts_expense_idx" ON "expense_receipts" USING btree ("organization_id","expense_id");--> statement-breakpoint
CREATE INDEX "expenses_organization_paid_idx" ON "expenses" USING btree ("organization_id","paid_on" DESC NULLS LAST,"created_at" DESC NULLS LAST);