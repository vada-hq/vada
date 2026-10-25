-- 탈퇴의 바탕(기능 021 조각 5, DEC-54, DEC-64, RULE-16). 운영진에 탈퇴한 시각을 두고, 탈퇴하면 이름과 이메일을 비운다.
-- 탈퇴한 운영진은 학생회마다 '떠난 운영진 N'으로 보인다. N은 저장하지 않고 읽을 때 센다(logical-model.md 계산되는 값).
-- 넓히기와 새 칸이라 그것을 읽는 코드보다 먼저 두 DB에 적용한다. 지금 행은 모두 이름과 이메일이 있고 탈퇴한 시각이 없어 CHECK를 어길 수 없다.
ALTER TABLE member
  ADD COLUMN left_at timestamptz,
  ALTER COLUMN name DROP NOT NULL,
  ALTER COLUMN email DROP NOT NULL,
  ADD CONSTRAINT member_left_clears_name_email CHECK (
    (left_at IS NULL AND name IS NOT NULL AND email IS NOT NULL)
    OR (left_at IS NOT NULL AND name IS NULL AND email IS NULL)
  );
--> statement-breakpoint
-- 동의 기록은 탈퇴하고 1년 둔다(DEC-51, DEC-55). 로그인 계정을 지울 때 함께 지워지지 않게 외래 키를 빼고, 탈퇴한 시각을 둔다.
-- 남는 것은 계정 번호(가명)·판·시각뿐이다. 1년이 지난 줄은 기한 파기가 지운다(조각 6).
ALTER TABLE terms_agreement
  DROP CONSTRAINT terms_agreement_user_id_fkey,
  ADD COLUMN withdrawn_at timestamptz;
