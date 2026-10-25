-- 지운 메시지의 바탕(기능 021 조각 8, DEC-54, DEC-88, RULE-17). 메시지는 행을 남기고 본문을 비우며 지운 시각을 둔다.
-- 붙은 사진 파일도 행을 남기고 이름과 저장소 위치를 비운다. 증빙으로 따로 복사한 파일은 다른 행이라 그대로다(DEC-45).
-- 넓히기와 새 칸이라 그것을 읽는 코드보다 먼저 두 DB에 적용한다. 지금 행은 모두 본문이 있고 지운 시각이 없어 CHECK를 어길 수 없다.
ALTER TABLE message
  ADD COLUMN deleted_at timestamptz,
  ALTER COLUMN body DROP NOT NULL,
  ADD CONSTRAINT message_deleted_clears_body CHECK ((deleted_at IS NULL) = (body IS NOT NULL));
--> statement-breakpoint
-- 지금 파일은 모두 이름과 저장소 위치가 있어 CHECK를 어길 수 없다. 저장소 위치의 UNIQUE는 NULL끼리 겹치지 않는다.
ALTER TABLE file
  ALTER COLUMN name DROP NOT NULL,
  ALTER COLUMN storage_key DROP NOT NULL,
  ADD CONSTRAINT file_cleared_together CHECK ((name IS NULL) = (storage_key IS NULL));
