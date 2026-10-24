-- 명령 영수증(기능 017, DEC-84, RULE-45). 공개 신청과 지출 적기를 같은 명령 번호로 다시 보내면 처음 결과를 돌려주려고 만든 기록을 남긴다. 기록(record)이 아니라 판이 없다.
-- 새 표만 더하므로 기존 행을 깨지 않는다. 이 표를 읽는 코드보다 먼저 두 DB에 적용한다.
-- body_hash는 서버 비밀 값으로 만든 HMAC이라 되돌릴 수 없다. 그래도 신청 본문에서 나온 값이라 신청을 취소하거나 비울 때 같이 지우고, 아니어도 24시간 뒤 지운다(purge/run.ts). 로그와 응답에 싣지 않는다.
-- scope_key: 신청은 양식 번호, 지출은 '학생회 번호:보낸 운영진 번호'. 같은 번호도 범위가 다르면 따로 센다.
-- 같은 번호의 재전송이 겹쳐도 하나만 남는 것은 UNIQUE가 막는다(앱의 잠금은 그 앞의 한 겹이다).
CREATE TABLE command_receipt (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  kind        text NOT NULL CHECK (kind IN ('registration_apply', 'expense_create')),
  scope_key   text NOT NULL CHECK (char_length(scope_key) <= 80),
  command_id  uuid NOT NULL,
  body_hash   text NOT NULL CHECK (body_hash ~ '^[0-9a-f]{64}$'),
  result_id   uuid NOT NULL,
  result_kind text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, scope_key, command_id),
  CHECK ((kind = 'registration_apply' AND result_kind = 'registration') OR (kind = 'expense_create' AND result_kind = 'expense')),
  FOREIGN KEY (result_id, result_kind) REFERENCES record (id, kind)
);
--> statement-breakpoint
CREATE INDEX command_receipt_result_id_idx ON command_receipt (result_id);
--> statement-breakpoint
CREATE INDEX command_receipt_created_at_idx ON command_receipt (created_at);
