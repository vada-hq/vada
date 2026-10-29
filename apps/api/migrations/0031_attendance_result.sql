-- 출석 기록에 결과(참석, 불참)를 둔다(DEC-93). 운영진이 명단에서 고른 줄을 [불참 처리]한다. 불참은 신청 취소를 막지 않는다.
-- 지금 출석 기록은 모두 참석이라 기본값이 그 뜻이다. 새 칸이라 그것을 읽는 코드보다 먼저 두 DB에 적용하고, 새 칸의 CHECK라 위반 행이 없다.
-- 취소하지 않은 출석 기록은 결과와 상관없이 신청마다 하나다(attendance_registration_id_idx 그대로).
ALTER TABLE attendance
  ADD COLUMN result text NOT NULL DEFAULT 'attended' CHECK (result IN ('attended', 'absent'));
