-- 취소하지 않은 입금 기록은 신청마다 하나다(기능 008 조각 1, 표 변경 B, DEC-68). 이미 있는 칸에 거는 제약이다.
-- 적용 전에 두 DB에서 같은 신청의 취소하지 않은 입금 기록이 둘 이상인 경우가 0건인지 본다.
-- 설계의 이름 규칙(표_칸_idx)에서 부분 유일 인덱스가 먼저 이름을 받으므로, 있던 일반 인덱스는 _idx1로 옮긴다.
ALTER INDEX deposit_registration_id_idx RENAME TO deposit_registration_id_idx1;
--> statement-breakpoint
CREATE UNIQUE INDEX deposit_registration_id_idx ON deposit (registration_id) WHERE cancelled_at IS NULL;
