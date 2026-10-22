-- 수입 내용 상한과 이월금 하나(기능 009 조각 1, DEC-70). physical-model.md의 income과 같다. 새 칸·새 표는 없다.
-- 이미 있는 칸에 거는 제약이라 코드 배포 → 두 DB에서 위반 행 0건 확인 → 적용 순서로 한다.
-- 적용 전에 두 DB에서 내용이 200자를 넘는 수입, 한 기간에 취소하지 않은 이월금 수입이 둘 이상인 경우가 0건인지 본다.
ALTER TABLE income ADD CHECK (char_length(description) <= 200);
--> statement-breakpoint
-- 설계의 이름 규칙(표_칸_idx)에서 부분 유일 인덱스가 먼저 이름을 받으므로, 있던 일반 인덱스는 _idx1로 옮긴다.
ALTER INDEX income_fiscal_period_id_idx RENAME TO income_fiscal_period_id_idx1;
--> statement-breakpoint
CREATE UNIQUE INDEX income_fiscal_period_id_idx ON income (fiscal_period_id) WHERE source = 'carryover' AND cancelled_at IS NULL;
