-- 보낸 시각과 순서를 보존하면서 고친 메시지를 구별한다.
ALTER TABLE message ADD COLUMN edited_at timestamptz;
