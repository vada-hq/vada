-- 개인 캘린더 구독 주소(DEC-102). 토큰은 SHA-256 소문자 16진으로만 저장한다.
CREATE TABLE calendar_feed (
  member_id uuid NOT NULL REFERENCES member (id),
  council_id uuid NOT NULL REFERENCES council (id),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, council_id)
);
--> statement-breakpoint
CREATE INDEX ON calendar_feed (council_id);
