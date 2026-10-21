-- 구매와 지출 칸 상한(기능 005 조각 1). physical-model.md의 CHECK와 같다.
-- 이미 있는 칸에 거는 제약이라 코드 배포 → 두 DB에서 위반 행 0건 확인 → 적용 순서로 한다.
ALTER TABLE fiscal_period ADD CHECK (char_length(name) <= 20);
--> statement-breakpoint
ALTER TABLE budget_item ADD CHECK (char_length(purpose) <= 100);
--> statement-breakpoint
ALTER TABLE request ADD CHECK (char_length(title) <= 100);
--> statement-breakpoint
ALTER TABLE request ADD CHECK (char_length(body) <= 1000);
--> statement-breakpoint
ALTER TABLE line_item ADD CHECK (char_length(name) <= 100);
--> statement-breakpoint
ALTER TABLE line_item ADD CHECK (char_length(link) <= 2000);
--> statement-breakpoint
ALTER TABLE line_item ADD CHECK (char_length(options) <= 200);
--> statement-breakpoint
ALTER TABLE expense ADD CHECK (char_length(vendor) <= 100);
--> statement-breakpoint
ALTER TABLE expense ADD CHECK (char_length(description) <= 200);
--> statement-breakpoint
ALTER TABLE expense ADD CHECK (char_length(reason) <= 1000);
--> statement-breakpoint
ALTER TABLE approval ADD CHECK (char_length(reason) <= 500);
