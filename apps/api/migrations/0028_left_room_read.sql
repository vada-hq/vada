-- 학생회에서 내보내진 사람의 공지방 읽음 위치. 다시 들어오면 참여 줄에 되살리고 지운다.
-- 공지방은 들어오기 전 같은 기수 메시지도 보여(DEC-90) 이것이 없으면 이미 읽은 공지가 다시 안 읽음이 된다.
-- 방·운영진 행을 지우면(이 표를 모르는 옛 코드의 학생회 파기 포함) 따라 지워진다(ON DELETE CASCADE).
CREATE TABLE left_room_read (
  room_id uuid NOT NULL REFERENCES chat_room (id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES member (id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL,
  PRIMARY KEY (room_id, member_id)
);
--> statement-breakpoint
CREATE INDEX ON left_room_read (member_id);
