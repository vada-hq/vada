-- 수입 적기와 구매 요청 내기도 명령 영수증을 쓴다(DEC-84를 넓힘, QA Q-finance-1·2). 종류와 결과 종류의 허용 값을 넓힌다.
-- 허용 값을 넓히는 것뿐이라 위반 행이 생길 수 없다. 새 값을 쓰는 코드보다 먼저 두 DB에 적용한다(main CI가 배포 전에 적용한다).
ALTER TABLE command_receipt DROP CONSTRAINT command_receipt_kind_check;
--> statement-breakpoint
ALTER TABLE command_receipt ADD CONSTRAINT command_receipt_kind_check CHECK (kind IN ('registration_apply', 'expense_create', 'income_create', 'request_create'));
--> statement-breakpoint
ALTER TABLE command_receipt DROP CONSTRAINT command_receipt_check;
--> statement-breakpoint
ALTER TABLE command_receipt ADD CONSTRAINT command_receipt_check CHECK (
  (kind = 'registration_apply' AND result_kind = 'registration')
  OR (kind = 'expense_create' AND result_kind = 'expense')
  OR (kind = 'income_create' AND result_kind = 'income')
  OR (kind = 'request_create' AND result_kind = 'request')
);
