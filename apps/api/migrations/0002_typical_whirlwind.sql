CREATE TABLE "education_colleges" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "education_colleges_school_id" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "education_departments" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"college_id" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "education_schools" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "rep_school_id" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "rep_college_id" text;--> statement-breakpoint
ALTER TABLE "education_colleges" ADD CONSTRAINT "education_colleges_school_id_education_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."education_schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "education_departments" ADD CONSTRAINT "education_departments_college_same_school" FOREIGN KEY ("school_id","college_id") REFERENCES "public"."education_colleges"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "education_colleges_school_name" ON "education_colleges" USING btree ("school_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "education_departments_college_name" ON "education_departments" USING btree ("college_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "education_schools_name" ON "education_schools" USING btree ("name");--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_rep_school_id_education_schools_id_fk" FOREIGN KEY ("rep_school_id") REFERENCES "public"."education_schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_rep_college_same_school" FOREIGN KEY ("rep_school_id","rep_college_id") REFERENCES "public"."education_colleges"("school_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- ─── 첫 학교 하나 ───────────────────────────────────────────────────────────
--
-- **씨앗을 옮김 파일에 둔다.** 실서비스가 도는 것은 `npm run db:migrate` 하나뿐이라
-- (src/db/migrate.ts), 따로 씨앗 스크립트를 두면 그것을 누가 언제 돌리는지가 배포
-- 절차에 새로 생긴다 — 안 돌린 채 배포되면 학교 목록이 통째로 비고, 그 화면은
-- '검색 결과가 없습니다'만 그린다. 여기 두면 표가 생기는 그 순간 함께 든다.
-- 검사도 같은 파일에서 표를 만들므로(scripts/build-schema-sql.mjs) 두 길이 갈리지 않는다.
--
-- **되풀이해도 안전하다.** `ON CONFLICT DO NOTHING`이라 두 번 돌아도 같은 것이 두 번
-- 들어가지 않는다. 옮김은 원래 한 번만 도는데도 이렇게 두는 까닭은, 이 파일이 다른
-- 저장소에 손으로 부어질 수 있고 그때 조용히 깨지는 것보다 아무 일도 안 하는 편이
-- 낫기 때문이다. 반대로 **이미 든 줄을 고치지는 않는다**(DO UPDATE가 아니다) —
-- 이름이 바뀌면 그것은 다음 옮김 파일이 할 일이다.
--
-- **전국을 채우지 않는다.** 사람이 '지금은 한 학교만'으로 정했다(한양대 ERICA의
-- 소프트웨어융합대학). 나머지는 학교알리미 같은 공시 자료에서 와야 하고, 지어낸
-- 목록은 사람이 자기 학과를 못 찾는 순간 거짓으로 드러난다.
INSERT INTO "education_schools" ("id", "name") VALUES
	('SCH-HYU-ERICA', '한양대학교 ERICA')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "education_colleges" ("id", "school_id", "name") VALUES
	('COL-HYU-ERICA-SW', 'SCH-HYU-ERICA', '소프트웨어융합대학')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "education_departments" ("id", "school_id", "college_id", "name") VALUES
	('DEP-HYU-ERICA-SW-CS', 'SCH-HYU-ERICA', 'COL-HYU-ERICA-SW', '컴퓨터학부'),
	('DEP-HYU-ERICA-SW-ICT', 'SCH-HYU-ERICA', 'COL-HYU-ERICA-SW', 'ICT융합학부'),
	('DEP-HYU-ERICA-SW-AI', 'SCH-HYU-ERICA', 'COL-HYU-ERICA-SW', '인공지능학과')
ON CONFLICT ("id") DO NOTHING;
