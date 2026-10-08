ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_name_unique" UNIQUE("organization_id","name");--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_name_not_blank" CHECK ("departments"."name" ~ '[^[:space:]]');--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_name_length" CHECK (char_length("departments"."name") <= 20);--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_name_not_blank" CHECK ("organizations"."name" ~ '[^[:space:]]');--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_name_length" CHECK (char_length("organizations"."name") <= 50);