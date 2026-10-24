# VADA M1 저장소 규칙

## 제품 원칙 (범위·spec·화면을 정하기 전에 먼저 본다)

- 원칙 문서는 `vada-hq/vada-docs` 레포다. 이 레포 옆 폴더(`../vada-docs`)에 있다(`vada-hq/workspace`의 `setup.sh`가 함께 받는다). `product.md`, `domain.md`, `principles.md`를 읽는다. `vada-planning`은 보관된 참고 자료라 기준으로 쓰지 않는다.
- 사용자가 평소 하던 일 말고 새 입력을 요구하지 않는다. 기록은 이미 한 일(대화·업무·구매·지출·참석)로 저절로 만들고, 사람은 고치거나 확인만 한다.
- 기능은 "지금 그 행위가 행위자에게 바로 이득인가"로 판단한다. 수고는 지금 사람이 지고 덕은 다음 사람이 보는 일은 남지 않는다.
- AI가 만든 내용은 사람이 확인하기 전까지 초안이고, 근거(원문 대화·자료)에 연결한다. 결정 이유와 변경 이력을 남긴다.
- spec에는 "원칙 대조" 절을 둔다. 사람이 새로 하는 입력과 그것이 바로 이득인지, 근거 연결, 변경 이력을 적는다. 와이어프레임도 이 원칙으로 비판한다.

## 기능 만들기

- 기능과 버그 고치기는 `docs/work-method.md`대로 만든다. 기능 명세(`docs/features/NNN-이름.md`) → 조각마다 만들기·검사·검토 한 번·main에 올려 배포 → 닫기다.
- 세션, 역할별 모델과 effort, 하위 에이전트(`.claude/agents/`), Codex 검토는 `docs/agent-operations.md`를 따른다.
- 진행은 vada-docs 이슈와 GitHub Project #2로 팀에 보인다. 이슈를 최신으로 두는 규칙은 `docs/work-method.md` '진행 에이전트'에 있다.
- 문서 맨 위에는 읽을 사람을 적는다(`독자: 사람` 또는 `독자: 에이전트`). 규칙은 vada-docs `CONTRIBUTING.md` '형식'을 따른다.
- 작업을 시작해 배포할 때까지 사람에게 묻거나 승인받지 않는다. 결정은 유사 서비스 벤치마킹과 업계 표준 근거로 권장대로 정하고 근거와 함께 기록한다. 사람은 배포된 제품을 써 보고 다른 곳을 버그로 알린다.

## 메뉴 작업 폴더에서 바로 고치기

사람이 배포된 사이트를 보다가 메뉴 작업 폴더에서 세션을 열고 "~ 고쳐 줘"라고 하면, 명세·조각·검토 없이 아래 차례로 고쳐 main에 올린다. 메뉴마다 세션을 나란히 연다(trunk 기반 개발에서 아주 작은 팀이 main에 바로 올리는 방식, [trunkbaseddevelopment.com](https://trunkbaseddevelopment.com/)).

| 작업 폴더(`vada-hq/`) | 메뉴 | 주로 닿는 코드 |
|---|---|---|
| `vada-home` | 홈 | web `home`, api `home` |
| `vada-chat` | 대화 | web·api `chat`, `push` |
| `vada-events` | 행사(신청 양식 포함) | web `events`, `registrations`, `public`, api `events`, `registrations`, `settlement`, `deposits` |
| `vada-tasks` | 업무 | web·api `tasks` |
| `vada-finance` | 재정 | web `finance`, api `budget`, `expenses`, `incomes`, `purchases`, `closing`, `fee-payments`, `accounts` |

- 폴더는 늘 main 위의 detached HEAD로 둔다. 가지를 만들지 않는다. `git worktree lock`으로 잠가 두었다(`tools/clean-merged.sh`가 main과 같은 폴더를 지우지 않게). `.env`는 `vada/.env`의 복사본이다.
- 같은 폴더에 세션을 둘 열지 않는다. 다른 메뉴의 코드도 고쳐도 되지만 필요한 줄만 고친다. 공통 파일(`workspace`, `components`, `lib/messages.ts`, contracts `index.ts`, `serve.ts`·`app.ts`의 등록)은 여러 폴더가 함께 고치므로 특히 그렇다.
- 여러 메뉴에 걸친 기능, 권한·돈 계산·학생회 격리를 새로 정하는 일, 칸·표를 지우거나 이름을 바꾸는 마이그레이션은 여기서 하지 않는다. 그런 요청이면 그렇다고 말하고 `docs/work-method.md`대로 하자고 한다.

차례

1. 시작: `git status`가 깨끗한지 본다(이어서 하던 수정이 남았으면 그것부터 끝낸다). `git fetch origin && git switch --detach origin/main && pnpm install --frozen-lockfile`(바뀐 의존성이 없으면 1초 안에 끝난다). `gh run list --branch main --limit 3`에서 이 폴더가 올린 커밋이 실패했으면 그것부터 고친다.
2. 고친다. 전체 시험은 돌리지 않는다. 바꾼 모듈의 시험 파일만 돌리고, 화면 문구나 부품을 바꿨으면 `src/ui-gallery` 시험도 돌린다(스냅숏이 바뀌면 `-u`로 갱신하고 차이를 본다). 그다음 `pnpm check`.
3. 커밋한다. 수정 하나에 커밋 하나다.
4. `git fetch origin && git rebase origin/main`. 충돌을 풀었으면 `git diff --check`와 `pnpm check`를 다시 돌린다. 스냅숏 충돌은 손으로 고치지 않고 다시 만든다. `git push origin HEAD:main`이 거절되면(그사이 다른 폴더가 올림) 4를 되풀이한다.
5. 올린 커밋의 main CI를 뒤에서 지켜본다(`gh run watch <id> --exit-status`를 백그라운드로). 사람에게는 무엇을 고쳤고 약 10분 뒤 배포되면 어느 화면에서 보면 되는지 한 줄로 알리고, 기다리지 않고 다음 요청을 받는다. CI가 실패하면 다음 일보다 먼저 고친다(배포는 멈추고 운영은 그대로다).

- 마이그레이션은 칸·표를 더하는 것만 만든다. 번호와 `migrations/meta/_journal.json`이 순번이라 두 폴더가 같은 번호를 만들면 부딪친다. 그래서 만들기 직전에 4의 fetch·rebase를 하고, 만들면 바로 개발 DB에 적용(`pnpm --filter @vada/api db:migrate --apply`)한 뒤 다른 수정을 기다리지 않고 올린다. 운영 DB는 main CI가 배포 전에 적용한다. 나머지 순서는 아래 '마이그레이션'을 따른다.

## 새 API를 만들 때

- 요청 본문 스키마는 `packages/contracts`에 zod `z.strictObject`로 정의한다. 문자열은 `text(max)`(사람이 쓰는 글) 또는 `token(max)`(식별자·키)로만 만들고, 모든 문자열·배열·숫자에 상한을 둔다.
- 라우트에서는 `json(Schema)`(`apps/api/src/http/validate.ts`)를 인증 미들웨어보다 앞에 두고 `c.req.valid('json')`만 사용한다. `c.req.json()`을 직접 호출하지 않는다. `json()`은 `z.strictObject`가 아니면 서버 시작 시 실패한다.
- 변경 라우트는 `/api/organizations/` 아래에 둔다. 로그인한 사람 자신의 것(휴대폰 알림)은 `/api/me/` 아래에 둔다. 출처·형식·크기 검사는 두 곳 모두 공통 가드(`apps/api/src/http/guard.ts`)가 맡으므로 라우트에서 다시 구현하지 않는다. 그 밖에 둘 수밖에 없는 라우트(외부 webhook 등)는 자체 검사를 두고 `boundary.test.ts`의 `outsideGuard`에 이유와 함께 적는다.
- 로그인 없이 쓰는 공개 변경 라우트(참가 신청)는 `/api/public/` 아래에 둔다. 공통 가드가 같이 걸리고 `boundary.test.ts`가 같이 검사한다. 개인 링크 토큰은 경로에 넣지 않고 본문으로 받으며, 화면 주소에서는 `#` 뒤에 둔다.
- 본문이 32KB보다 큰 경로(학생회비 명단)는 `guard.ts`의 `bodyLimitOf`에 더한다. 라우트에서 크기를 따로 다루지 않는다.
- 새 라우트 모듈은 `createApp`의 `AppOptions`로만 연결한다. 그래야 경계 테스트가 빠짐없이 검사한다.
- 실패는 `new ApiError(code)`(`apps/api/src/http/errors.ts`)로 던진다. 코드와 HTTP 상태는 `packages/contracts/src/errors.ts`의 오류 목록(`ERROR_STATUS`) 한 곳에 더하고, 코드나 라우트에 상태 숫자를 쓰지 않는다. 던지지 않고 바로 응답할 때는 `errorResponse(c, code)`다. 화면은 같은 목록의 `statusOf`로 가르고 코드 → 문구는 `apps/web/src/lib/messages.ts`에 둔다(참가 신청 화면의 문구는 `lib/registration-messages.ts`). 라우트별 `onError`를 만들지 않는다(외부 재시도 계약이 있는 webhook의 503 응답만 예외).
- 길이 제한이 있는 컬럼은 DB에도 같은 값의 CHECK를 둔다.
- 테스트에는 성공 케이스와 함께 다음을 넣는다: 필수값 누락, 빈 문자열·공백만, 상한+1(이모지 포함), NUL·홀로 쓰인 서러게이트, 모르는 키, 다른 학생회 사용자, 미인증.
- 화면은 같은 스키마의 `safeParse`로 누를 때 칸을 확인한다(버튼은 끄지 않는다, '화면 문구와 폼'). 길이 숫자를 화면에 다시 적지 않는다.
- `apps/api/src/http/boundary.test.ts`가 모든 변경 라우트의 경계 검사를 예외 없이 확인한다. 검사를 건너뛰는 목록을 다시 만들지 않는다.

## 코드

- 모듈 하나는 한 가지 일만 한다. 파일 이름으로 하는 일을 말할 수 없으면 나눈다.
- 같은 규칙이나 계산이 두 번째로 필요해지면 복사하지 않고 공유 도우미로 옮긴다. 요청 모양은 `packages/contracts`, 서버 공통은 `apps/api/src/http`, 화면 공통은 `src/lib`·`src/components`에 둔다.
- 진입점(`serve.ts`, `main.tsx`, 각 `routes.ts`)은 읽고 연결만 한다. 판단과 계산은 시험이 있는 모듈(`service.ts`, `queries.ts`, `lib/`)에 둔다.
- 린트와 타입 검사를 통째로 끄지 않는다. 꼭 필요하면 한 줄, 한 규칙만 `// oxlint-disable-next-line 규칙 -- 이유`로 끈다. `@ts-ignore`는 쓰지 않고 `@ts-expect-error 이유`를 쓴다. 쓸모없어진 끄기는 린트가 실패시킨다.
- 크기 상한은 `.oxlintrc.json`이 건다. 함수는 복잡도 10, 길이 50줄(화면 컴포넌트 `.tsx`는 100줄), 인자 4개, 중첩 4단, 파일은 300줄(빈 줄과 주석 제외)이다. 줄 수 상한은 린터 권장 규칙이 아니고 결함과의 관련 근거가 약해서, JSX가 길어지는 화면 컴포넌트는 느슨하게 둔다(복잡도가 결함과 더 관련 있다). 이름 없는 숫자(-1, 0, 1 제외)는 `const`로 이름을 붙인다. 시험 파일과 `test-support`는 함수·파일 길이와 숫자를 걸지 않는다. 임시 예외 목록은 없고, 상한을 넘는 새 코드는 린트가 바로 막는다. 안 쓰는 파일·의존성·내보내기는 knip(`knip.jsonc`)이 막는다(`pnpm check`에 들어 있다).
- 상수는 값마다 한 곳에서만 정의하고 그 값을 주로 쓰는 모듈에 둔다. 서버와 화면이 같이 쓰면 `packages/contracts`에 둔다. 앱 전체 상수 파일 하나는 만들지 않는다.
- 프로미스는 `await`한다. 일부러 기다리지 않을 때만 `void`를 붙인다.
- 주석은 코드가 무엇을 하는지가 아니라 왜 그런지를 적는다.
- 의존성은 `^` 없이 정확한 버전으로 넣는다(`.npmrc`의 `save-exact`).

## 화면

- 버튼·입력칸·선택칸·여러 줄 입력·라벨·칩·카드·배너·대화상자·옆 메뉴·메뉴 항목·탭은 `apps/web/src/components/ui`의 부품을 쓴다. 날것의 `<button>`·`<input>`에 직접 모양을 주지 않는다. 체크박스만 브라우저 기본 모양에 `size-4 accent-blue-600`을 준다.
- 여러 기능이 같이 쓰는 표시용 부품은 `src/components`에 둔다(API 호출 금지). 기능 화면과 데이터 훅은 기능 폴더에 둔다.
- 모양은 Tailwind 클래스로만 준다. 새 CSS 파일을 만들지 않는다. 토큰과 전역 기본값은 `src/index.css` 하나에 둔다.
- 색은 테마 토큰(`primary`, `muted-foreground` 등)이나 Tailwind 기본 팔레트 단계만 쓴다. 크기와 간격은 Tailwind 스케일(`p-6`, `max-w-148`처럼 0.25rem 배수)만 쓴다. `bg-[#…]`, `text-[13px]`, `p-[7px]` 같은 임의 값은 쓰지 않는다.
- 기준 글자 크기는 브라우저 기본 16px이다(본문 `text-sm` 14px, 보조 글 `text-xs` 12px, 페이지 제목 `text-xl` 20px). 와이어프레임은 0.875 축척이라 값을 그대로 옮기지 않고 1/0.875배로 읽는다.
- 줄바꿈 없는 긴 글(링크, 이름)이 들어갈 수 있는 곳에는 `wrap-anywhere`를 준다.
- 새 부품이나 변형은 개발용 부품 확인 화면(`/ui.html`, `src/ui-gallery`)에 더한다.
- 화면을 바꾸면 와이어프레임(Figma `B5OHqrl9bbvXCUkhME4Sfo`)의 같은 화면 노드 스크린샷과 비교한다.

### 화면 문구와 폼

화면 문구와 폼 규칙의 원문은 이 절이다. 다른 곳에 옮겨 적지 않는다.

- 설명 글(도움말, 묶음 설명, 결과 안내)은 대부분의 사용자가 그것 없이 막힐 때만 짧은 한 문장으로 쓴다. 먼저 라벨을 고쳐 본다. 사용자가 판단할 일에 경고나 권유를 덧붙이지 않는다(GOV.UK hint text, NN/g "Concise, Scannable, and Objective"). 법이 요구하는 고지는 예외다.
- 입력칸 안의 예시 글(placeholder)은 쓰지 않는다(GOV.UK text input, NN/g "Placeholders in Form Fields Are Harmful"). 예외는 제출과 칸 확인이 없는 검색칸의 짧은 안내다(예: '이름이나 학번으로 찾기').
- 추가 질문은 그것이 필요한 선택을 했을 때만 보인다. 펼치는 라디오는 세로로 둔다(NN/g "Progressive Disclosure", GOV.UK radios).
- 가장 흔한 값을 기본으로 골라 둔다(NN/g "The Power of Defaults").
- 필수 칸은 별표(`Field`의 `required`), 선택 칸은 '(선택)'(`optional`)으로 표시한다. 제출 버튼은 끄지 않고 누를 때 확인해, 문제를 칸 아래(`Field`의 `error`)에 보이고 첫 칸으로 옮긴다(NN/g "Marking Required Fields in Forms", GOV.UK). 보내는 중에만 끈다. 예외는 대화 입력칸의 [보내기]로, 빈 메시지일 때 끈다(채팅 앱의 관례).
- 말투는 해요체다. 라벨, 상태, 제목은 문장 대신 명사형으로 쓴다(예: '신청 양식 생성 완료', '계좌 선택'). 오류처럼 문장이 필요한 곳만 해요체로 짧게 쓴다.
- 빈 화면은 명사형 '○○ 없음'이다. 그 일을 할 수 있는 사람에게는 하는 버튼을 함께 둔다(vada-docs DEC-78 이동 규칙 9).
- 창에서 나가는 버튼은 '닫기'다. 기록을 없애는 동작의 이름은 '○○ 취소'로 대상을 붙인다.
- 날짜는 '10월 25일 (토)', 시각이 있으면 '10월 25일 (토) 14:00', 올해가 아니면 앞에 '2026년'을 붙인다. 기간은 '~'로 잇는다.
- 같은 대상과 동작은 모든 화면에서 같은 이름으로 부른다.

## 마이그레이션

- 표 구현(이름, 자료형, 제약, 인덱스)의 원문은 `apps/api/migrations/`다. 무엇을 왜 저장하는지와 업무 규칙(RULE-)은 vada-docs `logical-model.md`가 원문이다. 저장하는 것이나 규칙이 바뀌면 같은 때에 그 문서를 고친다(DEC-77).
- 표를 바꿀 때는 `pnpm --filter @vada/api db:generate`(`drizzle-kit generate --custom`)로 빈 마이그레이션을 만들어 SQL을 쓰고, 조회용 정의 `apps/api/src/db/schema.ts`를 같이 고친다. CI의 맞춤 시험(`src/db/schema-match.test.ts`)이 정의와 마이그레이션 DB를 맞댄다.
- 첫 마이그레이션 `0000_baseline.sql`은 구현 전 설계(vada-docs `archive/physical-model.md`)에서 만든 파일이다. 손으로 고치거나 다시 만들지 않는다.
- 표를 쓰는 관례(PostgreSQL 18 이상)
  - 식별자는 `uuidv7()`로 만든다. 표와 칸 이름은 영어 snake_case이고, 엔티티와의 대응은 `logical-model.md` '이름 대응'에 있다.
  - 시각은 `timestamptz`, 날짜는 `date`, 금액은 `numeric(14, 0)`(원), 문자는 `text`다. `timestamp`, `money`, `varchar(n)`, `serial`은 쓰지 않는다(PostgreSQL wiki "Don't Do This").
  - 정해진 값 중 하나인 칸은 `CHECK`로 막는다. 사람이 쓰는 글의 길이 상한은 `CHECK (char_length(칸) <= n)`이고 n은 그 칸을 받는 계약의 상한과 같다.
  - 엔티티 표는 기록(`record`)의 하위 표다. 하위 표의 `id`는 `record.id`를 가리키고 `kind` 칸과 `(id, kind)` 외래 키로 종류를 맞춘다. 여러 종류의 기록을 가리키는 칸은 `(대상 id, 대상 kind)` 외래 키와 허용 종류 `CHECK`로 막는다.
  - 연결 표(근거, 문서 연결, 대화방 참여)는 기록이 아니고, 양쪽 키를 기본 키로 쓴다.
  - 학생회 안에서 겹치면 안 되는 이름은 하위 표에 `council_id`를 두고 `(id, council_id)` 외래 키로 기록과 맞춘 뒤 `UNIQUE`로 막는다.
  - 외래 키 칸에는 인덱스를 둔다. 판은 `record_version`에 두고 유효 기간(`tstzrange`)이 겹치지 않게 막는다(btree_gist).
  - 계산되는 값(`logical-model.md`)은 저장하지 않는다.
- 서버 시작 시 자동으로 적용하지 않는다. 적용 대상은 Neon 프로젝트 `vada`의 `dev` 가지(개발, 로컬 `.env`의 `DATABASE_URL`)와 `production` 가지(배포) 두 곳이다.
- 운영 DB는 main CI의 `migrate-production` 작업이 저절로 적용한다. 시험과 검사가 통과한 뒤 돌고, Render는 CI가 통과해야 배포하므로 DB가 새 코드보다 먼저 바뀐다. 주소는 GitHub 저장소 비밀값 `PRODUCTION_DATABASE_URL`이다. 적용이 실패하면 CI가 실패해 배포도 멈춘다. 개발 DB는 진행 에이전트가 main에 올리기 전에 적용한다(작업자와 검토자는 하지 않는다). `pnpm --filter @vada/api db:migrate`는 미리 보기다. 대상(호스트와 DB 이름), 점검 결과, 적용할 개수만 보여 주고 아무것도 바꾸지 않는다(`--dry-run`은 같은 뜻을 분명히 적는 것). 실제 적용은 `pnpm --filter @vada/api db:migrate --apply`로만 한다. 인자는 `--apply`, `--dry-run`, `--from-shell`뿐이고(`--apply`와 `--dry-run`은 같이 줄 수 없다) 다른 인자는 `.env`를 읽거나 연결하기 전에 멈춘다. pnpm은 스크립트 이름 뒤의 인자를 그대로 넘기므로 `--`는 쓰지 않는다(맨 앞의 `--`는 무시한다).
- 대상은 `.env`의 DB가 기본이다. 배포 DB에는 셸에 `DATABASE_URL`을 주고 `--from-shell`을 붙인다(적용은 `--from-shell --apply`). 셸에 `DATABASE_URL`이 있는데 `--from-shell`이 없으면 아무것도 하지 않고 멈춘다. 적용 기록이 없거나 기록 표가 비었는데 표가 있으면, 이미 적용된 기록이 로컬 파일과 순서·해시까지 같지 않으면, 로컬 마이그레이션 시각이 커지는 순서가 아니면 적용하지 않는다. 적용 뒤에는 기록을 다시 읽어 실제로 적용된 개수를 보여 준다.
- 제약을 추가하는 마이그레이션은 코드 배포 → 두 DB에서 위반 행이 0건인지 조회 → 적용 순서로 한다. 운영 DB는 main에 올리면 적용되므로, 그 마이그레이션 파일은 코드가 배포된 뒤 따로 올린다(위반 행이 있으면 적용이 실패해 배포가 멈추고 DB는 그대로다).
- 새 컬럼을 읽는 코드는 반대로, 두 DB에 마이그레이션을 먼저 적용한 뒤 배포한다. 코드가 먼저 나가면 없는 컬럼을 읽다가 해당 요청이 모두 실패한다. 새 컬럼에 거는 제약은 위반 행이 생길 수 없으므로 이 순서를 따르고, 기존 컬럼에 거는 제약과는 한 마이그레이션에 섞지 않는다.
- 칸·표를 지우는 마이그레이션은 그것을 읽지 않는 코드를 먼저 배포한 뒤 적용한다. 적용 스크립트가 남은 마이그레이션을 모두 적용하므로, 지우는 마이그레이션 파일은 배포 뒤에 만든다.
- `.sql` 파일은 `.gitattributes`로 LF로 고정한다. drizzle이 남기는 적용 기록의 해시가 파일 내용 기준이라, 줄바꿈이 바뀌면 기록과 어긋나 보인다.
- 개발 DB의 시험 학생회는 진행 에이전트가 `pnpm --filter @vada/api test-data seed <user-id> --apply`로 둔다(초대 코드 `TESTDATA`). 부서원은 `assign <user-id> <planning|finance> --apply`로 넣는다. 끝난 기간(시험 1학기)과 지금 기간은 `periods <user-id> --apply`로 둔다(재정부 계정, 있으면 바꾸지 않는다). `--apply`가 없으면 대상과 하려는 일만 보여 주고 아무것도 쓰지 않는다.
- 시연 학생회(섭외·리허설용, 학교 이름 'VADA 시연 학교')는 진행 에이전트가 `pnpm --filter @vada/api demo <user-id> [--apply] [--from-shell]`로 둔다. 미리 보기가 기본이고 `--apply`가 있어야 쓴다. 이미 있으면 아무것도 바꾸지 않고 멈춘다. 배포 DB는 셸에 `DATABASE_URL`을 주고 `--from-shell`을 붙인다(db:migrate와 같은 규칙). 날짜는 돌리는 날(한국) 기준이고, 다시 넣으려면 학교 이름을 바꾼다.
- 작업자와 검토자는 `db:migrate`(미리 보기 포함), `test-data`, `demo`, `pg-smoke`를 실행하지 않는다. 넷 다 실제 DB에 연결한다.

## 로그·비밀

- 로그와 응답에 요청 본문, 오류 메시지 원문, DB 값, 비밀 값을 넣지 않는다.
- 서버 쪽 실패(예상하지 못한 500, 5xx)는 `apps/api/src/http/on-error.ts`가 로그와 Sentry(`SENTRY_DSN`이 있을 때)에 함께 보낸다. Sentry를 직접 호출하지 않는다. 보내기 전 정제는 `http/sentry.ts`의 `scrubEvent`가 맡는다.
- 휴대폰 알림의 구독 주소(endpoint)는 기기를 가리키는 비밀 주소다. 로그와 응답에 넣지 않는다.
- `.env`의 값을 열람하거나 출력하지 않는다. 프로그램이 읽어 쓰는 것은 된다.

## 실행 환경

- Node 버전은 저장소 루트 `.node-version` 하나로 정한다. 로컬, CI(`node-version-file`), Render가 모두 이 파일을 따른다. Render 대시보드에 `NODE_VERSION` 변수를 두면 이 파일보다 우선하므로 두지 않는다.
- 패키지 관리자는 pnpm이다. 버전은 `package.json`의 `packageManager`가 정하고 CI도 이것을 따른다. 작업 폴더마다 설치해도 라이브러리는 PC의 pnpm 저장소 한 벌을 하드 링크로 나눠 써서 디스크를 거의 더 쓰지 않는다. 의존성은 `pnpm --filter <패키지> add <이름>`으로 더한다(정확한 버전으로 적힌다).
- pnpm 기본값을 그대로 쓴다: 나온 지 하루가 안 된 버전은 받지 않고(`minimumReleaseAge`), 의존성의 설치 스크립트는 `pnpm-workspace.yaml`의 `allowBuilds`에 적은 것만 돈다. 새 의존성이 설치 스크립트를 요구해 설치가 멈추면, 무엇을 하는 스크립트인지 보고 필요할 때만 `allowBuilds`에 더한다.
- Render는 pnpm 없이 시작한다. 빌드 명령은 `npx --yes pnpm@<packageManager의 버전> install --frozen-lockfile --prod=false && npx --yes pnpm@<같은 버전> build`, 시작 명령은 `BETTER_AUTH_URL="$RENDER_EXTERNAL_URL" npm --prefix apps/api start`다(CI의 운영 모드 시작도 같은 명령). `packageManager`를 올리면 Render 빌드 명령의 버전도 같이 올린다.
- `engines`에 위가 열린 범위(`>=22`)를 쓰지 않는다. Render는 열린 범위를 항상 최신 Node로 해석해, 테스트한 버전과 운영 버전이 달라진다.

## 검사

- 커밋 전 정적 검사: `pnpm check` (형식 확인, 린트, 타입 검사). 시험은 아래처럼 영향받는 것만 돌린다. 전체 시험은 CI가 main에서 돈다(가지는 손으로만, `docs/work-method.md` 원칙 8)
- 형식: `pnpm format`. 형식은 Prettier가 정한다. 손으로 맞추거나 검토에서 지적하지 않는다
- 린트: `pnpm lint` (Oxlint, 타입 정보 사용. 규칙은 typescript-eslint recommended-type-checked와 같다)
- blame에서 형식 커밋 빼기(한 번): `git config blame.ignoreRevsFile .git-blame-ignore-revs`
- API 테스트: `pnpm --filter @vada/api test` (개별 파일은 `apps/api`에서 `pnpm exec tsx --test <파일>`)
- 계약 테스트: `pnpm --filter @vada/contracts test`
- 화면 테스트: `pnpm --filter @vada/web test` (개별 파일은 `apps/web`에서 `pnpm exec vitest run <파일>`)
- 타입 검사: `pnpm typecheck`
- 부품 확인 화면: `pnpm --filter @vada/web dev` 후 `http://127.0.0.1:5180/ui.html`
