-- 행사 정산의 새 칸(기능 008 조각 1, 표 변경 A). physical-model.md의 request·deposit과 같다(DEC-68).
-- 새 칸과 새 칸의 제약만 둔다. 그것을 읽는 코드보다 먼저 두 DB에 적용한다. 기존 칸에 거는 제약은 0010이다.
-- 요청의 행사: 낼 때 고르고 바꾸지 않는다. 행사의 '결재를 기다리는 품목'은 이것으로 센다.
ALTER TABLE request ADD COLUMN event_id uuid REFERENCES event (id);
--> statement-breakpoint
CREATE INDEX ON request (event_id);
--> statement-breakpoint
-- 잘못 확인한 입금은 지우지 않고 취소한다.
ALTER TABLE deposit ADD COLUMN cancelled_at timestamptz;
--> statement-breakpoint
-- 환불함 표시(DEC-55). 설계에는 있고 DB에 없던 칸이다. 새 칸이라 위반 행이 생길 수 없다.
ALTER TABLE deposit ADD COLUMN refunded_at timestamptz;
--> statement-breakpoint
ALTER TABLE deposit ADD COLUMN refund_amount numeric(14, 0) CHECK (refund_amount >= 0 AND refund_amount <= amount);
--> statement-breakpoint
ALTER TABLE deposit ADD CHECK ((refunded_at IS NULL) = (refund_amount IS NULL));
