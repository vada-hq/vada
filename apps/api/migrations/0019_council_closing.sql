-- 학생회 그만두기(기능 021 조각 9, DEC-55). 그만둔다고 알린 시각을 두고, 그동안 학생회는 읽기만 된다.
-- 새 칸이라 그것을 읽는 코드보다 먼저 두 DB에 적용한다. 지금 학생회는 모두 비어 있다(그만두지 않음).
ALTER TABLE council ADD COLUMN closing_requested_at timestamptz;
--> statement-breakpoint
-- 신청자 정보 열람 기록은 VADA의 법령상 의무 기록이라 학생회를 파기해도 1년 남는다(DEC-55 접근 기록, DEC-72).
-- 학생회·운영진·양식·신청 행을 지울 때 막히지 않게 외래 키를 빼고, 번호(가명)·행동·시각·IP만 남긴다(0016의 동의 기록과 같은 방식).
-- 제약을 빼기만 해서 지금 행이 어길 것이 없고, 지금 코드는 이 외래 키에 기대지 않는다.
ALTER TABLE applicant_access_log
  DROP CONSTRAINT applicant_access_log_member_id_fkey,
  DROP CONSTRAINT applicant_access_log_council_id_fkey,
  DROP CONSTRAINT applicant_access_log_form_id_fkey,
  DROP CONSTRAINT applicant_access_log_registration_id_fkey,
  DROP CONSTRAINT applicant_access_log_form_id_council_id_fkey,
  DROP CONSTRAINT applicant_access_log_registration_id_council_id_fkey;
