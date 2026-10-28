-- Custom SQL migration file, put your code below! --
-- 회의 일시·장소·취소·회의록·참가자와 후속 업무의 나온 곳을 남긴다(DEC-104).
-- 새 칸·새 표라 그것을 읽는 코드보다 먼저 두 DB에 적용한다. 지금 행이 어길 수 있는 제약이 없다.
-- 기존 칸 제약은 마이그레이션 B(mtg-8)에서 따로 더한다.
ALTER TABLE meeting
  ADD COLUMN ends_at timestamptz,
  ADD COLUMN place text CONSTRAINT meeting_place_check CHECK (char_length(place) <= 100),
  ADD COLUMN purpose text CONSTRAINT meeting_purpose_check CHECK (char_length(purpose) <= 500),
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancel_reason text CONSTRAINT meeting_cancel_reason_check CHECK (char_length(cancel_reason) <= 200),
  ADD CONSTRAINT meeting_ends_after_start CHECK (ends_at IS NULL OR ends_at > held_at),
  ADD CONSTRAINT meeting_cancel_pair CHECK ((cancelled_at IS NULL) = (cancel_reason IS NULL));
--> statement-breakpoint
-- ends_at·place는 새 회의의 계약에서 필수로 받는다. 기존 행을 위해 여기서는 NULL을 허용한다.
-- body는 미리 적는 안건 설명이고 notes는 그 안건의 회의록(논의 내용)이다.
ALTER TABLE agenda_item
  ADD COLUMN notes text CONSTRAINT agenda_item_notes_check CHECK (char_length(notes) <= 10000),
  ADD COLUMN cancelled_at timestamptz;
--> statement-breakpoint
ALTER TABLE decision ADD COLUMN cancelled_at timestamptz;
--> statement-breakpoint
-- 기록·판이 없는 연결 표다. 확정 전에 빼면 행을 지운다(room_membership과 같은 꼴).
-- 참가자와 회의가 같은 학생회인지, 더할 때 지금 운영진인지는 앱이 확인한다(RULE-50).
CREATE TABLE meeting_attendee (
  meeting_id uuid NOT NULL CONSTRAINT meeting_attendee_meeting_id_fk REFERENCES meeting (id),
  member_id uuid NOT NULL CONSTRAINT meeting_attendee_member_id_fk REFERENCES member (id),
  added_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meeting_attendee_pkey PRIMARY KEY (meeting_id, member_id)
);
--> statement-breakpoint
CREATE INDEX meeting_attendee_member_id_idx ON meeting_attendee (member_id);
--> statement-breakpoint
-- 나온 곳은 업무마다 하나이고 업무의 판에 남는다. 같은 학생회 안건인지는 앱이 확인한다(RULE-50).
ALTER TABLE task
  ADD COLUMN origin_id uuid,
  ADD COLUMN origin_kind text CONSTRAINT task_origin_kind_check CHECK (origin_kind IN ('agenda_item')),
  ADD CONSTRAINT task_origin_pair CHECK ((origin_id IS NULL) = (origin_kind IS NULL)),
  ADD CONSTRAINT task_origin_fk FOREIGN KEY (origin_id, origin_kind) REFERENCES record (id, kind);
--> statement-breakpoint
CREATE INDEX task_origin_id_idx ON task (origin_id);
--> statement-breakpoint
CREATE INDEX meeting_held_at_idx ON meeting (held_at);
-- agenda_item(meeting_id)는 UNIQUE(meeting_id, position)의 앞 칸으로 덮으므로 인덱스를 더하지 않는다.
