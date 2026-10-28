-- Custom SQL migration file, put your code below! --
-- 캘린더에서 만든 일정(DEC-102). 행사·회의·업무 날짜는 각 원본 표가 맡는다.
-- 새 표이며, main CI가 이 표를 읽는 코드 배포 전에 적용한다.
ALTER TABLE record DROP CONSTRAINT record_kind_check;
--> statement-breakpoint
ALTER TABLE record ADD CONSTRAINT record_kind_check CHECK (kind IN (
  'council', 'cohort', 'member', 'council_membership', 'department',
  'department_membership', 'audit_body', 'voting_body', 'fiscal_period',
  'budget', 'budget_item', 'income', 'expense', 'payment_line', 'evidence',
  'account_closing', 'fee_payment', 'deposit', 'account', 'event', 'task', 'request',
  'line_item', 'registration_form', 'registration', 'attendance', 'meeting', 'agenda_item', 'poll',
  'poll_option', 'poll_response', 'approval', 'decision', 'document',
  'draft_item', 'source', 'chat_room', 'message', 'file', 'notification', 'shipment', 'schedule_item'));
--> statement-breakpoint
CREATE TABLE schedule_item (
  id uuid PRIMARY KEY,
  kind text NOT NULL DEFAULT 'schedule_item' CHECK (kind = 'schedule_item'),
  council_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('deadline', 'academic', 'external', 'other')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  starts_on date,
  ends_on date,
  starts_at timestamptz,
  ends_at timestamptz,
  place text CHECK (char_length(place) BETWEEN 1 AND 100),
  memo text CHECK (char_length(memo) BETWEEN 1 AND 1000),
  visibility text NOT NULL DEFAULT 'council' CHECK (visibility IN ('council', 'department')),
  department_id uuid REFERENCES department (id),
  event_id uuid REFERENCES event (id),
  cancelled_at timestamptz,
  CHECK ((starts_on IS NULL) <> (starts_at IS NULL)),
  CHECK (starts_on IS NOT NULL OR ends_on IS NULL),
  CHECK (starts_at IS NOT NULL OR ends_at IS NULL),
  CHECK (ends_on IS NULL OR ends_on >= starts_on),
  CHECK (ends_at IS NULL OR ends_at > starts_at),
  CHECK (visibility = 'council' OR department_id IS NOT NULL),
  FOREIGN KEY (id, kind) REFERENCES record (id, kind),
  FOREIGN KEY (id, council_id) REFERENCES record (id, council_id),
  FOREIGN KEY (department_id, council_id) REFERENCES record (id, council_id),
  FOREIGN KEY (event_id, council_id) REFERENCES record (id, council_id)
);
--> statement-breakpoint
CREATE INDEX ON schedule_item (council_id);
--> statement-breakpoint
CREATE INDEX ON schedule_item (department_id);
--> statement-breakpoint
CREATE INDEX ON schedule_item (event_id);
