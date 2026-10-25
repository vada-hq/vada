-- 이미 저장된 Google 프로필 사진 주소와 토큰을 비우고, 다시 저장되지 못하게 막는다(기능 021 조각 3, DEC-53 결과, 처리방침 1조 ②).
-- 손 SQL이 아니라 마이그레이션인 까닭: 운영 DB는 main CI가 적용하고 기록이 남으며, 아무도 행 내용을 보지 않는다(DEC-56).
-- 로그인이 이 값을 저장하지 않게 고친 코드(조각 2)가 배포된 뒤에 올린다. 먼저 올리면 그사이 로그인이 값을 다시 쓴다.
-- 지운 값은 되살리지 않는다(뜻한 대로). vada는 이 값을 읽지 않고 Google API도 부르지 않는다.
UPDATE users SET image = NULL WHERE image IS NOT NULL;
--> statement-breakpoint
-- 만료 시각은 토큰이 없으면 뜻이 없어 같이 비운다.
UPDATE accounts
SET
  access_token = NULL,
  refresh_token = NULL,
  id_token = NULL,
  access_token_expires_at = NULL,
  refresh_token_expires_at = NULL
WHERE access_token IS NOT NULL
  OR refresh_token IS NOT NULL
  OR id_token IS NOT NULL
  OR access_token_expires_at IS NOT NULL
  OR refresh_token_expires_at IS NOT NULL;
--> statement-breakpoint
-- CHECK는 값을 비운 다음에 같은 마이그레이션에서 건다. PostgreSQL은 CHECK를 걸 때 모든 행을 검사하므로, 저장된 값이 남아 있으면
-- 적용이 실패해 배포가 멈춘다. 그래서 비우기를 먼저 두어 위반 행이 남을 수 없게 한다. drizzle은 남은 마이그레이션을 한 거래로
-- 적용하므로, CHECK가 실패하면 비우기도 함께 되돌아가 DB는 그대로다.
-- CHECK는 코드(조각 2)가 놓친 경로가 있어도 DB가 마지막으로 막는 방어다.
ALTER TABLE users ADD CONSTRAINT users_image_not_stored CHECK (image IS NULL);
--> statement-breakpoint
ALTER TABLE accounts ADD CONSTRAINT accounts_tokens_not_stored CHECK (
  access_token IS NULL AND refresh_token IS NULL AND id_token IS NULL
);
