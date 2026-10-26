-- 답글(기능 022 조각 10, DEC-90). 답글은 원글과 같은 방의 메시지이고 원글을 가리킨다. 원글이 아닌 메시지는 비어 있다.
-- 한 단계(원글이 답글이 아님)는 서버가 막는다. 같은 방은 DB가 막는다: (id, room_id) UNIQUE를 두고 (reply_to_id, room_id)가 그것을 가리킨다.
-- 새 칸이라 그것을 읽는 코드보다 먼저 두 DB에 적용한다. 지금 행은 모두 reply_to_id가 비어 외래 키를 어길 수 없고,
-- (id, room_id) UNIQUE는 id가 기본 키라 지금 행이 어길 수 없다(기존 칸의 제약이지만 위반 행이 생길 수 없어 한 마이그레이션에 둔다).
ALTER TABLE message ADD CONSTRAINT message_id_room_id_key UNIQUE (id, room_id);
--> statement-breakpoint
ALTER TABLE message
  ADD COLUMN reply_to_id uuid,
  ADD CONSTRAINT message_reply_to_same_room_fkey
    FOREIGN KEY (reply_to_id, room_id) REFERENCES message (id, room_id);
--> statement-breakpoint
CREATE INDEX message_reply_to_id_idx ON message (reply_to_id);
