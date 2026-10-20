-- 대화 칸 상한(기능 003 조각 1). physical-model.md의 message.body, file.name CHECK와 같다.
-- 이미 있는 칸에 거는 제약이라 코드 배포 → 두 DB에서 위반 행 0건 확인 → 적용 순서로 한다.
ALTER TABLE message ADD CHECK (char_length(body) <= 2000);
--> statement-breakpoint
ALTER TABLE file ADD CHECK (char_length(name) <= 200);
