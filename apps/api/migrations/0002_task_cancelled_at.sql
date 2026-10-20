-- 업무 지우기(DEC-49, 기능 004 조각 1). physical-model.md의 task.cancelled_at과 같다.
-- 새 칸이라 위반 행이 생길 수 없다. 읽는 코드(조각 2)보다 먼저 두 DB에 적용한다.
ALTER TABLE task ADD COLUMN cancelled_at timestamptz;
