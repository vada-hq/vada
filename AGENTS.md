# VADA M1 저장소 규칙

## 새 API를 만들 때
- 요청 본문 스키마는 `packages/contracts`에 zod `z.strictObject`로 정의한다. 문자열은 `text(max)`(사람이 쓰는 글) 또는 `token(max)`(식별자·키)로만 만들고, 모든 문자열·배열·숫자에 상한을 둔다.
- 라우트에서는 `json(Schema)`(`apps/api/src/http/validate.ts`)를 인증 미들웨어보다 앞에 두고 `c.req.valid('json')`만 사용한다. `c.req.json()`을 직접 호출하지 않는다. `json()`은 `z.strictObject`가 아니면 서버 시작 시 실패한다.
- 변경 라우트는 `/api/organizations/` 아래에 둔다. 출처·형식·크기 검사는 공통 가드(`apps/api/src/http/guard.ts`)가 맡으므로 라우트에서 다시 구현하지 않는다. 그 밖에 둘 수밖에 없는 라우트(외부 webhook 등)는 자체 검사를 두고 `boundary.test.ts`의 `outsideGuard`에 이유와 함께 적는다.
- 새 라우트 모듈은 `createApp`의 `AppOptions`로만 연결한다. 그래야 경계 테스트가 빠짐없이 검사한다.
- 실패는 `ApiError(code, status)`(`apps/api/src/http/errors.ts`)로 던진다. 라우트별 `onError`를 만들지 않는다(외부 재시도 계약이 있는 webhook의 503 응답만 예외).
- 길이 제한이 있는 컬럼은 DB에도 같은 값의 CHECK를 둔다.
- 테스트에는 성공 케이스와 함께 다음을 넣는다: 필수값 누락, 빈 문자열·공백만, 상한+1(이모지 포함), NUL·홀로 쓰인 서러게이트, 모르는 키, 다른 학생회 사용자, 미인증.
- 화면은 같은 스키마의 `safeParse`로 버튼 활성화를 판단한다. 길이 숫자를 화면에 다시 적지 않는다.
- `apps/api/src/http/boundary.test.ts`가 모든 변경 라우트의 경계 검사를 확인한다. 예외 목록(`schemaPending`)에 새 항목을 추가하지 않는다.

## 마이그레이션
- 서버 시작 시 자동으로 적용하지 않는다. 적용 대상은 dev(`.env`의 `DATABASE_URL`, Neon `production` 브랜치)와 배포 DB(`m1-preview`) 두 곳이다.
- 제약을 추가하는 마이그레이션은 코드 배포 → 두 DB에서 위반 행이 0건인지 조회 → 적용 순서로 한다. 적용 전에 이미 적용된 기록이 로컬 파일과 순서·해시까지 일치하는지 확인한다.
- `.sql` 파일은 `.gitattributes`로 LF로 고정한다. drizzle이 남기는 적용 기록의 해시가 파일 내용 기준이라, 줄바꿈이 바뀌면 기록과 어긋나 보인다.

## 로그·비밀
- 로그와 응답에 요청 본문, 오류 메시지 원문, DB 값, 비밀 값을 넣지 않는다.
- `.env`는 읽거나 출력하지 않는다.

## 검사
- API 테스트: `npm test --workspace @vada/api` (개별 파일은 `apps/api`에서 `npx tsx --test <파일>`)
- 계약 테스트: `npm test --workspace @vada/contracts`
- 화면 테스트: `npm test --workspace @vada/web`
- 타입 검사: `npm run typecheck`
