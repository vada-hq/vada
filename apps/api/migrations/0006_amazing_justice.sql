CREATE TABLE "budget_periods" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_periods_once" UNIQUE("org_id")
);
--> statement-breakpoint
CREATE TABLE "budget_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "budget_sources_org_id" UNIQUE("org_id","id")
);
--> statement-breakpoint
ALTER TABLE "budget_items" ADD COLUMN "department_id" text;--> statement-breakpoint
ALTER TABLE "budget_periods" ADD CONSTRAINT "budget_periods_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_sources" ADD CONSTRAINT "budget_sources_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_sources_org" ON "budget_sources" USING btree ("org_id");--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_department_same_org" FOREIGN KEY ("org_id","department_id") REFERENCES "public"."departments"("org_id","id") ON DELETE set null ON UPDATE no action;