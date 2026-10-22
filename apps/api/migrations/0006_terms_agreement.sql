-- 가입 동의 기록(기능 006 조각 2, DEC-51). 로그인 계정마다 동의한 약관 판과 처리방침 판(시행일)을 남긴다.
-- 설계 밖 표다. 새 표라 그것을 읽는 코드보다 먼저 두 DB에 적용한다. 기록은 고치지 않고 판마다 한 줄 더한다.
CREATE TABLE terms_agreement (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id         text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  terms_version   text NOT NULL CHECK (terms_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  privacy_version text NOT NULL CHECK (privacy_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  agreed_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, terms_version, privacy_version)
);
