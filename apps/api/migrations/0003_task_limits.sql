-- 업무 칸 상한과 상태(기능 004 조각 1). physical-model.md의 task 제목·내용 CHECK, 상태 기본값과 CHECK와 같다.
-- 이미 있는 칸에 거는 제약이라 코드 배포 → 두 DB에서 위반 행 0건 확인 → 적용 순서로 한다.
ALTER TABLE task ADD CHECK (char_length(title) <= 100);
--> statement-breakpoint
ALTER TABLE task ADD CHECK (char_length(body) <= 1000);
--> statement-breakpoint
ALTER TABLE task ALTER COLUMN status SET DEFAULT 'todo';
--> statement-breakpoint
ALTER TABLE task ADD CHECK (status IN ('todo', 'in_progress', 'done'));
