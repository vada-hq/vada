-- 행사와 계좌 칸 상한(기능 006 조각 1). physical-model.md의 CHECK와 같다.
-- 이미 있는 칸에 거는 제약이라 코드 배포 → 두 DB에서 위반 행 0건 확인 → 적용 순서로 한다.
ALTER TABLE event ADD CHECK (char_length(name) <= 100);
--> statement-breakpoint
ALTER TABLE event ADD CHECK (char_length(place) <= 100);
--> statement-breakpoint
ALTER TABLE account ADD CHECK (char_length(name) <= 20);
--> statement-breakpoint
ALTER TABLE account ADD CHECK (char_length(bank) <= 20);
--> statement-breakpoint
ALTER TABLE account ADD CHECK (char_length(account_number) <= 30);
--> statement-breakpoint
ALTER TABLE account ADD CHECK (char_length(holder) <= 60);
