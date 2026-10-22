-- 출석의 확인 방법과 취소, 열람 기록, 개인 링크(기능 007 조각 1). physical-model.md의 attendance와 같고, 뒤의 두 표는 설계 밖 표다.
-- 새 칸과 새 표라 그것을 읽는 코드보다 먼저 두 DB에 적용한다. method는 NOT NULL이라 적용 전에 두 DB의 attendance가 0행인지 본다.
-- 납부 학번은 기한이 지나거나 빼면 비운다(DEC-54, DEC-55). 행은 남는다.
ALTER TABLE fee_payment ALTER COLUMN student_id DROP NOT NULL;
--> statement-breakpoint
-- 취소하면 학번만 바로 비운다. 환불을 기다리는 동안 이름과 휴대폰이 남는다(DEC-55). 지금 규칙보다 느슨해 위반 행이 생길 수 없다.
ALTER TABLE registration DROP CONSTRAINT registration_check;
--> statement-breakpoint
ALTER TABLE registration ADD CHECK (cancelled_at IS NULL OR student_id IS NULL);
--> statement-breakpoint
ALTER TABLE attendance ADD COLUMN method text NOT NULL CHECK (method IN ('qr', 'manual'));
--> statement-breakpoint
ALTER TABLE attendance ADD COLUMN cancelled_at timestamptz;
--> statement-breakpoint
-- 설계의 이름 규칙(표_칸_idx)에서 부분 유일 인덱스가 먼저 이름을 받으므로, 있던 일반 인덱스는 _idx1로 옮긴다.
ALTER INDEX attendance_registration_id_idx RENAME TO attendance_registration_id_idx1;
--> statement-breakpoint
CREATE UNIQUE INDEX attendance_registration_id_idx ON attendance (registration_id) WHERE cancelled_at IS NULL;
--> statement-breakpoint
-- 개인 링크: 신청마다 하나. 토큰은 SHA-256(소문자 16진)만 둔다. 취소하거나 신청자 정보를 비우면 줄을 지운다(DEC-44).
CREATE TABLE registration_link (
  registration_id uuid PRIMARY KEY REFERENCES registration (id),
  token_hash      text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  created_at      timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
-- 신청자 정보 열람 기록(DEC-56, 접속기록 항목). 1년 뒤 지운다. 양식·신청은 같은 학생회의 것이어야 한다(기록의 (id, council_id)로 건다).
CREATE TABLE applicant_access_log (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  member_id       uuid NOT NULL REFERENCES member (id),
  council_id      uuid NOT NULL REFERENCES council (id),
  form_id         uuid NOT NULL REFERENCES registration_form (id),
  registration_id uuid REFERENCES registration (id),
  action          text NOT NULL CHECK (action IN ('list', 'check_in')),
  accessed_at     timestamptz NOT NULL DEFAULT now(),
  ip              text NOT NULL CHECK (char_length(ip) BETWEEN 1 AND 45),
  FOREIGN KEY (form_id, council_id) REFERENCES record (id, council_id),
  FOREIGN KEY (registration_id, council_id) REFERENCES record (id, council_id)
);
--> statement-breakpoint
CREATE INDEX ON applicant_access_log (accessed_at);
--> statement-breakpoint
CREATE INDEX ON applicant_access_log (form_id);
