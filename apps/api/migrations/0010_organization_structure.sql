ALTER TABLE "departments" ADD COLUMN "is_leadership" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "title" text;--> statement-breakpoint
CREATE UNIQUE INDEX "departments_one_leadership" ON "departments" USING btree ("organization_id") WHERE "departments"."is_leadership";--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_leadership_not_finance" CHECK (NOT ("departments"."is_leadership" AND "departments"."handles_finance"));--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_title_not_blank" CHECK ("memberships"."title" ~ '[^[:space:]]');--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_title_length" CHECK (char_length("memberships"."title") <= 20);--> statement-breakpoint
-- 기존 학생회마다 빈 회장단을 만든다. 회장단에 넣을 사람은 배포 뒤 정한다.
INSERT INTO "departments" ("id", "organization_id", "name", "is_leadership") SELECT gen_random_uuid()::text, "id", '회장단', true FROM "organizations";
