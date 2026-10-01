CREATE TABLE "shipment_registrations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"input_hash" text NOT NULL,
	"shipment_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipment_registrations_actor_key_unique" UNIQUE("organization_id","actor_id","idempotency_key"),
	CONSTRAINT "shipment_registrations_key_not_blank" CHECK ("shipment_registrations"."idempotency_key" ~ '[^[:space:]]'),
	CONSTRAINT "shipment_registrations_hash_valid" CHECK ("shipment_registrations"."input_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "shipment_registrations" ADD CONSTRAINT "shipment_registrations_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_registrations" ADD CONSTRAINT "shipment_registrations_same_organization" FOREIGN KEY ("organization_id","shipment_id") REFERENCES "public"."shipments"("organization_id","id") ON DELETE restrict ON UPDATE no action;