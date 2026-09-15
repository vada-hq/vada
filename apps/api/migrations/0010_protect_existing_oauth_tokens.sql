-- VADA는 제공자 API를 부르지 않으므로 예전에 원문으로 저장된 OAuth 자격증명을
-- 보관할 이유가 없다. 활성 세션은 sessions 표에 있어 이 정리의 영향을 받지 않는다.
-- 이후 로그인에서 받은 접근·갱신 토큰은 Better Auth가 암호화해 다시 저장한다.
UPDATE "accounts"
SET
	"access_token" = NULL,
	"refresh_token" = NULL,
	"id_token" = NULL
WHERE
	"access_token" IS NOT NULL
	OR "refresh_token" IS NOT NULL
	OR "id_token" IS NOT NULL;
