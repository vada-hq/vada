-- 승인한 품목의 취소(기능 014, DEC-73). 결재 기록의 결과에 cancelled를 더한다: 품목의 상태는 마지막 결재 기록이고, 승인 기록은 그대로 남는다(RULE-9).
-- 허용 값을 넓히는 것뿐이라 위반 행이 생길 수 없다. 새 값을 쓰는 코드보다 먼저 두 DB에 적용한다.
ALTER TABLE approval DROP CONSTRAINT approval_outcome_check;
--> statement-breakpoint
ALTER TABLE approval ADD CONSTRAINT approval_outcome_check CHECK (outcome IN ('approved', 'rejected', 'cancelled', 'audited', 'completed', 'completion_cancelled'));
