CREATE TABLE "coupang_products" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fetched_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupang_products_id_digits" CHECK ("coupang_products"."id" ~ '^[0-9]{1,20}$'),
	CONSTRAINT "coupang_products_status_valid" CHECK ("coupang_products"."status" IN ('pending','ready','failed')),
	CONSTRAINT "coupang_products_items_array" CHECK (jsonb_typeof("coupang_products"."items") = 'array' AND jsonb_array_length("coupang_products"."items") <= 100),
	CONSTRAINT "coupang_products_ready_fetched" CHECK ("coupang_products"."status" <> 'ready' OR "coupang_products"."fetched_at" IS NOT NULL),
	CONSTRAINT "coupang_products_attempts_nonnegative" CHECK ("coupang_products"."attempts" >= 0),
	CONSTRAINT "coupang_products_error_code" CHECK ("coupang_products"."error_code" ~ '^[A-Z_]{1,40}$')
);
--> statement-breakpoint
CREATE TABLE "purchase_candidate_shares" (
	"organization_id" text NOT NULL,
	"candidate_id" text NOT NULL,
	"message_id" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_candidate_shares_message_id_position_pk" PRIMARY KEY("message_id","position"),
	CONSTRAINT "purchase_candidate_shares_position" CHECK ("purchase_candidate_shares"."position" >= 0 AND "purchase_candidate_shares"."position" < 10)
);
--> statement-breakpoint
CREATE TABLE "purchase_candidates" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text NOT NULL,
	"product_id" text NOT NULL,
	"item_id" text,
	"vendor_item_id" text,
	"url" text NOT NULL,
	"hidden_by" text,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_candidates_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "purchase_candidates_event_product_vendor_unique" UNIQUE NULLS NOT DISTINCT("event_id","product_id","vendor_item_id"),
	CONSTRAINT "purchase_candidates_item_digits" CHECK ("purchase_candidates"."item_id" ~ '^[0-9]{1,20}$'),
	CONSTRAINT "purchase_candidates_vendor_digits" CHECK ("purchase_candidates"."vendor_item_id" ~ '^[0-9]{1,20}$'),
	CONSTRAINT "purchase_candidates_url" CHECK ("purchase_candidates"."url" LIKE 'https://www.coupang.com/vp/products/%' AND char_length("purchase_candidates"."url") <= 200),
	CONSTRAINT "purchase_candidates_hidden_pair" CHECK (("purchase_candidates"."hidden_at" IS NULL) = ("purchase_candidates"."hidden_by" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "candidate_id" text;--> statement-breakpoint
ALTER TABLE "purchase_candidate_shares" ADD CONSTRAINT "purchase_candidate_shares_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_candidate_shares" ADD CONSTRAINT "purchase_candidate_shares_candidate_same_organization" FOREIGN KEY ("organization_id","candidate_id") REFERENCES "public"."purchase_candidates"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_candidates" ADD CONSTRAINT "purchase_candidates_product_id_coupang_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."coupang_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_candidates" ADD CONSTRAINT "purchase_candidates_hidden_by_users_id_fk" FOREIGN KEY ("hidden_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_candidates" ADD CONSTRAINT "purchase_candidates_event_same_organization" FOREIGN KEY ("organization_id","event_id") REFERENCES "public"."events"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coupang_products_due_idx" ON "coupang_products" USING btree ("next_attempt_at") WHERE "coupang_products"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "purchase_candidate_shares_candidate_idx" ON "purchase_candidate_shares" USING btree ("candidate_id","created_at");--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_candidate_same_organization" FOREIGN KEY ("organization_id","candidate_id") REFERENCES "public"."purchase_candidates"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchase_items_candidate_idx" ON "purchase_items" USING btree ("organization_id","candidate_id");