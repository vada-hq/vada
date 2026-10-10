# VADA M1 저장소 규칙

## 새 API를 만들 때
- 요청 본문 스키마는 `packages/contracts`에 zod `z.strictObject`로 정의한다. 문자열은 `text(max)`(사람이 쓰는 글) 또는 `token(max)`(식별자·키)로만 만들고, 모든 문자열·배열·숫자에 상한을 둔다.
- 라우트에서는 `json(Schema)`(`apps/api/src/http/validate.ts`)를 인증 미들웨어보다 앞에 두고 `c.req.valid('json')`만 사용한다. `c.req.json()`을 직접 호출하지 않는다. `json()`은 `z.strictObject`가 아니면 서버 시작 시 실패한다.
- 변경 라우트는 `/api/organizations/` 아래에 둔다. 출처·형식·크기 검사는 공통 가드(`apps/api/src/http/guard.ts`)가 맡으므로 라우트에서 다시 구현하지 않는다. 그 밖에 둘 수밖에 없는 라우트(외부 webhook 등)는 자체 검사를 두고 `boundary.test.ts`의 `outsideGuard`에 이유와 함께 적는다.
- 로그인 없이 쓰는 공개 변경 라우트(참가 신청)는 `/api/public/` 아래에 둔다. 공통 가드가 같이 걸리고 `boundary.test.ts`가 같이 검사한다. 개인 링크 토큰은 경로에 넣지 않고 본문으로 받으며, 화면 주소에서는 `#` 뒤에 둔다.
- 본문이 32KB보다 큰 경로(학생회비 명단)는 `guard.ts`의 `bodyLimitOf`에 더한다. 라우트에서 크기를 따로 다루지 않는다.
- 새 라우트 모듈은 `createApp`의 `AppOptions`로만 연결한다. 그래야 경계 테스트가 빠짐없이 검사한다.
- 실패는 `ApiError(code, status)`(`apps/api/src/http/errors.ts`)로 던진다. 라우트별 `onError`를 만들지 않는다(외부 재시도 계약이 있는 webhook의 503 응답만 예외).
- 길이 제한이 있는 컬럼은 DB에도 같은 값의 CHECK를 둔다.
- 테스트에는 성공 케이스와 함께 다음을 넣는다: 필수값 누락, 빈 문자열·공백만, 상한+1(이모지 포함), NUL·홀로 쓰인 서러게이트, 모르는 키, 다른 학생회 사용자, 미인증.
- 화면은 같은 스키마의 `safeParse`로 버튼 활성화를 판단한다. 길이 숫자를 화면에 다시 적지 않는다.
- `apps/api/src/http/boundary.test.ts`가 모든 변경 라우트의 경계 검사를 예외 없이 확인한다. 검사를 건너뛰는 목록을 다시 만들지 않는다.

## 화면
- 버튼·입력칸·선택칸·여러 줄 입력·라벨·칩·카드·배너·대화상자·옆 메뉴·메뉴 항목·탭은 `apps/web/src/components/ui`의 부품을 쓴다. 날것의 `<button>`·`<input>`에 직접 모양을 주지 않는다. 체크박스만 브라우저 기본 모양에 `size-4 accent-blue-600`을 준다.
- 여러 기능이 같이 쓰는 표시용 부품은 `src/components`에 둔다(API 호출 금지). 기능 화면과 데이터 훅은 기능 폴더에 둔다.
- 모양은 Tailwind 클래스로만 준다. 새 CSS 파일을 만들지 않는다. 토큰과 전역 기본값은 `src/index.css` 하나에 둔다.
- 색은 테마 토큰(`primary`, `muted-foreground` 등)이나 Tailwind 기본 팔레트 단계만 쓴다. 크기와 간격은 Tailwind 스케일(`p-6`, `max-w-148`처럼 0.25rem 배수)만 쓴다. `bg-[#…]`, `text-[13px]`, `p-[7px]` 같은 임의 값은 쓰지 않는다.
- 기준 글자 크기가 14px(휴대폰 폭 16px)이라 와이어프레임 값이 표준 클래스로 옮겨진다(사이드바 210px = `w-60`, 본문 12.25px = `text-sm`).
- 줄바꿈 없는 긴 글(링크, 이름)이 들어갈 수 있는 곳에는 `wrap-anywhere`를 준다.
- 새 부품이나 변형은 개발용 부품 확인 화면(`/ui.html`, `src/ui-gallery`)에 더한다.
- 화면을 바꾸면 와이어프레임(Figma `B5OHqrl9bbvXCUkhME4Sfo`)의 같은 화면 노드 스크린샷과 비교한다.

## 마이그레이션
- 서버 시작 시 자동으로 적용하지 않는다. 적용 대상은 dev(`.env`의 `DATABASE_URL`, Neon `production` 브랜치)와 배포 DB(`m1-preview`) 두 곳이다.
- 제약을 추가하는 마이그레이션은 코드 배포 → 두 DB에서 위반 행이 0건인지 조회 → 적용 순서로 한다. 적용 전에 이미 적용된 기록이 로컬 파일과 순서·해시까지 일치하는지 확인한다.
- 새 컬럼을 읽는 코드는 반대로, 두 DB에 마이그레이션을 먼저 적용한 뒤 배포한다. 코드가 먼저 나가면 없는 컬럼을 읽다가 해당 요청이 모두 실패한다. 새 컬럼에 거는 제약은 위반 행이 생길 수 없으므로 이 순서를 따르고, 기존 컬럼에 거는 제약과는 한 마이그레이션에 섞지 않는다.
- `.sql` 파일은 `.gitattributes`로 LF로 고정한다. drizzle이 남기는 적용 기록의 해시가 파일 내용 기준이라, 줄바꿈이 바뀌면 기록과 어긋나 보인다.

## 로그·비밀
- 로그와 응답에 요청 본문, 오류 메시지 원문, DB 값, 비밀 값을 넣지 않는다.
- 서버 쪽 실패(예상하지 못한 500, 5xx)는 `apps/api/src/http/on-error.ts`가 로그와 Sentry(`SENTRY_DSN`이 있을 때)에 함께 보낸다. Sentry를 직접 호출하지 않는다. 보내기 전 정제는 `http/sentry.ts`의 `scrubEvent`가 맡는다.
- `.env`는 읽거나 출력하지 않는다.

## 실행 환경
- Node 버전은 저장소 루트 `.node-version` 하나로 정한다. 로컬, CI(`node-version-file`), Render가 모두 이 파일을 따른다. Render 대시보드에 `NODE_VERSION` 변수를 두면 이 파일보다 우선하므로 두지 않는다.
- `engines`에 위가 열린 범위(`>=22`)를 쓰지 않는다. Render는 열린 범위를 항상 최신 Node로 해석해, 테스트한 버전과 운영 버전이 달라진다.

## 검사
- API 테스트: `npm test --workspace @vada/api` (개별 파일은 `apps/api`에서 `npx tsx --test <파일>`)
- 계약 테스트: `npm test --workspace @vada/contracts`
- 화면 테스트: `npm test --workspace @vada/web`
- 타입 검사: `npm run typecheck`
- 부품 확인 화면: `npm run dev --workspace @vada/web` 후 `http://127.0.0.1:5180/ui.html`
