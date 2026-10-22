-- 신청 양식과 참가 신청 칸의 상한과 형식(기능 007 조각 1). physical-model.md의 CHECK와 같다.
-- 이미 있는 칸에 거는 제약이라 코드 배포 → 두 DB에서 위반 행 0건 확인 → 적용 순서로 한다. 새 칸과 표는 0008에 있다.
ALTER TABLE registration_form ADD CHECK (char_length(name) <= 50);
--> statement-breakpoint
ALTER TABLE registration_form ADD CHECK (char_length(notice) <= 2000);
--> statement-breakpoint
ALTER TABLE registration_form ADD CHECK (public_code ~ '^[2-9A-HJ-NP-Z]{8}$');
--> statement-breakpoint
ALTER TABLE registration_form ADD CHECK ((payer_fee IS NULL) = (non_payer_fee IS NULL));
--> statement-breakpoint
ALTER TABLE registration ADD CHECK (char_length(name) <= 50);
--> statement-breakpoint
ALTER TABLE registration ADD CHECK (student_id ~ '^[0-9]{6,12}$');
--> statement-breakpoint
ALTER TABLE registration ADD CHECK (phone ~ '^01[0-9]{8,9}$');
