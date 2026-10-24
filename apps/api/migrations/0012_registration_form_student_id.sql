-- 신청 양식의 학번 받기(DEC-75). physical-model.md의 registration_form.collects_student_id와 같다.
-- 새 칸과 새 칸의 제약이라 그것을 읽는 코드보다 먼저 두 DB에 적용한다.
-- 처음 값이 true인 까닭: 적용하고 새 코드를 배포하기 전까지 옛 코드는 이 칸 없이 양식을 넣는다. 처음 값이 false면 두 참가비가 다른 양식이 아래 CHECK에 걸린다.
ALTER TABLE registration_form ADD COLUMN collects_student_id boolean NOT NULL DEFAULT true;
--> statement-breakpoint
-- 이미 있는 양식은 지금 받는 항목을 그대로 둔다: 두 참가비가 다르면 받고, 아니면 받지 않는다. 이미 공지한 신청 화면이 바뀌지 않게 한다.
UPDATE registration_form SET collects_student_id = (payer_fee IS DISTINCT FROM non_payer_fee);
--> statement-breakpoint
-- 적용 참가비를 납부자 명단과 학번으로 정하므로(DEC-26, DEC-67) 두 참가비가 다르면 학번을 꼭 받는다. 위 채우기로 위반 행이 없다.
ALTER TABLE registration_form ADD CHECK (collects_student_id OR payer_fee IS NOT DISTINCT FROM non_payer_fee);
