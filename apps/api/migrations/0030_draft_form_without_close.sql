-- 초안 양식은 마감 없이 저장한다(DEC-93: 행사 시작이 미정이면 마감을 정할 수 없다). 활성화는 지금처럼 마감 없음을 막는다(missingFormConditions).
-- 넓히기라 그것을 읽는 코드보다 먼저 두 DB에 적용한다. NOT NULL을 대신하는 CHECK를 같은 문장에 건다:
-- 마감이 비면 멈춘 양식이어야 한다. 지금 행은 모두 마감이 있어 CHECK를 어길 수 없다. 신청 0명(초안)은 서버가 본다.
ALTER TABLE registration_form
  ALTER COLUMN closes_at DROP NOT NULL,
  ADD CONSTRAINT registration_form_open_needs_close CHECK (closes_at IS NOT NULL OR paused_at IS NOT NULL);
