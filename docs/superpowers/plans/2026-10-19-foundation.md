# 바탕 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 옛 기능을 지우고, vada-docs 설계(physical-model.md)와 같은 새 DB 위에 기록과 판, 학생회·기수·운영진·부서·소속, 권한 엔진과 조직 칸, 학생회 만들기·초대·편성·설정, 알림 받을 기기 저장과 그 화면을 만들어, vada-m1이 새 DB에서 로그인, 학생회 만들기, 초대로 들이기가 되게 한다.

**Architecture:** 첫 마이그레이션 `0000_baseline.sql`은 로그인 표 4개 + physical-model.md의 SQL 블록(스크립트가 뽑는다) + 설계 밖 표 3개다. 모든 쓰기는 기록 모듈(`apps/api/src/records/`: 기록 행, 하위 행, 판을 한 거래로, 시각은 `clock_timestamp()`)을 거치고, 라우트는 `json()` → `requireSession` → `actorOf`(요청마다 지금 소속을 읽음) → `can`(코드 권한표) 순서다. 조직 변경은 학생회 행을 `FOR NO KEY UPDATE`로 잠근 뒤 권한을 다시 본다. 화면은 내 학생회 목록에서 시작해 학생회가 없으면 초대 코드와 만들기를, 있으면 작업 공간 틀(학생회 이름 메뉴, 운영진 > 사람·부서, 설정 > 학생회 정보)을 보이고, 동작 버튼은 서버가 준 내 권한 목록으로만 보인다.

**Tech Stack:** PostgreSQL 18(Neon, 시험은 PGlite 0.5.8 + btree_gist), drizzle-orm 0.45.3(조회용 표 정의, pglite·postgres-js 마이그레이터), drizzle-kit 0.31.11, Hono 4.13.9, better-auth 1.7.6, zod 4.6.5 계약 패키지 `@vada/contracts`, React 19 + Tailwind 4 + `radix-ui` 1.7.0(DropdownMenu, Dialog), vitest 5 + testing-library, node:test(tsx), TypeScript 7.0.2.

**Spec:** `docs/superpowers/specs/2026-10-19-foundation-design.md` (방법: `docs/superpowers/specs/2026-10-19-rebuild-design.md`, 설계: `../vada-docs/physical-model.md`·`logical-model.md`·DEC-16, 17, 27, 28, 33, 34, 41, 46, 47)

## Global Constraints

- 요청 본문 스키마는 `packages/contracts`에 zod `z.strictObject`로 정의한다. 문자열은 `text(max)`(사람이 쓰는 글) 또는 `token(max)`(식별자·키)로만 만들고, 모든 문자열·배열·숫자에 상한을 둔다. (AGENTS.md)
- 라우트에서는 `json(Schema)`(`apps/api/src/http/validate.ts`)를 인증 미들웨어보다 앞에 두고 `c.req.valid('json')`만 사용한다. `c.req.json()`을 직접 호출하지 않는다. 그 뒤가 세션 확인(`requireSession`) → `actorOf` → `can`이다. (AGENTS.md, spec '권한')
- 본문에 받을 값이 없는 변경(코드 바꾸기, 내보내기, 부서에서 빼기, 부서 없애기)도 `EmptyRequestSchema`(`z.strictObject({})`)를 받고, 화면은 `{}`를 보낸다. 공통 가드의 경계 검사가 모든 변경 라우트에 걸려야 해서다.
- 변경 라우트는 `/api/organizations/` 아래에, 로그인한 사람 자신의 것(내 학생회 목록, 휴대폰 알림)은 `/api/me/` 아래에 둔다. 옛 이름 `organizations`가 들어간 접두어 `/api/organizations/`는 그대로 쓰고, 코드 안의 이름은 council이다. 초대 확인은 읽기 전용 `GET /api/invites/:code`다. (spec 'API', '옛 기능 지우기')
- 새 라우트 모듈은 `createApp`의 `AppOptions`로만 연결하고 `apps/api/src/http/boundary.test.ts`의 `modules`에 넣는다. 검사를 건너뛰는 목록을 만들지 않는다. (AGENTS.md)
- 실패는 `ApiError(code, status)`(`apps/api/src/http/errors.ts`)로 던진다. 권한이 없으면 403 `FORBIDDEN`이다. 다른 학생회의 운영진이 경로의 `councilId`를 바꿔 부르면 403이고, 다른 학생회의 부서나 운영진 번호를 넣으면 404 `NOT_FOUND`다. 쓰인 적 있는 부서 없애기는 409 `DEPARTMENT_IN_USE`, 회장 내보내기는 409 `PRESIDENT_CANNOT_LEAVE`다. 이 계획이 더하는 오류 코드는 아래 '오류 코드' 표에 있다. (spec 'API')
- 구성원(운영진) 목록에는 이메일을 보이지 않는다. (spec G12)
- 기록과 판의 시각은 실제 시계 시각 `clock_timestamp()`로 적는다. 한 거래에서 두 번 바꿔도 판이 겹치거나 비지 않는다. 오늘은 한국 날짜다(`koreanOf`, 서버는 UTC로 돈다). (spec G7, DEC-46)
- 초대 코드 입력은 지금 vada의 `InviteCodeSchema`(공백과 하이픈 제거, 대문자)를 그대로 쓴다. 코드 형식은 DB CHECK `^[2-9A-HJ-NP-Z]{8}$`이다. (spec)
- 설계 검사에서 빼는 설계 밖 표는 `users`, `accounts`, `sessions`, `verifications`, `member_login`, `invite_code`, `push_device` 7개다. (spec G11)
- 테스트에는 성공 케이스와 함께 필수값 누락, 빈 문자열·공백만, 상한+1(이모지 포함), NUL·홀로 쓰인 서러게이트, 모르는 키, 다른 학생회 사용자, 미인증을 넣는다. (AGENTS.md, spec '테스트')
- 화면은 `apps/web/src/components/ui`의 부품만 쓰고 날것의 `<button>`·`<input>`에 모양을 주지 않는다. Tailwind 표준 스케일과 테마 토큰만 쓰고, 긴 글에는 `wrap-anywhere`를 준다. 새 부품과 변형은 `/ui.html`(`src/ui-gallery`)에 더한다. 버튼 활성화는 같은 스키마의 `safeParse`로 판단하고 길이 숫자를 화면에 다시 적지 않는다. 동작 버튼은 서버가 준 내 권한 목록(`permissions`)으로만 보이거나 숨긴다(DEC-38). (AGENTS.md, spec '화면')
- 화면의 기준은 vada-docs의 navigation.md와 screens.md다. Figma(M1 와이어프레임)와는 같은 화면이 있을 때만 맞대 보고, 그 비교는 '바꾸는 날' 2단계에서 사람이 한다. 바탕에서는 메뉴 중 '운영진'만 연다(대화, 업무, 재정, 행사는 그 덩어리가 연다). (spec '옛 기능 지우기', '화면')
- 구현자는 브라우저를 열지 않는다. 화면은 시험으로 확인하고, `/ui.html`의 새 부품은 컨트롤러가 헤드리스 스크린샷(데스크톱 폭과 390px iframe)으로 본다. 로컬 `.env`의 `DATABASE_URL`은 '바꾸는 날'까지 옛 DB를 가리키므로 `npm run dev:api`로 새 화면을 띄우지 않는다(새 표가 없다). 로그인 뒤 화면은 사람이 '바꾸는 날' 2단계에서 본다(P36).
- 이름 칸의 길이 상한은 계약(`text(max)`)과 DB CHECK(physical-model.md)가 같은 값이다: 학생회 이름·학교 50, 직급 표시 이름·기수 이름·부서 이름 20. (AGENTS.md, P28)
- 로그와 응답에 요청 본문, 오류 메시지 원문, DB 값, 비밀 값, 알림 구독 주소(endpoint)를 넣지 않는다. (AGENTS.md)
- Task 2부터 모든 API 시험은 `apps/api/src/db/test-db.ts`의 `createTestDb()`만 쓴다(`new PGlite()`를 직접 부르지 않는다). 거래(`db.transaction`) 콜백 안에서는 `tx`만 쓴다. 그 안에서 `pg.query`나 `db`를 부르면 PGlite가 거래가 끝나기를 기다려 시험이 멈춘다. (spec '시험 DB와 표 정의')
- 실제 DB(Neon)에 닿는 명령(`npm run db:migrate`, `npm run test-data`)은 에이전트가 실행하지 않는다. 사람이 '바꾸는 날'에 실행한다. `check:design`은 PGlite만 쓰므로 로컬에서 돌린다. Task 14 이후 `db:migrate`는 셸의 `DATABASE_URL`을 `--from-shell`이 있을 때만 쓴다(P30).
- 커밋: 작업마다 로컬에만 커밋한다. 제목은 50자 이내 명령형 한국어이고, AI 서명·Co-Authored-By를 붙이지 않는다. push(곧 Render 배포)는 사용자가 반영하라고 할 때만 한다.
- `.env`와 `.env.*`는 읽거나 출력하지 않는다.
- 이 PC에서 API 테스트 여러 파일은 `--test-concurrency=2`로 돌린다.
- `.sql` 파일은 LF다(`.gitattributes`). drizzle 적용 기록의 해시가 파일 내용 기준이다.

## 오류 코드

spec이 정한 것(`FORBIDDEN` 403, `NOT_FOUND` 404, `DEPARTMENT_IN_USE` 409, `PRESIDENT_CANNOT_LEAVE` 409) 밖에 이 계획이 더하는 코드다. 화면 문구는 Task 11~13 코드에 있다.

| 코드 | 상태 | 언제 | 근거 |
|---|---|---|---|
| `REASON_REQUIRED` | 400 | 확정한 기록(`record.confirmed_at` 있음)을 사유 없이 바꿈 | spec '기록 모듈' |
| `PRESIDENT_REQUIRED` | 409 | 회장이 없어지는 변경(회장의 직급을 거두거나 회장 소속을 끝냄) | spec G8 |
| `COHORT_NOT_CURRENT` | 409 | 학생회 만들기·기수 고치기에서 기간이 오늘(한국 날짜)을 담지 않음 | P15 |
| `NO_CURRENT_COHORT` | 409 | 지금 기수가 없는 학생회에 초대로 들어오기 | P16 |
| `EMAIL_IN_USE` | 409 | 로그인 잇기에서 같은 이메일의 운영진이 다른 계정에 이어져 있음 | P17 |
| `ALREADY_PRESIDENT` | 409 | 회장이 자기에게 회장 넘기기 | P18 |
| `CANNOT_REMOVE_SELF` | 409 | 회장단이 자기를 내보내기 | P18 |
| `DEPARTMENT_NAME_TAKEN` | 409 | 같은 학생회에 같은 이름의 부서 | DB UNIQUE(council_id, name) |
| `PUSH_SERVICE_UNSUPPORTED` | 400 | 알려진 알림 서버가 아닌 기기 저장(덩어리 1의 시험 알림과 같은 코드) | P22 |
| `RECORD_CONFIRMED` | 409 | 확정한 기록(`record.confirmed_at` 있음)을 지우려 함(부서 없애기) | P34 |

## Review Focus

spec이 함의하지만 시험이 놓치기 쉬운, 실제 사용에서 가장 먼저 터질 다섯 가지다. 각 줄의 시험은 맡은 작업에 넣었다.

1. **내보내진 사람이 열어 둔 화면:** 세션은 살아 있는데 다음 요청이 403이다. 화면은 오류에 멈추지 않고 그 학생회를 닫아 내 학생회 목록으로(남은 학생회가 없으면 '학생회가 없을 때' 안내로) 돌아가야 한다. → Task 8 `team/flow.test.ts`(다음 요청 403), Task 11 `App.integration.test.tsx` '내보내진 사람의 다음 요청이 403이면…'.
2. **한국 날짜 경계:** 서버(Render)는 UTC다. 1월 1일 00~09시(한국)에 올해 기수로 학생회를 만들거나 12월 31일 밤에 학생회를 열면 UTC 날짜로는 기수 밖이다. 한국 날짜로 지금 소속을 봐야 한다. → Task 5 `access/actor.test.ts` '…한국 날짜로 센다', Task 6 `councils/councils.test.ts` '…한국의 1월 1일 새벽…'.
3. **다시 들어온 운영진의 직급:** 내보낸 부회장이 초대 링크로 다시 들어오면 같은 소속이 다시 열리지만 직급과 부서는 돌아오지 않아야 한다(G3). 돌아오면 내보낸 사람이 바로 회장단 권한을 되찾는다. → Task 7 `invites/invites.test.ts` '내보내졌던 사람이 다시 들어오면…'.
4. **들어가기를 두 번 누르거나 두 탭에서 동시에 들어오기:** 둘 다 200이고 소속과 판은 하나여야 한다(500이나 소속 둘이 아니라). → Task 7 `invites/invites.test.ts` '두 탭에서 동시에 들어와도…'.
5. **대문자가 섞인 이메일, 미리 있던 운영진:** 로그인 이메일에 대문자가 있거나 같은 이메일의 잇지 않은 운영진이 있으면 새 운영진을 만들다 UNIQUE 위반(500)으로 막히지 않고 그 운영진에 이어야 한다. → Task 6 `councils/link.test.ts` '같은 이메일의 잇지 않은 운영진이 있으면…'.

동시에 오는 요청의 시험(4번, Task 7의 코드 동시 바꾸기, Task 8의 회장 넘기기와 내보내기)은 PGlite가 거래를 하나씩 돌려서 잠금이 없어도 통과한다(각 시험에 주석으로 적었다). 이 시험들은 결과의 모양만 지킨다. 실제 PostgreSQL에서 동시 처리가 되는지는 '바꾸는 날' 2단계와 6단계에서 두 기기로 본다.

## Plan decisions

spec이 정하지 않아 이 계획이 가장 작은 쪽으로 정한 것이다. 한 줄씩 까닭을 단다. P4, P14, P22, P23, P28, P30, P33~P36은 수정 1회차(컨트롤러 결정과 리뷰 반영)에서 바꾸거나 더했다.

- **P1** 옛 마이그레이션 29개와 snapshot은 Task 1이 아니라 Task 2에서 지운다: Task 1과 2 사이에도 로그인 시험(`auth.test.ts`)이 로그인 표를 만들 마이그레이션이 있어야 커밋마다 시험이 통과한다.
- **P2** 남기는 배관 중 기능이 사라진 설정은 그대로 둔다(`guard.ts`의 학생회비 명단·회고 본문 상한, `web.ts`의 `/apply/:code`·`/r` 진입점, `/api/public/*` 가드, `lib/download.ts`·`lib/qr-code.ts`): spec이 `http/`, `web.ts`, `lib`를 남기라고 했고 덩어리 7이 다시 쓴다. `lib/qr-code.test.ts`만 지운 코드에 기대지 않게 고친다.
- **P3** Task 1이 `ci.yml`의 `DELIVERY_*` 환경 변수 6줄과 AGENTS.md의 행사 잠금 규칙 한 줄을 지운다: 지운 기능을 설정하고 설명하는 줄이다(다시 만들기 설계서: 행사 잠금은 그 기능의 spec이 다시 정한다).
- **P4** 영수증 저장소(R2) 모듈은 남긴다: Task 1이 `apps/api/src/expenses/storage.ts`와 `storage.test.ts`를 `apps/api/src/storage/`로 옮기고(git mv, 시험 목록에 남김) `expenses/`의 나머지를 지운다. `serve.ts`에는 잇지 않는다(덩어리 5 전에는 쓰는 곳이 없다). `package.json`의 의존성(aws4fetch, write-excel-file, fflate, uqr, zxing-wasm)은 그대로 둔다: 사용자가 "기능만 비우고 배관은 남긴다"를 골랐고 다시 만들기 설계서가 R2를 남기는 배관으로 적었다. 잠금 파일은 건드리지 않는다.
- **P5** 시험 DB 도우미는 프로세스마다 마이그레이션을 한 번 적용한 DB를 떠 두고(`dumpDataDir`) 시험마다 그 사본을 연다(`loadDataDir`): 이 PC에서 새로 만들기는 약 8초, 사본은 약 1.7초다.
- **P6** 첫 마이그레이션 생성 스크립트와 `check:design`은 physical-model.md 경로를 인자로도 받는다(기본 `../vada-docs/physical-model.md`): worktree에서 실행해도 된다.
- **P7** `db:generate` 스크립트를 `drizzle-kit generate --custom`으로 바꾸고 옛 snapshot을 남기지 않는다: 다시 만들기 설계서가 schema.ts로 표를 만들지 않고 빈 마이그레이션에 SQL을 쓰게 했다.
- **P8** 로그인 잇기가 처음 만드는 운영진 기록은 시스템이 만든 기록이다(`created_by`와 판 1의 `changed_by` 비움): 운영진 번호가 생기기 전이라 행위자가 없다(physical-model.md: 시스템이 만든 기록은 비운다).
- **P9** 판의 `data`는 하위 행 전체를 DB에서 `to_jsonb`로 담는다(`id`, `kind` 포함): "그 판의 칸 값 전체"를 시간대·정밀도 변환 없이 남긴다.
- **P10** 기록 모듈에 여러 기록을 차례로 바꾸는 `updateRecords`를 두고, 회장이 없어지는지는 다 바꾼 뒤에 본다: 부분 유일 인덱스가 열린 회장 둘을 막아 회장 넘기기는 거두기가 먼저여야 하기 때문이다.
- **P11** 다시 들어오면 같은 학생회 소속 행을 연다: `starts_at`은 다시 들어온 시각, `ends_at`과 `council_rank`는 비운다. 부서 소속은 끝난 채로 둔다(G3: 직급과 부서 없이 들어온다).
- **P12** 빠졌던 부서에 다시 넣으면 그 부서 소속 행을 다시 연다: UNIQUE(member_id, department_id, cohort_id) 때문이다.
- **P13** 판 경계 시각은 `GREATEST(clock_timestamp(), 지금 판 시작 + 1µs)`다: 같은 마이크로초나 시계가 뒤로 가도 판이 비지 않는다.
- **P14** 같은 학생회의 조직 변경(만들기 뒤의 모든 변경, 들어오기, 코드 바꾸기)은 학생회 행을 `FOR NO KEY UPDATE`로 잠그고 요청한 사람의 소속과 권한을 다시 본다. 로그인 잇기는 `users` 행을, 기록 모듈은 바꿀 하위 행을 같은 방식으로 잠근다(spec '기록 모듈'은 `FOR UPDATE`로 적었다): 동시 회장 넘기기·내보내기·코드 바꾸기는 한 줄로 서지만, 그 행을 가리키는 행을 넣을 때의 외래 키 검사(`FOR KEY SHARE`)는 기다리지 않는다(세션, 알림 기기, 뒤 덩어리의 기록. PostgreSQL 행 잠금 문서).
- **P15** 학생회를 만들거나 기수를 고칠 때 기간이 오늘(한국 날짜)을 담지 않으면 409 `COHORT_NOT_CURRENT`다: 담지 않으면 모든 운영진이 학생회를 열 수 없고, 다음 기수 도구(RFC-6)가 없어 되돌릴 길이 없다.
- **P16** 지금 기수가 없는 학생회에 초대로 들어오면 409 `NO_CURRENT_COHORT`다: '지금 기수에 바로 들어온다'(G3)의 지금 기수가 없다.
- **P17** 같은 이메일의 운영진이 이미 다른 계정에 이어져 있으면 409 `EMAIL_IN_USE`다: physical-model.md의 `member.email`이 UNIQUE라 새 운영진을 만들 수 없다.
- **P18** 회장단이 자기를 내보내면 409 `CANNOT_REMOVE_SELF`, 회장이 자기에게 넘기면 409 `ALREADY_PRESIDENT`다: spec G4 '스스로 나가기는 없다'.
- **P19** 부서 배정 경로로 부서 직급(부장·부부장)을 바꾸면 `member.manage`에 더해 `rank.manage`도 본다: 권한표가 부서 배정과 직급을 다른 칸으로 둔다(지금은 둘 다 회장단이다).
- **P20** 경로의 학생회 번호가 uuid가 아니면 403, 운영진·부서 번호가 uuid가 아니면 404이고, 본문의 번호는 계약에서 uuid로 거른다(400): uuid가 아닌 값이 DB에 닿으면 500이 난다.
- **P21** `GET /api/organizations/:councilId/members`가 운영진과 부서 목록을 함께 돌려주고, 회장단의 운영진·부서 변경도 같은 목록 전체를 돌려준다: spec에 부서 목록 경로가 없고 사람·부서 화면이 같이 쓴다(지금 vada와 같은 방식).
- **P22** 알림 받을 기기는 덩어리 1의 허용 목록(`isKnownPushService`)으로 거르고 모르면 400 `PUSH_SERVICE_UNSUPPORTED`다. 같은 구독 주소를 다른 계정이 저장하면 그 계정의 기기가 된다. 응답은 본문 없는 204다. 시험 알림 결과가 `expired`면 서버가 보낸 사람의 그 기기 줄도 지운다(`createPushRoutes`의 다섯째 인자 `forget`): 구독 주소는 비밀 주소이고, 한 브라우저는 마지막에 켠 계정이 쓴다. 화면의 지우기 요청이 실패해도 끝난 구독의 줄이 남지 않는다.
- **P23** 화면: '알림 켜기'가 기기를 저장하지 못하면 구독을 지우고 다시 누르게 한다. 대화상자를 열 때 이미 켜진(지금 열쇠의) 구독이 있으면 한 번 저장한다(서버가 구독 주소로 덮어써 여러 번이어도 같다). 이 저장이 실패하면 켜기에 실패한 것과 똑같이 구독을 지우고 "알림을 켜지 못했어요. 다시 눌러 주세요."와 [알림 켜기]를 보인다. 열쇠가 바뀐 옛 구독(덩어리 1이 대화상자를 열 때 지운다)과 끝난(expired) 구독은 서버에서도 지운다: 화면이 '켜짐'인데 서버에 기기가 없는 상태를 만들지 않는다(G10). 구독은 덩어리 1처럼 누른 동작 안에서 바로 부르고, 저장은 구독이 끝난 뒤에 한다. 덩어리 1의 기기 확인에서 알림을 켠 휴대폰도 바꾸는 날 대화상자를 열면 새 DB에 저장된다.
- **P24** 화면: 학생회 하나 보기가 403이면 그 학생회를 닫고 내 학생회 목록을 다시 읽는다(Review Focus 1).
- **P25** 화면: 학생회 이름 메뉴와 줄마다 ⋯ 메뉴에 새 부품 `components/ui/menu.tsx`(Radix DropdownMenu), 확인 대화상자에 새 표시 부품 `components/ConfirmDialog.tsx`를 둔다. 둘 다 `/ui.html`에 더한다.
- **P26** 화면: 부회장 메뉴는 `{표시 이름} 직급 주기/거두기`로 적는다: 학생회가 정한 표시 이름 뒤에 조사(으로/로)를 붙이면 틀릴 수 있다.
- **P27** 화면: 초대 코드 바꾸기에는 확인 대화상자를 두지 않고, 바꾼 뒤 "옛 링크로는 이제 들어올 수 없어요"를 알린다: spec이 확인 대화상자를 내보내기와 회장 넘기기에만 정했다.
- **P28** 길이 상한은 계약과 DB가 같다: 학생회 이름 50, 학교 50, 기수 이름 20, 부서 이름 20, 직급 표시 이름 20(지금 vada에 있던 값은 그대로). DB CHECK(`char_length(x) <= n`)는 vada-docs 5198ef5의 physical-model.md에 있어 첫 마이그레이션에 그대로 들어간다. Task 2 시험이 51자 학생회 이름을 DB가 막는지 본다: AGENTS.md "길이 제한이 있는 컬럼은 DB에도 같은 값의 CHECK를 둔다", 설계가 첫 마이그레이션의 단일 원천이다.
- **P29** 시험 데이터는 학교 이름 'VADA 시험 학교'로 시험 학생회를 찾고 초대 코드를 늘 `TESTDATA`로 맞춘다: uuidv7 번호는 정해 둘 수 없고, 화면에서 코드를 바꿔도 다시 돌리면 같은 결과가 된다.
- **P30** `db:migrate`의 대상은 `.env`의 DB가 기본이고, 셸의 `DATABASE_URL`은 `--from-shell`을 줄 때만 쓴다. 셸에 주소가 있는데 플래그가 없거나, 플래그는 있는데 주소가 없으면 아무것도 하지 않고 멈춘다. 적용 전에 대상(호스트와 DB 이름만)과 상태를 찍고, 적용 기록이 없거나 기록 표가 비었는데 표가 있으면, 또는 기록이 로컬과 다르면 멈춘다. `--dry-run`은 바꾸지 않는다: spec '바꾸는 날'이 배포 DB 주소를 준 채 실행하게 했지만, 셸에 남은 배포 주소로 모르게 적용하면 안 된다. AGENTS.md가 적용 전 기록 확인을 요구한다.
- **P31** 작업을 14개로 나눈다(제안의 화면 2개를 3개로): 화면 2(사람의 동작)와 화면 3(부서·설정)을 나눠 한 작업의 화면 코드가 리뷰 한 번에 들어오게 했다.
- **P32** 경계 시험의 라우트 모듈에는 빈 객체를 DB로 넘긴다(`{} as Db`): 경계 검사는 DB에 닿기 전에 끝나고, 닿으면 500이 나 시험이 실패한다. 시험마다 DB를 만들지 않아도 된다.
- **P33** 기록 모듈은 주인 칸(`councilId`, `cohortId`, `departmentId`, `memberId`와 DB 칸 이름 `council_id` 등)을 바꾸는 변경을 `Error`로 막는다(코드의 잘못이다): 같은 학생회인지는 만들 때만 보므로(`assertSameCouncil`), 바꾸면 다른 학생회의 기수나 부서를 가리킬 수 있다.
- **P34** 부서 없애기는 확정한 기록(`record.confirmed_at` 있음)이면 409 `RECORD_CONFIRMED`다: physical-model.md "확정한 기록은 지우지 않는다"(DEC-27 기준 6). 바탕에는 기록을 확정하는 길이 없어 모듈 시험으로 지키고, 화면은 일반 실패 문구를 보인다.
- **P35** Task 1이 옛 모델 문서 `docs/ERD.md`, `docs/purchase-model.md`, `docs/purchase-benchmark.md`를 지우고 README의 파일 지도를 남는 폴더로 바꾼다. Task 14가 바탕에서 생긴 폴더를 README에 더한다: 옛 모델을 설명하는 문서는 에이전트를 잘못 이끈다(옛 코드를 먼저 지우는 것과 같은 까닭). 지난 계획·설계서(`docs/superpowers/`)의 언급은 그때의 기록이라 고치지 않는다.
- **P36** 구현자는 브라우저를 열지 않는다. `/ui.html`은 컨트롤러가 헤드리스 스크린샷(데스크톱 폭, 390px iframe)으로 보고, 로그인 뒤 화면과 Figma 비교는 사람이 '바꾸는 날' 2단계에서 본다: 구현 중에는 새 표가 있는 DB가 없고, 눈 확인을 한 곳으로 모은다.

## 알려 둘 것 (spec과 문서의 빈틈)

1. AGENTS.md는 "길이 제한이 있는 컬럼은 DB에도 같은 값의 CHECK를 둔다"고 하는데 physical-model.md에는 이름 칸의 길이 CHECK가 없었다. vada-docs 5198ef5가 설계에 같은 값의 CHECK를 더해 풀었다. 첫 마이그레이션이 설계를 그대로 옮기므로 계약과 DB가 같은 값을 갖는다(P28, Task 2 Step 1이 5198ef5 이후인지 본다).
2. spec '권한'은 라우트 순서를 "세션 확인, 입력 검사, actorOf, can"으로 적었다. 컨트롤러가 이 문구를 AGENTS.md와 경계 시험(입력 검사 `json()`이 인증보다 먼저)에 맞게 고쳤다. 계획은 처음부터 AGENTS.md를 따랐고 코드는 바뀌지 않는다.
3. 다시 만들기 설계서는 영수증 저장소(R2)를 남기는 배관으로 적었지만 바탕 spec은 `expenses/`를 통째로 지우라고 했다. 사용자가 고른 "기능만 비우고 배관은 남긴다"에 따라 저장소 모듈만 `apps/api/src/storage/`로 옮겨 남긴다(P4).
4. spec은 로그아웃한 브라우저의 알림 기기를 어떻게 할지 정하지 않았다. 이 계획에서는 로그아웃해도 기기가 그 계정에 남고, 같은 브라우저에서 다른 계정이 알림을 켜거나 알림 대화상자를 열면 그 계정으로 옮겨진다(P22, P23). 흔한 방식은 로그아웃할 때 구독을 끊고 기기를 지우는 것이다. 바탕은 알림을 보내지 않아 지금 드러나는 것은 없다. 알림을 실제로 보내는 덩어리 3이 알림을 하나라도 보내기 전에 정해야 한다.

## 출발점

- 덩어리 1(휴대폰 길, 가지 `mobile-path`) 계획의 Task 1~8이 모두 끝난 커밋에서 시작한다. Task 1 Step 1이 덩어리 1의 결과물이 있는지 본다.
- vada-docs는 옆 폴더 `../vada-docs`에 있고, 가지 `rebuild-design`의 5198ef5(이름 칸 길이 CHECK. 회장 부분 유일 인덱스는 156230a부터) 이후다. Task 2 Step 1이 확인한다.
- 이 계획의 코드는 덩어리 1의 실제 코드에 맞췄다. 가지 `mobile-path`의 005e2ca, 마지막 수정까지다. 맞춘 것은 LoginPanel, popup-login, AuthDone, platform, service-worker, 서버와 화면의 push/*, Gallery의 '휴대폰 알림'과 '카톡 안 로그인', `docs/device-checks.md`다. 005e2ca에서는 알림 보내기가 `{ result, status?, code? }`를 돌려주고, 대화상자를 열 때 열쇠가 바뀐 옛 구독을 지운다. 그 뒤에 덩어리 1이 또 바뀌면 두 가지를 한다. 이 계획이 통째로 바꾸는 파일(`App.tsx`, `App.test.tsx`, `main.tsx`)에는 덩어리 1의 실제 로그인 부분과 로그인 시험을 그대로 옮긴다. Task 10의 `usePush.ts`·`PushSettings.test.tsx` 편집은 실제 코드에 같은 뜻으로 넣는다.

## 파일 지도

| 경로 | 책임 | 작업 |
|---|---|---|
| `apps/api/scripts/design-sql.ts` | 설계 SQL 블록 뽑기·문장 나누기, 로그인 표·설계 밖 표 SQL | 2 |
| `apps/api/scripts/baseline-from-design.ts` | `0000_baseline.sql` 만들기(한 번) | 2 |
| `apps/api/migrations/0000_baseline.sql`, `meta/_journal.json` | 첫 마이그레이션 | 2 |
| `apps/api/src/db/test-db.ts` | 시험 DB(btree_gist + 마이그레이션) | 2 |
| `apps/api/src/db/schema.ts` | 조회용 표 정의 52개 | 1, 3 |
| `apps/api/scripts/catalog.ts`, `check-design.ts` | 설계 검사(로컬) | 3 |
| `apps/api/src/records/records.ts` | 기록 모듈: 만들기, 바꾸기, 판, 회장 지키기 | 4 |
| `apps/api/src/access/actor.ts`, `permissions.ts`, `authorize.ts` | 지금 소속, 권한표, 경로 번호와 잠금 | 5 |
| `apps/api/src/test-support/council.ts`, `http.ts` | 시험용 학생회와 요청 | 5, 6 |
| `apps/api/src/councils/` | 로그인 잇기, 학생회 만들기·목록·보기·설정·기수 | 6, 9 |
| `apps/api/src/invites/` | 초대 코드, 초대 확인, 들어오기, 코드 바꾸기 | 6, 7 |
| `apps/api/src/team/` | 운영진 목록·편성, 부서, 흐름 시험 | 8, 9 |
| `apps/api/src/storage/storage.ts` | 영수증 저장소(R2). 옮기기만 하고 잇지 않는다 | 1 |
| `README.md` | 저장소 파일 지도 | 1, 14 |
| `apps/api/src/push/devices.ts` | 알림 받을 기기 저장과 지우기(`forgetPushDevice`) | 10 |
| `apps/api/src/db/migrate-check.ts`, `migrate.ts` | 바꾸는 날의 적용 점검 | 14 |
| `apps/api/scripts/test-data.ts`, `manage-test-data.ts` | 시험 데이터 | 14 |
| `packages/contracts/src/permissions.ts`, `councils.ts`, `invites.ts`, `team.ts` | 직급·권한 이름, 요청 스키마, 응답 타입 | 5~9 |
| `apps/web/src/lib/api.ts` | 같은 출처 API 부르기 | 11 |
| `apps/web/src/components/ui/menu.tsx`, `components/ConfirmDialog.tsx` | 새 부품 | 11, 12 |
| `apps/web/src/councils/` | 학생회 없음, 만들기, 초대 링크, 내 학생회 목록 | 11 |
| `apps/web/src/workspace/` | 작업 공간 틀, 학생회 하나 읽기 | 11~13 |
| `apps/web/src/team/` | 운영진 > 사람·부서, 운영진 데이터 훅 | 11~13 |
| `apps/web/src/settings/CouncilSettings.tsx` | 설정 > 학생회 정보 | 13 |

---

### Task 1: 옛 기능 지우기

옛 기능의 서버 모듈, 화면, 계약, 데이터 스크립트, 배송 도구, 옛 모델 문서를 지운다. 남는 것은 로그인, 공통 가드와 입력 검사, 오류 처리와 Sentry, 휴대폰 길(덩어리 1), 영수증 저장소(R2) 모듈(`apps/api/src/storage/`로 옮긴다, P4), 화면 부품이다. 로그인하면 "아직 들어간 학생회가 없어요."와 휴대폰 알림(종), 로그아웃만 보인다. 옛 마이그레이션은 Task 2가 지운다(P1).

**Files:**
- Move: `apps/api/src/expenses/storage.ts` → `apps/api/src/storage/storage.ts`, `apps/api/src/expenses/storage.test.ts` → `apps/api/src/storage/storage.test.ts`(git mv, 내용은 그대로. 시험의 import `./storage.js`도 같은 폴더라 그대로다)
- Delete(서버): `apps/api/src/{access,organization,events,chat,purchases,deliveries,expenses,settlement,budget,incomes,registrations,fees,tasks,reports,home,workbook}/`(`expenses/`는 위의 둘을 옮긴 뒤의 나머지), `apps/api/src/db/{schema.test.ts,migrations.test.ts,purchases.test.ts,deliveries.test.ts,test-migrations.ts}`, `apps/api/scripts/`의 모든 파일
- Delete(화면): `apps/web/src/{access,budget,chat,events,deliveries,purchases,expenses,settlement,registrations,fees,tasks,home,records,organization,public,workspace}/`, `apps/web/src/App.integration.test.tsx`, `apps/web/src/test-support/workflow-fixtures.ts`, `apps/web/src/components/{AccountInfo,QrCode,StatGrid}.tsx`(spec 목록의 화면 `reports`는 따로 폴더가 없다. 결과보고서 화면은 `events/`·`records/`와 함께 지워진다)
- Delete(계약): `packages/contracts/src/`의 `budget`, `chat`, `coupang`, `deliveries`, `events`, `expenses`, `fees`, `home`, `incomes`, `invites`, `organizations`, `purchases`, `registrations`, `reports`, `settlement`, `tasks`(`.ts`와 `.test.ts`)
- Delete(배송): `.github/workflows/delivery-worker.yml`, `scripts/`(저장소 맨 위)의 모든 파일, `docs/delivery-api.md`, `docs/delivery-tracking-discovery.md`, `docs/delivery-webhook-test.md`, `docs/delivery-worker.md`
- Delete(옛 모델 문서): `docs/ERD.md`, `docs/purchase-model.md`, `docs/purchase-benchmark.md`(P35)
- Modify: `README.md`(파일 지도)
- Modify: `apps/api/src/app.ts`, `apps/api/src/serve.ts`, `apps/api/src/db/schema.ts`, `apps/api/src/auth/auth.test.ts`, `apps/api/src/http/boundary.test.ts`, `apps/api/package.json`
- Modify: `packages/contracts/src/index.ts`, `packages/contracts/src/input.test.ts`, `packages/contracts/package.json`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`, `apps/web/src/main.tsx`, `apps/web/src/ui-gallery/Gallery.tsx`, `apps/web/src/ui-gallery/Gallery.test.tsx`, `apps/web/src/lib/qr-code.test.ts`
- Modify: `.github/workflows/ci.yml`, `AGENTS.md`

**Interfaces:**
- Consumes: 덩어리 1의 `createPushRoutes(getSession, publicKey, send, wait?)`(`push/routes.ts`), `pushConfigFrom`, `createPushSender`, 화면의 `LoginPanel`, `startPopupLogin`, `AUTH_CHANNEL`, `AUTH_DONE_PATH`, `AuthDone`, `isIosHomeScreenApp`, `registerServiceWorker`, `PushSettingsButton`(기본 내보내기, `push/PushSettings.tsx`), `PushPanel`
- Produces:
  - `AppOptions = { auth; trustedOrigin; push? }`, `createApp(options)` — 뒤 작업이 모듈을 하나씩 더한다
  - `schema.ts`의 로그인 표 `users`, `accounts`, `sessions`, `verifications`(지금 정의 그대로)
  - `@vada/contracts`의 `codePoints`, `isStrictObject`, `text`, `token`, `koreanDateTime`, `dateFromKorean`, `koreanOf`, 푸시 계약, `HealthResponse`
  - `apps/api/src/storage/storage.ts`의 `ReceiptStorage`, `R2Config`, `r2ConfigFrom(env)`, `createR2Storage(config, fetcher?, now?)`(옮기기만 한다. 덩어리 5가 쓴다)

- [ ] **Step 1: 출발점을 확인한다**

덩어리 1이 끝났는지 본다.

Run: `git log --oneline -1 && ls apps/web/src/push/PushSettings.tsx apps/web/src/auth/LoginPanel.tsx apps/web/src/auth/popup-login.ts apps/web/src/auth/AuthDone.tsx apps/web/src/lib/platform.ts apps/web/src/lib/service-worker.ts apps/api/src/push/routes.ts docs/device-checks.md && grep -c "휴대폰 알림" apps/web/src/ui-gallery/Gallery.tsx`
Expected: 파일 8개가 모두 있고, 마지막 숫자가 1 이상이다. 하나라도 없으면 멈추고 알린다(덩어리 1이 끝나지 않았다).

Run: `npm ci && npm test --workspace @vada/contracts`
Expected: PASS

- [ ] **Step 2: 실패하는 화면 시험을 쓴다**

`apps/web/src/App.test.tsx`를 다음으로 바꾼다. 덩어리 1의 로그인 시험(카카오톡, 홈 화면 앱, 앱이 다시 보일 때 세션 다시 읽기)은 그대로 옮겼고, 옛 소속·작업 공간·초대 링크 시험 대신 '학생회 없음' 안내를 본다. 덩어리 1에 이 목록에 없는 로그인 시험이 더 있으면 그것도 그대로 옮긴다.

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'

const auth = vi.hoisted(() => ({ useSession: vi.fn(), social: vi.fn(), signOut: vi.fn(), refetch: vi.fn() }))
vi.mock('./auth/auth-client', () => ({ authClient: { useSession: auth.useSession, signIn: { social: auth.social }, signOut: auth.signOut } }))
beforeEach(() => {
  vi.resetAllMocks()
  window.history.replaceState(null, '', '/')
  auth.useSession.mockReturnValue({ data: null, isPending: false, error: null, refetch: auth.refetch })
})
afterEach(cleanup)

test('anonymous user starts Google login with same-origin callbacks', async () => {
  auth.social.mockResolvedValue({ error: null })
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
  await waitFor(() => expect(auth.social).toHaveBeenCalledWith({ provider: 'google', callbackURL: '/', errorCallbackURL: '/' }))
})

test('session loading and failures are not presented as logged out', () => {
  auth.useSession.mockReturnValue({ data: null, isPending: true, error: null })
  const view = render(<App />)
  expect(screen.getByRole('status').textContent).toContain('확인 중')
  expect(screen.queryByRole('button', { name: 'Google로 로그인' })).toBeNull()
  auth.useSession.mockReturnValue({ data: null, isPending: false, error: { message: 'private error' }, refetch: auth.refetch })
  view.rerender(<App />)
  expect(screen.getByRole('alert').textContent).toContain('세션을 확인하지 못했어요')
  fireEvent.click(screen.getByRole('button', { name: '다시 확인' }))
  expect(auth.refetch).toHaveBeenCalled()
})

test('로그인한 사람은 학생회가 없다는 안내와 휴대폰 알림 버튼을 보고, 로그아웃하면 로그인 화면으로 돌아간다', async () => {
  auth.useSession.mockReturnValue({ data: { user: { name: '테스터', email: 'test@example.test' } }, isPending: false, error: null })
  auth.signOut.mockResolvedValue({ error: null })
  const view = render(<App />)
  expect(screen.getByText('test@example.test')).toBeTruthy()
  expect(screen.getByText('아직 들어간 학생회가 없어요.')).toBeTruthy()
  expect(screen.getByRole('button', { name: '휴대폰 알림' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))
  await waitFor(() => expect(auth.signOut).toHaveBeenCalledOnce())
  auth.useSession.mockReturnValue({ data: null, isPending: false, error: null })
  view.rerender(<App />)
  expect(screen.getByRole('button', { name: 'Google로 로그인' })).toBeTruthy()
})

test('login failure allows retry without exposing the raw error', async () => {
  auth.social.mockRejectedValue(new Error('private error'))
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('로그인을 시작하지 못했어요'))
  expect(screen.getByRole('button', { name: 'Google로 로그인' }).hasAttribute('disabled')).toBe(false)
})

test('OAuth callback failure is explained without showing its raw value', () => {
  window.history.replaceState(null, '', '/?error=access_denied')
  render(<App />)
  expect(screen.getByRole('alert').textContent).toContain('로그인이 완료되지 않았어요')
})

test('logout failure keeps the signed-in state and enables retry', async () => {
  auth.useSession.mockReturnValue({ data: { user: { name: '테스터', email: 'test@example.test' } }, isPending: false, error: null })
  auth.signOut.mockResolvedValue({ error: { message: 'private error' } })
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('로그아웃하지 못했어요'))
  expect(screen.getByRole('button', { name: '로그아웃' }).hasAttribute('disabled')).toBe(false)
})

test('KakaoTalk in-app browser offers the outside browser instead of Google login', () => {
  const agent = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Linux; Android 14) KAKAOTALK/10.9.0')
  try {
    render(<App />)
    expect(screen.getByText('카카오톡 안에서는 Google 로그인이 막혀 있어요. 바깥 브라우저로 열어 주세요.')).toBeTruthy()
    expect(screen.getByRole('button', { name: '바깥 브라우저로 열기' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Google로 로그인' })).toBeNull()
  } finally {
    agent.mockRestore()
  }
})

test('iOS home-screen app opens an in-app window before asking for the Google URL', async () => {
  Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
  const popup = { location: { href: 'about:blank' }, close: vi.fn() }
  const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
  auth.social.mockResolvedValue({ data: { url: 'https://accounts.google.com/x', redirect: false }, error: null })
  try {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
    expect(open).toHaveBeenCalledWith('about:blank', '_blank')
    await waitFor(() => expect(popup.location.href).toBe('https://accounts.google.com/x'))
    expect(auth.social).toHaveBeenCalledWith({ provider: 'google', callbackURL: '/auth-done', errorCallbackURL: '/auth-done?error=1', disableRedirect: true })
    expect(screen.getByRole('button', { name: '다른 방법으로 로그인' })).toBeTruthy()
  } finally {
    open.mockRestore()
    delete (navigator as { standalone?: boolean }).standalone
  }
})

test('iOS home-screen app rechecks the session when the login window reports back', () => {
  Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
  const listeners: (() => void)[] = []
  vi.stubGlobal('BroadcastChannel', class {
    set onmessage(listener: () => void) { listeners.push(listener) }
    postMessage() {}
    close() {}
  })
  try {
    render(<App />)
    expect(listeners).toHaveLength(1)
    listeners[0]!()
    expect(auth.refetch).toHaveBeenCalled()
  } finally {
    vi.unstubAllGlobals()
    delete (navigator as { standalone?: boolean }).standalone
  }
})

test('iOS home-screen app rechecks the session when it becomes visible again, and stops listening once signed in', () => {
  Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
  let visibility: DocumentVisibilityState = 'visible'
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
  const changeTo = (next: DocumentVisibilityState) => {
    visibility = next
    document.dispatchEvent(new Event('visibilitychange'))
  }
  const closed = vi.fn()
  vi.stubGlobal('BroadcastChannel', class {
    postMessage() {}
    close() { closed() }
  })
  try {
    const view = render(<App />)
    changeTo('hidden')
    expect(auth.refetch).not.toHaveBeenCalled()
    changeTo('visible')
    expect(auth.refetch).toHaveBeenCalledTimes(1)
    auth.useSession.mockReturnValue({ data: { user: { name: '테스터', email: 'test@example.test' } }, isPending: false, error: null, refetch: auth.refetch })
    view.rerender(<App />)
    expect(closed).toHaveBeenCalled()
    changeTo('visible')
    expect(auth.refetch).toHaveBeenCalledTimes(1)
  } finally {
    vi.unstubAllGlobals()
    delete (document as { visibilityState?: unknown }).visibilityState
    delete (navigator as { standalone?: boolean }).standalone
  }
})
```

- [ ] **Step 3: 시험이 실패하는지 본다**

Run: `cd apps/web && npx vitest run src/App.test.tsx`
Expected: FAIL, `2 failed | 8 passed (10)`. '로그인한 사람은 학생회가 없다는 안내…' 시험은 '아직 들어간 학생회가 없어요.'를 찾지 못하고, 'logout failure…' 시험은 `Found multiple elements with the role "alert"`다(옛 App이 소속을 불러 오류를 하나 더 보인다).

- [ ] **Step 4: 서버의 옛 기능을 지운다**

영수증 저장소 모듈을 먼저 옮긴다(`git mv`는 없는 폴더를 만들지 않아 폴더부터 만든다). 그다음 옛 기능을 지운다.

Run:
```bash
mkdir -p apps/api/src/storage
git mv apps/api/src/expenses/storage.ts apps/api/src/storage/storage.ts
git mv apps/api/src/expenses/storage.test.ts apps/api/src/storage/storage.test.ts
git rm -r -q apps/api/src/access apps/api/src/organization apps/api/src/events apps/api/src/chat apps/api/src/purchases apps/api/src/deliveries apps/api/src/expenses apps/api/src/settlement apps/api/src/budget apps/api/src/incomes apps/api/src/registrations apps/api/src/fees apps/api/src/tasks apps/api/src/reports apps/api/src/home apps/api/src/workbook
git rm -q apps/api/src/db/schema.test.ts apps/api/src/db/migrations.test.ts apps/api/src/db/purchases.test.ts apps/api/src/db/deliveries.test.ts apps/api/src/db/test-migrations.ts
git rm -r -q apps/api/scripts
```

`apps/api/src/app.ts`를 다음으로 바꾼다:

```ts
import { Hono } from 'hono'
import type { HealthResponse } from '@vada/contracts'
import type { createPushRoutes } from './push/routes.js'
import { handleError } from './http/on-error.js'
import { limitBody, mutationGuard } from './http/guard.js'

type AuthHandler = { handler: (request: Request) => Promise<Response> }
export type AppOptions = {
  auth: AuthHandler
  trustedOrigin: string
  // 휴대폰 알림. 알림 열쇠(VAPID)가 없으면 만들지 않는다.
  push?: ReturnType<typeof createPushRoutes>
}

export function createApp({ auth, trustedOrigin, push }: AppOptions) {
  const app = new Hono()
  app.use('/api/organizations/*', mutationGuard(trustedOrigin))
  // 로그인한 사람 자신의 것(휴대폰 알림)도 같은 가드를 건다.
  app.use('/api/me/*', mutationGuard(trustedOrigin))
  // 로그인 없이 쓰는 공개 경로(참가 신청)도 같은 화면에서만 보내므로 같은 가드를 건다.
  app.use('/api/public/*', mutationGuard(trustedOrigin))
  app.get('/api/health', (c) => c.json({ status: 'ok' } satisfies HealthResponse))
  // better-auth는 출처 검사 전에 본문 전체를 읽으므로 크기만 먼저 제한한다.
  app.use('/api/auth/*', limitBody())
  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))
  if (push) app.route('/api', push)
  app.onError(handleError)
  return app
}
```

`apps/api/src/serve.ts`를 다음으로 바꾼다(배송, 구매, 신청 정리 실행기와 영수증 저장소 연결(`r2ConfigFrom`, `createR2Storage`, '영수증 저장소 켜짐 (R2)' 로그)을 뺐다. 저장소 모듈은 남지만 덩어리 5 전에는 쓰는 곳이 없어 잇지 않는다):

```ts
import { serve } from '@hono/node-server'
import { readRuntime } from './runtime.js'
import { attachWeb } from './web.js'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { createApp } from './app.js'
import { createAuth } from './auth/auth.js'
import { startErrorReporting, stopErrorReporting } from './http/sentry.js'
import { pushConfigFrom } from './push/config.js'
import { createPushRoutes } from './push/routes.js'
import { createPushSender } from './push/sender.js'

function main() {
  const { env, production, hostname, port } = readRuntime(process.env, process.argv.includes('--production'))
  if (production) process.env.NODE_ENV = 'production'
  if (startErrorReporting(env.SENTRY_DSN, production ? 'production' : 'development')) console.log('오류 알림 켜짐 (Sentry)')
  // DB 마이그레이션은 서버 시작 시 자동 실행하지 않는다.
  const client = postgres(env.DATABASE_URL!, {
    max: 5, ssl: { rejectUnauthorized: true }, connect_timeout: 15, onnotice: () => {},
  })
  const db = drizzle(client)
  const auth = createAuth(db, {
    secret: env.BETTER_AUTH_SECRET!, baseURL: env.BETTER_AUTH_URL!,
    googleClientId: env.GOOGLE_CLIENT_ID!, googleClientSecret: env.GOOGLE_CLIENT_SECRET!,
  })
  // 휴대폰 알림 열쇠는 서버에서만 쓴다. 없으면 알림 경로를 만들지 않는다.
  const pushConfig = pushConfigFrom(env)
  if (pushConfig) console.log('휴대폰 알림 켜짐 (Web Push)')
  const push = pushConfig
    ? createPushRoutes((headers) => auth.api.getSession({ headers }), pushConfig.publicKey, createPushSender(pushConfig))
    : undefined
  const app = createApp({ auth, trustedOrigin: env.BETTER_AUTH_URL!, push })
  if (production) attachWeb(app)
  const server = serve({ fetch: app.fetch, hostname, port }, () => {
    console.log(`VADA ${production ? '웹 + API' : 'API'} 서버 시작 (port ${port})`)
  })
  server.on('error', () => {
    console.error('서버 실행 실패. 호스트와 포트 사용 여부를 확인하세요.')
    void client.end({ timeout: 5 })
    process.exitCode = 1
  })
  const shutdown = () => {
    server.close(() => { void client.end({ timeout: 5 }); void stopErrorReporting() })
  }
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
}

try {
  main()
} catch {
  console.error('서버 시작 실패. 설정을 확인하세요. 오류 원문은 출력하지 않습니다.')
  process.exitCode = 1
}
```

`apps/api/src/db/schema.ts`를 다음으로 바꾼다(로그인 표 4개만, 정의는 그대로):

```ts
import { boolean, index, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'

// Better Auth의 사용자 필드. 옛 기능 표는 지웠다. 새 표는 첫 마이그레이션(0000_baseline)과 함께 다시 쓴다.
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    .$onUpdate(() => new Date()),
})

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  // Better Auth 기본 스키마 호환 필드이며, 비밀번호 로그인을 활성화하지 않는다.
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  unique('accounts_provider_account_unique').on(table.providerId, table.accountId),
  index('accounts_user_id_idx').on(table.userId),
])

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  index('sessions_user_id_idx').on(table.userId),
])

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  index('verifications_identifier_idx').on(table.identifier),
])
```

`apps/api/src/auth/auth.test.ts`를 다음으로 바꾼다. 로그인한 사람만 쓰는 경로로 옛 `/api/me/memberships` 대신 휴대폰 알림 열쇠(`GET /api/me/push`)를 본다. DB는 아직 옛 마이그레이션으로 만든다(Task 2가 바꾼다).

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { makeSignature } from 'better-auth/crypto'
import { createApp } from '../app.js'
import { createPushRoutes } from '../push/routes.js'
import { createAuth } from './auth.js'

test('auth routes use the existing schema without external services', async (t) => {
  const pg = new PGlite()
  const secret = 'local-test-only-secret-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const baseURL = 'http://127.0.0.1:5180'
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) })
    const auth = createAuth(db, { secret, baseURL, googleClientId: 'test-client', googleClientSecret: 'test-secret' })
    // 로그인한 사람만 쓰는 경로(휴대폰 알림 열쇠)로 세션 확인을 본다.
    const push = createPushRoutes((headers) => auth.api.getSession({ headers }), 'PUBLIC', async () => ({ result: 'sent' }), async () => {})
    const app = createApp({ auth, trustedOrigin: 'http://127.0.0.1:5180', push })
    const request = (path: string, init?: RequestInit) => app.request(`${baseURL}/api/auth/${path}`, init)

    await t.test('anonymous session is null', async () => {
      const response = await request('get-session')
      assert.equal(response.status, 200)
      assert.equal(await response.json(), null)
      assert.equal((await app.request(`${baseURL}/api/me/push`)).status, 401)
    })
    await t.test('Google login creates OAuth state and uses the configured callback', async () => {
      const response = await request('sign-in/social', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: baseURL },
        body: JSON.stringify({ provider: 'google', callbackURL: '/', disableRedirect: true }),
      })
      assert.equal(response.status, 200)
      const body = await response.json() as { url: string }
      const url = new URL(body.url)
      assert.equal(url.hostname, 'accounts.google.com')
      assert.equal(url.searchParams.get('redirect_uri'), `${baseURL}/api/auth/callback/google`)
      assert.ok(url.searchParams.get('state'))
      assert.ok(response.headers.get('set-cookie'))
    })
    await t.test('초대 링크로 돌아오는 상대 경로 콜백을 허용한다', async () => {
      const response = await request('sign-in/social', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: baseURL },
        body: JSON.stringify({ provider: 'google', callbackURL: '/join/ABCD2345', errorCallbackURL: '/join/ABCD2345', disableRedirect: true }),
      })
      assert.equal(response.status, 200)
    })
    await t.test('untrusted origin on cookie-bearing requests and untrusted callbacks are rejected', async () => {
      for (const [origin, callbackURL] of [['https://untrusted.example', '/'], [baseURL, 'https://untrusted.example']]) {
        const response = await request('sign-in/social', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin!, Cookie: 'test-cookie=present' },
          body: JSON.stringify({ provider: 'google', callbackURL }),
        })
        assert.equal(response.status, 403)
      }
    })

    // 테스트용 세션만 생성한다. 실제 Google 인증 성공을 검증하는 것은 아니다.
    const context = await auth.$context
    const user = await context.internalAdapter.createUser(
      { name: 'Tester', email: 'tester@example.test', emailVerified: true },
      { method: 'oauth', oauth: { providerId: 'google' } },
    )
    await t.test('auth adapter can persist a provider account in the existing tables', async () => {
      const account = await context.internalAdapter.createAccount({ userId: user.id, providerId: 'google', accountId: 'test-google-subject' })
      assert.equal(account.userId, user.id)
      const rows = await pg.query<{ user_id: string }>('SELECT user_id FROM accounts WHERE id = $1', [account.id])
      assert.equal(rows.rows[0]?.user_id, user.id)
    })
    await pg.query(`INSERT INTO sessions (id, user_id, token, expires_at) VALUES
      ('active', $1, 'active-token', now() + interval '1 day'),
      ('expired', $1, 'expired-token', now() - interval '1 day')`, [user.id])
    const cookie = async (token: string) => `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, secret)}`)}`
    await t.test('signed session resolves the internal user; expired and tampered sessions do not', async () => {
      const response = await request('get-session', { headers: { Cookie: await cookie('active-token') } })
      assert.equal(response.status, 200)
      const body = await response.json() as { user: { id: string } }
      assert.equal(body.user.id, user.id)
      const key = await app.request(`${baseURL}/api/me/push`, { headers: { Cookie: await cookie('active-token') } })
      assert.equal(key.status, 200)
      assert.deepEqual(await key.json(), { publicKey: 'PUBLIC' })
      for (const value of [await cookie('expired-token'), `${context.authCookies.sessionToken.name}=tampered`]) {
        const invalid = await request('get-session', { headers: { Cookie: value } })
        assert.equal(await invalid.json(), null)
      }
    })
    await t.test('logout revokes the stored session and clears its cookie', async () => {
      const headers = { Origin: baseURL, Cookie: await cookie('active-token') }
      const response = await request('sign-out', { method: 'POST', headers })
      assert.equal(response.status, 200)
      assert.match(response.headers.get('set-cookie') ?? '', /Max-Age=0/i)
      const session = await request('get-session', { headers })
      assert.equal(await session.json(), null)
      assert.equal((await app.request(`${baseURL}/api/me/push`, { headers })).status, 401)
      const rows = await pg.query("SELECT id FROM sessions WHERE id = 'active'")
      assert.equal(rows.rows.length, 0)
    })
    await t.test('password signup is not enabled', async () => {
      const response = await request('sign-up/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: baseURL },
        body: JSON.stringify({ name: 'No', email: 'no@example.test', password: 'not-enabled-123' }),
      })
      assert.notEqual(response.status, 200)
      const rows = await pg.query("SELECT id FROM users WHERE email = 'no@example.test'")
      assert.equal(rows.rows.length, 0)
    })
  } finally {
    await pg.close()
  }
})
```

`apps/api/src/http/boundary.test.ts`를 다음으로 바꾼다. 남는 변경 라우트는 휴대폰 알림뿐이라 최소 개수를 1로 두고, 공개 경로 개수 검사와 배송 webhook 예외를 뺐다. 변경 라우트를 더하는 작업이 이 수를 올린다.

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { z } from 'zod'
import { createApp, type AppOptions } from '../app.js'
import { createPushRoutes } from '../push/routes.js'
import { bodyLimitOf, MAX_BODY_BYTES } from './guard.js'
import { json } from './validate.js'

// 공통 가드가 거는 곳: 로그인한 구성원의 경로, 로그인한 사람 자신의 경로(휴대폰 알림), 로그인 없이 쓰는 공개 경로
const guarded = ['/api/organizations/', '/api/me/', '/api/public/']
const isGuarded = (path: string) => guarded.some(prefix => path.startsWith(prefix))
// 공통 가드 밖의 변경 라우트. 새 항목은 가드를 대신할 자체 검사가 있어야 한다.
const outsideGuard = new Map([
  ['ALL /api/auth/*', '인증 본문 크기 제한 미들웨어'],
  ['POST /api/auth/*', 'better-auth가 출처를 직접 검사한다'],
])
const readOnly = new Set(['GET', 'HEAD', 'OPTIONS'])

test('모든 변경 라우트는 출처·형식·크기·JSON·모르는 키를 인증 전에 거절한다', async () => {
  const origin = 'http://127.0.0.1:5180'
  let authCalls = 0
  const session = async () => { authCalls++; return null }
  // AppOptions에 모듈이 추가되면 여기서 타입 오류가 나므로 이 테스트에서 빠질 수 없다.
  const modules = {
    push: createPushRoutes(session, 'PUBLIC', async () => ({ result: 'sent' }), async () => {}),
  } satisfies Required<Omit<AppOptions, 'auth' | 'trustedOrigin'>>
  const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, ...modules })
  const writes = [...new Set(app.routes.filter(route => !readOnly.has(route.method)).map(route => `${route.method} ${route.path}`))]
  const pathOf = (key: string) => key.slice(key.indexOf(' ') + 1)
  for (const key of writes) {
    assert.ok(isGuarded(pathOf(key)) || outsideGuard.has(key), `${key}: 공통 가드 밖의 변경 라우트는 outsideGuard에 이유와 함께 적는다`)
  }
  for (const key of outsideGuard.keys()) assert.ok(writes.includes(key), `${key}: 없는 라우트가 outsideGuard에 남아 있다`)
  // 미들웨어 등록(/*)은 빼고 실제 라우트만 검사한다.
  const mutating = writes.filter(key => isGuarded(pathOf(key)) && !key.endsWith('/*'))
  // 목록이 비어 테스트가 저절로 통과하는 일을 막는다. 변경 라우트를 더하면 이 수도 올린다.
  assert.ok(mutating.length >= 1, `변경 라우트 ${mutating.length}개`)
  for (const key of mutating) {
    const registered = key.slice(0, key.indexOf(' '))
    // app.all()로 등록한 라우트는 POST로 확인한다.
    const method = registered === 'ALL' ? 'POST' : registered
    const path = pathOf(key).replace(/:[^/]+/g, 'probe')
    const send = (headers: Record<string, string>, body: string) => app.request(path, { method, headers, body })
    const jsonHeaders = { 'Content-Type': 'application/json', Origin: origin }
    assert.equal((await send({ ...jsonHeaders, Origin: 'https://evil.test' }, '{}')).status, 403, key)
    assert.equal((await send({ Origin: origin, 'Content-Type': 'text/plain' }, '{}')).status, 415, key)
    // 본문 상한은 경로마다 가드가 정한다. 그 상한을 넘으면 413이다.
    const limit = bodyLimitOf(path)
    assert.equal((await send(jsonHeaders, JSON.stringify({ x: 'a'.repeat(limit + 8) }))).status, 413, key)
    if (limit > MAX_BODY_BYTES) assert.notEqual((await send(jsonHeaders, JSON.stringify({ x: 'a'.repeat(MAX_BODY_BYTES + 8) }))).status, 413, key)
    const before = authCalls
    const malformed = await send(jsonHeaders, '{')
    assert.equal(malformed.status, 400, key)
    assert.deepEqual(await malformed.json(), { error: 'INVALID_INPUT' }, key)
    assert.equal((await send(jsonHeaders, '{"__probe":1}')).status, 400, key)
    assert.equal(authCalls, before, `${key}: 형식 검사가 인증보다 먼저여야 한다`)
  }
})

test('본문 상한은 가드 한 곳에서 경로마다 정한다: 학생회비 명단은 1 MiB, 회고 저장은 64 KiB이다', () => {
  assert.equal(bodyLimitOf('/api/organizations/a/dues-roster'), 1_048_576)
  assert.equal(bodyLimitOf('/api/organizations/a/events/e/report/retrospective'), 65_536)
  for (const path of ['/api/organizations/a/dues-roster/delete', '/api/organizations/a/expenses', '/api/public/registrations/lookup',
    '/api/organizations/a/b/dues-roster', '/api/organizations//dues-roster', '/api/organizations/a/events/e/report',
    '/api/organizations/a/events/e/report/retrospective/generate', '/api/organizations/a/events/e/report/retrospective/confirm',
    '/api/organizations/a/events//report/retrospective', '/api/organizations/a/events/e/report/retrospectives']) {
    assert.equal(bodyLimitOf(path), MAX_BODY_BYTES, path)
  }
})

test('json()은 모르는 키를 조용히 버리는 스키마를 라우트 생성 시점에 거부한다', () => {
  assert.throws(() => json(z.object({ title: z.string() })))
  assert.throws(() => json(z.looseObject({ title: z.string() })))
  assert.doesNotThrow(() => json(z.strictObject({ title: z.string() })))
})
```

`apps/api/package.json`의 `scripts`를 다음으로 바꾼다(배송 실행기, 시험·시연 데이터 스크립트를 뺐다. 시험 데이터는 Task 14가 다시 쓴다. 옮긴 영수증 저장소 시험은 남긴다). 덩어리 1이 `test`에 더한 푸시 시험 파일이 이 목록과 다르면 실제 파일들을 그대로 둔다.

```json
  "scripts": {
    "dev": "tsx watch src/serve.ts",
    "start": "tsx src/serve.ts --production",
    "typecheck": "tsc --noEmit",
    "test": "tsx --test src/app.test.ts src/runtime.test.ts src/web.test.ts src/auth/auth.test.ts src/http/boundary.test.ts src/http/sentry.test.ts src/storage/storage.test.ts src/push/config.test.ts src/push/endpoint.test.ts src/push/sender.test.ts src/push/routes.test.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/db/migrate.ts"
  },
```

Run: `cd apps/api && npx tsc --noEmit && npx tsx --test --test-concurrency=2 $(node -p "require('./package.json').scripts.test.replace('tsx --test ', '')")`
Expected: 타입 오류 없음, `# fail 0`(영수증 저장소 시험 3개 포함)

- [ ] **Step 5: 계약의 옛 스키마를 지운다**

Run:
```bash
git rm -q packages/contracts/src/{budget,chat,coupang,deliveries,events,expenses,fees,home,incomes,invites,organizations,purchases,registrations,reports,settlement,tasks}.ts
git rm -q packages/contracts/src/{budget,coupang,expenses,fees,incomes,registrations,reports,settlement,tasks}.test.ts
```

`packages/contracts/src/index.ts`를 다음으로 바꾼다:

```ts
export { codePoints, isStrictObject, text, token } from './input.js'
export { koreanDateTime, dateFromKorean, koreanOf } from './korean-time.js'
export { PUSH_ENDPOINT_MAX, PUSH_TEST_RESULTS, PushSubscriptionSchema, type PushSubscriptionRequest, type PushTestResult,
  type PushKeyResponse, type PushTestResponse } from './push.js'
export interface HealthResponse {
  status: 'ok'
}
```

`packages/contracts/src/input.test.ts`를 다음으로 바꾼다(지운 스키마의 시험을 뺐다. 초대 코드 시험은 Task 7이 `invites.test.ts`로 다시 쓴다):

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import fc from 'fast-check'
import { z } from 'zod'
import { codePoints, isStrictObject, text, token } from './input.js'
// 홀로 쓰인 서러게이트까지 만들도록 UTF-16 코드 단위를 직접 뽑는다.
const anyText = fc.string({ unit: fc.integer({ min: 0, max: 0xffff }).map(n => String.fromCharCode(n)), maxLength: 120 })

test('text: 앞뒤 공백 제거 후 1..max 코드 포인트, NUL·홀로 쓰인 서러게이트 없음일 때만 통과한다', () => {
  const schema = text(50)
  fc.assert(fc.property(anyText, value => {
    const trimmed = value.trim()
    const expected = trimmed.length > 0 && codePoints(trimmed) <= 50 && !/[\u0000\uD800-\uDFFF]/u.test(value)
    const result = schema.safeParse(value)
    assert.equal(result.success, expected)
    if (result.success) assert.equal(result.data, trimmed)
  }))
})

test('token: 원문 max 이하, 제어 문자 없음, 공백 제거 후 1자 이상일 때만 통과한다', () => {
  const schema = token(40)
  fc.assert(fc.property(anyText, value => {
    const expected = value.length <= 40 && !/[\u0000-\u001f\u007f\uD800-\uDFFF]/u.test(value) && value.trim().length > 0
    const result = schema.safeParse(value)
    assert.equal(result.success, expected)
    if (result.success) assert.equal(result.data, value.trim())
  }))
})

test('문자열이 아닌 값은 거부한다', () => {
  for (const value of [null, undefined, 1, true, [], {}]) {
    assert.equal(text(10).safeParse(value).success, false)
    assert.equal(token(10).safeParse(value).success, false)
  }
})

test('isStrictObject: 모르는 키를 거부하는 z.strictObject만 참이다', () => {
  assert.equal(isStrictObject(z.strictObject({ a: z.string() })), true)
  for (const schema of [z.object({ a: z.string() }), z.looseObject({ a: z.string() }), z.string(), null, {}]) {
    assert.equal(isStrictObject(schema), false)
  }
})
```

`packages/contracts/package.json`의 `test`를 다음으로 바꾼다:

```json
  "scripts": { "typecheck": "tsc --noEmit", "test": "tsx --test src/input.test.ts src/push.test.ts" },
```

Run: `npm test --workspace @vada/contracts && npm run typecheck --workspace @vada/contracts`
Expected: PASS(시험 6개), 타입 오류 없음

- [ ] **Step 6: 화면의 옛 기능을 지우고 로그인 뒤 화면을 바꾼다**

Run:
```bash
git rm -r -q apps/web/src/{access,budget,chat,events,deliveries,purchases,expenses,settlement,registrations,fees,tasks,home,records,organization,public,workspace}
git rm -q apps/web/src/App.integration.test.tsx apps/web/src/test-support/workflow-fixtures.ts apps/web/src/components/{AccountInfo,QrCode,StatGrid}.tsx
```

`apps/web/src/App.tsx`를 다음으로 바꾼다. 로그인 부분(LoginPanel, 홈 화면 앱 안 로그인, 세션 다시 읽기)은 덩어리 1 Task 5·6의 코드를 그대로 옮겼다. 덩어리 1의 실제 파일과 로그인 부분이 다르면 실제 파일의 로그인 부분을 따른다.

```tsx
import { useEffect, useState, type ReactNode } from 'react'
import { authClient } from './auth/auth-client'
import LoginPanel from './auth/LoginPanel'
import { AUTH_CHANNEL, AUTH_DONE_PATH, startPopupLogin } from './auth/popup-login'
import PushSettingsButton from './push/PushSettings'
import StateMessage from '@/components/StateMessage'
import { AuthCard } from '@/components/AuthCard'
import { BrandMark } from '@/components/BrandMark'
import { Button } from '@/components/ui/button'
import { isKakaoInAppBrowser } from '@/lib/in-app-browser'
import { isIosHomeScreenApp } from '@/lib/platform'

// 로그인 전후의 가운데 카드 화면. 와이어프레임 SIGN-IN·INV-00과 같은 틀이다.
function AuthPage({ children }: { children: ReactNode }) {
  return <main className="flex min-h-dvh items-center justify-center p-4 sm:py-12">
    <AuthCard>
      <div className="flex flex-wrap items-center gap-2">
        <BrandMark />
        <h1 className="text-base font-semibold text-gray-900">VADA</h1>
        <p className="ml-auto text-xs text-gray-400">학생회를 위한 공간</p>
      </div>
      {children}
    </AuthCard>
  </main>
}

export default function App() {
  const { data: session, isPending, error, refetch } = authClient.useSession()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(() => new URLSearchParams(window.location.search).has('error')
    ? '로그인이 완료되지 않았어요. 다시 시도해 주세요.' : '')
  const [homeScreenApp] = useState(() => isIosHomeScreenApp(navigator as { standalone?: boolean }))
  // iOS 홈 화면 앱: 로그인 창이 알리거나 앱이 다시 보이면 세션을 다시 읽는다.
  useEffect(() => {
    if (!homeScreenApp || session) return
    const recheck = () => { void refetch() }
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(AUTH_CHANNEL)
    if (channel) channel.onmessage = recheck
    const onVisible = () => { if (document.visibilityState === 'visible') recheck() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { channel?.close(); document.removeEventListener('visibilitychange', onVisible) }
  }, [homeScreenApp, session, refetch])

  async function login() {
    setBusy(true)
    setMessage('')
    try {
      const result = await authClient.signIn.social({ provider: 'google', callbackURL: '/', errorCallbackURL: '/' })
      if (result.error) throw new Error('Sign-in failed')
    } catch {
      setMessage('로그인을 시작하지 못했어요. 연결을 확인하고 다시 시도해 주세요.')
      setBusy(false)
    }
  }

  // iOS 홈 화면 앱: 누른 순간 앱 안 창을 열고 그 창에서 Google 로그인을 한다(휴대폰 길 spec 길 B).
  async function loginInApp() {
    setBusy(true)
    setMessage('')
    const result = await startPopupLogin(() => window.open('about:blank', '_blank'),
      () => authClient.signIn.social({ provider: 'google', callbackURL: AUTH_DONE_PATH, errorCallbackURL: `${AUTH_DONE_PATH}?error=1`, disableRedirect: true }))
    setBusy(false)
    if (result === 'blocked') setMessage('로그인 창을 열지 못했어요. 다른 방법으로 로그인해 주세요.')
    if (result === 'failed') setMessage('로그인을 시작하지 못했어요. 연결을 확인하고 다시 시도해 주세요.')
  }

  async function logout() {
    setBusy(true)
    setMessage('')
    try {
      const result = await authClient.signOut()
      if (result.error) throw new Error('Sign-out failed')
    } catch {
      setMessage('로그아웃하지 못했어요. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  // 바탕을 만드는 동안 로그인한 사람에게는 학생회가 없다는 안내와 휴대폰 알림만 보인다(바탕 spec '옛 기능 지우기').
  if (!isPending && !error && session) return <AuthPage>
    <div className="flex flex-col gap-0.5 rounded-md bg-gray-50 px-3 py-2">
      <h2 className="text-xs font-medium text-gray-500">로그인 완료</h2>
      <p className="text-sm font-medium text-gray-900">{session.user.name}</p>
      <p className="text-xs wrap-anywhere text-gray-500">{session.user.email}</p>
    </div>
    <p className="text-sm text-gray-500">아직 들어간 학생회가 없어요.</p>
    <div className="flex items-center gap-2">
      <PushSettingsButton />
      <Button variant="outline" className="flex-1" disabled={busy} onClick={() => { void logout() }}>{busy ? '로그아웃 중…' : '로그아웃'}</Button>
    </div>
    {message && <StateMessage kind="error">{message}</StateMessage>}
  </AuthPage>

  return <AuthPage>
    {isPending ? <StateMessage kind="loading">로그인 상태 확인 중…</StateMessage> : error ? <div className="flex flex-col gap-3">
      <StateMessage kind="error">세션을 확인하지 못했어요. 서버 연결을 확인해 주세요.</StateMessage>
      <Button onClick={() => { void refetch() }}>다시 확인</Button>
    </div> : <LoginPanel kakao={isKakaoInAppBrowser(navigator.userAgent)} homeScreenApp={homeScreenApp} busy={busy}
      onLogin={() => { void login() }} onLoginInApp={() => { void loginInApp() }} />}
    {message && <StateMessage kind="error">{message}</StateMessage>}
  </AuthPage>
}
```

`apps/web/src/main.tsx`를 다음으로 바꾼다(공개 신청 화면을 뺐다. 모든 화면이 로그인을 쓰므로 카카오톡이면 늘 바깥 브라우저로 넘긴다):

```tsx
import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { isKakaoInAppBrowser, openOutsideKakao } from '@/lib/in-app-browser'
import { registerServiceWorker } from '@/lib/service-worker'
import { AUTH_DONE_PATH } from './auth/popup-login'
import './index.css'

const App = lazy(() => import('./App'))
const AuthDone = lazy(() => import('./auth/AuthDone'))
// 홈 화면 앱 안 창에서 로그인이 끝나면 오는 곳이다(휴대폰 길 spec).
const authDone = window.location.pathname === AUTH_DONE_PATH
// 카카오톡에서 연 링크는 구글 로그인이 막히므로 기본 브라우저로 넘긴다. 넘어가지 못해도 화면은 그린다.
if (!authDone && isKakaoInAppBrowser(navigator.userAgent)) openOutsideKakao(navigator.userAgent, window.location)
// 휴대폰 알림을 받을 서비스 워커
if (!authDone) registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>{authDone ? <AuthDone failed={new URLSearchParams(window.location.search).has('error')} /> : <App />}</Suspense>
  </StrictMode>,
)
```

`apps/web/src/lib/qr-code.test.ts`를 다음으로 바꾼다(지운 `registrations/qr-reader`와 `checkInQrText`에 기대지 않는다, P2):

```ts
// @vitest-environment node
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { expect, test } from 'vitest'
import { prepareZXingModule, readBarcodes, type ReaderOptions } from 'zxing-wasm/reader'
import { qrMatrix } from './qr-code'

// 참석 확인 QR을 읽던 스캐너의 설정과 글자 모양이다(참가 신청은 덩어리 7에서 다시 만든다).
const readerOptions: ReaderOptions = { formats: ['QRCode'], tryHarder: true, maxNumberOfSymbols: 1 }
const checkInText = `VADA:${'0123456789ABCDEF'.repeat(4)}`

// 칸 하나를 scale 픽셀로 그린 흑백 그림(RGBA). 스캐너가 캔버스에서 꺼내는 그림과 같은 모양이다.
function imageOf(matrix: boolean[][], scale = 4) {
  const size = matrix.length * scale
  const data = new Uint8ClampedArray(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const value = matrix[Math.floor(y / scale)]![Math.floor(x / scale)] ? 0 : 255
    data.set([value, value, value, 255], (y * size + x) * 4)
  }
  return { data, width: size, height: size, colorSpace: 'srgb' as const }
}

test('QrCode가 그리는 칸을 스캐너의 판독기로 읽으면 같은 글자가 나온다', async () => {
  const wasm = readFileSync(createRequire(import.meta.url).resolve('zxing-wasm/reader/zxing_reader.wasm'))
  await prepareZXingModule({ overrides: { wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) }, fireImmediately: true })
  const text = checkInText
  const matrix = qrMatrix(text)
  // 대문자라 영숫자 모드: 버전 4(33칸) + 여백 2칸씩
  expect(matrix.length).toBe(37)
  const [result] = await readBarcodes(imageOf(matrix), readerOptions)
  expect(result?.text).toBe(text)
})
```

`apps/web/src/ui-gallery/Gallery.tsx`에서:

1. 다음 import 네 줄을 지운다:
```tsx
import { checkInQrText } from '@vada/contracts'
import { AccountInfo } from '@/components/AccountInfo'
import { QrCode } from '@/components/QrCode'
import { StatGrid } from '@/components/StatGrid'
```
2. 다음 세 묶음을 지운다(`<Section title="카드·배너">` 바로 앞까지):
```tsx
    <Section title="숫자 묶음">
      <StatGrid label="예시 숫자" className="w-96 grid-cols-2 gap-3" stats={[
        { label: '예산', value: '3,000,000원', action: <Button variant="outline" size="sm" className="mt-1 self-start">예산 정하기</Button> },
        { label: '실제 지출', value: '950,000원' },
        { label: '지출 예정', value: '1,100,000원', note: '금액을 모르는 품목 2개 제외' },
        { label: '남은 예산', value: '120,000원 초과', tone: 'danger' },
      ]} />
    </Section>
    <Section title="계좌 상자">
      <AccountInfo className="w-80" account={{ bank: '카카오뱅크', accountNumber: '3333-01-1234567', holder: '소프트웨어융합대학 컴퓨터학부 학생회 집행부' }} />
    </Section>
    <Section title="QR">
      <QrCode className="size-48" value={checkInQrText('0123456789abcdef'.repeat(4))} label="참석 확인 QR 예시" />
    </Section>
```

`apps/web/src/ui-gallery/Gallery.test.tsx`에서:

1. 첫 시험의 이름 목록에서 `'숫자 묶음', '계좌 상자', 'QR', `을 지운다. 다 하면 다음과 같다(덩어리 1 005e2ca의 '카톡 안 로그인'은 남는다):
```tsx
  for (const name of ['버튼', '입력', '칩', '카드·배너', '메뉴·탭', '빈 화면·아바타·로고', '대화상자·옆 메뉴', '상태 문구', '휴대폰 알림', '인증 카드',
    '카톡 안 로그인', '긴 글', '숨김']) {
```
2. 맨 끝의 두 시험 `'숫자 묶음은 이름 붙은 영역에…'`과 `'계좌 상자는 은행·번호·예금주와…'`를 통째로 지운다.

Run: `cd apps/web && npx tsc --noEmit && npx vitest run`
Expected: 타입 오류 없음, 실패 0(`App.test.tsx` 10개 통과)

- [ ] **Step 7: 배송 도구와 옛 모델 문서, README, CI 설정, 저장소 규칙을 정리한다**

옛 모델(옛 표와 구매 모델)을 설명하는 문서도 지운다. 에이전트가 읽고 옛 구조를 따라가지 않게 하려는 것이다(P35). `.env.example`은 열지 않는다.

Run:
```bash
git rm -q .github/workflows/delivery-worker.yml docs/delivery-api.md docs/delivery-tracking-discovery.md docs/delivery-webhook-test.md docs/delivery-worker.md
git rm -q docs/ERD.md docs/purchase-model.md docs/purchase-benchmark.md
git rm -r -q scripts
```

`README.md`를 다음으로 바꾼다(옛 파일 목록 대신 남는 폴더의 지도. 바탕에서 생기는 폴더는 Task 14가 더한다):

````markdown
```text
vada-m1/
├─ AGENTS.md                  # 저장소 규칙. 에이전트와 사람이 같이 따른다
├─ .github/workflows/         # CI
├─ apps/
│  ├─ api/                    # API 서버(Hono, better-auth, drizzle)
│  │  ├─ migrations/          # 마이그레이션(.sql은 LF)
│  │  └─ src/
│  │     ├─ auth/             # Google 로그인과 세션 확인
│  │     ├─ db/               # 조회용 표 정의, 마이그레이션 적용
│  │     ├─ http/             # 공통 가드, 입력 검사, 오류 처리, Sentry
│  │     ├─ push/             # 휴대폰 알림(웹 푸시)
│  │     └─ storage/          # 영수증 저장소(R2). 쓰는 기능은 구매와 지출 덩어리가 다시 만든다
│  └─ web/                    # 화면(React, Vite, Tailwind)
│     ├─ public/              # 홈 화면 설정, 아이콘, 서비스 워커
│     └─ src/
│        ├─ auth/             # 로그인 화면
│        ├─ components/       # 화면 부품(ui/는 기본 부품)
│        ├─ lib/
│        ├─ push/             # 휴대폰 알림 대화상자
│        ├─ test-support/
│        └─ ui-gallery/       # 부품 확인 화면(/ui.html)
├─ docs/
│  ├─ device-checks.md        # 실제 기기 확인 기록
│  └─ superpowers/            # 설계서(specs)와 구현 계획(plans)
└─ packages/
   └─ contracts/              # 요청 스키마와 응답 타입(zod). 화면과 서버가 같이 쓴다
```
````

`.github/workflows/ci.yml`의 `Start in production mode` 단계 `env:`에서 다음 여섯 줄을 지운다(P3):
```yaml
          DELIVERY_ENABLED: 'true'
          DELIVERY_TRACKING_ENABLED: 'true'
          DELIVERY_PUBLIC_URL: https://vada.invalid
          DELIVERY_WEBHOOK_SECRET: ci-start-smoke-webhook-secret-0123456789
          DELIVERY_TRACKER_CLIENT_ID: ci-start-smoke
          DELIVERY_TRACKER_CLIENT_SECRET: ci-start-smoke
```

`AGENTS.md`의 "새 API를 만들 때" 절에서 "- 행사 기록을 바꾸는 라우트는"으로 시작하는 줄(행사 잠금 규칙, `events/lock.ts`와 `completion-lock.test.ts`를 가리킨다) 하나를 통째로 지운다(P3).

- [ ] **Step 8: 전체 검사를 돌린다**

Run: `npm run typecheck`
Expected: 타입 오류 없음

Run: `cd apps/api && npx tsx --test --test-concurrency=2 $(node -p "require('./package.json').scripts.test.replace('tsx --test ', '')")`
Expected: `# fail 0`

Run: `npm test --workspace @vada/contracts && npm test --workspace @vada/web && npm run build`
Expected: PASS, 실패 0, 빌드 성공

Run: `git grep -n -e "access/" -e "organization/" -e "workflow-fixtures" -e "checkInQrText" -e "r2ConfigFrom" -- apps packages ':!apps/api/src/storage'`
Expected: 아무것도 나오지 않는다(영수증 저장소는 `storage/` 안에만 있다).

Run: `git grep -n -e "ERD.md" -e "purchase-model" -e "purchase-benchmark" -- README.md AGENTS.md docs apps packages ':!docs/superpowers'`
Expected: 아무것도 나오지 않는다(지난 계획·설계서의 언급은 기록이라 둔다, P35).

- [ ] **Step 9: 커밋**

```bash
git add -A apps packages .github AGENTS.md README.md
git commit -m "옛 기능 모듈과 화면, 계약, 배송 도구 지우기"
```

---

### Task 2: 첫 마이그레이션과 시험 DB 도우미

옛 마이그레이션 29개와 journal, snapshot을 지우고 `0000_baseline.sql` 하나로 새로 시작한다. 로그인 표 4개는 지금 정의 그대로, 설계 SQL 블록은 스크립트가 vada-docs에서 뽑고, 설계 밖 표 3개는 spec 그대로다. 설계에는 이름 칸의 길이 CHECK(계약과 같은 값)가 있어 그대로 들어간다(P28). 시험 DB는 btree_gist를 켠 PGlite에 이 마이그레이션을 적용한 것이다.

**Files:**
- Create: `apps/api/scripts/design-sql.ts`, `apps/api/scripts/design-sql.test.ts`
- Create: `apps/api/scripts/baseline-from-design.ts`
- Delete: `apps/api/migrations/0000_rare_cardiac.sql` … `0028_drop_event_reports.sql`(29개), `apps/api/migrations/meta/*_snapshot.json`(29개)
- Create(스크립트가 만든다): `apps/api/migrations/0000_baseline.sql`
- Modify: `apps/api/migrations/meta/_journal.json`
- Create: `apps/api/src/db/test-db.ts`, `apps/api/src/db/baseline.test.ts`
- Modify: `apps/api/src/auth/auth.test.ts`, `apps/api/package.json`

**Interfaces:**
- Consumes: 없음(Task 1의 로그인 표 정의와 같은 DDL을 쓴다)
- Produces:
  - `BREAKPOINT = '--> statement-breakpoint'`, `AUTH_TABLES`, `OUTSIDE_TABLES`, `NOT_IN_DESIGN: ReadonlySet<string>`(설계 밖 표 7개), `AUTH_STATEMENTS: string[]`, `OUTSIDE_STATEMENTS: string[]`
  - `designBlock(markdown: string): string`, `splitStatements(sql: string): string[]`, `joinStatements(statements: readonly string[]): string`, `baselineOf(designMarkdown: string): string`
  - `migrationsFolder: string`, `createTestDb(): Promise<{ pg: PGlite; db: PgliteDatabase; close: () => Promise<void> }>`, `type TestDb`

- [ ] **Step 1: vada-docs가 맞는 판인지 본다**

Run: `git -C ../vada-docs merge-base --is-ancestor 5198ef5 HEAD && echo "5198ef5 이후" && grep -c "CREATE UNIQUE INDEX ON council_membership" ../vada-docs/physical-model.md && grep -c "char_length(" ../vada-docs/physical-model.md`
Expected: `5198ef5 이후`, `1`, `9`(작성 규칙 한 줄 + 학생회 이름·학교·직급 표시 이름 넷·기수 이름·부서 이름). 아무것도 안 찍히거나 숫자가 다르면 멈추고 알린다(이름 칸 길이 CHECK나 회장 부분 유일 인덱스가 없는 설계다). worktree에서는 `../vada-docs` 대신 vada-docs 폴더 경로를 쓴다.

- [ ] **Step 2: 실패하는 시험을 쓴다 — 설계 SQL 뽑기와 나누기**

`apps/api/scripts/design-sql.test.ts`:

````ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AUTH_STATEMENTS, BREAKPOINT, NOT_IN_DESIGN, OUTSIDE_STATEMENTS, baselineOf, designBlock, joinStatements, splitStatements } from './design-sql.js'

const markdown = [
  '# physical-model.md',
  '',
  '```sql',
  'CREATE EXTENSION IF NOT EXISTS btree_gist;',
  '',
  '-- 공통 ----',
  '',
  'CREATE TABLE a (',
  '  id uuid PRIMARY KEY,  -- 설명',
  '  kind text NOT NULL',
  ');',
  'CREATE UNIQUE INDEX ON a (id) WHERE kind = \'x\';  -- 끝에 붙은 주석',
  '-- 주석 줄의 ;은 문장의 끝이 아니다;',
  'CREATE INDEX ON a (kind);',
  '```',
  '',
  '```sql',
  'CREATE TABLE ignored (id int);',
  '```',
].join('\r\n')

test('designBlock은 첫 SQL 블록을 LF로 꺼낸다', () => {
  const block = designBlock(markdown)
  assert.ok(block.startsWith('CREATE EXTENSION IF NOT EXISTS btree_gist;'))
  assert.ok(block.endsWith('CREATE INDEX ON a (kind);'))
  assert.ok(!block.includes('\r'))
  assert.ok(!block.includes('ignored'))
  assert.throws(() => designBlock('# 표 없음'))
  assert.throws(() => designBlock('```sql\nCREATE TABLE a (id int);'))
})

test('splitStatements는 줄 끝 ;에서 나누고, 끝에 붙은 주석과 앞의 주석 줄을 그 문장에 둔다', () => {
  const statements = splitStatements(designBlock(markdown))
  assert.deepEqual(statements, [
    'CREATE EXTENSION IF NOT EXISTS btree_gist;',
    '-- 공통 ----\n\nCREATE TABLE a (\n  id uuid PRIMARY KEY,  -- 설명\n  kind text NOT NULL\n);',
    'CREATE UNIQUE INDEX ON a (id) WHERE kind = \'x\';  -- 끝에 붙은 주석',
    '-- 주석 줄의 ;은 문장의 끝이 아니다;\nCREATE INDEX ON a (kind);',
  ])
  assert.throws(() => splitStatements('CREATE TABLE a (id int)'))
  assert.deepEqual(splitStatements('CREATE TABLE a (id int);\n-- 끝의 주석만 남으면 버린다\n'), ['CREATE TABLE a (id int);'])
})

test('baselineOf는 로그인 표, 설계 블록, 설계 밖 표 순서로 문장 사이에만 표시를 넣는다', () => {
  const sql = baselineOf(markdown)
  assert.ok(!sql.includes('\r'))
  assert.ok(sql.endsWith('CREATE INDEX ON push_device (user_id);\n'))
  const pieces = sql.split(BREAKPOINT)
  assert.equal(pieces.length, AUTH_STATEMENTS.length + 4 + OUTSIDE_STATEMENTS.length)
  assert.ok(pieces[0]!.includes('CREATE TABLE "users"'))
  assert.ok(pieces[AUTH_STATEMENTS.length]!.includes('CREATE EXTENSION IF NOT EXISTS btree_gist;'))
  assert.ok(pieces[AUTH_STATEMENTS.length + 4]!.includes('CREATE TABLE member_login'))
  assert.equal(joinStatements(['a;', 'b;']), `a;\n${BREAKPOINT}\nb;`)
})

test('설계 검사에서 빼는 표는 로그인 표 4개와 설계 밖 표 3개다', () => {
  assert.deepEqual([...NOT_IN_DESIGN].sort(), ['accounts', 'invite_code', 'member_login', 'push_device', 'sessions', 'users', 'verifications'])
})
````

Run: `cd apps/api && npx tsx --test scripts/design-sql.test.ts`
Expected: FAIL (`Cannot find module` … `design-sql.js`)

- [ ] **Step 3: 설계 SQL 모듈과 생성 스크립트를 만든다**

`apps/api/scripts/design-sql.ts`:

````ts
// 첫 마이그레이션(0000_baseline.sql)의 재료. 설계 SQL 블록을 뽑고 문장으로 나누는 순수 함수와, 설계 밖 표의 SQL을 둔다.
// 설계 SQL은 손으로 옮기지 않는다(다시 만들기 설계서). baseline-from-design.ts와 check-design.ts가 같이 쓴다.

// drizzle 마이그레이터는 이 표시로 파일을 잘라 한 조각씩 실행한다. 조각마다 문장 하나를 둔다.
export const BREAKPOINT = '--> statement-breakpoint'

// 설계 검사에서 뺄 표: 로그인 표 4개와 설계 밖 표 3개(바탕 spec G11)
export const AUTH_TABLES = ['users', 'accounts', 'sessions', 'verifications'] as const
export const OUTSIDE_TABLES = ['member_login', 'invite_code', 'push_device'] as const
export const NOT_IN_DESIGN: ReadonlySet<string> = new Set([...AUTH_TABLES, ...OUTSIDE_TABLES])

// 로그인 표 4개. 옛 0000_rare_cardiac.sql과 0001_auth.sql의 정의 그대로다(better-auth가 쓴다).
export const AUTH_STATEMENTS = [
  `CREATE TABLE "users" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE("email")
);`,
  `CREATE TABLE "accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp with time zone,
  "refresh_token_expires_at" timestamp with time zone,
  "scope" text,
  "password" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "accounts_provider_account_unique" UNIQUE("provider_id","account_id")
);`,
  `CREATE TABLE "sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "token" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sessions_token_unique" UNIQUE("token")
);`,
  `CREATE TABLE "verifications" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);`,
  'ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;',
  'ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;',
  'CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");',
  'CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");',
  'CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");',
]

// 설계 밖 표 3개. 바탕 spec(docs/superpowers/specs/2026-10-19-foundation-design.md)의 '첫 마이그레이션' 그대로다.
export const OUTSIDE_STATEMENTS = [
  `-- 로그인 잇기: 로그인 계정(users)과 운영진(member)을 하나씩 잇는다(G1)
CREATE TABLE member_login (
  member_id uuid PRIMARY KEY REFERENCES member (id),
  user_id   text NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  linked_at timestamptz NOT NULL DEFAULT now()
);`,
  `-- 초대 코드: 학생회마다 하나(G2). 형식은 지금 vada와 같다
CREATE TABLE invite_code (
  council_id uuid PRIMARY KEY REFERENCES council (id),
  code       text NOT NULL UNIQUE CHECK (code ~ '^[2-9A-HJ-NP-Z]{8}$'),
  created_by uuid NOT NULL REFERENCES member (id),
  created_at timestamptz NOT NULL DEFAULT now()
);`,
  'CREATE INDEX ON invite_code (created_by);',
  `-- 알림 받을 기기(G10). 구독 주소는 기기를 가리키는 비밀 주소다
CREATE TABLE push_device (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id         text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  endpoint        text NOT NULL UNIQUE CHECK (char_length(endpoint) <= 1024),
  p256dh          text NOT NULL CHECK (char_length(p256dh) <= 200),
  auth            text NOT NULL CHECK (char_length(auth) <= 100),
  expiration_time timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);`,
  'CREATE INDEX ON push_device (user_id);',
]

// physical-model.md의 첫 SQL 블록(```sql … ```)을 꺼낸다.
export function designBlock(markdown: string): string {
  const text = markdown.replace(/\r\n/g, '\n')
  const start = text.indexOf('```sql\n')
  if (start < 0) throw new Error('physical-model.md에 SQL 블록이 없다')
  const end = text.indexOf('\n```', start + '```sql\n'.length)
  if (end < 0) throw new Error('SQL 블록이 닫히지 않았다')
  return text.slice(start + '```sql\n'.length, end)
}

const comment = /^\s*--/
// 문장은 줄 끝의 ;에서 끝난다(뒤에 -- 주석이 붙어도 된다). 주석 줄의 ;은 문장의 끝이 아니다.
const statementEnd = /;\s*(--.*)?$/

// 블록을 문장으로 나눈다. 문장 앞의 주석 줄은 그 문장에 붙는다. 함수 본문($$)은 설계에 없어 다루지 않는다.
export function splitStatements(sql: string): string[] {
  const statements: string[] = []
  let current: string[] = []
  for (const line of sql.replace(/\r\n/g, '\n').split('\n')) {
    current.push(line)
    if (!comment.test(line) && statementEnd.test(line)) {
      statements.push(current.join('\n').trim())
      current = []
    }
  }
  if (current.some(line => line.trim() && !comment.test(line))) throw new Error('마지막 문장이 ;로 끝나지 않는다')
  return statements
}

// 문장 사이에만 표시를 넣는다. 마지막 문장 뒤에는 넣지 않는다(빈 조각을 실행하지 않게).
export const joinStatements = (statements: readonly string[]) => statements.join(`\n${BREAKPOINT}\n`)

// 0000_baseline.sql의 내용: 로그인 표 4개 → 설계 SQL 블록 → 설계 밖 표 3개. 줄바꿈은 LF다.
export function baselineOf(designMarkdown: string): string {
  const header = [
    '-- 0000_baseline: 첫 마이그레이션. apps/api/scripts/baseline-from-design.ts가 만든다. 손으로 고치지 않는다.',
    '-- 로그인 표 4개(지금 정의 그대로) → vada-docs physical-model.md의 SQL 블록 → 설계 밖 표 3개(바탕 spec).',
  ].join('\n')
  const statements = [...AUTH_STATEMENTS, ...splitStatements(designBlock(designMarkdown)), ...OUTSIDE_STATEMENTS]
  return `${header}\n${joinStatements(statements)}\n`
}
````

`apps/api/scripts/baseline-from-design.ts`:

```ts
// 첫 마이그레이션 apps/api/migrations/0000_baseline.sql을 만든다. 바탕에서 한 번 돌리고 결과를 커밋한다.
// 이 뒤로 표를 바꿀 때는 이 스크립트를 쓰지 않는다. physical-model.md를 먼저 고치고 drizzle-kit generate --custom으로 새 마이그레이션을 쓴다.
// 사용법(apps/api에서): npx tsx scripts/baseline-from-design.ts [physical-model.md 경로]
// 경로를 주지 않으면 이 저장소 옆 폴더 ../vada-docs/physical-model.md를 읽는다.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { baselineOf } from './design-sql.js'

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const designPath = process.argv[2] ? resolve(process.argv[2]) : resolve(repoRoot, '../vada-docs/physical-model.md')
const output = fileURLToPath(new URL('../migrations/0000_baseline.sql', import.meta.url))
writeFileSync(output, baselineOf(readFileSync(designPath, 'utf8')))
console.log(`0000_baseline.sql을 만들었다: ${designPath}`)
```

Run: `cd apps/api && npx tsx --test scripts/design-sql.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 4: 실패하는 DB 시험을 쓴다**

`apps/api/src/db/baseline.test.ts`:

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import type { PGlite } from '@electric-sql/pglite'
import { createTestDb, migrationsFolder } from './test-db.js'

// 기록과 하위 행을 함께 넣는다(vada-docs tools/schema-check/setup.mjs의 recorder와 같다). 기록 모듈은 다음 작업에서 만든다.
const COUNCIL_COLUMN = new Set(['cohort', 'department'])
async function add(pg: PGlite, kind: string, council: string | null, fields: Record<string, unknown>) {
  const { rows } = await pg.query<{ id: string }>('INSERT INTO record (kind, council_id) VALUES ($1, $2) RETURNING id', [kind, council])
  const row: Record<string, unknown> = { id: rows[0]!.id, ...(COUNCIL_COLUMN.has(kind) ? { council_id: council } : {}), ...fields }
  const columns = Object.keys(row)
  await pg.query(`INSERT INTO ${kind} (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(row))
  return rows[0]!.id
}

async function seed(pg: PGlite) {
  const council = await add(pg, 'council', null, { name: '컴퓨터학부 학생회', unit: 'department', school_name: '한양대학교 ERICA' })
  const cohort = await add(pg, 'cohort', council, { name: '2026', starts_on: '2026-01-01', ends_on: '2026-12-31' })
  const member = (name: string) => add(pg, 'member', null, { name, email: `${name}@example.test` })
  return { council, cohort, member }
}

test('첫 마이그레이션은 설계 표 45개와 로그인 표 4개, 설계 밖 표 3개를 만든다', async () => {
  const { pg, close } = await createTestDb()
  try {
    const { rows } = await pg.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name")
    const names = rows.map(row => row.table_name)
    assert.equal(names.length, 52)
    for (const name of ['users', 'accounts', 'sessions', 'verifications', 'member_login', 'invite_code', 'push_device', 'record', 'record_version',
      'council', 'cohort', 'member', 'council_membership', 'department', 'department_membership']) assert.ok(names.includes(name), name)
    const journal = JSON.parse(readFileSync(join(migrationsFolder, 'meta/_journal.json'), 'utf8')) as { entries: { tag: string }[] }
    assert.deepEqual(journal.entries.map(entry => entry.tag), ['0000_baseline'])
    assert.equal((await pg.query('SELECT id FROM drizzle.__drizzle_migrations')).rows.length, 1)
  } finally {
    await close()
  }
})

test('첫 마이그레이션 파일은 LF이고, 조각마다 문장이 하나다', () => {
  const sql = readFileSync(join(migrationsFolder, '0000_baseline.sql'), 'utf8')
  assert.ok(!sql.includes('\r'))
  const pieces = sql.split('--> statement-breakpoint')
  // 로그인 9문장 + 설계 104문장 + 설계 밖 5문장
  assert.equal(pieces.length, 118)
  for (const piece of pieces) {
    const ends = piece.split('\n').filter(line => !/^\s*--/.test(line) && /;\s*(--.*)?$/.test(line))
    assert.equal(ends.length, 1, piece)
  }
})

test('DB가 한 기수의 회장 둘을 막고, 끝난 회장 뒤의 새 회장은 받는다', async () => {
  const { pg, close } = await createTestDb()
  try {
    const { council, cohort, member } = await seed(pg)
    const first = await member('first')
    const second = await member('second')
    const president = (who: string) => add(pg, 'council_membership', council,
      { member_id: who, cohort_id: cohort, council_rank: 'president', starts_at: '2026-01-02' })
    await president(first)
    await assert.rejects(president(second), { code: '23505' })
    await pg.query("UPDATE council_membership SET ends_at = '2026-06-01' WHERE member_id = $1", [first])
    await president(second)
  } finally {
    await close()
  }
})

test('DB가 같은 기록의 판 기간이 겹치는 것을 막고, 이어 붙은 판은 받는다', async () => {
  const { pg, close } = await createTestDb()
  try {
    const { council } = await seed(pg)
    const version = (no: number, range: string) =>
      pg.query(`INSERT INTO record_version (record_id, version_no, valid, data) VALUES ($1, $2, ${range}, '{}')`, [council, no])
    await version(1, "tstzrange('2026-01-01', '2026-02-01')")
    await assert.rejects(version(2, "tstzrange('2026-01-15', NULL)"), { code: '23P01' })
    await version(2, "tstzrange('2026-02-01', NULL)")
  } finally {
    await close()
  }
})

test('DB가 초대 코드 형식(2~9와 I·O를 뺀 대문자 8자)만 받고, 같은 코드를 두 학생회에 주지 않는다', async () => {
  const { pg, close } = await createTestDb()
  try {
    const { council, member } = await seed(pg)
    const other = await add(pg, 'council', null, { name: '경영학부 학생회', unit: 'department', school_name: '한양대학교 ERICA' })
    const creator = await member('creator')
    const insert = (to: string, code: string) => pg.query('INSERT INTO invite_code (council_id, code, created_by) VALUES ($1, $2, $3)', [to, code, creator])
    for (const code of ['abcd2345', 'ABCD234', 'ABCD23456', 'ABCD234O', 'ABCD234I', 'ABCD2340', 'ABCD2341', 'ABCD 234']) {
      await assert.rejects(insert(council, code), { code: '23514' }, code)
    }
    await insert(council, 'ABCD2345')
    await assert.rejects(insert(other, 'ABCD2345'), { code: '23505' })
    await assert.rejects(insert(council, 'WXYZ6789'), { code: '23505' })
  } finally {
    await close()
  }
})

test('DB가 이름 칸의 길이 상한을 막는다(계약과 같은 값: 학생회 이름·학교 50, 직급 표시 이름·기수·부서 이름 20, 이모지도 한 글자)', async () => {
  const { pg, close } = await createTestDb()
  try {
    const { council } = await seed(pg)
    const name = (length: number) => `${'가'.repeat(length - 1)}😀`
    await assert.rejects(add(pg, 'council', null, { name: name(51), unit: 'department', school_name: '학교' }), { code: '23514' })
    await assert.rejects(add(pg, 'council', null, { name: '학생회', unit: 'department', school_name: name(51) }), { code: '23514' })
    await add(pg, 'council', null, { name: name(50), unit: 'department', school_name: name(50) })
    for (const column of ['president_title', 'vice_president_title', 'head_title', 'vice_head_title']) {
      await assert.rejects(pg.query(`UPDATE council SET ${column} = $1 WHERE id = $2`, [name(21), council]), { code: '23514' }, column)
    }
    await assert.rejects(add(pg, 'cohort', council, { name: name(21), starts_on: '2027-01-01', ends_on: '2027-12-31' }), { code: '23514' })
    await assert.rejects(add(pg, 'department', council, { name: name(21) }), { code: '23514' })
    await add(pg, 'department', council, { name: name(20) })
  } finally {
    await close()
  }
})

test('DB가 로그인 계정 하나를 운영진 둘에 잇거나 운영진 하나를 두 계정에 잇는 것을 막는다', async () => {
  const { pg, close } = await createTestDb()
  try {
    const { member } = await seed(pg)
    const kim = await member('kim')
    const lee = await member('lee')
    await pg.query("INSERT INTO users (id, name, email) VALUES ('u1', '김', 'kim@example.test'), ('u2', '이', 'lee@example.test')")
    await pg.query("INSERT INTO member_login (member_id, user_id) VALUES ($1, 'u1')", [kim])
    await assert.rejects(pg.query("INSERT INTO member_login (member_id, user_id) VALUES ($1, 'u1')", [lee]), { code: '23505' })
    await assert.rejects(pg.query("INSERT INTO member_login (member_id, user_id) VALUES ($1, 'u2')", [kim]), { code: '23505' })
    // 로그인 계정을 지우면 잇기만 지운다. 운영진 기록은 남는다.
    await pg.query("DELETE FROM users WHERE id = 'u1'")
    assert.equal((await pg.query('SELECT * FROM member_login')).rows.length, 0)
    assert.equal((await pg.query('SELECT * FROM member WHERE id = $1', [kim])).rows.length, 1)
  } finally {
    await close()
  }
})
```

Run: `cd apps/api && npx tsx --test src/db/baseline.test.ts`
Expected: FAIL (`Cannot find module` … `test-db.js`)

- [ ] **Step 5: 옛 마이그레이션을 지우고 첫 마이그레이션을 만든다**

Run:
```bash
git rm -q apps/api/migrations/0*.sql apps/api/migrations/meta/*_snapshot.json
cd apps/api && npx tsx scripts/baseline-from-design.ts
```
Expected: `0000_baseline.sql을 만들었다: …\vada-docs\physical-model.md`가 찍힌다. worktree에서 하면 vada-docs 경로를 인자로 준다(`npx tsx scripts/baseline-from-design.ts <vada-docs 폴더>/physical-model.md`, P6).

Run: `grep -c "statement-breakpoint" apps/api/migrations/0000_baseline.sql && head -3 apps/api/migrations/0000_baseline.sql && tail -1 apps/api/migrations/0000_baseline.sql`
Expected: `117`(로그인 9 + 설계 104 + 설계 밖 5 = 118문장), 머리 주석 두 줄 뒤 `CREATE TABLE "users" (`, 마지막 줄 `CREATE INDEX ON push_device (user_id);`

Run: `grep -c "char_length(" apps/api/migrations/0000_baseline.sql`
Expected: `11`(설계의 이름 칸 8개 + 알림 기기 3개)

`apps/api/migrations/meta/_journal.json`을 다음으로 바꾼다:

```json
{
  "version": "7",
  "dialect": "postgresql",
  "entries": [
    {
      "idx": 0,
      "version": "7",
      "when": 1792368000000,
      "tag": "0000_baseline",
      "breakpoints": true
    }
  ]
}
```

`apps/api/src/db/test-db.ts`:

```ts
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'

export const migrationsFolder = fileURLToPath(new URL('../../migrations', import.meta.url))

// 마이그레이션을 적용한 DB를 프로세스마다 한 번 만들어 떠 둔다. 새 DB를 처음부터 만들면 이 PC에서 8초쯤 걸리고, 뜬 것을 불러오면 2초쯤 걸린다.
let template: Promise<File | Blob> | undefined
async function migratedTemplate() {
  const pg = await PGlite.create({ extensions: { btree_gist } })
  try {
    await migrate(drizzle(pg), { migrationsFolder })
    return await pg.dumpDataDir('none')
  } finally {
    await pg.close()
  }
}

// 시험 DB. 새 표는 btree_gist 확장이 필요해 new PGlite() 대신 이 도우미만 쓴다(바탕 spec).
// 마이그레이션을 모두 적용한 빈 DB를 시험마다 따로 돌려준다. 다 쓰면 close()로 닫는다.
export async function createTestDb() {
  template ??= migratedTemplate()
  const pg = await PGlite.create({ loadDataDir: await template, extensions: { btree_gist } })
  const db = drizzle(pg)
  return { pg, db, close: () => pg.close() }
}
export type TestDb = Awaited<ReturnType<typeof createTestDb>>
```

- [ ] **Step 6: DB 시험이 통과하는지 본다**

Run: `cd apps/api && npx tsx --test src/db/baseline.test.ts`
Expected: PASS (7 tests). 표 52개(설계 45 + 로그인 4 + 설계 밖 3), 회장 둘 막기, 판 기간 겹침 막기, 초대 코드 형식, 이름 칸 길이 CHECK(51자 학생회 이름은 23514), 로그인 잇기 중복 막기를 본다.

- [ ] **Step 7: 로그인 시험이 시험 DB 도우미를 쓰게 한다**

`apps/api/src/auth/auth.test.ts`를 다음으로 바꾼다(`new PGlite()`와 옛 마이그레이션 대신 `createTestDb()`):

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { makeSignature } from 'better-auth/crypto'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import { createPushRoutes } from '../push/routes.js'
import { createAuth } from './auth.js'

test('auth routes use the existing schema without external services', async (t) => {
  const { pg, db, close } = await createTestDb()
  const secret = 'local-test-only-secret-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const baseURL = 'http://127.0.0.1:5180'
  try {
    const auth = createAuth(db, { secret, baseURL, googleClientId: 'test-client', googleClientSecret: 'test-secret' })
    // 로그인한 사람만 쓰는 경로(휴대폰 알림 열쇠)로 세션 확인을 본다.
    const push = createPushRoutes((headers) => auth.api.getSession({ headers }), 'PUBLIC', async () => ({ result: 'sent' }), async () => {})
    const app = createApp({ auth, trustedOrigin: 'http://127.0.0.1:5180', push })
    const request = (path: string, init?: RequestInit) => app.request(`${baseURL}/api/auth/${path}`, init)

    await t.test('anonymous session is null', async () => {
      const response = await request('get-session')
      assert.equal(response.status, 200)
      assert.equal(await response.json(), null)
      assert.equal((await app.request(`${baseURL}/api/me/push`)).status, 401)
    })
    await t.test('Google login creates OAuth state and uses the configured callback', async () => {
      const response = await request('sign-in/social', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: baseURL },
        body: JSON.stringify({ provider: 'google', callbackURL: '/', disableRedirect: true }),
      })
      assert.equal(response.status, 200)
      const body = await response.json() as { url: string }
      const url = new URL(body.url)
      assert.equal(url.hostname, 'accounts.google.com')
      assert.equal(url.searchParams.get('redirect_uri'), `${baseURL}/api/auth/callback/google`)
      assert.ok(url.searchParams.get('state'))
      assert.ok(response.headers.get('set-cookie'))
    })
    await t.test('초대 링크로 돌아오는 상대 경로 콜백을 허용한다', async () => {
      const response = await request('sign-in/social', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: baseURL },
        body: JSON.stringify({ provider: 'google', callbackURL: '/join/ABCD2345', errorCallbackURL: '/join/ABCD2345', disableRedirect: true }),
      })
      assert.equal(response.status, 200)
    })
    await t.test('untrusted origin on cookie-bearing requests and untrusted callbacks are rejected', async () => {
      for (const [origin, callbackURL] of [['https://untrusted.example', '/'], [baseURL, 'https://untrusted.example']]) {
        const response = await request('sign-in/social', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin!, Cookie: 'test-cookie=present' },
          body: JSON.stringify({ provider: 'google', callbackURL }),
        })
        assert.equal(response.status, 403)
      }
    })

    // 테스트용 세션만 생성한다. 실제 Google 인증 성공을 검증하는 것은 아니다.
    const context = await auth.$context
    const user = await context.internalAdapter.createUser(
      { name: 'Tester', email: 'tester@example.test', emailVerified: true },
      { method: 'oauth', oauth: { providerId: 'google' } },
    )
    await t.test('auth adapter can persist a provider account in the existing tables', async () => {
      const account = await context.internalAdapter.createAccount({ userId: user.id, providerId: 'google', accountId: 'test-google-subject' })
      assert.equal(account.userId, user.id)
      const rows = await pg.query<{ user_id: string }>('SELECT user_id FROM accounts WHERE id = $1', [account.id])
      assert.equal(rows.rows[0]?.user_id, user.id)
    })
    await pg.query(`INSERT INTO sessions (id, user_id, token, expires_at) VALUES
      ('active', $1, 'active-token', now() + interval '1 day'),
      ('expired', $1, 'expired-token', now() - interval '1 day')`, [user.id])
    const cookie = async (token: string) => `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, secret)}`)}`
    await t.test('signed session resolves the internal user; expired and tampered sessions do not', async () => {
      const response = await request('get-session', { headers: { Cookie: await cookie('active-token') } })
      assert.equal(response.status, 200)
      const body = await response.json() as { user: { id: string } }
      assert.equal(body.user.id, user.id)
      const key = await app.request(`${baseURL}/api/me/push`, { headers: { Cookie: await cookie('active-token') } })
      assert.equal(key.status, 200)
      assert.deepEqual(await key.json(), { publicKey: 'PUBLIC' })
      for (const value of [await cookie('expired-token'), `${context.authCookies.sessionToken.name}=tampered`]) {
        const invalid = await request('get-session', { headers: { Cookie: value } })
        assert.equal(await invalid.json(), null)
      }
    })
    await t.test('logout revokes the stored session and clears its cookie', async () => {
      const headers = { Origin: baseURL, Cookie: await cookie('active-token') }
      const response = await request('sign-out', { method: 'POST', headers })
      assert.equal(response.status, 200)
      assert.match(response.headers.get('set-cookie') ?? '', /Max-Age=0/i)
      const session = await request('get-session', { headers })
      assert.equal(await session.json(), null)
      assert.equal((await app.request(`${baseURL}/api/me/push`, { headers })).status, 401)
      const rows = await pg.query("SELECT id FROM sessions WHERE id = 'active'")
      assert.equal(rows.rows.length, 0)
    })
    await t.test('password signup is not enabled', async () => {
      const response = await request('sign-up/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: baseURL },
        body: JSON.stringify({ name: 'No', email: 'no@example.test', password: 'not-enabled-123' }),
      })
      assert.notEqual(response.status, 200)
      const rows = await pg.query("SELECT id FROM users WHERE email = 'no@example.test'")
      assert.equal(rows.rows.length, 0)
    })
  } finally {
    await close()
  }
})
```

`apps/api/package.json`에서:
1. `test` 스크립트 끝에 ` src/db/baseline.test.ts scripts/design-sql.test.ts`를 더한다.
2. `"db:generate": "drizzle-kit generate"`를 `"db:generate": "drizzle-kit generate --custom"`으로 바꾼다(P7).

Run: `cd apps/api && npx tsc --noEmit && npx tsx --test --test-concurrency=2 $(node -p "require('./package.json').scripts.test.replace('tsx --test ', '')")`
Expected: 타입 오류 없음, `# fail 0`

Run: `git status --short apps/api/migrations`
Expected: 옛 `.sql` 29개와 snapshot 29개가 `D`, `0000_baseline.sql`이 새 파일, `_journal.json`이 `M`이다.

- [ ] **Step 8: 커밋**

```bash
git add apps/api/scripts apps/api/migrations apps/api/src/db/test-db.ts apps/api/src/db/baseline.test.ts apps/api/src/auth/auth.test.ts apps/api/package.json
git commit -m "설계에서 뽑은 첫 마이그레이션과 시험 DB 더하기"
```

---

### Task 3: 조회용 표 정의, 맞춤 검사, 설계 검사

`schema.ts`를 새 표 52개의 조회용 정의로 다시 쓴다. CI에서는 정의가 마이그레이션 DB와 같은지(표, 칸, 타입, NULL 여부) 보고, 로컬에서는 `check:design`이 마이그레이션 DB와 physical-model.md를 그대로 적용한 DB를 맞댄다(표, 칸, 제약, 인덱스. 설계 밖 표 7개는 뺀다).

**Files:**
- Modify: `apps/api/src/db/schema.ts`
- Create: `apps/api/src/db/schema-match.test.ts`
- Create: `apps/api/scripts/catalog.ts`, `apps/api/scripts/catalog.test.ts`, `apps/api/scripts/check-design.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- Consumes: `createTestDb`, `migrationsFolder`(Task 2), `designBlock`, `NOT_IN_DESIGN`(Task 2)
- Produces:
  - `schema.ts` 표: `users`, `accounts`, `sessions`, `verifications`, `record`, `recordVersion`, `council`, `member`, `cohort`, `councilMembership`, `department`, `departmentMembership`, `auditBody`, `votingBody`, `fiscalPeriod`, `budget`, `account`, `event`, `budgetItem`, `income`, `expense`, `evidence`, `accountClosing`, `feePayment`, `task`, `request`, `lineItem`, `paymentLine`, `registrationForm`, `registration`, `deposit`, `attendance`, `meeting`, `agendaItem`, `poll`, `pollOption`, `pollResponse`, `chatRoom`, `roomMembership`, `message`, `file`, `approval`, `decision`, `evidenceLink`, `document`, `documentLink`, `draftItem`, `source`, `notification`, `memberLogin`, `inviteCode`, `pushDevice`
  - 칸 타입: 날짜는 `'YYYY-MM-DD'` 글자, 시각은 `Date`, 금액은 글자, `council.unit`은 `'department' | 'college' | 'university'`, `councilMembership.councilRank`는 `'president' | 'vice_president' | null`, `department.role`은 `'finance' | null`, `departmentMembership.departmentRank`는 `'head' | 'vice_head' | null`
  - `describeDatabase(pg: PGlite, exclude: ReadonlySet<string>): Promise<string[]>`, `catalogDifferences(design, migrated): { onlyInDesign: string[]; onlyInMigration: string[] }`
  - npm 스크립트 `check:design`

- [ ] **Step 1: 실패하는 맞춤 시험을 쓴다**

`apps/api/src/db/schema-match.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { is } from 'drizzle-orm'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import * as schema from './schema.js'
import { createTestDb } from './test-db.js'

type Column = { table: string; column: string; type: string; notNull: boolean }
const key = (column: Column) => `${column.table}.${column.column}`
const byKey = (a: Column, b: Column) => key(a).localeCompare(key(b))

// 조회용 정의(schema.ts)와 마이그레이션을 적용한 DB가 같은지 본다: 표, 칸, 타입, NULL 여부(바탕 spec '맞춤 검사').
test('조회용 표 정의가 마이그레이션 DB의 표·칸·타입·NULL 여부와 같다', async () => {
  const tables = Object.values(schema as Record<string, unknown>).filter((value): value is PgTable => is(value, PgTable))
  const defined: Column[] = tables.flatMap(table => {
    const config = getTableConfig(table)
    return config.columns.map(column => ({ table: config.name, column: column.name, type: column.getSQLType(), notNull: column.notNull }))
  }).sort(byKey)
  const { pg, close } = await createTestDb()
  try {
    const { rows } = await pg.query<{ table_name: string; column_name: string; data_type: string; numeric_precision: number | null
      numeric_scale: number | null; is_nullable: 'YES' | 'NO' }>(
      `SELECT table_name, column_name, data_type, numeric_precision, numeric_scale, is_nullable
       FROM information_schema.columns WHERE table_schema = 'public'`)
    const actual: Column[] = rows.map(row => ({
      table: row.table_name,
      column: row.column_name,
      type: row.data_type === 'numeric' ? `numeric(${row.numeric_precision}, ${row.numeric_scale})` : row.data_type,
      notNull: row.is_nullable === 'NO',
    })).sort(byKey)
    assert.deepEqual([...new Set(defined.map(column => column.table))].sort(), [...new Set(actual.map(column => column.table))].sort())
    assert.deepEqual(defined, actual)
  } finally {
    await close()
  }
})
```

Run: `cd apps/api && npx tsx --test src/db/schema-match.test.ts`
Expected: FAIL. 표 이름 목록이 다르다(`record`, `council` 등이 정의에 없다).

- [ ] **Step 2: 조회용 표 정의를 쓴다**

`apps/api/src/db/schema.ts`를 다음으로 바꾼다:

```ts
import { sql } from 'drizzle-orm'
import { bigint, boolean, customType, date, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'

// 조회용 표 정의다. 표는 마이그레이션(SQL)이 만들고, 이 파일로 표를 만들지 않는다(다시 만들기 설계서).
// 표와 칸, 타입, NULL 여부만 맞춘다. 외래 키, UNIQUE, CHECK, EXCLUDE, 부분 유일 인덱스는 SQL에만 있다.
// 마이그레이션 DB와 같은지는 schema-match.test.ts가 확인한다.

const at = (name: string) => timestamp(name, { withTimezone: true })
const day = (name: string) => date(name, { mode: 'string' })
const won = (name: string) => numeric(name, { precision: 14, scale: 0 })
// drizzle에 없는 PostgreSQL 범위 타입. 칸과 타입만 맞춘다. 값은 '["2026-10-19 00:00:00+00",)' 같은 글자다.
const tstzrange = customType<{ data: string; driverData: string }>({ dataType: () => 'tstzrange' })

// 로그인 표 4개(better-auth). 지금 정의 그대로다.
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    .$onUpdate(() => new Date()),
})

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  // Better Auth 기본 스키마 호환 필드이며, 비밀번호 로그인을 활성화하지 않는다.
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  unique('accounts_provider_account_unique').on(table.providerId, table.accountId),
  index('accounts_user_id_idx').on(table.userId),
])

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  index('sessions_user_id_idx').on(table.userId),
])

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  index('verifications_identifier_idx').on(table.identifier),
])

// 공통(physical-model.md)
export const record = pgTable('record', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  kind: text('kind').notNull(),
  councilId: uuid('council_id'),
  createdBy: uuid('created_by'),
  createdAt: at('created_at').notNull().defaultNow(),
  confirmedBy: uuid('confirmed_by'),
  confirmedAt: at('confirmed_at'),
})

export const recordVersion = pgTable('record_version', {
  recordId: uuid('record_id').notNull(),
  versionNo: integer('version_no').notNull(),
  valid: tstzrange('valid').notNull(),
  data: jsonb('data').notNull(),
  changedBy: uuid('changed_by'),
  reason: text('reason'),
}, (table) => [primaryKey({ columns: [table.recordId, table.versionNo] })])

// 조직
export const council = pgTable('council', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('council'),
  name: text('name').notNull(),
  unit: text('unit').$type<'department' | 'college' | 'university'>().notNull(),
  schoolName: text('school_name').notNull(),
  presidentTitle: text('president_title').notNull().default('회장'),
  vicePresidentTitle: text('vice_president_title').notNull().default('부회장'),
  headTitle: text('head_title').notNull().default('부장'),
  viceHeadTitle: text('vice_head_title').notNull().default('부부장'),
})

export const member = pgTable('member', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('member'),
  name: text('name').notNull(),
  email: text('email').notNull(),
})

export const cohort = pgTable('cohort', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('cohort'),
  councilId: uuid('council_id').notNull(),
  name: text('name').notNull(),
  startsOn: day('starts_on').notNull(),
  endsOn: day('ends_on').notNull(),
})

export const councilMembership = pgTable('council_membership', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('council_membership'),
  memberId: uuid('member_id').notNull(),
  cohortId: uuid('cohort_id').notNull(),
  councilRank: text('council_rank').$type<'president' | 'vice_president'>(),
  startsAt: at('starts_at').notNull(),
  endsAt: at('ends_at'),
})

export const department = pgTable('department', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('department'),
  councilId: uuid('council_id').notNull(),
  name: text('name').notNull(),
  role: text('role').$type<'finance'>(),
})

export const departmentMembership = pgTable('department_membership', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('department_membership'),
  memberId: uuid('member_id').notNull(),
  departmentId: uuid('department_id').notNull(),
  cohortId: uuid('cohort_id').notNull(),
  departmentRank: text('department_rank').$type<'head' | 'vice_head'>(),
  startsAt: at('starts_at').notNull(),
  endsAt: at('ends_at'),
})

export const auditBody = pgTable('audit_body', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('audit_body'),
  councilId: uuid('council_id').notNull(),
  name: text('name').notNull(),
})

export const votingBody = pgTable('voting_body', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('voting_body'),
  councilId: uuid('council_id').notNull(),
  name: text('name').notNull(),
})

// 돈
export const fiscalPeriod = pgTable('fiscal_period', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('fiscal_period'),
  councilId: uuid('council_id').notNull(),
  name: text('name').notNull(),
  startsOn: day('starts_on').notNull(),
  endsOn: day('ends_on').notNull(),
  previousPeriodId: uuid('previous_period_id'),
})

export const budget = pgTable('budget', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('budget'),
  fiscalPeriodId: uuid('fiscal_period_id').notNull(),
})

export const account = pgTable('account', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('account'),
  councilId: uuid('council_id').notNull(),
  name: text('name').notNull(),
  bank: text('bank').notNull(),
  accountNumber: text('account_number').notNull(),
  holder: text('holder').notNull(),
  type: text('type').notNull(),
  closedOn: day('closed_on'),
})

export const event = pgTable('event', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('event'),
  name: text('name').notNull(),
  startsAt: at('starts_at'),
  endsAt: at('ends_at'),
  place: text('place'),
  ownerId: uuid('owner_id'),
  previousEventId: uuid('previous_event_id'),
})

export const budgetItem = pgTable('budget_item', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('budget_item'),
  budgetId: uuid('budget_id').notNull(),
  type: text('type').notNull(),
  purpose: text('purpose').notNull(),
  amount: won('amount').notNull(),
  eventId: uuid('event_id'),
})

export const income = pgTable('income', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('income'),
  fiscalPeriodId: uuid('fiscal_period_id').notNull(),
  source: text('source').notNull(),
  amount: won('amount').notNull(),
  receivedOn: day('received_on').notNull(),
  description: text('description'),
  budgetItemId: uuid('budget_item_id'),
  accountId: uuid('account_id'),
  cancelledAt: at('cancelled_at'),
})

export const expense = pgTable('expense', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('expense'),
  amount: won('amount').notNull(),
  paidAt: at('paid_at').notNull(),
  description: text('description').notNull(),
  vendor: text('vendor').notNull(),
  method: text('method').notNull(),
  reason: text('reason'),
  eventId: uuid('event_id'),
  budgetItemId: uuid('budget_item_id'),
  requestedBy: uuid('requested_by'),
  paidBy: uuid('paid_by'),
  reimbursedAt: at('reimbursed_at'),
  accountId: uuid('account_id'),
  cancelledAt: at('cancelled_at'),
})

export const evidence = pgTable('evidence', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('evidence'),
  expenseId: uuid('expense_id').notNull(),
  type: text('type').notNull(),
})

export const accountClosing = pgTable('account_closing', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('account_closing'),
  fiscalPeriodId: uuid('fiscal_period_id').notNull(),
  publishedAt: at('published_at'),
})

export const feePayment = pgTable('fee_payment', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('fee_payment'),
  councilId: uuid('council_id').notNull(),
  studentId: text('student_id').notNull(),
  paidFrom: day('paid_from').notNull(),
  paidUntil: day('paid_until').notNull(),
})

// 일
export const task = pgTable('task', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('task'),
  title: text('title').notNull(),
  body: text('body'),
  dueAt: at('due_at'),
  status: text('status').notNull(),
  recurrence: text('recurrence'),
  eventId: uuid('event_id'),
  departmentId: uuid('department_id'),
  assigneeId: uuid('assignee_id'),
})

export const request = pgTable('request', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('request'),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  requestedBy: uuid('requested_by').notNull(),
  neededBy: day('needed_by'),
  defaultBudgetItemId: uuid('default_budget_item_id'),
  cancelledAt: at('cancelled_at'),
})

export const lineItem = pgTable('line_item', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('line_item'),
  requestId: uuid('request_id').notNull(),
  name: text('name').notNull(),
  link: text('link'),
  options: text('options'),
  quantity: integer('quantity').notNull(),
  amount: won('amount'),
  budgetItemId: uuid('budget_item_id'),
})

export const paymentLine = pgTable('payment_line', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('payment_line'),
  expenseId: uuid('expense_id').notNull(),
  lineItemId: uuid('line_item_id').notNull(),
  amount: won('amount').notNull(),
})

export const registrationForm = pgTable('registration_form', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('registration_form'),
  eventId: uuid('event_id').notNull(),
  name: text('name').notNull(),
  opensAt: at('opens_at'),
  closesAt: at('closes_at').notNull(),
  capacity: integer('capacity'),
  notice: text('notice'),
  collectsPhone: boolean('collects_phone').notNull().default(false),
  pausedAt: at('paused_at'),
  publicCode: text('public_code').notNull(),
  payerFee: won('payer_fee'),
  nonPayerFee: won('non_payer_fee'),
  feeAccountId: uuid('fee_account_id'),
})

export const registration = pgTable('registration', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('registration'),
  formId: uuid('form_id').notNull(),
  name: text('name'),
  studentId: text('student_id'),
  phone: text('phone'),
  appliedFee: won('applied_fee').notNull(),
  cancelledAt: at('cancelled_at'),
})

export const deposit = pgTable('deposit', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('deposit'),
  registrationId: uuid('registration_id').notNull(),
  amount: won('amount').notNull(),
  confirmedAt: at('confirmed_at').notNull(),
  incomeId: uuid('income_id'),
})

export const attendance = pgTable('attendance', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('attendance'),
  registrationId: uuid('registration_id').notNull(),
  confirmedAt: at('confirmed_at').notNull(),
})

export const meeting = pgTable('meeting', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('meeting'),
  title: text('title').notNull(),
  heldAt: at('held_at').notNull(),
  eventId: uuid('event_id'),
  hostDepartmentId: uuid('host_department_id'),
})

export const agendaItem = pgTable('agenda_item', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('agenda_item'),
  meetingId: uuid('meeting_id').notNull(),
  position: integer('position').notNull(),
  title: text('title').notNull(),
  body: text('body'),
})

export const poll = pgTable('poll', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('poll'),
  title: text('title').notNull(),
  closesAt: at('closes_at'),
  closedAt: at('closed_at'),
  originId: uuid('origin_id'),
  originKind: text('origin_kind'),
})

export const pollOption = pgTable('poll_option', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('poll_option'),
  pollId: uuid('poll_id').notNull(),
  position: integer('position').notNull(),
  label: text('label').notNull(),
})

export const pollResponse = pgTable('poll_response', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('poll_response'),
  pollId: uuid('poll_id').notNull(),
  memberId: uuid('member_id').notNull(),
  optionId: uuid('option_id').notNull(),
})

// 기록
export const chatRoom = pgTable('chat_room', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('chat_room'),
  type: text('type').notNull(),
  eventId: uuid('event_id'),
  departmentId: uuid('department_id'),
})

export const roomMembership = pgTable('room_membership', {
  roomId: uuid('room_id').notNull(),
  memberId: uuid('member_id').notNull(),
  joinedAt: at('joined_at').notNull(),
  lastReadAt: at('last_read_at'),
}, (table) => [primaryKey({ columns: [table.roomId, table.memberId] })])

export const message = pgTable('message', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('message'),
  roomId: uuid('room_id').notNull(),
  body: text('body').notNull(),
  sentAt: at('sent_at').notNull(),
  isNotice: boolean('is_notice').notNull().default(false),
})

export const file = pgTable('file', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('file'),
  name: text('name').notNull(),
  mediaType: text('media_type').notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  storageKey: text('storage_key').notNull(),
  attachedToId: uuid('attached_to_id'),
})

export const approval = pgTable('approval', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('approval'),
  targetId: uuid('target_id').notNull(),
  targetKind: text('target_kind').notNull(),
  outcome: text('outcome').notNull(),
  actorId: uuid('actor_id').notNull(),
  actorKind: text('actor_kind').notNull(),
  actedAt: at('acted_at').notNull(),
  reason: text('reason'),
})

export const decision = pgTable('decision', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('decision'),
  content: text('content').notNull(),
  rationale: text('rationale'),
  decidedBy: uuid('decided_by').notNull(),
  decidedAt: at('decided_at').notNull(),
  originId: uuid('origin_id'),
  originKind: text('origin_kind'),
})

export const evidenceLink = pgTable('evidence_link', {
  recordId: uuid('record_id').notNull(),
  messageId: uuid('message_id').notNull(),
}, (table) => [primaryKey({ columns: [table.recordId, table.messageId] })])

export const document = pgTable('document', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('document'),
  title: text('title').notNull(),
  type: text('type').notNull(),
  body: text('body'),
})

export const documentLink = pgTable('document_link', {
  documentId: uuid('document_id').notNull(),
  recordId: uuid('record_id').notNull(),
}, (table) => [primaryKey({ columns: [table.documentId, table.recordId] })])

export const draftItem = pgTable('draft_item', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('draft_item'),
  recordId: uuid('record_id').notNull(),
  position: integer('position').notNull(),
  content: text('content').notNull(),
  needsCheck: boolean('needs_check').notNull().default(false),
})

export const source = pgTable('source', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('source'),
  draftItemId: uuid('draft_item_id').notNull(),
  originId: uuid('origin_id').notNull(),
  originKind: text('origin_kind').notNull(),
  location: text('location').notNull(),
})

export const notification = pgTable('notification', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull().default('notification'),
  recipientId: uuid('recipient_id').notNull(),
  recordId: uuid('record_id').notNull(),
  type: text('type').notNull(),
  notifiedAt: at('notified_at').notNull(),
  readAt: at('read_at'),
})

// 설계 밖 표 3개(바탕 spec)
export const memberLogin = pgTable('member_login', {
  memberId: uuid('member_id').primaryKey(),
  userId: text('user_id').notNull(),
  linkedAt: at('linked_at').notNull().defaultNow(),
})

export const inviteCode = pgTable('invite_code', {
  councilId: uuid('council_id').primaryKey(),
  code: text('code').notNull(),
  createdBy: uuid('created_by').notNull(),
  createdAt: at('created_at').notNull().defaultNow(),
})

export const pushDevice = pgTable('push_device', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  userId: text('user_id').notNull(),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  expirationTime: at('expiration_time'),
  createdAt: at('created_at').notNull().defaultNow(),
})
```

Run: `cd apps/api && npx tsx --test src/db/schema-match.test.ts`
Expected: PASS (1 test)

시험이 정말 어긋남을 잡는지 한 번 본다: `department`의 `role` 줄 끝에 `.notNull()`을 붙이고 다시 돌린다.
Expected: FAIL(`column: 'role'`의 `notNull`이 다르다). 확인한 뒤 `.notNull()`을 지운다.

- [ ] **Step 3: 실패하는 설계 검사 시험을 쓴다**

`apps/api/scripts/catalog.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb } from '../src/db/test-db.js'
import { catalogDifferences, describeDatabase } from './catalog.js'
import { NOT_IN_DESIGN } from './design-sql.js'

test('설계 검사의 비교는 설계 밖 표를 빼고, 한쪽에만 있는 제약을 찾아낸다', async () => {
  const design = await createTestDb()
  const migrated = await createTestDb()
  try {
    const lines = await describeDatabase(design.pg, NOT_IN_DESIGN)
    assert.ok(lines.includes('표 council'))
    assert.ok(lines.some(line => line.startsWith('제약 department department_council_id_name_key UNIQUE (council_id, name)')))
    for (const table of NOT_IN_DESIGN) assert.ok(!lines.some(line => line.startsWith(`표 ${table}`) || line.includes(` ${table}.`)), table)
    assert.deepEqual(catalogDifferences(lines, await describeDatabase(migrated.pg, NOT_IN_DESIGN)), { onlyInDesign: [], onlyInMigration: [] })
    await migrated.pg.exec('ALTER TABLE department DROP CONSTRAINT department_council_id_name_key; CREATE INDEX extra_idx ON member (name);')
    const differences = catalogDifferences(lines, await describeDatabase(migrated.pg, NOT_IN_DESIGN))
    assert.deepEqual(differences.onlyInDesign.filter(line => line.startsWith('제약')),
      ['제약 department department_council_id_name_key UNIQUE (council_id, name)'])
    assert.deepEqual(differences.onlyInMigration, ['인덱스 member CREATE INDEX extra_idx ON public.member USING btree (name)'])
  } finally {
    await design.close()
    await migrated.close()
  }
})
```

Run: `cd apps/api && npx tsx --test scripts/catalog.test.ts`
Expected: FAIL (`Cannot find module` … `catalog.js`)

- [ ] **Step 4: 설계 검사를 만든다**

`apps/api/scripts/catalog.ts`:

```ts
import type { PGlite } from '@electric-sql/pglite'

// DB의 표, 칸, 제약, 인덱스를 한 줄씩 적는다. 두 DB를 맞대는 설계 검사(check-design.ts)가 쓴다.
// exclude에 든 표와 그 표의 제약·인덱스는 적지 않는다(설계 밖 표).
export async function describeDatabase(pg: PGlite, exclude: ReadonlySet<string>): Promise<string[]> {
  const columns = await pg.query<{ table: string; column: string; type: string; not_null: boolean; default: string | null }>(`
    SELECT c.relname AS table, a.attname AS column, format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS not_null,
      pg_get_expr(d.adbin, d.adrelid) AS default
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped`)
  const constraints = await pg.query<{ table: string; name: string; definition: string }>(`
    SELECT c.relname AS table, con.conname AS name, pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'`)
  const indexes = await pg.query<{ table: string; definition: string }>(
    "SELECT tablename AS table, indexdef AS definition FROM pg_indexes WHERE schemaname = 'public'")
  const extensions = await pg.query<{ name: string }>('SELECT extname AS name FROM pg_extension')
  const kept = <T extends { table: string }>(rows: T[]) => rows.filter(row => !exclude.has(row.table))
  return [
    ...[...new Set(kept(columns.rows).map(row => row.table))].map(table => `표 ${table}`),
    ...kept(columns.rows).map(row => `칸 ${row.table}.${row.column} ${row.type}${row.not_null ? ' NOT NULL' : ''}${row.default ? ` DEFAULT ${row.default}` : ''}`),
    ...kept(constraints.rows).map(row => `제약 ${row.table} ${row.name} ${row.definition}`),
    ...kept(indexes.rows).map(row => `인덱스 ${row.table} ${row.definition}`),
    ...extensions.rows.map(row => `확장 ${row.name}`),
  ].sort()
}

// 한쪽에만 있는 줄을 돌려준다. 둘 다 비면 같은 DB다.
export function catalogDifferences(design: readonly string[], migrated: readonly string[]) {
  const inMigrated = new Set(migrated)
  const inDesign = new Set(design)
  return {
    onlyInDesign: design.filter(line => !inMigrated.has(line)),
    onlyInMigration: migrated.filter(line => !inDesign.has(line)),
  }
}
```

`apps/api/scripts/check-design.ts`:

```ts
// 설계 검사(로컬): 마이그레이션을 적용한 DB와 physical-model.md의 SQL 블록을 그대로 적용한 DB를 맞댄다(표, 칸, 제약, 인덱스).
// 로그인 표 4개와 설계 밖 표 3개는 빼고 본다. 옆 폴더 vada-docs가 있어야 해서 CI에는 넣지 않는다. 표를 바꿀 때 돌린다.
// 사용법: npm run check:design --workspace @vada/api [-- physical-model.md 경로]
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import { createTestDb } from '../src/db/test-db.js'
import { catalogDifferences, describeDatabase } from './catalog.js'
import { designBlock, NOT_IN_DESIGN } from './design-sql.js'

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const designPath = process.argv[2] ? resolve(process.argv[2]) : resolve(repoRoot, '../vada-docs/physical-model.md')
const design = await PGlite.create({ extensions: { btree_gist } })
const migrated = await createTestDb()
try {
  await design.exec(designBlock(readFileSync(designPath, 'utf8')))
  const expected = await describeDatabase(design, NOT_IN_DESIGN)
  const { onlyInDesign, onlyInMigration } = catalogDifferences(expected, await describeDatabase(migrated.pg, NOT_IN_DESIGN))
  for (const line of onlyInDesign) console.log(`설계에만 있다: ${line}`)
  for (const line of onlyInMigration) console.log(`마이그레이션에만 있다: ${line}`)
  if (onlyInDesign.length || onlyInMigration.length) {
    console.log('설계와 마이그레이션이 다르다. physical-model.md를 먼저 고쳤는지, 새 마이그레이션이 같은 SQL인지 확인한다.')
    process.exitCode = 1
  } else {
    console.log(`설계와 같다: ${expected.filter(line => line.startsWith('표 ')).length}개 표 (${designPath})`)
  }
} finally {
  await design.close()
  await migrated.close()
}
```

`apps/api/package.json`의 `scripts`에 `"check:design": "tsx scripts/check-design.ts",`를 `db:migrate` 줄 위에 더하고, `test` 스크립트 끝에 ` src/db/schema-match.test.ts scripts/catalog.test.ts`를 더한다.

Run: `cd apps/api && npx tsx --test scripts/catalog.test.ts`
Expected: PASS (1 test)

Run: `npm run check:design --workspace @vada/api`
Expected: `설계와 같다: 45개 표 (…vada-docs…physical-model.md)`, 종료 코드 0. worktree에서는 `npm run check:design --workspace @vada/api -- <vada-docs 폴더>/physical-model.md`로 경로를 준다(P6).

- [ ] **Step 5: 전체 API 시험과 타입을 본다**

Run: `cd apps/api && npx tsc --noEmit && npx tsx --test --test-concurrency=2 $(node -p "require('./package.json').scripts.test.replace('tsx --test ', '')")`
Expected: 타입 오류 없음, `# fail 0`

- [ ] **Step 6: 커밋**

```bash
git add apps/api/src/db/schema.ts apps/api/src/db/schema-match.test.ts apps/api/scripts/catalog.ts apps/api/scripts/catalog.test.ts apps/api/scripts/check-design.ts apps/api/package.json
git commit -m "조회용 표 정의와 맞춤 검사, 설계 검사 더하기"
```

---

### Task 4: 기록 모듈

모든 쓰기가 거치는 기록 모듈이다(DEC-33, DEC-34, DEC-46). 만들기는 기록 행, 하위 행, 판 1을 한 번에 만들고, 바꾸기는 하위 행을 `FOR NO KEY UPDATE`로 잠그고(P14) 바꾼 뒤 지금 판을 닫고 새 판을 연다. 확정한 기록은 사유가 있어야 바꾸고, 회장이 없어지는 변경은 막는다(G8). 주인 칸(학생회·기수·부서·운영진 번호)은 바꾸지 않는다(P33). 지우기는 이 모듈의 일이 아니다(쓰인 적 없는 부서 없애기는 Task 9).

**Files:**
- Create: `apps/api/src/records/records.ts`, `apps/api/src/records/records.test.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- Consumes: `schema.ts`의 `record`, `council`, `member`, `cohort`, `councilMembership`, `department`, `departmentMembership`(Task 3), `ApiError`, `createTestDb`(Task 2)
- Produces:
  - `type Db = PgDatabase<PgQueryResultHKT>`, `type Tx`(Db의 거래)
  - `type RecordKind = 'council' | 'member' | 'cohort' | 'council_membership' | 'department' | 'department_membership'`
  - `type RecordValues<K>`(하위 행의 칸 값, `id`·`kind`·`councilId` 빼고. 칸 값에 `clockNow` 같은 SQL을 넣을 수 있다)
  - `type RecordChange<K> = { kind: K; id: string; actor: string | null; reason: string | null; changes: PgUpdateSetSource<…> }`, `type AnyRecordChange`
  - `clockNow`(`clock_timestamp()` SQL)
  - `createRecord<K>(tx, { kind, councilId, actor, values }): Promise<string>`
  - `updateRecord<K>(tx, change: RecordChange<K>): Promise<void>`, `updateRecords(tx, changes: readonly AnyRecordChange[]): Promise<void>`
  - 오류: 확정한 기록을 사유 없이 바꾸면 `ApiError('REASON_REQUIRED', 400)`, 회장이 없어지면 `ApiError('PRESIDENT_REQUIRED', 409)`, 없는 기록은 `ApiError('NOT_FOUND', 404)`. 학생회 번호 규칙(학생회와 운영진만 비움, 소속은 기수·부서와 같은 학생회)을 어기거나 주인 칸(`councilId`, `cohortId`, `departmentId`, `memberId`와 DB 칸 이름)을 바꾸면 `Error`(코드의 잘못이다. 바꾸기 전에 모든 변경을 먼저 본다)

- [ ] **Step 1: 실패하는 시험을 쓴다**

`apps/api/src/records/records.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PGlite } from '@electric-sql/pglite'
import { createTestDb } from '../db/test-db.js'
import { clockNow, createRecord, updateRecord, updateRecords, type AnyRecordChange, type Tx } from './records.js'

type Version = { version_no: number; lower: string; upper: string | null; data: Record<string, unknown>; changed_by: string | null; reason: string | null }
const versionsOf = async (pg: PGlite, id: string) => (await pg.query<Version>(
  `SELECT version_no, lower(valid)::text AS lower, upper(valid)::text AS upper, data, changed_by, reason
   FROM record_version WHERE record_id = $1 ORDER BY version_no`, [id])).rows

// 학생회와 기수, 운영진 둘을 만든다. 운영진은 시스템이 만든 것으로 둔다(만든 사람 없음).
async function seed(tx: Tx) {
  const kim = await createRecord(tx, { kind: 'member', councilId: null, actor: null, values: { name: '김회장', email: 'kim@example.test' } })
  const lee = await createRecord(tx, { kind: 'member', councilId: null, actor: null, values: { name: '이부원', email: 'lee@example.test' } })
  const council = await createRecord(tx, { kind: 'council', councilId: null, actor: kim,
    values: { name: '컴퓨터학부 학생회', unit: 'department', schoolName: '한양대학교 ERICA' } })
  const cohort = await createRecord(tx, { kind: 'cohort', councilId: council, actor: kim, values: { name: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' } })
  return { kim, lee, council, cohort }
}

test('만들기는 기록, 하위 행, 판 1을 한 번에 만들고 판에 하위 행의 칸 값 전체를 담는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const { kim, council, cohort } = await db.transaction(seed)
    const [row] = (await pg.query<{ kind: string; council_id: string | null; created_by: string | null; created_at: string }>(
      'SELECT kind, council_id, created_by, created_at::text FROM record WHERE id = $1', [council])).rows
    assert.deepEqual({ ...row, created_at: undefined }, { kind: 'council', council_id: null, created_by: kim, created_at: undefined })
    const versions = await versionsOf(pg, council)
    assert.equal(versions.length, 1)
    assert.equal(versions[0]!.lower, row!.created_at)
    assert.equal(versions[0]!.upper, null)
    assert.equal(versions[0]!.changed_by, kim)
    assert.deepEqual(versions[0]!.data, { id: council, kind: 'council', name: '컴퓨터학부 학생회', unit: 'department', school_name: '한양대학교 ERICA',
      president_title: '회장', vice_president_title: '부회장', head_title: '부장', vice_head_title: '부부장' })
    // 기수는 하위 행에도 학생회 번호를 둔다. 모듈이 기록의 학생회 번호를 넣는다.
    assert.deepEqual((await pg.query('SELECT council_id FROM cohort WHERE id = $1', [cohort])).rows, [{ council_id: council }])
    assert.deepEqual((await pg.query('SELECT council_id FROM record WHERE id = $1', [cohort])).rows, [{ council_id: council }])
    // 시스템이 만든 운영진은 만든 사람과 판 1의 바꾼 사람을 비운다.
    assert.equal((await versionsOf(pg, kim))[0]!.changed_by, null)
  } finally {
    await close()
  }
})

test('바꾸기는 지금 판을 닫고 새 판을 열며, 바꾼 사람과 사유를 새 판에 둔다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const { kim, lee, council } = await db.transaction(seed)
    await db.transaction(tx => updateRecord(tx, { kind: 'council', id: council, actor: lee, reason: null, changes: { name: '소프트웨어학부 학생회' } }))
    const versions = await versionsOf(pg, council)
    assert.deepEqual(versions.map(version => [version.version_no, version.changed_by, version.data.name]),
      [[1, kim, '컴퓨터학부 학생회'], [2, lee, '소프트웨어학부 학생회']])
    assert.equal(versions[0]!.upper, versions[1]!.lower)
    assert.equal(versions[1]!.upper, null)
    assert.deepEqual((await pg.query('SELECT name FROM council WHERE id = $1', [council])).rows, [{ name: '소프트웨어학부 학생회' }])
  } finally {
    await close()
  }
})

test('한 거래에서 두 번 바꿔도 판이 겹치거나 비지 않고 이어진다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const { kim, council } = await db.transaction(seed)
    await db.transaction(async tx => {
      await updateRecord(tx, { kind: 'council', id: council, actor: kim, reason: null, changes: { name: '하나' } })
      await updateRecord(tx, { kind: 'council', id: council, actor: kim, reason: null, changes: { name: '둘' } })
    })
    const versions = await versionsOf(pg, council)
    assert.deepEqual(versions.map(version => version.data.name), ['컴퓨터학부 학생회', '하나', '둘'])
    for (let index = 1; index < versions.length; index++) {
      assert.equal(versions[index]!.lower, versions[index - 1]!.upper)
      assert.ok(versions[index - 1]!.lower < versions[index - 1]!.upper!, '판의 기간이 비지 않는다')
    }
  } finally {
    await close()
  }
})

test('확정한 기록은 사유 없이 바꿀 수 없고, 사유를 주면 판에 남는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const { kim, council } = await db.transaction(seed)
    await pg.query('UPDATE record SET confirmed_by = $1, confirmed_at = now() WHERE id = $2', [kim, council])
    for (const reason of [null, '', '   ']) {
      await assert.rejects(db.transaction(tx => updateRecord(tx, { kind: 'council', id: council, actor: kim, reason, changes: { name: '바꿈' } })),
        { code: 'REASON_REQUIRED', status: 400 })
    }
    assert.equal((await versionsOf(pg, council)).length, 1)
    await db.transaction(tx => updateRecord(tx, { kind: 'council', id: council, actor: kim, reason: '회칙 개정', changes: { name: '바꿈' } }))
    assert.equal((await versionsOf(pg, council))[1]!.reason, '회칙 개정')
  } finally {
    await close()
  }
})

test('학생회 번호 규칙: 학생회와 운영진만 비우고, 소속은 기수와 부서의 학생회와 같아야 한다', async () => {
  const { db, close } = await createTestDb()
  try {
    const first = await db.transaction(seed)
    const other = await db.transaction(async tx => {
      const council = await createRecord(tx, { kind: 'council', councilId: null, actor: first.kim, values: { name: '경영학부 학생회', unit: 'department', schoolName: '한양대학교 ERICA' } })
      const department = await createRecord(tx, { kind: 'department', councilId: council, actor: first.kim, values: { name: '재정부', role: 'finance' } })
      return { council, department }
    })
    const attempts: ((tx: Tx) => Promise<unknown>)[] = [
      tx => createRecord(tx, { kind: 'member', councilId: first.council, actor: null, values: { name: '박', email: 'park@example.test' } }),
      tx => createRecord(tx, { kind: 'council', councilId: first.council, actor: null, values: { name: 'x', unit: 'college', schoolName: 'y' } }),
      tx => createRecord(tx, { kind: 'cohort', councilId: null, actor: null, values: { name: '2027', startsOn: '2027-01-01', endsOn: '2027-12-31' } }),
      tx => createRecord(tx, { kind: 'council_membership', councilId: other.council, actor: first.kim,
        values: { memberId: first.lee, cohortId: first.cohort, startsAt: clockNow } }),
      tx => createRecord(tx, { kind: 'department_membership', councilId: first.council, actor: first.kim,
        values: { memberId: first.lee, departmentId: other.department, cohortId: first.cohort, startsAt: clockNow } }),
    ]
    for (const attempt of attempts) await assert.rejects(db.transaction(attempt))
  } finally {
    await close()
  }
})

test('회장이 없어지는 변경은 막고, 한 번에 거두고 주는 회장 넘기기는 받는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const { kim, lee, council, cohort } = await db.transaction(seed)
    const [president, member] = await db.transaction(async tx => [
      await createRecord(tx, { kind: 'council_membership', councilId: council, actor: kim, values: { memberId: kim, cohortId: cohort, councilRank: 'president', startsAt: clockNow } }),
      await createRecord(tx, { kind: 'council_membership', councilId: council, actor: kim, values: { memberId: lee, cohortId: cohort, startsAt: clockNow } }),
    ])
    for (const changes of [{ councilRank: null }, { councilRank: 'vice_president' as const }, { endsAt: clockNow }]) {
      await assert.rejects(db.transaction(tx => updateRecord(tx, { kind: 'council_membership', id: president!, actor: kim, reason: null, changes })),
        { code: 'PRESIDENT_REQUIRED', status: 409 })
    }
    await db.transaction(tx => updateRecords(tx, [
      { kind: 'council_membership', id: president!, actor: kim, reason: null, changes: { councilRank: null } },
      { kind: 'council_membership', id: member!, actor: kim, reason: null, changes: { councilRank: 'president' } },
    ]))
    assert.deepEqual((await pg.query('SELECT member_id FROM council_membership WHERE council_rank = $1', ['president'])).rows, [{ member_id: lee }])
    assert.deepEqual((await versionsOf(pg, president!)).map(version => version.data.council_rank), ['president', null])
    assert.deepEqual((await versionsOf(pg, member!)).map(version => version.data.council_rank), [null, 'president'])
  } finally {
    await close()
  }
})

test('주인 칸(학생회·기수·부서·운영진 번호)은 바꾸지 않는다. 같은 학생회인지는 만들 때만 보기 때문이다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const { kim, lee, council, cohort } = await db.transaction(seed)
    const ids = await db.transaction(async tx => {
      const next = await createRecord(tx, { kind: 'cohort', councilId: council, actor: kim, values: { name: '2027', startsOn: '2027-01-01', endsOn: '2027-12-31' } })
      const department = await createRecord(tx, { kind: 'department', councilId: council, actor: kim, values: { name: '기획부' } })
      const membership = await createRecord(tx, { kind: 'council_membership', councilId: council, actor: kim, values: { memberId: lee, cohortId: cohort, startsAt: clockNow } })
      const placement = await createRecord(tx, { kind: 'department_membership', councilId: council, actor: kim,
        values: { memberId: lee, departmentId: department, cohortId: cohort, startsAt: clockNow } })
      return { next, department, membership, placement }
    })
    const attempts: AnyRecordChange[] = [
      { kind: 'cohort', id: cohort, actor: kim, reason: null, changes: { councilId: council } },
      { kind: 'council_membership', id: ids.membership, actor: kim, reason: null, changes: { cohortId: ids.next } },
      { kind: 'council_membership', id: ids.membership, actor: kim, reason: null, changes: { memberId: kim } },
      { kind: 'department_membership', id: ids.placement, actor: kim, reason: null, changes: { departmentId: ids.department } },
      // drizzle 칸 이름이 아닌 DB 칸 이름으로 넘겨도 막는다.
      { kind: 'department', id: ids.department, actor: kim, reason: null, changes: { council_id: council } as never },
    ]
    for (const change of attempts) await assert.rejects(db.transaction(tx => updateRecords(tx, [change])), /주인 칸/, change.kind)
    for (const id of [cohort, ids.membership, ids.placement, ids.department]) assert.equal((await versionsOf(pg, id)).length, 1)
  } finally {
    await close()
  }
})

test('없는 기록을 바꾸면 404다', async () => {
  const { db, close } = await createTestDb()
  try {
    await db.transaction(seed)
    await assert.rejects(db.transaction(tx => updateRecord(tx, { kind: 'council', id: '01900000-0000-7000-8000-000000000000', actor: null, reason: null, changes: { name: 'x' } })),
      { code: 'NOT_FOUND', status: 404 })
  } finally {
    await close()
  }
})
```

Run: `cd apps/api && npx tsx --test src/records/records.test.ts`
Expected: FAIL (`Cannot find module` … `records.js`)

- [ ] **Step 2: 기록 모듈을 만든다**

`apps/api/src/records/records.ts`:

```ts
import { eq, sql } from 'drizzle-orm'
import type { PgDatabase, PgInsertValue, PgQueryResultHKT, PgUpdateSetSource } from 'drizzle-orm/pg-core'
import { cohort, council, councilMembership, department, departmentMembership, member, record } from '../db/schema.js'
import { ApiError } from '../http/errors.js'

// 기록과 판(DEC-33, DEC-34, DEC-46). 모든 쓰기는 이 모듈을 거친다(바탕 spec '기록 모듈').
// 지금 상태도 판이다. 만들 때 판 1을 열고, 바꿀 때 지금 판을 닫고 새 판을 연다. 판에는 하위 행의 칸 값 전체를 담는다.
// 시각은 clock_timestamp()로 적어, 한 거래에서 두 번 바꿔도 판이 겹치거나 비지 않는다.

export type Db = PgDatabase<PgQueryResultHKT>
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

// 바탕이 다루는 종류와 하위 표. 다음 덩어리가 자기 종류를 여기에 더한다.
const tables = {
  council,
  member,
  cohort,
  council_membership: councilMembership,
  department,
  department_membership: departmentMembership,
}
export type RecordKind = keyof typeof tables
type Table<K extends RecordKind> = (typeof tables)[K]
// 하위 표에도 학생회 번호를 두는 종류(physical-model.md 작성 규칙). 모듈이 기록의 학생회 번호를 그대로 넣는다.
const councilColumn: ReadonlySet<RecordKind> = new Set(['cohort', 'department'])
// 학생회를 넘어 이어지는 운영진과 학생회 자신만 학생회 번호를 비운다.
const withoutCouncil: ReadonlySet<RecordKind> = new Set(['council', 'member'])

export type RecordValues<K extends RecordKind> = Omit<PgInsertValue<Table<K>>, 'id' | 'kind' | 'councilId'>
export type RecordChange<K extends RecordKind> = {
  kind: K
  id: string
  // 바꾼 사람(운영진 번호). 신청자나 시스템이면 null이다.
  actor: string | null
  // 바꾼 사유. 확정한 기록(record.confirmed_at이 있음)을 바꿀 때만 꼭 받는다.
  reason: string | null
  changes: PgUpdateSetSource<Table<K>>
}
// 종류마다의 변경. 여러 종류를 한 번에 바꿀 때 칸 이름을 종류별로 검사한다.
export type AnyRecordChange = { [K in RecordKind]: RecordChange<K> }[RecordKind]

// 지금 시각. 거래 시작 시각(now())이 아니라 실제 시계 시각이다.
export const clockNow = sql`clock_timestamp()`

// 학생회 소속과 부서 소속은 기수나 부서의 학생회와 같아야 한다. DB가 막지 못해 여기서 막는다.
async function assertSameCouncil(tx: Tx, kind: RecordKind, councilId: string | null, values: Record<string, unknown>) {
  const owners: string[] = []
  if (kind === 'council_membership' || kind === 'department_membership') {
    const [owner] = await tx.select({ councilId: cohort.councilId }).from(cohort).where(eq(cohort.id, String(values.cohortId)))
    owners.push(owner?.councilId ?? '')
  }
  if (kind === 'department_membership') {
    const [owner] = await tx.select({ councilId: department.councilId }).from(department).where(eq(department.id, String(values.departmentId)))
    owners.push(owner?.councilId ?? '')
  }
  if (owners.some(owner => owner !== councilId)) throw new Error(`${kind}: 기수나 부서의 학생회와 기록의 학생회가 다르다`)
}

// 기록 하나와 하위 행 하나, 판 1을 함께 만들고 식별자를 돌려준다. actor는 만든 사람이고, 신청자나 시스템이면 null이다.
export async function createRecord<K extends RecordKind>(tx: Tx,
  { kind, councilId, actor, values }: { kind: K; councilId: string | null; actor: string | null; values: RecordValues<K> }): Promise<string> {
  if (withoutCouncil.has(kind) !== (councilId === null)) throw new Error(`${kind}: 학생회 번호 규칙에 어긋난다`)
  await assertSameCouncil(tx, kind, councilId, values as Record<string, unknown>)
  const [created] = await tx.insert(record).values({ kind, councilId, createdBy: actor, createdAt: clockNow }).returning({ id: record.id })
  const id = created!.id
  const table: Table<RecordKind> = tables[kind]
  await tx.insert(table).values({ ...values, id, ...(councilColumn.has(kind) ? { councilId } : {}) } as PgInsertValue<Table<RecordKind>>)
  await tx.execute(sql`INSERT INTO record_version (record_id, version_no, valid, data, changed_by)
    SELECT r.id, 1, tstzrange(r.created_at, NULL), to_jsonb(t), r.created_by FROM record r JOIN ${table} t ON t.id = r.id WHERE r.id = ${id}`)
  return id
}

// 하위 행이 어느 학생회·기수·부서·운영진의 것인지 정하는 칸. 같은 학생회인지는 만들 때만 보므로(assertSameCouncil) 바꾸지 않는다.
const ownershipKeys: ReadonlySet<string> = new Set(['councilId', 'cohortId', 'departmentId', 'memberId', 'council_id', 'cohort_id', 'department_id', 'member_id'])

// 여러 기록을 차례로 바꾼다. 하위 행을 잠그고 바꾼 뒤, 지금 판을 닫고 새 판을 연다.
// 회장이 없어지는 변경은 막는다(DEC-17, DEC-47). 회장 넘기기처럼 한 번에 거두고 주는 변경은 모두 바꾼 뒤에 본다.
export async function updateRecords(tx: Tx, changes: readonly AnyRecordChange[]) {
  for (const change of changes) {
    const owned = Object.keys(change.changes).filter(key => ownershipKeys.has(key))
    if (owned.length) throw new Error(`${change.kind}: 주인 칸(${owned.join(', ')})은 바꾸지 않는다`)
  }
  const presidentCohorts = new Set<string>()
  for (const change of changes) {
    const table: Table<RecordKind> = tables[change.kind]
    // FOR NO KEY UPDATE: 같은 기록을 바꾸는 거래는 한 줄로 세우되, 이 행을 가리키는 행을 넣을 때의 외래 키 검사(FOR KEY SHARE)는 막지 않는다.
    const [current] = await tx.select({ id: table.id }).from(table).where(eq(table.id, change.id)).for('no key update')
    if (!current) throw new ApiError('NOT_FOUND', 404)
    const [meta] = await tx.select({ confirmedAt: record.confirmedAt }).from(record).where(eq(record.id, change.id))
    if (meta?.confirmedAt && !change.reason?.trim()) throw new ApiError('REASON_REQUIRED', 400)
    if (change.kind === 'council_membership') {
      const [president] = await tx.select({ cohortId: councilMembership.cohortId }).from(councilMembership)
        .where(sql`${councilMembership.id} = ${change.id} AND ${councilMembership.councilRank} = 'president' AND ${councilMembership.endsAt} IS NULL`)
      if (president) presidentCohorts.add(president.cohortId)
    }
    await tx.update(table).set(change.changes as PgUpdateSetSource<Table<RecordKind>>).where(eq(table.id, change.id))
    // 지금 판의 끝과 새 판의 시작을 같은 시각으로 잇는다. 시계가 같거나 뒤로 가도 판이 비지 않게 1마이크로초를 둔다.
    await tx.execute(sql`WITH closed AS (
        UPDATE record_version SET valid = tstzrange(lower(valid), GREATEST(clock_timestamp(), lower(valid) + interval '1 microsecond'))
        WHERE record_id = ${change.id} AND upper_inf(valid)
        RETURNING version_no, upper(valid) AS ended_at
      )
      INSERT INTO record_version (record_id, version_no, valid, data, changed_by, reason)
      SELECT ${change.id}, closed.version_no + 1, tstzrange(closed.ended_at, NULL), to_jsonb(t), ${change.actor}, ${change.reason}
      FROM closed, ${table} t WHERE t.id = ${change.id}`)
  }
  for (const cohortId of presidentCohorts) {
    const [president] = await tx.select({ id: councilMembership.id }).from(councilMembership)
      .where(sql`${councilMembership.cohortId} = ${cohortId} AND ${councilMembership.councilRank} = 'president' AND ${councilMembership.endsAt} IS NULL`)
    if (!president) throw new ApiError('PRESIDENT_REQUIRED', 409)
  }
}

export const updateRecord = <K extends RecordKind>(tx: Tx, change: RecordChange<K>) => updateRecords(tx, [change as AnyRecordChange])
```

- [ ] **Step 3: 시험이 통과하는지 본다**

Run: `cd apps/api && npx tsx --test src/records/records.test.ts`
Expected: PASS (8 tests). 한 거래에서 두 번 바꿔도 판 셋이 끝과 시작으로 이어지고 비지 않는다(P13). 주인 칸을 바꾸는 변경 다섯 가지는 `/주인 칸/` 오류로 막히고 판이 늘지 않는다(P33).

- [ ] **Step 4: 시험 목록에 더하고 타입을 본다**

`apps/api/package.json`의 `test` 스크립트 끝에 ` src/records/records.test.ts`를 더한다.

Run: `npm run typecheck --workspace @vada/api`
Expected: 타입 오류 없음

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/records apps/api/package.json
git commit -m "기록과 판을 남기는 기록 모듈 더하기"
```

---

### Task 5: 권한 — 지금 소속과 권한표

`actorOf`는 요청마다 DB를 읽어 지금 소속(끝 시각이 비었고 오늘이 기수 기간 안인 학생회 소속)과 학생회 직급, 지금 부서 소속을 돌려준다. `can`은 코드 권한표 하나를 묻는다. 바탕에서는 조직 칸 8개와 공통 규칙(상속, 합치기, 직무 분리)만 둔다(G9). 경로 번호 검사와, 바꾸기 전에 학생회 행을 `FOR NO KEY UPDATE`로 잠그는 `authorizeChange`도 여기 둔다(P14, P20).

**Files:**
- Create: `packages/contracts/src/permissions.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/api/src/access/actor.ts`, `apps/api/src/access/permissions.ts`, `apps/api/src/access/authorize.ts`
- Create: `apps/api/src/access/permissions.test.ts`, `apps/api/src/access/actor.test.ts`
- Create: `apps/api/src/test-support/council.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- Consumes: `createRecord`, `updateRecord`, `clockNow`, `Db`, `Tx`(Task 4), `schema.ts` 표(Task 3), `koreanOf`(계약), `createTestDb`(Task 2)
- Produces:
  - 계약: `COUNCIL_RANKS`, `type CouncilRank = 'president' | 'vice_president'`, `DEPARTMENT_RANKS`, `type DepartmentRank = 'head' | 'vice_head'`, `DEPARTMENT_ROLES`, `type DepartmentRole = 'finance'`, `ACTIONS`, `type Action = 'council.view' | 'council.update' | 'cohort.update' | 'department.manage' | 'invite.manage' | 'member.manage' | 'rank.manage' | 'president.transfer'`
  - `type ActorDepartment = { departmentId: string; role: DepartmentRole | null; rank: DepartmentRank | null }`
  - `type Actor = { memberId: string; councilId: string; cohortId: string; membershipId: string; councilRank: CouncilRank | null; departments: ActorDepartment[] }`
  - `koreanDate(now: Date): string`, `actorOf(db: Pick<Db, 'select'>, userId: string, councilId: string, now: Date): Promise<Actor | null>`
  - `type Criterion`, `type Rule = { who: readonly Criterion[]; notOwnRequest?: boolean }`, `type Context = { departmentId?: string; requestedBy?: string }`, `PERMISSIONS`, `allows(actor, rule, context?)`, `can(actor, action, context?)`, `permissionsOf(actor): Action[]`
  - `councilIdOf(value: string | undefined): string`(uuid가 아니면 403), `recordIdOf(value: string | undefined): string`(uuid가 아니면 404)
  - `authorize(db, userId, councilId, action, now): Promise<Actor>`(아니면 403), `authorizeChange(tx, userId, councilId, action, now): Promise<Actor>`(학생회 행을 `FOR NO KEY UPDATE`로 잠근 뒤 같은 검사)
  - 시험용: `addUser(pg, userId, name?, email?)`, `seedCouncil(db, pg, prefix?, period?)`, `type Person`, `type SeededCouncil`

- [ ] **Step 1: 계약에 직급과 권한표의 동작 이름을 더한다**

`packages/contracts/src/permissions.ts`:

```ts
// 직급, 역할, 권한표의 동작 이름(DEC-16, DEC-28). 서버의 권한표(apps/api/src/access/permissions.ts)와 화면이 같이 쓴다.
// 직급의 표시 이름은 학생회가 정한다(council의 *_title 칸). 여기 값은 저장하는 이름이다.
export const COUNCIL_RANKS = ['president', 'vice_president'] as const
export type CouncilRank = typeof COUNCIL_RANKS[number]
export const DEPARTMENT_RANKS = ['head', 'vice_head'] as const
export type DepartmentRank = typeof DEPARTMENT_RANKS[number]
export const DEPARTMENT_ROLES = ['finance'] as const
export type DepartmentRole = typeof DEPARTMENT_ROLES[number]

// 바탕의 조직 칸(DEC-28, DEC-47). 다른 칸은 그 기능을 만드는 덩어리가 더한다(바탕 spec G9).
export const ACTIONS = [
  'council.view', // 학생회, 운영진, 부서 보기
  'council.update', // 학생회 정보와 직급 표시 이름 고치기
  'cohort.update', // 기수 고치기
  'department.manage', // 부서 만들기, 이름 바꾸기, 없애기, 재정 역할 주고 거두기
  'invite.manage', // 초대 코드 보기와 바꾸기
  'member.manage', // 운영진 내보내기, 부서 배정과 빼기
  'rank.manage', // 부회장 직급, 부장과 부부장 직급 주고 거두기
  'president.transfer', // 회장 직급 넘기기
] as const
export type Action = typeof ACTIONS[number]
```

`packages/contracts/src/index.ts`를 다음으로 바꾼다:

```ts
export { codePoints, isStrictObject, text, token } from './input.js'
export { koreanDateTime, dateFromKorean, koreanOf } from './korean-time.js'
export { PUSH_ENDPOINT_MAX, PUSH_TEST_RESULTS, PushSubscriptionSchema, type PushSubscriptionRequest, type PushTestResult,
  type PushKeyResponse, type PushTestResponse } from './push.js'
export { COUNCIL_RANKS, DEPARTMENT_RANKS, DEPARTMENT_ROLES, ACTIONS, type CouncilRank, type DepartmentRank, type DepartmentRole,
  type Action } from './permissions.js'
export interface HealthResponse {
  status: 'ok'
}
```

Run: `npm run typecheck --workspace @vada/contracts`
Expected: 타입 오류 없음

- [ ] **Step 2: 시험용 학생회를 만드는 도우미를 쓴다**

`apps/api/src/test-support/council.ts`(권한과 소속 시험이 같이 쓴다):

```ts
import type { PGlite } from '@electric-sql/pglite'
import { memberLogin } from '../db/schema.js'
import { clockNow, createRecord, updateRecord, type Db } from '../records/records.js'

export type Person = { userId: string; memberId: string }

// 시험용 로그인 계정. better-auth가 만드는 users 행과 같은 칸만 채운다.
export async function addUser(pg: PGlite, userId: string, name = userId, email = `${userId}@example.test`) {
  await pg.query('INSERT INTO users (id, name, email) VALUES ($1, $2, $3)', [userId, name, email])
}

// 학생회 하나와 여러 처지의 사람을 기록 모듈로 만든다. 권한과 소속 시험이 같이 쓴다.
// 사람: 회장, 부회장, 재정부원, 기획부장, 기획부 부부장, 기획부원, 직급과 부서가 없는 운영진, 내보낸 운영진(소속이 끝남).
export async function seedCouncil(db: Db, pg: PGlite, prefix = 's', period = { startsOn: '2026-01-01', endsOn: '2026-12-31' }) {
  const names = ['president', 'vicePresident', 'financeMember', 'planningHead', 'planningViceHead', 'planningMember', 'plain', 'ended'] as const
  for (const name of names) await addUser(pg, `${prefix}-${name}`, `${prefix} ${name}`)
  return db.transaction(async tx => {
    const people = {} as Record<(typeof names)[number], Person>
    for (const name of names) {
      const memberId = await createRecord(tx, { kind: 'member', councilId: null, actor: null, values: { name: `${prefix} ${name}`, email: `${prefix}-${name}@example.test` } })
      await tx.insert(memberLogin).values({ memberId, userId: `${prefix}-${name}` })
      people[name] = { userId: `${prefix}-${name}`, memberId }
    }
    const actor = people.president.memberId
    const councilId = await createRecord(tx, { kind: 'council', councilId: null, actor, values: { name: `${prefix} 학생회`, unit: 'department', schoolName: '한양대학교 ERICA' } })
    const cohortId = await createRecord(tx, { kind: 'cohort', councilId, actor, values: { name: period.startsOn.slice(0, 4), ...period } })
    const finance = await createRecord(tx, { kind: 'department', councilId, actor, values: { name: '재정부', role: 'finance' } })
    const planning = await createRecord(tx, { kind: 'department', councilId, actor, values: { name: '기획부' } })
    const memberships: Record<string, string> = {}
    for (const name of names) {
      const councilRank = name === 'president' ? 'president' as const : name === 'vicePresident' ? 'vice_president' as const : null
      memberships[name] = await createRecord(tx, { kind: 'council_membership', councilId, actor,
        values: { memberId: people[name].memberId, cohortId, councilRank, startsAt: clockNow } })
    }
    const placements = [['financeMember', finance, null], ['planningHead', planning, 'head'], ['planningViceHead', planning, 'vice_head'],
      ['planningMember', planning, null]] as const
    for (const [name, departmentId, departmentRank] of placements) {
      await createRecord(tx, { kind: 'department_membership', councilId, actor,
        values: { memberId: people[name].memberId, departmentId, cohortId, departmentRank, startsAt: clockNow } })
    }
    await updateRecord(tx, { kind: 'council_membership', id: memberships.ended!, actor, reason: null, changes: { endsAt: clockNow } })
    return { councilId, cohortId, departments: { finance, planning }, people }
  })
}
export type SeededCouncil = Awaited<ReturnType<typeof seedCouncil>>
```

- [ ] **Step 3: 실패하는 시험을 쓴다**

`apps/api/src/access/permissions.test.ts`(조직 칸마다 허용 한 사람과 거부 한 사람, 상속, 재정 권한, 합치기, 직무 분리):

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ACTIONS, type Action } from '@vada/contracts'
import type { Actor } from './actor.js'
import { allows, can, permissionsOf, PERMISSIONS } from './permissions.js'

const actor = (memberId: string, councilRank: Actor['councilRank'], departments: Actor['departments'] = []): Actor =>
  ({ memberId, councilId: 'c', cohortId: 'k', membershipId: `m-${memberId}`, councilRank, departments })
const president = actor('president', 'president')
const vicePresident = actor('vice', 'vice_president')
const financeMember = actor('finance', null, [{ departmentId: 'finance', role: 'finance', rank: null }])
const planningHead = actor('head', null, [{ departmentId: 'planning', role: null, rank: 'head' }])
const planningViceHead = actor('viceHead', null, [{ departmentId: 'planning', role: null, rank: 'vice_head' }])
const planningMember = actor('member', null, [{ departmentId: 'planning', role: null, rank: null }])
const plain = actor('plain', null)

test('권한표는 계약의 동작을 빠짐없이 한 칸씩 가진다', () => {
  assert.deepEqual(Object.keys(PERMISSIONS).sort(), [...ACTIONS].sort())
})

// 조직 칸마다 허용 한 사람과 거부 한 사람(바탕 spec '테스트'). 보기의 거부(운영진이 아닌 사람)는 actor.test.ts의 authorize가 본다.
const cells: [Action, Actor, Actor][] = [
  ['council.view', plain, plain],
  ['council.update', vicePresident, planningHead],
  ['cohort.update', vicePresident, planningHead],
  ['department.manage', vicePresident, financeMember],
  ['invite.manage', vicePresident, planningHead],
  ['member.manage', vicePresident, planningViceHead],
  ['rank.manage', vicePresident, planningHead],
  ['president.transfer', president, vicePresident],
]
for (const [action, allowed, denied] of cells) {
  test(`조직 칸 ${action}: ${allowed.memberId}는 되고${action === 'council.view' ? '' : ` ${denied.memberId}는 안 된다`}`, () => {
    assert.equal(can(allowed, action), true)
    if (action !== 'council.view') assert.equal(can(denied, action), false)
  })
}

test('상속: 회장단은 모든 부서에서 부장 권한을 가지고, 부부장은 부장과 같다. 다른 부서의 부장과 부원은 아니다', () => {
  const rule = { who: ['department_head'] as const }
  const planning = { departmentId: 'planning' }
  for (const allowed of [president, vicePresident, planningHead, planningViceHead]) assert.equal(allows(allowed, rule, planning), true, allowed.memberId)
  for (const denied of [planningMember, financeMember, plain]) assert.equal(allows(denied, rule, planning), false, denied.memberId)
  assert.equal(allows(planningHead, rule, { departmentId: 'finance' }), false)
})

test('재정 권한은 직급으로 물려받지 않는다: 회장은 재정 칸이 안 되고, 직급 없는 재정부원은 된다', () => {
  const rule = { who: ['finance'] as const }
  assert.equal(allows(president, rule), false)
  assert.equal(allows(vicePresident, rule), false)
  assert.equal(allows(financeMember, rule), true)
})

test('합치기: 여러 기준 중 하나라도 맞으면 된다', () => {
  const rule = { who: ['leadership', 'finance'] as const }
  assert.equal(allows(financeMember, rule), true)
  assert.equal(allows(vicePresident, rule), true)
  assert.equal(allows(planningHead, rule), false)
})

// 0836eaa에서 바뀜: 재정부 예외를 없앴다. 구매 결재 칸에만 직무 분리를 두지 않는다(DEC-41). 아래 시험과 allows는 옛 모양이다.
test('직무 분리: 요청한 사람은 자기 요청을 승인하지 않는다. 재정부는 예외다(DEC-41)', () => {
  const byHead = { who: ['department_head'] as const, notOwnRequest: true }
  assert.equal(allows(planningHead, byHead, { departmentId: 'planning', requestedBy: 'head' }), false)
  assert.equal(allows(planningHead, byHead, { departmentId: 'planning', requestedBy: 'member' }), true)
  const byFinance = { who: ['finance'] as const, notOwnRequest: true }
  assert.equal(allows(financeMember, byFinance, { requestedBy: 'finance' }), true)
})

test('내 권한 목록: 회장은 조직 칸 전부, 부회장은 회장 넘기기만 빼고, 직급 없는 운영진은 보기만 가진다', () => {
  assert.deepEqual(permissionsOf(president), [...ACTIONS])
  assert.deepEqual(permissionsOf(vicePresident), ACTIONS.filter(action => action !== 'president.transfer'))
  assert.deepEqual(permissionsOf(planningHead), ['council.view'])
  assert.deepEqual(permissionsOf(plain), ['council.view'])
})
```

`apps/api/src/access/actor.test.ts`(지금 소속, 끝난 소속·다른 학생회·잇지 않은 계정, 한국 날짜 경계, authorize, 경로 번호):

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb } from '../db/test-db.js'
import { addUser, seedCouncil } from '../test-support/council.js'
import { actorOf, koreanDate } from './actor.js'
import { authorize, authorizeChange, councilIdOf, recordIdOf } from './authorize.js'

const inside = new Date('2026-06-01T03:00:00Z')

test('지금 소속: 학생회 직급과 지금 부서 소속(부서, 역할, 부서 직급)을 돌려준다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const seeded = await seedCouncil(db, pg)
    const { people, departments, councilId, cohortId } = seeded
    const president = await actorOf(db, people.president.userId, councilId, inside)
    assert.deepEqual({ ...president, membershipId: undefined }, { memberId: people.president.memberId, councilId, cohortId, membershipId: undefined,
      councilRank: 'president', departments: [] })
    assert.deepEqual((await actorOf(db, people.financeMember.userId, councilId, inside))?.departments,
      [{ departmentId: departments.finance, role: 'finance', rank: null }])
    assert.deepEqual((await actorOf(db, people.planningViceHead.userId, councilId, inside))?.departments,
      [{ departmentId: departments.planning, role: null, rank: 'vice_head' }])
    assert.equal((await actorOf(db, people.plain.userId, councilId, inside))?.councilRank, null)
  } finally {
    await close()
  }
})

test('끝난 소속, 잇지 않은 계정, 다른 학생회 사람은 지금 소속이 없다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const first = await seedCouncil(db, pg, 'a')
    const second = await seedCouncil(db, pg, 'b')
    await addUser(pg, 'stranger')
    assert.equal(await actorOf(db, first.people.ended.userId, first.councilId, inside), null)
    assert.equal(await actorOf(db, 'stranger', first.councilId, inside), null)
    assert.equal(await actorOf(db, second.people.president.userId, first.councilId, inside), null)
  } finally {
    await close()
  }
})

test('기간이 지난 기수의 사람은 막힌다. 날짜는 서버 시간대가 아니라 한국 날짜로 센다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const { people, councilId } = await seedCouncil(db, pg)
    const user = people.plain.userId
    // 2026-01-01 00:00 KST는 2025-12-31 15:00 UTC다.
    assert.equal(koreanDate(new Date('2025-12-31T15:00:00Z')), '2026-01-01')
    assert.equal(await actorOf(db, user, councilId, new Date('2025-12-31T14:59:59Z')), null)
    assert.notEqual(await actorOf(db, user, councilId, new Date('2025-12-31T15:00:00Z')), null)
    assert.notEqual(await actorOf(db, user, councilId, new Date('2026-12-31T14:59:59Z')), null)
    assert.equal(await actorOf(db, user, councilId, new Date('2026-12-31T15:00:00Z')), null)
  } finally {
    await close()
  }
})

test('authorize: 운영진이 아니거나 권한이 없으면 403이고, 바꾸기는 학생회를 잠근 뒤 다시 본다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const { people, councilId } = await seedCouncil(db, pg)
    await addUser(pg, 'stranger')
    await assert.rejects(authorize(db, 'stranger', councilId, 'council.view', inside), { code: 'FORBIDDEN', status: 403 })
    await assert.rejects(authorize(db, people.ended.userId, councilId, 'council.view', inside), { code: 'FORBIDDEN', status: 403 })
    await assert.rejects(authorize(db, people.planningHead.userId, councilId, 'member.manage', inside), { code: 'FORBIDDEN', status: 403 })
    assert.equal((await authorize(db, people.plain.userId, councilId, 'council.view', inside)).memberId, people.plain.memberId)
    const actor = await db.transaction(tx => authorizeChange(tx, people.vicePresident.userId, councilId, 'member.manage', inside))
    assert.equal(actor.councilRank, 'vice_president')
  } finally {
    await close()
  }
})

test('경로 번호: 학생회 번호가 uuid가 아니면 403, 운영진·부서 번호가 uuid가 아니면 404다', () => {
  assert.equal(councilIdOf('0192F2A0-0000-7000-8000-000000000001'), '0192f2a0-0000-7000-8000-000000000001')
  for (const value of [undefined, '', 'probe', '0192f2a0-0000-7000-8000-00000000000', "' OR 1=1 --"]) {
    assert.throws(() => councilIdOf(value), { code: 'FORBIDDEN', status: 403 })
    assert.throws(() => recordIdOf(value), { code: 'NOT_FOUND', status: 404 })
  }
})
```

Run: `cd apps/api && npx tsx --test --test-concurrency=2 src/access/permissions.test.ts src/access/actor.test.ts`
Expected: FAIL (`Cannot find module` … `permissions.js`, `actor.js`)

- [ ] **Step 4: 지금 소속, 권한표, 권한 확인을 만든다**

`apps/api/src/access/actor.ts`:

```ts
import { and, asc, eq, gte, isNull, lte } from 'drizzle-orm'
import { koreanOf, type CouncilRank, type DepartmentRank, type DepartmentRole } from '@vada/contracts'
import { cohort, councilMembership, department, departmentMembership, memberLogin } from '../db/schema.js'
import type { Db } from '../records/records.js'

export type ActorDepartment = { departmentId: string; role: DepartmentRole | null; rank: DepartmentRank | null }
// 요청한 사람의 지금 소속. 권한(can)은 이것만 보고 정한다.
export type Actor = {
  memberId: string
  councilId: string
  cohortId: string
  membershipId: string
  councilRank: CouncilRank | null
  departments: ActorDepartment[]
}

// 한국 날짜(YYYY-MM-DD). 서버 시간대(Render는 UTC)와 상관없이 같은 날을 쓴다.
export const koreanDate = (now: Date) => koreanOf(now).slice(0, 10)

// 요청마다 DB를 읽는다. 그래서 내보내면 세션이 남아 있어도 다음 요청부터 막힌다(바탕 spec '권한').
// 지금 소속은 끝 시각이 비어 있고, 오늘(한국 날짜)이 기수 기간 안인 학생회 소속이다. 없으면 null이다.
export async function actorOf(db: Pick<Db, 'select'>, userId: string, councilId: string, now: Date): Promise<Actor | null> {
  const today = koreanDate(now)
  const [membership] = await db.select({ memberId: memberLogin.memberId, membershipId: councilMembership.id, cohortId: councilMembership.cohortId,
    councilRank: councilMembership.councilRank })
    .from(memberLogin)
    .innerJoin(councilMembership, eq(councilMembership.memberId, memberLogin.memberId))
    .innerJoin(cohort, eq(cohort.id, councilMembership.cohortId))
    .where(and(eq(memberLogin.userId, userId), eq(cohort.councilId, councilId), isNull(councilMembership.endsAt),
      lte(cohort.startsOn, today), gte(cohort.endsOn, today)))
  if (!membership) return null
  const departments = await db.select({ departmentId: department.id, role: department.role, rank: departmentMembership.departmentRank })
    .from(departmentMembership)
    .innerJoin(department, eq(department.id, departmentMembership.departmentId))
    .where(and(eq(departmentMembership.memberId, membership.memberId), eq(departmentMembership.cohortId, membership.cohortId),
      isNull(departmentMembership.endsAt)))
    .orderBy(asc(department.id))
  return { ...membership, councilId, departments }
}
```

`apps/api/src/access/permissions.ts`:

```ts
import type { Action } from '@vada/contracts'
import type { Actor } from './actor.js'

// 권한표 하나(DEC-27, DEC-28, DEC-47). 라우트는 이 표만 묻는다(can). 칸마다 테스트가 있다(permissions.test.ts).
// 기준: 회장단은 학생회 직급이 있는 사람, 부장은 부서 직급이 있는 사람(부부장은 부장과 같다, 기준 4),
// 재정부는 재정 역할 부서의 지금 소속이다.
export type Criterion = 'member' | 'leadership' | 'president' | 'department_head' | 'finance'
// 칸 하나: 할 수 있는 사람의 기준들. 하나라도 맞으면 된다(합치기, 기준 7). notOwnRequest는 직무 분리(기준 5)다.
export type Rule = { who: readonly Criterion[]; notOwnRequest?: boolean }
// 칸이 보는 대상. 부서 단위 칸은 departmentId, 결재 칸은 요청한 사람(requestedBy)을 받는다.
export type Context = { departmentId?: string; requestedBy?: string }

export const PERMISSIONS: { readonly [A in Action]: Rule } = {
  'council.view': { who: ['member'] },
  'council.update': { who: ['leadership'] },
  'cohort.update': { who: ['leadership'] },
  'department.manage': { who: ['leadership'] },
  'invite.manage': { who: ['leadership'] },
  'member.manage': { who: ['leadership'] },
  'rank.manage': { who: ['leadership'] },
  'president.transfer': { who: ['president'] },
}

function meets(actor: Actor, criterion: Criterion, context: Context) {
  switch (criterion) {
    case 'member': return true
    case 'leadership': return actor.councilRank !== null
    case 'president': return actor.councilRank === 'president'
    // 상속(기준 3): 회장단은 모든 부서에서 부장 권한을 가진다.
    case 'department_head': return actor.councilRank !== null
      || actor.departments.some(item => item.rank !== null && item.departmentId === context.departmentId)
    // 재정 권한은 직급으로 물려받지 않는다(기준 3).
    case 'finance': return actor.departments.some(item => item.role === 'finance')
  }
}

export function allows(actor: Actor, rule: Rule, context: Context = {}) {
  if (!rule.who.some(criterion => meets(actor, criterion, context))) return false
  // 0836eaa에서 바뀜: 재정 예외 없이 `!(rule.notOwnRequest && context.requestedBy === actor.memberId)`다. 이 줄을 베끼지 않는다.
  // 직무 분리: 요청한 사람은 자기 요청을 승인하지 않는다. 재정 역할 부서는 예외다(DEC-41).
  return !(rule.notOwnRequest && context.requestedBy === actor.memberId && !meets(actor, 'finance', context))
}

export const can = (actor: Actor, action: Action, context?: Context) => allows(actor, PERMISSIONS[action], context)

// 화면에 줄 내 권한 목록. 화면은 이 목록으로 동작 버튼을 보이거나 숨기고, 권한을 다시 계산하지 않는다(DEC-38).
export const permissionsOf = (actor: Actor): Action[] => (Object.keys(PERMISSIONS) as Action[]).filter(action => can(actor, action))
```

`apps/api/src/access/authorize.ts`:

```ts
import { eq } from 'drizzle-orm'
import type { Action } from '@vada/contracts'
import { council } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import type { Db, Tx } from '../records/records.js'
import { actorOf, type Actor } from './actor.js'
import { can } from './permissions.js'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 경로의 학생회 번호. 형식이 틀리면 그 학생회의 운영진일 수 없으므로 403이다(학생회가 있는지 드러내지 않는다).
export function councilIdOf(value: string | undefined) {
  if (!value || !uuid.test(value)) throw new ApiError('FORBIDDEN', 403)
  return value.toLowerCase()
}

// 경로의 운영진·부서 번호. 형식이 틀리면 없는 번호로 본다.
export function recordIdOf(value: string | undefined) {
  if (!value || !uuid.test(value)) throw new ApiError('NOT_FOUND', 404)
  return value.toLowerCase()
}

// 읽기: 지금 소속을 찾고 권한표를 묻는다. 운영진이 아니거나 권한이 없으면 403이다.
export async function authorize(db: Pick<Db, 'select'>, userId: string, councilId: string, action: Action, now: Date): Promise<Actor> {
  const actor = await actorOf(db, userId, councilId, now)
  if (!actor || !can(actor, action)) throw new ApiError('FORBIDDEN', 403)
  return actor
}

// 바꾸기: 학생회 행을 잠가 같은 학생회의 조직 변경을 한 번에 하나씩 처리한다. 잠근 뒤 요청한 사람의 소속과 권한을 다시 본다.
// FOR NO KEY UPDATE라서 이 학생회를 가리키는 기록을 넣을 때의 외래 키 검사(FOR KEY SHARE)는 기다리지 않는다.
export async function authorizeChange(tx: Tx, userId: string, councilId: string, action: Action, now: Date): Promise<Actor> {
  await tx.select({ id: council.id }).from(council).where(eq(council.id, councilId)).for('no key update')
  return authorize(tx, userId, councilId, action, now)
}
```

- [ ] **Step 5: 시험이 통과하는지 본다**

Run: `cd apps/api && npx tsx --test --test-concurrency=2 src/access/permissions.test.ts src/access/actor.test.ts`
Expected: PASS (permissions 14 tests, actor 5 tests)

- [ ] **Step 6: 시험 목록에 더하고 타입을 본다**

`apps/api/package.json`의 `test` 스크립트 끝에 ` src/access/permissions.test.ts src/access/actor.test.ts`를 더한다.

Run: `npm run typecheck`
Expected: 타입 오류 없음

- [ ] **Step 7: 커밋**

```bash
git add packages/contracts/src/permissions.ts packages/contracts/src/index.ts apps/api/src/access apps/api/src/test-support apps/api/package.json
git commit -m "지금 소속과 권한표, 조직 칸 더하기"
```

---

### Task 6: 로그인 잇기, 학생회 만들기, 내 학생회 목록, 학생회 보기

로그인 계정과 운영진을 '로그인 잇기' 표로 잇는다(G1). 학생회 만들기는 한 거래로 운영진(없으면), 로그인 잇기, 학생회, 첫 기수, 회장 소속, 재정부(재정 역할), 초대 코드를 만든다(G6). `GET /api/me/councils`는 지금 소속이 있는 학생회를, `GET /api/organizations/:councilId`는 학생회 정보, 지금 기수, 내 직급과 부서, 내 권한 목록을 돌려준다.

**Files:**
- Create: `packages/contracts/src/councils.ts`, `packages/contracts/src/councils.test.ts`
- Modify: `packages/contracts/src/index.ts`, `packages/contracts/package.json`
- Create: `apps/api/src/invites/code.ts`
- Create: `apps/api/src/councils/link.ts`, `apps/api/src/councils/queries.ts`, `apps/api/src/councils/service.ts`, `apps/api/src/councils/routes.ts`
- Create: `apps/api/src/councils/link.test.ts`, `apps/api/src/councils/councils.test.ts`
- Create: `apps/api/src/test-support/http.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/serve.ts`, `apps/api/src/http/boundary.test.ts`, `apps/api/package.json`

**Interfaces:**
- Consumes: `createRecord`, `clockNow`, `Db`, `Tx`(Task 4), `actorOf`, `koreanDate`, `authorize`, `councilIdOf`, `permissionsOf`, `type Actor`(Task 5), `addUser`(Task 5 시험용), `requireSession`, `SessionReader`, `SessionEnv`(`auth/require-session.ts`), `json`, `ApiError`
- Produces:
  - 계약: `COUNCIL_NAME_MAX = 50`, `SCHOOL_NAME_MAX = 50`, `COHORT_NAME_MAX = 20`, `COUNCIL_UNITS`, `type CouncilUnit`, `dateInput`, `CreateCouncilSchema`(`{ name, unit, schoolName, cohortName, startsOn, endsOn }`, 끝일 > 시작일), `type CreateCouncilRequest`
  - 계약 응답: `MyCouncil = { id; name; councilRank: CouncilRank | null; departments: { id; name; rank }[] }`, `MyCouncilsResponse = { councils: MyCouncil[] }`, `CreateCouncilResponse = { council: MyCouncil }`, `CouncilTitles = { president; vicePresident; head; viceHead }`, `CouncilView = { council: { id; name; unit; schoolName; titles }; cohort: { id; name; startsOn; endsOn }; me: { memberId; name; councilRank; departments: { id; name; role; rank }[] }; permissions: Action[] }`
  - `INVITE_ALPHABET`, `newInviteCode(): string`, `freshInviteCode(db): Promise<string>`
  - `linkMember(tx, userId): Promise<string>`(운영진 번호. `users` 행을 `FOR NO KEY UPDATE`로 잠가 같은 계정의 잇기를 한 줄로 세운다. 같은 이메일이 다른 계정에 이어져 있으면 `EMAIL_IN_USE` 409)
  - `myCouncils(db, userId, now): Promise<MyCouncil[]>`, `councilView(db, actor): Promise<CouncilView>`
  - `FINANCE_DEPARTMENT_NAME = '재정부'`, `assertCurrentPeriod(period, now)`(`COHORT_NOT_CURRENT` 409), `createCouncil(tx, userId, input, now): Promise<string>`
  - `createCouncilRoutes(db: Db, getSession: SessionReader, clock?: () => Date)`, `AppOptions.councils`
  - HTTP: `GET /api/me/councils` → `MyCouncilsResponse`, `POST /api/organizations/create` → 201 `CreateCouncilResponse`, `GET /api/organizations/:councilId` → `CouncilView`
  - 시험용: `ORIGIN`, `testSession: SessionReader`(머리 `x-test-user`), `caller(app)` → `{ get(path, userId?), post(path, body, userId?) }`

- [ ] **Step 1: 실패하는 계약 시험을 쓴다**

`packages/contracts/src/councils.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { COHORT_NAME_MAX, COUNCIL_NAME_MAX, CreateCouncilSchema, SCHOOL_NAME_MAX, dateInput } from './councils.js'
import { isStrictObject } from './input.js'

const valid = { name: ' 컴퓨터학부 학생회 ', unit: 'department', schoolName: '한양대학교 ERICA', cohortName: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' }

test('학생회 만들기: 이름을 다듬고, 단위와 기수 기간을 받는다', () => {
  assert.deepEqual(CreateCouncilSchema.parse(valid), { ...valid, name: '컴퓨터학부 학생회' })
  for (const unit of ['department', 'college', 'university']) assert.equal(CreateCouncilSchema.safeParse({ ...valid, unit }).success, true)
  assert.equal(CreateCouncilSchema.safeParse({ ...valid, name: '😀'.repeat(COUNCIL_NAME_MAX) }).success, true)
  assert.equal(CreateCouncilSchema.safeParse({ ...valid, startsOn: '2028-02-29', endsOn: '2029-02-28' }).success, true)
  assert.equal(isStrictObject(CreateCouncilSchema), true)
})

test('학생회 만들기: 빠진 값, 빈 값, 상한+1, NUL·서러게이트, 모르는 키, 틀린 날짜와 거꾸로 된 기간을 거절한다', () => {
  const bad: unknown[] = [
    {}, { ...valid, name: undefined }, { ...valid, unit: undefined }, { ...valid, schoolName: undefined }, { ...valid, cohortName: undefined },
    { ...valid, startsOn: undefined }, { ...valid, endsOn: undefined },
    { ...valid, name: '' }, { ...valid, name: '   ' }, { ...valid, schoolName: ' ' }, { ...valid, cohortName: '' },
    { ...valid, name: '😀'.repeat(COUNCIL_NAME_MAX + 1) }, { ...valid, schoolName: '😀'.repeat(SCHOOL_NAME_MAX + 1) },
    { ...valid, cohortName: '😀'.repeat(COHORT_NAME_MAX + 1) },
    { ...valid, name: '학생회\u0000' }, { ...valid, schoolName: '\uD800' },
    { ...valid, extra: 1 }, { ...valid, unit: 'club' },
    { ...valid, startsOn: '2026-02-30' }, { ...valid, startsOn: '2026-1-1' }, { ...valid, startsOn: '1999-12-31' }, { ...valid, endsOn: '3000-01-01' },
    { ...valid, startsOn: '2026-12-31', endsOn: '2026-12-31' }, { ...valid, startsOn: '2027-01-01', endsOn: '2026-12-31' },
  ]
  for (const value of bad) assert.equal(CreateCouncilSchema.safeParse(value).success, false, JSON.stringify(value))
})

test('dateInput: 달력에 있는 YYYY-MM-DD만 받는다', () => {
  for (const value of ['2026-01-01', '2028-02-29', '2999-12-31']) assert.equal(dateInput.safeParse(value).success, true, value)
  for (const value of ['2027-02-29', '2026-13-01', '2026-00-10', '26-01-01', '2026/01/01', '', ' ', '2026-01-01T00:00', '\u00002026-01-01', 20260101]) {
    assert.equal(dateInput.safeParse(value).success, false, String(value))
  }
})
```

Run: `cd packages/contracts && npx tsx --test src/councils.test.ts`
Expected: FAIL (`Cannot find module` … `councils.js`)

- [ ] **Step 2: 학생회 계약을 만든다**

`packages/contracts/src/councils.ts`:

```ts
import { z } from 'zod'
import { text, token } from './input.js'
import type { Action, CouncilRank, DepartmentRank, DepartmentRole } from './permissions.js'

// 사람이 쓰는 이름의 상한. 학생회 이름은 지금 vada와 같은 50자다.
export const COUNCIL_NAME_MAX = 50
export const SCHOOL_NAME_MAX = 50
export const COHORT_NAME_MAX = 20
export const COUNCIL_UNITS = ['department', 'college', 'university'] as const
export type CouncilUnit = typeof COUNCIL_UNITS[number]

// 날짜(YYYY-MM-DD). 달력에 있는 날이고, koreanDateTime과 같은 범위(2000~2999년)만 받는다.
const datePattern = /^\d{4}-\d{2}-\d{2}$/
export const dateInput = token(10).refine(value => {
  if (!datePattern.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value && value >= '2000-01-01' && value <= '2999-12-31'
})

// 학생회 만들기(바탕 spec G6): 학생회 정보와 첫 기수. 끝일은 시작일보다 뒤다(DB CHECK ends_on > starts_on).
export const CreateCouncilSchema = z.strictObject({
  name: text(COUNCIL_NAME_MAX),
  unit: z.enum(COUNCIL_UNITS),
  schoolName: text(SCHOOL_NAME_MAX),
  cohortName: text(COHORT_NAME_MAX),
  startsOn: dateInput,
  endsOn: dateInput,
}).refine(value => value.endsOn > value.startsOn, { path: ['endsOn'] })
export type CreateCouncilRequest = z.infer<typeof CreateCouncilSchema>

// 내 학생회 목록의 한 줄: 학생회, 학생회 직급, 지금 부서 소속
export interface MyCouncil {
  id: string
  name: string
  councilRank: CouncilRank | null
  departments: { id: string; name: string; rank: DepartmentRank | null }[]
}
export interface MyCouncilsResponse { councils: MyCouncil[] }
export interface CreateCouncilResponse { council: MyCouncil }

// 직급 표시 이름. 학생회가 정한다(DEC-16). 비상대책위원장도 회장 직급에 표시 이름만 바꾼다.
export interface CouncilTitles { president: string; vicePresident: string; head: string; viceHead: string }
// 학생회 하나: 학생회 정보, 지금 기수, 내 직급과 부서, 내 권한 목록. 화면은 permissions로 동작 버튼을 보이거나 숨긴다(DEC-38).
export interface CouncilView {
  council: { id: string; name: string; unit: CouncilUnit; schoolName: string; titles: CouncilTitles }
  cohort: { id: string; name: string; startsOn: string; endsOn: string }
  me: { memberId: string; name: string; councilRank: CouncilRank | null
    departments: { id: string; name: string; role: DepartmentRole | null; rank: DepartmentRank | null }[] }
  permissions: Action[]
}
```

`packages/contracts/src/index.ts`를 다음으로 바꾼다:

```ts
export { codePoints, isStrictObject, text, token } from './input.js'
export { koreanDateTime, dateFromKorean, koreanOf } from './korean-time.js'
export { PUSH_ENDPOINT_MAX, PUSH_TEST_RESULTS, PushSubscriptionSchema, type PushSubscriptionRequest, type PushTestResult,
  type PushKeyResponse, type PushTestResponse } from './push.js'
export { COUNCIL_RANKS, DEPARTMENT_RANKS, DEPARTMENT_ROLES, ACTIONS, type CouncilRank, type DepartmentRank, type DepartmentRole,
  type Action } from './permissions.js'
export { COUNCIL_NAME_MAX, SCHOOL_NAME_MAX, COHORT_NAME_MAX, COUNCIL_UNITS, dateInput, CreateCouncilSchema, type CouncilUnit,
  type CreateCouncilRequest, type MyCouncil, type MyCouncilsResponse, type CreateCouncilResponse, type CouncilTitles, type CouncilView } from './councils.js'
export interface HealthResponse {
  status: 'ok'
}
```

`packages/contracts/package.json`의 `test` 스크립트 끝에 ` src/councils.test.ts`를 더한다.

Run: `npm test --workspace @vada/contracts`
Expected: PASS(`councils.test.ts` 3 tests 포함)

- [ ] **Step 3: 실패하는 서버 시험을 쓴다**

`apps/api/src/test-support/http.ts`:

```ts
import type { SessionReader } from '../auth/require-session.js'

export const ORIGIN = 'http://127.0.0.1:5180'

// 시험용 세션: 요청 머리 x-test-user가 로그인한 계정이다. 없으면 로그인하지 않은 요청이다.
export const testSession: SessionReader = async headers => {
  const userId = headers.get('x-test-user')
  return userId ? { user: { id: userId } } : null
}

type App = { request: (input: string, init?: RequestInit) => Response | Promise<Response> }
// 공통 가드를 지나는 요청(같은 출처, JSON)을 보낸다. userId를 빼면 로그인하지 않은 요청이다.
export function caller(app: App) {
  const as = (userId?: string): Record<string, string> => (userId ? { 'x-test-user': userId } : {})
  return {
    get: (path: string, userId?: string) => app.request(path, { headers: as(userId) }),
    post: (path: string, body: unknown, userId?: string) => app.request(path, {
      method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...as(userId) },
    }),
  }
}
```

`apps/api/src/councils/link.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb } from '../db/test-db.js'
import { createRecord } from '../records/records.js'
import { addUser } from '../test-support/council.js'
import { linkMember } from './link.js'

test('처음 잇으면 운영진을 만든다: 이름은 로그인 이름, 이메일은 소문자. 다시 부르면 같은 운영진이다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    await addUser(pg, 'u1', '김회장', 'Kim.Hoe@Example.COM')
    const first = await db.transaction(tx => linkMember(tx, 'u1'))
    assert.equal(await db.transaction(tx => linkMember(tx, 'u1')), first)
    assert.deepEqual((await pg.query('SELECT name, email FROM member')).rows, [{ name: '김회장', email: 'kim.hoe@example.com' }])
    assert.deepEqual((await pg.query('SELECT member_id, user_id FROM member_login')).rows, [{ member_id: first, user_id: 'u1' }])
    // 로그인 잇기가 만든 운영진은 시스템이 만든 기록이다(만든 사람과 판 1의 바꾼 사람이 없다).
    assert.deepEqual((await pg.query('SELECT created_by, council_id FROM record WHERE id = $1', [first])).rows, [{ created_by: null, council_id: null }])
    assert.deepEqual((await pg.query('SELECT version_no, changed_by FROM record_version WHERE record_id = $1', [first])).rows,
      [{ version_no: 1, changed_by: null }])
  } finally {
    await close()
  }
})

test('같은 이메일의 잇지 않은 운영진이 있으면 그 운영진에 잇는다. 대문자 이메일도 같은 사람이다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const waiting = await db.transaction(tx => createRecord(tx, { kind: 'member', councilId: null, actor: null,
      values: { name: '미리 적은 이름', email: 'lee@example.test' } }))
    await addUser(pg, 'u2', '이부원', 'LEE@Example.test')
    assert.equal(await db.transaction(tx => linkMember(tx, 'u2')), waiting)
    assert.equal((await pg.query('SELECT id FROM member')).rows.length, 1)
  } finally {
    await close()
  }
})

test('다른 계정에 이어진 운영진이 같은 이메일을 쓰면 409 EMAIL_IN_USE이고 아무것도 만들지 않는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    await addUser(pg, 'old', '예전 계정', 'park@example.test')
    await db.transaction(tx => linkMember(tx, 'old'))
    // 같은 이메일이 다른 Google 계정으로 옮겨 간 경우(드물다)
    await pg.query("UPDATE users SET email = 'park-old@example.test' WHERE id = 'old'")
    await addUser(pg, 'new', '새 계정', 'park@example.test')
    await assert.rejects(db.transaction(tx => linkMember(tx, 'new')), { code: 'EMAIL_IN_USE', status: 409 })
    assert.equal((await pg.query('SELECT member_id FROM member_login')).rows.length, 1)
    assert.equal((await pg.query('SELECT id FROM member')).rows.length, 1)
  } finally {
    await close()
  }
})
```

`apps/api/src/councils/councils.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ACTIONS, type CouncilView, type CreateCouncilResponse, type MyCouncilsResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import { addUser } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createCouncilRoutes } from './routes.js'

// 2026-10-19 12:00 KST
const noon = new Date('2026-10-19T03:00:00Z')
const body = { name: '컴퓨터학부 학생회', unit: 'department', schoolName: '한양대학교 ERICA', cohortName: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' }

function appOf(testDb: TestDb, now = noon) {
  const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: ORIGIN, councils: createCouncilRoutes(testDb.db, testSession, () => now) })
  return caller(app)
}

test('학생회 만들기는 한 거래로 운영진, 로그인 잇기, 학생회, 첫 기수, 회장 소속, 재정부, 초대 코드를 만든다', async () => {
  const testDb = await createTestDb()
  const { pg } = testDb
  try {
    await addUser(pg, 'u1', '김회장', 'kim@example.test')
    const response = await appOf(testDb).post('/api/organizations/create', body, 'u1')
    assert.equal(response.status, 201)
    const { council } = await response.json() as CreateCouncilResponse
    assert.deepEqual({ ...council, id: undefined }, { id: undefined, name: '컴퓨터학부 학생회', councilRank: 'president', departments: [] })
    const [creator] = (await pg.query<{ member_id: string }>("SELECT member_id FROM member_login WHERE user_id = 'u1'")).rows
    const kinds = await pg.query<{ kind: string; council_id: string | null; created_by: string | null }>(
      'SELECT kind, council_id, created_by FROM record ORDER BY created_at, id')
    assert.deepEqual(kinds.rows.map(row => row.kind), ['member', 'council', 'cohort', 'council_membership', 'department'])
    for (const row of kinds.rows.slice(1)) {
      assert.equal(row.created_by, creator!.member_id, row.kind)
      assert.equal(row.council_id, row.kind === 'council' ? null : council.id, row.kind)
    }
    assert.deepEqual((await pg.query('SELECT name, starts_on::text, ends_on::text FROM cohort')).rows,
      [{ name: '2026', starts_on: '2026-01-01', ends_on: '2026-12-31' }])
    assert.deepEqual((await pg.query('SELECT member_id, council_rank, ends_at FROM council_membership')).rows,
      [{ member_id: creator!.member_id, council_rank: 'president', ends_at: null }])
    assert.deepEqual((await pg.query('SELECT name, role FROM department')).rows, [{ name: '재정부', role: 'finance' }])
    const codes = await pg.query<{ code: string; created_by: string }>('SELECT code, created_by FROM invite_code WHERE council_id = $1', [council.id])
    assert.match(codes.rows[0]!.code, /^[2-9A-HJ-NP-Z]{8}$/)
    assert.equal(codes.rows[0]!.created_by, creator!.member_id)
    assert.equal((await pg.query('SELECT * FROM audit_body UNION ALL SELECT * FROM voting_body')).rows.length, 0)
    // 기록마다 판 1이 있다.
    assert.deepEqual((await pg.query('SELECT count(*)::int AS n FROM record r JOIN record_version v ON v.record_id = r.id AND v.version_no = 1')).rows, [{ n: 5 }])
  } finally {
    await testDb.close()
  }
})

test('학생회 만들기 중간에 실패하면 아무것도 남지 않는다', async (t) => {
  const testDb = await createTestDb()
  const { pg } = testDb
  try {
    await addUser(pg, 'u1')
    // 마지막 단계(초대 코드)를 실패시킨다.
    await pg.exec(`CREATE FUNCTION refuse() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'refused'; END $$;
      CREATE TRIGGER refuse BEFORE INSERT ON invite_code FOR EACH ROW EXECUTE FUNCTION refuse();`)
    // 예상하지 못한 실패는 on-error가 로그에 남긴다. 시험 출력에서는 숨긴다.
    t.mock.method(console, 'error', () => {})
    assert.equal((await appOf(testDb).post('/api/organizations/create', body, 'u1')).status, 500)
    for (const table of ['record', 'record_version', 'member', 'member_login', 'council', 'cohort', 'council_membership', 'department']) {
      assert.equal((await pg.query(`SELECT 1 FROM ${table}`)).rows.length, 0, table)
    }
  } finally {
    await testDb.close()
  }
})

test('내 학생회 목록과 학생회 하나 보기: 만든 사람은 회장이고 조직 칸 권한을 모두 가진다', async () => {
  const testDb = await createTestDb()
  try {
    await addUser(testDb.pg, 'u1', '김회장')
    await addUser(testDb.pg, 'u2', '이방문')
    const api = appOf(testDb)
    const { council } = await (await api.post('/api/organizations/create', body, 'u1')).json() as CreateCouncilResponse
    assert.deepEqual(await (await api.get('/api/me/councils', 'u1')).json() as MyCouncilsResponse, { councils: [council] })
    assert.deepEqual(await (await api.get('/api/me/councils', 'u2')).json() as MyCouncilsResponse, { councils: [] })
    const response = await api.get(`/api/organizations/${council.id}`, 'u1')
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    const view = await response.json() as CouncilView
    assert.deepEqual(view.council, { id: council.id, name: '컴퓨터학부 학생회', unit: 'department', schoolName: '한양대학교 ERICA',
      titles: { president: '회장', vicePresident: '부회장', head: '부장', viceHead: '부부장' } })
    assert.deepEqual({ ...view.cohort, id: undefined }, { id: undefined, name: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' })
    assert.deepEqual({ ...view.me, memberId: undefined }, { memberId: undefined, name: '김회장', councilRank: 'president', departments: [] })
    assert.deepEqual(view.permissions, [...ACTIONS])
  } finally {
    await testDb.close()
  }
})

test('다른 학생회 사람과 운영진이 아닌 사람은 403, 로그인하지 않으면 401이다', async () => {
  const testDb = await createTestDb()
  try {
    for (const user of ['u1', 'u2', 'u3']) await addUser(testDb.pg, user)
    const api = appOf(testDb)
    const first = (await (await api.post('/api/organizations/create', body, 'u1')).json() as CreateCouncilResponse).council
    await api.post('/api/organizations/create', { ...body, name: '경영학부 학생회' }, 'u2')
    assert.equal((await api.get(`/api/organizations/${first.id}`, 'u2')).status, 403)
    assert.equal((await api.get(`/api/organizations/${first.id}`, 'u3')).status, 403)
    assert.equal((await api.get('/api/organizations/not-a-uuid', 'u1')).status, 403)
    assert.equal((await api.get(`/api/organizations/${first.id}`)).status, 401)
    assert.equal((await api.get('/api/me/councils')).status, 401)
    assert.equal((await api.post('/api/organizations/create', body)).status, 401)
  } finally {
    await testDb.close()
  }
})

test('학생회 만들기 입력: 빠진 값, 빈 값, 상한+1, NUL·서러게이트, 모르는 키는 400이고 아무것도 만들지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    await addUser(testDb.pg, 'u1')
    const api = appOf(testDb)
    for (const bad of [{ ...body, name: undefined }, { ...body, name: '  ' }, { ...body, name: '😀'.repeat(51) }, { ...body, schoolName: 'a\u0000' },
      { ...body, cohortName: '\uD800' }, { ...body, extra: true }, { ...body, endsOn: '2026-01-01' }, { ...body, startsOn: '2026-02-30' }]) {
      const response = await api.post('/api/organizations/create', bad, 'u1')
      assert.equal(response.status, 400, JSON.stringify(bad))
      assert.deepEqual(await response.json(), { error: 'INVALID_INPUT' })
    }
    assert.equal((await testDb.pg.query('SELECT 1 FROM record')).rows.length, 0)
  } finally {
    await testDb.close()
  }
})

test('기수 기간이 오늘(한국 날짜)을 담지 않으면 409 COHORT_NOT_CURRENT다. 한국의 1월 1일 새벽(UTC로는 전날)에 만든 올해 기수는 받는다', async () => {
  const testDb = await createTestDb()
  try {
    await addUser(testDb.pg, 'u1')
    const api = appOf(testDb)
    for (const period of [{ startsOn: '2027-01-01', endsOn: '2027-12-31' }, { startsOn: '2025-01-01', endsOn: '2025-12-31' }]) {
      const response = await api.post('/api/organizations/create', { ...body, ...period }, 'u1')
      assert.equal(response.status, 409)
      assert.deepEqual(await response.json(), { error: 'COHORT_NOT_CURRENT' })
    }
    // 2026-01-01 00:30 KST = 2025-12-31 15:30 UTC
    const newYear = appOf(testDb, new Date('2025-12-31T15:30:00Z'))
    const response = await newYear.post('/api/organizations/create', body, 'u1')
    assert.equal(response.status, 201)
    const { council } = await response.json() as CreateCouncilResponse
    assert.equal((await newYear.get(`/api/organizations/${council.id}`, 'u1')).status, 200)
  } finally {
    await testDb.close()
  }
})
```

Run: `cd apps/api && npx tsx --test --test-concurrency=2 src/councils/link.test.ts src/councils/councils.test.ts`
Expected: FAIL (`Cannot find module` … `link.js`, `routes.js`)

- [ ] **Step 4: 초대 코드, 로그인 잇기, 학생회 만들기와 읽기, 경로를 만든다**

`apps/api/src/invites/code.ts`:

```ts
import { randomInt } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { inviteCode } from '../db/schema.js'
import type { Db } from '../records/records.js'

// 초대 코드 8자. 헷갈리는 0·1·I·O를 뺀 32글자에서 뽑는다(DB CHECK ^[2-9A-HJ-NP-Z]{8}$, 지금 vada와 같다).
export const INVITE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
export const newInviteCode = () => Array.from({ length: 8 }, () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]).join('')

// 아직 쓰이지 않은 코드. 겹칠 확률은 32^8분의 1이라 몇 번만 다시 뽑는다.
export async function freshInviteCode(db: Pick<Db, 'select'>): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newInviteCode()
    const [taken] = await db.select({ code: inviteCode.code }).from(inviteCode).where(eq(inviteCode.code, code))
    if (!taken) return code
  }
  throw new Error('Invite code collision')
}
```

`apps/api/src/councils/link.ts`:

```ts
import { eq } from 'drizzle-orm'
import { member, memberLogin, users } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { createRecord, type Tx } from '../records/records.js'

// 로그인 잇기(바탕 spec G1): 로그인 계정(users)과 운영진(member)을 하나씩 잇고 운영진 번호를 돌려준다.
// 이메일은 식별자가 아니다(OpenID Connect 5.7). 이어진 뒤에는 이메일이 바뀌어도 같은 Google 계정이면 같은 사람이다.
// 학생회를 만들거나 초대로 들어올 때만 부른다. 처음 잇는 운영진 기록은 시스템이 만든 것으로 둔다(만든 사람 없음).
export async function linkMember(tx: Tx, userId: string): Promise<string> {
  // 같은 계정의 잇기를 한 번에 하나씩 한다(두 탭에서 동시에 만들거나 들어올 때). 로그인 세션을 넣는 일은 막지 않는다(FOR NO KEY UPDATE).
  const [user] = await tx.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, userId)).for('no key update')
  if (!user) throw new Error('Session user missing')
  const [linked] = await tx.select({ memberId: memberLogin.memberId }).from(memberLogin).where(eq(memberLogin.userId, userId))
  if (linked) return linked.memberId
  const email = user.email.toLowerCase()
  // 같은 이메일의 운영진이 있고 아직 잇지 않았으면 그 운영진에 잇는다.
  const [existing] = await tx.select({ id: member.id, linkedTo: memberLogin.userId }).from(member)
    .leftJoin(memberLogin, eq(memberLogin.memberId, member.id)).where(eq(member.email, email))
  // 다른 계정에 이어진 운영진이 같은 이메일을 쓰고 있다. 운영진 이메일은 겹칠 수 없다(physical-model.md).
  if (existing?.linkedTo) throw new ApiError('EMAIL_IN_USE', 409)
  const memberId = existing?.id ?? await createRecord(tx, { kind: 'member', councilId: null, actor: null, values: { name: user.name, email } })
  await tx.insert(memberLogin).values({ memberId, userId })
  return memberId
}
```

`apps/api/src/councils/queries.ts`:

```ts
import { and, asc, eq, gte, inArray, isNull, lte } from 'drizzle-orm'
import type { CouncilView, MyCouncil } from '@vada/contracts'
import { koreanDate, type Actor } from '../access/actor.js'
import { permissionsOf } from '../access/permissions.js'
import { cohort, council, councilMembership, department, departmentMembership, member, memberLogin } from '../db/schema.js'
import type { Db } from '../records/records.js'

type Reader = Pick<Db, 'select'>

// 내 학생회 목록: 지금 소속이 있는 학생회와 그 학생회의 직급, 지금 부서 소속. 끝난 소속과 지난 기수는 빠진다.
export async function myCouncils(db: Reader, userId: string, now: Date): Promise<MyCouncil[]> {
  const today = koreanDate(now)
  const rows = await db.select({ id: council.id, name: council.name, councilRank: councilMembership.councilRank, memberId: memberLogin.memberId,
    cohortId: cohort.id })
    .from(memberLogin)
    .innerJoin(councilMembership, eq(councilMembership.memberId, memberLogin.memberId))
    .innerJoin(cohort, eq(cohort.id, councilMembership.cohortId))
    .innerJoin(council, eq(council.id, cohort.councilId))
    .where(and(eq(memberLogin.userId, userId), isNull(councilMembership.endsAt), lte(cohort.startsOn, today), gte(cohort.endsOn, today)))
    .orderBy(asc(council.id))
  const first = rows[0]
  if (!first) return []
  const placements = await db.select({ cohortId: departmentMembership.cohortId, id: department.id, name: department.name,
    rank: departmentMembership.departmentRank })
    .from(departmentMembership)
    .innerJoin(department, eq(department.id, departmentMembership.departmentId))
    .where(and(eq(departmentMembership.memberId, first.memberId), isNull(departmentMembership.endsAt),
      inArray(departmentMembership.cohortId, rows.map(row => row.cohortId))))
    .orderBy(asc(department.id))
  return rows.map(row => ({ id: row.id, name: row.name, councilRank: row.councilRank,
    departments: placements.filter(item => item.cohortId === row.cohortId).map(({ id, name, rank }) => ({ id, name, rank })) }))
}

// 학생회 하나: 학생회 정보, 지금 기수, 내 직급과 부서, 내 권한 목록
export async function councilView(db: Reader, actor: Actor): Promise<CouncilView> {
  const [row] = await db.select().from(council).where(eq(council.id, actor.councilId))
  const [period] = await db.select({ id: cohort.id, name: cohort.name, startsOn: cohort.startsOn, endsOn: cohort.endsOn })
    .from(cohort).where(eq(cohort.id, actor.cohortId))
  const [me] = await db.select({ name: member.name }).from(member).where(eq(member.id, actor.memberId))
  const ids = actor.departments.map(item => item.departmentId)
  const names = ids.length ? await db.select({ id: department.id, name: department.name }).from(department).where(inArray(department.id, ids)) : []
  if (!row || !period || !me) throw new Error('Council view missing rows')
  return {
    council: { id: row.id, name: row.name, unit: row.unit, schoolName: row.schoolName,
      titles: { president: row.presidentTitle, vicePresident: row.vicePresidentTitle, head: row.headTitle, viceHead: row.viceHeadTitle } },
    cohort: period,
    me: { memberId: actor.memberId, name: me.name, councilRank: actor.councilRank,
      departments: actor.departments.map(item => ({ id: item.departmentId, name: names.find(name => name.id === item.departmentId)?.name ?? '',
        role: item.role, rank: item.rank })) },
    permissions: permissionsOf(actor),
  }
}
```

`apps/api/src/councils/service.ts`:

```ts
import type { CreateCouncilRequest } from '@vada/contracts'
import { koreanDate } from '../access/actor.js'
import { inviteCode } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { freshInviteCode } from '../invites/code.js'
import { clockNow, createRecord, type Tx } from '../records/records.js'
import { linkMember } from './link.js'

// 학생회를 만들면 함께 생기는 재정 역할 부서(DEC-16). 이름은 나중에 바꿀 수 있다.
export const FINANCE_DEPARTMENT_NAME = '재정부'

// 기수의 기간이 오늘(한국 날짜)을 담아야 운영진에게 지금 소속이 생긴다. 담지 않으면 아무도 학생회를 열 수 없다.
export function assertCurrentPeriod(period: { startsOn: string; endsOn: string }, now: Date) {
  const today = koreanDate(now)
  if (period.startsOn > today || period.endsOn < today) throw new ApiError('COHORT_NOT_CURRENT', 409)
}

// 학생회 만들기는 한 거래다(바탕 spec G6): 운영진(없으면)과 로그인 잇기, 학생회, 첫 기수, 회장 소속, 재정부, 초대 코드.
// 감사기구와 의결기구는 만들지 않는다. 학생회 번호를 돌려준다.
export async function createCouncil(tx: Tx, userId: string, input: CreateCouncilRequest, now: Date): Promise<string> {
  assertCurrentPeriod(input, now)
  const actor = await linkMember(tx, userId)
  const councilId = await createRecord(tx, { kind: 'council', councilId: null, actor,
    values: { name: input.name, unit: input.unit, schoolName: input.schoolName } })
  const cohortId = await createRecord(tx, { kind: 'cohort', councilId, actor,
    values: { name: input.cohortName, startsOn: input.startsOn, endsOn: input.endsOn } })
  await createRecord(tx, { kind: 'council_membership', councilId, actor,
    values: { memberId: actor, cohortId, councilRank: 'president', startsAt: clockNow } })
  await createRecord(tx, { kind: 'department', councilId, actor, values: { name: FINANCE_DEPARTMENT_NAME, role: 'finance' } })
  await tx.insert(inviteCode).values({ councilId, code: await freshInviteCode(tx), createdBy: actor })
  return councilId
}
```

`apps/api/src/councils/routes.ts`:

```ts
import { Hono } from 'hono'
import { CreateCouncilSchema, type CouncilView, type CreateCouncilResponse, type MyCouncilsResponse } from '@vada/contracts'
import { authorize, councilIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import { json } from '../http/validate.js'
import type { Db } from '../records/records.js'
import { councilView, myCouncils } from './queries.js'
import { createCouncil } from './service.js'

// 학생회: 내 학생회 목록, 만들기, 학생회 하나 보기. clock은 시험에서 오늘을 정할 때만 바꾼다.
export function createCouncilRoutes(db: Db, getSession: SessionReader, clock: () => Date = () => new Date()) {
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)

  routes.get('/me/councils', auth, async c => c.json({ councils: await myCouncils(db, c.get('userId'), clock()) } satisfies MyCouncilsResponse))
  routes.post('/organizations/create', json(CreateCouncilSchema), auth, async c => {
    const now = clock()
    const userId = c.get('userId')
    const councilId = await db.transaction(tx => createCouncil(tx, userId, c.req.valid('json'), now))
    const council = (await myCouncils(db, userId, now)).find(item => item.id === councilId)
    if (!council) throw new Error('Council missing after create')
    return c.json({ council } satisfies CreateCouncilResponse, 201)
  })
  routes.get('/organizations/:councilId', auth, async c => {
    const actor = await authorize(db, c.get('userId'), councilIdOf(c.req.param('councilId')), 'council.view', clock())
    return c.json(await councilView(db, actor) satisfies CouncilView)
  })
  return routes
}
```

- [ ] **Step 5: 앱과 서버, 경계 시험에 잇는다**

`apps/api/src/app.ts`를 다음으로 바꾼다:

```ts
import { Hono } from 'hono'
import type { HealthResponse } from '@vada/contracts'
import type { createCouncilRoutes } from './councils/routes.js'
import type { createPushRoutes } from './push/routes.js'
import { handleError } from './http/on-error.js'
import { limitBody, mutationGuard } from './http/guard.js'

type AuthHandler = { handler: (request: Request) => Promise<Response> }
export type AppOptions = {
  auth: AuthHandler
  trustedOrigin: string
  // 학생회: 내 학생회 목록, 만들기, 보기, 설정, 기수
  councils?: ReturnType<typeof createCouncilRoutes>
  // 휴대폰 알림. 알림 열쇠(VAPID)가 없으면 만들지 않는다.
  push?: ReturnType<typeof createPushRoutes>
}

export function createApp({ auth, trustedOrigin, councils, push }: AppOptions) {
  const app = new Hono()
  app.use('/api/organizations/*', mutationGuard(trustedOrigin))
  // 로그인한 사람 자신의 것(휴대폰 알림)도 같은 가드를 건다.
  app.use('/api/me/*', mutationGuard(trustedOrigin))
  // 로그인 없이 쓰는 공개 경로(참가 신청)도 같은 화면에서만 보내므로 같은 가드를 건다.
  app.use('/api/public/*', mutationGuard(trustedOrigin))
  app.get('/api/health', (c) => c.json({ status: 'ok' } satisfies HealthResponse))
  // better-auth는 출처 검사 전에 본문 전체를 읽으므로 크기만 먼저 제한한다.
  app.use('/api/auth/*', limitBody())
  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))
  if (councils) app.route('/api', councils)
  if (push) app.route('/api', push)
  app.onError(handleError)
  return app
}
```

`apps/api/src/serve.ts`를 다음으로 바꾼다(세션 읽기를 `session` 하나로 모았다):

```ts
import { serve } from '@hono/node-server'
import { readRuntime } from './runtime.js'
import { attachWeb } from './web.js'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { createApp } from './app.js'
import { createAuth } from './auth/auth.js'
import { createCouncilRoutes } from './councils/routes.js'
import { startErrorReporting, stopErrorReporting } from './http/sentry.js'
import { pushConfigFrom } from './push/config.js'
import { createPushRoutes } from './push/routes.js'
import { createPushSender } from './push/sender.js'

function main() {
  const { env, production, hostname, port } = readRuntime(process.env, process.argv.includes('--production'))
  if (production) process.env.NODE_ENV = 'production'
  if (startErrorReporting(env.SENTRY_DSN, production ? 'production' : 'development')) console.log('오류 알림 켜짐 (Sentry)')
  // DB 마이그레이션은 서버 시작 시 자동 실행하지 않는다.
  const client = postgres(env.DATABASE_URL!, {
    max: 5, ssl: { rejectUnauthorized: true }, connect_timeout: 15, onnotice: () => {},
  })
  const db = drizzle(client)
  const auth = createAuth(db, {
    secret: env.BETTER_AUTH_SECRET!, baseURL: env.BETTER_AUTH_URL!,
    googleClientId: env.GOOGLE_CLIENT_ID!, googleClientSecret: env.GOOGLE_CLIENT_SECRET!,
  })
  const session = (headers: Headers) => auth.api.getSession({ headers })
  const councils = createCouncilRoutes(db, session)
  // 휴대폰 알림 열쇠는 서버에서만 쓴다. 없으면 알림 경로를 만들지 않는다.
  const pushConfig = pushConfigFrom(env)
  if (pushConfig) console.log('휴대폰 알림 켜짐 (Web Push)')
  const push = pushConfig
    ? createPushRoutes(session, pushConfig.publicKey, createPushSender(pushConfig))
    : undefined
  const app = createApp({ auth, trustedOrigin: env.BETTER_AUTH_URL!, councils, push })
  if (production) attachWeb(app)
  const server = serve({ fetch: app.fetch, hostname, port }, () => {
    console.log(`VADA ${production ? '웹 + API' : 'API'} 서버 시작 (port ${port})`)
  })
  server.on('error', () => {
    console.error('서버 실행 실패. 호스트와 포트 사용 여부를 확인하세요.')
    void client.end({ timeout: 5 })
    process.exitCode = 1
  })
  const shutdown = () => {
    server.close(() => { void client.end({ timeout: 5 }); void stopErrorReporting() })
  }
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
}

try {
  main()
} catch {
  console.error('서버 시작 실패. 설정을 확인하세요. 오류 원문은 출력하지 않습니다.')
  process.exitCode = 1
}
```

`apps/api/src/http/boundary.test.ts`를 다음으로 바꾼다(라우트 모듈에 빈 객체를 DB로 넘긴다, P32):

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { z } from 'zod'
import { createApp, type AppOptions } from '../app.js'
import { createCouncilRoutes } from '../councils/routes.js'
import { createPushRoutes } from '../push/routes.js'
import { bodyLimitOf, MAX_BODY_BYTES } from './guard.js'
import { json } from './validate.js'
import type { Db } from '../records/records.js'

// 공통 가드가 거는 곳: 로그인한 구성원의 경로, 로그인한 사람 자신의 경로(휴대폰 알림), 로그인 없이 쓰는 공개 경로
const guarded = ['/api/organizations/', '/api/me/', '/api/public/']
const isGuarded = (path: string) => guarded.some(prefix => path.startsWith(prefix))
// 공통 가드 밖의 변경 라우트. 새 항목은 가드를 대신할 자체 검사가 있어야 한다.
const outsideGuard = new Map([
  ['ALL /api/auth/*', '인증 본문 크기 제한 미들웨어'],
  ['POST /api/auth/*', 'better-auth가 출처를 직접 검사한다'],
])
const readOnly = new Set(['GET', 'HEAD', 'OPTIONS'])

test('모든 변경 라우트는 출처·형식·크기·JSON·모르는 키를 인증 전에 거절한다', async () => {
  const origin = 'http://127.0.0.1:5180'
  let authCalls = 0
  const session = async () => { authCalls++; return null }
  // 경계 검사는 DB에 닿기 전에 끝난다. 라우트가 DB를 건드리면 500이 나 아래 상태 검사가 실패한다.
  const db = {} as Db
  // AppOptions에 모듈이 추가되면 여기서 타입 오류가 나므로 이 테스트에서 빠질 수 없다.
  const modules = {
    councils: createCouncilRoutes(db, session),
    push: createPushRoutes(session, 'PUBLIC', async () => ({ result: 'sent' }), async () => {}),
  } satisfies Required<Omit<AppOptions, 'auth' | 'trustedOrigin'>>
  const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, ...modules })
  const writes = [...new Set(app.routes.filter(route => !readOnly.has(route.method)).map(route => `${route.method} ${route.path}`))]
  const pathOf = (key: string) => key.slice(key.indexOf(' ') + 1)
  for (const key of writes) {
    assert.ok(isGuarded(pathOf(key)) || outsideGuard.has(key), `${key}: 공통 가드 밖의 변경 라우트는 outsideGuard에 이유와 함께 적는다`)
  }
  for (const key of outsideGuard.keys()) assert.ok(writes.includes(key), `${key}: 없는 라우트가 outsideGuard에 남아 있다`)
  // 미들웨어 등록(/*)은 빼고 실제 라우트만 검사한다.
  const mutating = writes.filter(key => isGuarded(pathOf(key)) && !key.endsWith('/*'))
  // 목록이 비어 테스트가 저절로 통과하는 일을 막는다. 변경 라우트를 더하면 이 수도 올린다.
  assert.ok(mutating.length >= 2, `변경 라우트 ${mutating.length}개`)
  for (const key of mutating) {
    const registered = key.slice(0, key.indexOf(' '))
    // app.all()로 등록한 라우트는 POST로 확인한다.
    const method = registered === 'ALL' ? 'POST' : registered
    const path = pathOf(key).replace(/:[^/]+/g, 'probe')
    const send = (headers: Record<string, string>, body: string) => app.request(path, { method, headers, body })
    const jsonHeaders = { 'Content-Type': 'application/json', Origin: origin }
    assert.equal((await send({ ...jsonHeaders, Origin: 'https://evil.test' }, '{}')).status, 403, key)
    assert.equal((await send({ Origin: origin, 'Content-Type': 'text/plain' }, '{}')).status, 415, key)
    // 본문 상한은 경로마다 가드가 정한다. 그 상한을 넘으면 413이다.
    const limit = bodyLimitOf(path)
    assert.equal((await send(jsonHeaders, JSON.stringify({ x: 'a'.repeat(limit + 8) }))).status, 413, key)
    if (limit > MAX_BODY_BYTES) assert.notEqual((await send(jsonHeaders, JSON.stringify({ x: 'a'.repeat(MAX_BODY_BYTES + 8) }))).status, 413, key)
    const before = authCalls
    const malformed = await send(jsonHeaders, '{')
    assert.equal(malformed.status, 400, key)
    assert.deepEqual(await malformed.json(), { error: 'INVALID_INPUT' }, key)
    assert.equal((await send(jsonHeaders, '{"__probe":1}')).status, 400, key)
    assert.equal(authCalls, before, `${key}: 형식 검사가 인증보다 먼저여야 한다`)
  }
})

test('본문 상한은 가드 한 곳에서 경로마다 정한다: 학생회비 명단은 1 MiB, 회고 저장은 64 KiB이다', () => {
  assert.equal(bodyLimitOf('/api/organizations/a/dues-roster'), 1_048_576)
  assert.equal(bodyLimitOf('/api/organizations/a/events/e/report/retrospective'), 65_536)
  for (const path of ['/api/organizations/a/dues-roster/delete', '/api/organizations/a/expenses', '/api/public/registrations/lookup',
    '/api/organizations/a/b/dues-roster', '/api/organizations//dues-roster', '/api/organizations/a/events/e/report',
    '/api/organizations/a/events/e/report/retrospective/generate', '/api/organizations/a/events/e/report/retrospective/confirm',
    '/api/organizations/a/events//report/retrospective', '/api/organizations/a/events/e/report/retrospectives']) {
    assert.equal(bodyLimitOf(path), MAX_BODY_BYTES, path)
  }
})

test('json()은 모르는 키를 조용히 버리는 스키마를 라우트 생성 시점에 거부한다', () => {
  assert.throws(() => json(z.object({ title: z.string() })))
  assert.throws(() => json(z.looseObject({ title: z.string() })))
  assert.doesNotThrow(() => json(z.strictObject({ title: z.string() })))
})
```

`apps/api/package.json`의 `test` 스크립트 끝에 ` src/councils/link.test.ts src/councils/councils.test.ts`를 더한다.

- [ ] **Step 6: 시험이 통과하는지 본다**

Run: `cd apps/api && npx tsx --test --test-concurrency=2 src/councils/link.test.ts src/councils/councils.test.ts src/http/boundary.test.ts`
Expected: PASS (link 3, councils 6, boundary 3). 경계 시험이 `POST /api/organizations/create`의 출처 403, 형식 415, 크기 413, 깨진 JSON 400, 모르는 키 400을 인증 전에 본다.

Run: `npm run typecheck && cd apps/api && npx tsx --test --test-concurrency=2 $(node -p "require('./package.json').scripts.test.replace('tsx --test ', '')")`
Expected: 타입 오류 없음, `# fail 0`

- [ ] **Step 7: 커밋**

```bash
git add packages/contracts apps/api/src/invites apps/api/src/councils apps/api/src/test-support/http.ts apps/api/src/app.ts apps/api/src/serve.ts apps/api/src/http/boundary.test.ts apps/api/package.json
git commit -m "로그인 잇기와 학생회 만들기, 목록, 보기 더하기"
```

---

### Task 7: 초대 — 초대 확인, 들어오기, 초대 코드 보기와 바꾸기

초대 링크로 로그인한 사람은 지금 기수에 직급과 부서 없이 바로 들어온다(G3). 이미 지금 소속이면 아무것도 바꾸지 않고, 내보내졌던 사람은 같은 소속을 다시 연다(G4, P11). 초대 코드는 회장단이 보고 바꾸며, 바꾸면 옛 코드는 막힌다(G2). 들어오기와 코드 바꾸기는 학생회 행을 잠근다(P14).

**Files:**
- Modify: `packages/contracts/src/input.ts`, `packages/contracts/src/index.ts`, `packages/contracts/package.json`
- Create: `packages/contracts/src/invites.ts`, `packages/contracts/src/invites.test.ts`
- Create: `apps/api/src/invites/service.ts`, `apps/api/src/invites/routes.ts`, `apps/api/src/invites/invites.test.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/serve.ts`, `apps/api/src/http/boundary.test.ts`, `apps/api/package.json`

**Interfaces:**
- Consumes: `freshInviteCode`(Task 6), `linkMember`, `myCouncils`(Task 6), `createRecord`, `updateRecord`, `clockNow`(Task 4), `actorOf`, `koreanDate`, `authorize`, `authorizeChange`, `councilIdOf`(Task 5), `createCouncilRoutes`, `caller`, `testSession`, `ORIGIN`(Task 6)
- Produces:
  - 계약: `EmptyRequestSchema = z.strictObject({})`(input.ts), `INVITE_CODE_MAX = 16`, `InviteCodeSchema`, `JoinCouncilSchema = { code }`, `type JoinCouncilRequest`, `InvitePreviewResponse = { council: { id; name }; joined: boolean }`, `JoinCouncilResponse = { council: MyCouncil }`, `InviteCodeResponse = { code: string }`
  - `invitedCouncil(db, code): Promise<{ id; name }>`(없으면 404), `joinCouncil(tx, userId, code, now): Promise<string>`(학생회 번호. 지금 기수가 없으면 `NO_CURRENT_COHORT` 409)
  - `createInviteRoutes(db, getSession, clock?)`, `AppOptions.invites`
  - HTTP: `GET /api/invites/:code` → `InvitePreviewResponse`, `POST /api/organizations/join` → `JoinCouncilResponse`, `GET /api/organizations/:councilId/invite` → `InviteCodeResponse`(회장단), `POST /api/organizations/:councilId/invite/rotate`(본문 `{}`) → `InviteCodeResponse`(회장단)

- [ ] **Step 1: 실패하는 계약 시험을 쓴다**

`packages/contracts/src/invites.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EmptyRequestSchema, isStrictObject } from './input.js'
import { INVITE_CODE_MAX, InviteCodeSchema, JoinCouncilSchema } from './invites.js'

test('초대 코드: 공백·하이픈·소문자를 정규화하고, 빈 값·제어 문자·상한 초과는 거부한다', () => {
  assert.equal(InviteCodeSchema.parse(' abcd-2345 '), 'ABCD2345')
  assert.equal(InviteCodeSchema.parse('abcd 2345'), 'ABCD2345')
  for (const value of ['', '   ', '-', 'A'.repeat(INVITE_CODE_MAX + 1), '😀'.repeat(INVITE_CODE_MAX + 1), 'ABCD\u00002345', '\uD800ABCD', 'AB\tCD', 1, null]) {
    assert.equal(InviteCodeSchema.safeParse(value).success, false, JSON.stringify(value))
  }
})

test('들어오기 본문은 코드 하나만 받는다', () => {
  assert.deepEqual(JoinCouncilSchema.parse({ code: 'abcd2345' }), { code: 'ABCD2345' })
  for (const value of [{}, { code: '' }, { code: 'ABCD2345', extra: 1 }, { code: null }]) {
    assert.equal(JoinCouncilSchema.safeParse(value).success, false, JSON.stringify(value))
  }
  assert.equal(isStrictObject(JoinCouncilSchema), true)
})

test('빈 본문 스키마는 빈 객체만 받는다', () => {
  assert.deepEqual(EmptyRequestSchema.parse({}), {})
  for (const value of [{ x: 1 }, null, [], 'x']) assert.equal(EmptyRequestSchema.safeParse(value).success, false, JSON.stringify(value))
  assert.equal(isStrictObject(EmptyRequestSchema), true)
})
```

Run: `cd packages/contracts && npx tsx --test src/invites.test.ts`
Expected: FAIL (`Cannot find module` … `invites.js`)

- [ ] **Step 2: 초대 계약과 빈 본문 스키마를 만든다**

`packages/contracts/src/input.ts` 끝에 더한다:

```ts

// 본문에 받을 값이 없는 변경(코드 바꾸기, 내보내기, 없애기)도 빈 strictObject를 받는다. 공통 가드의 경계 검사가 모든 변경 라우트에 걸린다.
export const EmptyRequestSchema = z.strictObject({})
```

`packages/contracts/src/invites.ts`:

```ts
import { z } from 'zod'
import { token } from './input.js'
import type { MyCouncil } from './councils.js'

// 와이어프레임 INV-00의 8자리 초대 코드. 사람이 입력하므로 공백·하이픈·소문자를 받아 정규화한다(지금 vada와 같다).
export const INVITE_CODE_MAX = 16
export const InviteCodeSchema = token(INVITE_CODE_MAX)
  .transform(value => value.replace(/[\s-]/g, '').toUpperCase())
  .pipe(z.string().min(1))
export const JoinCouncilSchema = z.strictObject({ code: InviteCodeSchema })
export type JoinCouncilRequest = z.infer<typeof JoinCouncilSchema>

// 초대 확인: 코드만 아는 사람에게는 학생회 이름까지만 보여 준다. joined는 이미 지금 기수에 들어왔는지다.
export interface InvitePreviewResponse { council: { id: string; name: string }; joined: boolean }
export interface JoinCouncilResponse { council: MyCouncil }
// 초대 코드 보기와 바꾸기(회장단)
export interface InviteCodeResponse { code: string }
```

`packages/contracts/src/index.ts`를 다음으로 바꾼다:

```ts
export { codePoints, EmptyRequestSchema, isStrictObject, text, token } from './input.js'
export { koreanDateTime, dateFromKorean, koreanOf } from './korean-time.js'
export { PUSH_ENDPOINT_MAX, PUSH_TEST_RESULTS, PushSubscriptionSchema, type PushSubscriptionRequest, type PushTestResult,
  type PushKeyResponse, type PushTestResponse } from './push.js'
export { COUNCIL_RANKS, DEPARTMENT_RANKS, DEPARTMENT_ROLES, ACTIONS, type CouncilRank, type DepartmentRank, type DepartmentRole,
  type Action } from './permissions.js'
export { COUNCIL_NAME_MAX, SCHOOL_NAME_MAX, COHORT_NAME_MAX, COUNCIL_UNITS, dateInput, CreateCouncilSchema, type CouncilUnit,
  type CreateCouncilRequest, type MyCouncil, type MyCouncilsResponse, type CreateCouncilResponse, type CouncilTitles, type CouncilView } from './councils.js'
export { INVITE_CODE_MAX, InviteCodeSchema, JoinCouncilSchema, type JoinCouncilRequest, type InvitePreviewResponse,
  type JoinCouncilResponse, type InviteCodeResponse } from './invites.js'
export interface HealthResponse {
  status: 'ok'
}
```

`packages/contracts/package.json`의 `test` 스크립트 끝에 ` src/invites.test.ts`를 더한다.

Run: `npm test --workspace @vada/contracts`
Expected: PASS(`invites.test.ts` 3 tests 포함)

- [ ] **Step 3: 실패하는 서버 시험을 쓴다**

`apps/api/src/invites/invites.test.ts`(Review Focus 3·4: 다시 들어온 사람의 직급, 동시에 들어오기. 회장단 둘의 동시 코드 바꾸기도 본다. 동시 시험 둘은 PGlite가 거래를 하나씩 돌려 잠금이 없어도 통과한다는 것을 시험 안 주석에 적었다. 결과의 모양만 지킨다):

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CreateCouncilResponse, InviteCodeResponse, InvitePreviewResponse, JoinCouncilResponse, MyCouncilsResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createCouncilRoutes } from '../councils/routes.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { addUser } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createInviteRoutes } from './routes.js'

const noon = new Date('2026-10-19T03:00:00Z')
const body = { name: '컴퓨터학부 학생회', unit: 'department', schoolName: '한양대학교 ERICA', cohortName: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' }

function appOf(testDb: TestDb, now = noon) {
  return caller(createApp({ auth: { handler: async () => new Response() }, trustedOrigin: ORIGIN,
    councils: createCouncilRoutes(testDb.db, testSession, () => now), invites: createInviteRoutes(testDb.db, testSession, () => now) }))
}

// 회장(u1)이 학생회를 만들고 초대 코드를 받는다.
async function setup(testDb: TestDb, users = ['u1', 'u2', 'u3']) {
  for (const user of users) await addUser(testDb.pg, user, `이름 ${user}`)
  const api = appOf(testDb)
  const { council } = await (await api.post('/api/organizations/create', body, 'u1')).json() as CreateCouncilResponse
  const { code } = await (await api.get(`/api/organizations/${council.id}/invite`, 'u1')).json() as InviteCodeResponse
  return { api, council, code }
}

// 한 행만 나와야 하는 조회의 그 행
function one<T>(rows: T[]): T {
  assert.equal(rows.length, 1)
  return rows[0]!
}

const membershipsOf = (testDb: TestDb, userId: string) => testDb.pg.query<{ id: string; council_rank: string | null; ends_at: string | null; starts_at: string }>(
  `SELECT cm.id, cm.council_rank, cm.ends_at::text, cm.starts_at::text FROM council_membership cm
   JOIN member_login ml ON ml.member_id = cm.member_id WHERE ml.user_id = $1`, [userId])

test('초대 확인은 학생회 이름과 이미 들어왔는지만 보여 주고, 코드는 공백·하이픈·소문자를 정규화한다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, council, code } = await setup(testDb)
    const typed = `${code.slice(0, 4).toLowerCase()}-${code.slice(4)}`
    assert.deepEqual(await (await api.get(`/api/invites/${encodeURIComponent(typed)}`, 'u2')).json() as InvitePreviewResponse,
      { council: { id: council.id, name: '컴퓨터학부 학생회' }, joined: false })
    assert.deepEqual(await (await api.get(`/api/invites/${code}`, 'u1')).json() as InvitePreviewResponse,
      { council: { id: council.id, name: '컴퓨터학부 학생회' }, joined: true })
    for (const wrong of ['ZZZZ2222', '%00', 'A'.repeat(17)]) assert.equal((await api.get(`/api/invites/${wrong}`, 'u2')).status, 404, wrong)
    assert.equal((await api.get(`/api/invites/${code}`)).status, 401)
  } finally {
    await testDb.close()
  }
})

test('초대 코드로 들어오면 지금 기수에 직급과 부서 없이 들어오고, 다시 들어와도 아무것도 바꾸지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, council, code } = await setup(testDb)
    const response = await api.post('/api/organizations/join', { code: code.toLowerCase() }, 'u2')
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json() as JoinCouncilResponse,
      { council: { id: council.id, name: '컴퓨터학부 학생회', councilRank: null, departments: [] } })
    const [joined] = (await membershipsOf(testDb, 'u2')).rows
    assert.deepEqual({ ...joined, id: undefined, starts_at: undefined }, { id: undefined, council_rank: null, ends_at: null, starts_at: undefined })
    // 들어온 사람이 자기 소속 기록을 만든 사람이다.
    assert.deepEqual((await testDb.pg.query(`SELECT r.created_by = ml.member_id AS self FROM record r, member_login ml
      WHERE r.id = $1 AND ml.user_id = 'u2'`, [joined!.id])).rows, [{ self: true }])
    assert.equal((await api.post('/api/organizations/join', { code }, 'u2')).status, 200)
    assert.equal((await membershipsOf(testDb, 'u2')).rows.length, 1)
    assert.equal((await testDb.pg.query('SELECT 1 FROM record_version WHERE record_id = $1', [joined!.id])).rows.length, 1)
    assert.deepEqual(await (await api.get('/api/me/councils', 'u2')).json() as MyCouncilsResponse,
      { councils: [{ id: council.id, name: '컴퓨터학부 학생회', councilRank: null, departments: [] }] })
  } finally {
    await testDb.close()
  }
})

test('두 탭에서 동시에 들어와도 소속과 판은 하나이고 둘 다 200이다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, code } = await setup(testDb)
    // PGlite는 거래를 하나씩 돌려 잠금이 없어도 이 시험은 통과한다. 실제 PostgreSQL의 동시 처리는 바꾸는 날 두 기기로 본다.
    const responses = await Promise.all([api.post('/api/organizations/join', { code }, 'u2'), api.post('/api/organizations/join', { code }, 'u2')])
    assert.deepEqual(responses.map(response => response.status), [200, 200])
    const memberships = (await membershipsOf(testDb, 'u2')).rows
    assert.equal(memberships.length, 1)
    assert.equal((await testDb.pg.query('SELECT 1 FROM record_version WHERE record_id = $1', [memberships[0]!.id])).rows.length, 1)
    assert.equal((await testDb.pg.query("SELECT 1 FROM member_login WHERE user_id = 'u2'")).rows.length, 1)
  } finally {
    await testDb.close()
  }
})

test('내보내졌던 사람이 다시 들어오면 같은 소속을 다시 연다. 직급과 부서는 돌아오지 않고, 끝났던 상태는 판에 남는다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, council, code } = await setup(testDb)
    await api.post('/api/organizations/join', { code }, 'u2')
    const { id: membershipId, starts_at: firstStart } = one((await membershipsOf(testDb, 'u2')).rows)
    // 부회장이자 재정부원이던 사람을 내보낸다(내보내기 경로는 다음 작업에서 만든다. 여기서는 기록 모듈로 같은 변경을 한다).
    // 거래 안에서는 tx만 쓴다. 거래 밖의 pg.query를 부르면 PGlite가 거래가 끝나기를 기다려 멈춘다.
    const { cohort_id: cohortId, member_id: memberId } = one((await testDb.pg.query<{ cohort_id: string; member_id: string }>(
      'SELECT cohort_id, member_id FROM council_membership WHERE id = $1', [membershipId])).rows)
    const { id: finance } = one((await testDb.pg.query<{ id: string }>("SELECT id FROM department WHERE role = 'finance'")).rows)
    await testDb.db.transaction(async tx => {
      await updateRecord(tx, { kind: 'council_membership', id: membershipId, actor: null, reason: null, changes: { councilRank: 'vice_president' } })
      const placement = await createRecord(tx, { kind: 'department_membership', councilId: council.id, actor: null,
        values: { memberId, departmentId: finance, cohortId, startsAt: clockNow } })
      await updateRecord(tx, { kind: 'department_membership', id: placement, actor: null, reason: null, changes: { endsAt: clockNow } })
      await updateRecord(tx, { kind: 'council_membership', id: membershipId, actor: null, reason: null, changes: { endsAt: clockNow } })
    })
    assert.deepEqual(await (await api.get('/api/me/councils', 'u2')).json() as MyCouncilsResponse, { councils: [] })
    assert.deepEqual(await (await api.get(`/api/invites/${code}`, 'u2')).json() as InvitePreviewResponse,
      { council: { id: council.id, name: '컴퓨터학부 학생회' }, joined: false })
    assert.equal((await api.post('/api/organizations/join', { code }, 'u2')).status, 200)
    const [reopened] = (await membershipsOf(testDb, 'u2')).rows
    assert.equal(reopened!.id, membershipId)
    assert.equal(reopened!.council_rank, null)
    assert.equal(reopened!.ends_at, null)
    assert.ok(reopened!.starts_at > firstStart)
    assert.deepEqual(await (await api.get('/api/me/councils', 'u2')).json() as MyCouncilsResponse,
      { councils: [{ id: council.id, name: '컴퓨터학부 학생회', councilRank: null, departments: [] }] })
    const versions = await testDb.pg.query<{ rank: string | null; ended: boolean }>(
      "SELECT data->>'council_rank' AS rank, data->>'ends_at' IS NOT NULL AS ended FROM record_version WHERE record_id = $1 ORDER BY version_no", [membershipId])
    assert.deepEqual(versions.rows, [{ rank: null, ended: false }, { rank: 'vice_president', ended: false }, { rank: 'vice_president', ended: true },
      { rank: null, ended: false }])
  } finally {
    await testDb.close()
  }
})

test('초대 코드 보기와 바꾸기는 회장단만 한다. 바꾸면 옛 코드는 막히고 새 코드로 들어온다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, council, code } = await setup(testDb, ['u1', 'u2', 'u3', 'u4'])
    await api.post('/api/organizations/join', { code }, 'u2')
    const other = (await (await api.post('/api/organizations/create', { ...body, name: '경영학부 학생회' }, 'u4')).json() as CreateCouncilResponse).council
    for (const user of ['u2', 'u4']) {
      assert.equal((await api.get(`/api/organizations/${council.id}/invite`, user)).status, 403, user)
      assert.equal((await api.post(`/api/organizations/${council.id}/invite/rotate`, {}, user)).status, 403, user)
    }
    assert.equal((await api.get(`/api/organizations/${other.id}/invite`, 'u1')).status, 403)
    assert.equal((await api.post(`/api/organizations/${council.id}/invite/rotate`, {})).status, 401)
    const rotated = await api.post(`/api/organizations/${council.id}/invite/rotate`, {}, 'u1')
    assert.equal(rotated.status, 200)
    const { code: next } = await rotated.json() as InviteCodeResponse
    assert.match(next, /^[2-9A-HJ-NP-Z]{8}$/)
    assert.notEqual(next, code)
    assert.deepEqual(await (await api.get(`/api/organizations/${council.id}/invite`, 'u1')).json() as InviteCodeResponse, { code: next })
    assert.equal((await api.get(`/api/invites/${code}`, 'u3')).status, 404)
    assert.equal((await api.post('/api/organizations/join', { code }, 'u3')).status, 404)
    assert.equal((await api.post('/api/organizations/join', { code: next }, 'u3')).status, 200)
    // 이미 들어온 운영진은 그대로다.
    assert.equal((await api.get(`/api/organizations/${council.id}`, 'u2')).status, 200)
  } finally {
    await testDb.close()
  }
})

test('회장단 둘이 동시에 코드를 바꾸면 둘 다 200이고, 나중 코드 하나만 남아 들어올 수 있다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, council, code } = await setup(testDb)
    await api.post('/api/organizations/join', { code }, 'u2')
    const { id } = one((await membershipsOf(testDb, 'u2')).rows)
    await testDb.db.transaction(tx => updateRecord(tx, { kind: 'council_membership', id, actor: null, reason: null, changes: { councilRank: 'vice_president' } }))
    // PGlite는 거래를 하나씩 돌려 잠금이 없어도 이 시험은 통과한다. 실제 PostgreSQL의 동시 처리는 바꾸는 날 두 기기로 본다.
    const responses = await Promise.all(['u1', 'u2'].map(user => api.post(`/api/organizations/${council.id}/invite/rotate`, {}, user)))
    assert.deepEqual(responses.map(response => response.status), [200, 200])
    const codes = await Promise.all(responses.map(async response => (await response.json() as InviteCodeResponse).code))
    const stored = (await testDb.pg.query<{ code: string }>('SELECT code FROM invite_code WHERE council_id = $1', [council.id])).rows
    assert.equal(stored.length, 1)
    assert.ok(codes.includes(stored[0]!.code))
    for (const used of [code, ...codes.filter(item => item !== stored[0]!.code)]) assert.equal((await api.get(`/api/invites/${used}`, 'u3')).status, 404)
  } finally {
    await testDb.close()
  }
})

test('지금 기수가 없으면 409 NO_CURRENT_COHORT이고, 들어오기 입력이 틀리면 400, 로그인하지 않으면 401이다', async () => {
  const testDb = await createTestDb()
  try {
    const { code } = await setup(testDb)
    const nextYear = appOf(testDb, new Date('2027-03-01T03:00:00Z'))
    const late = await nextYear.post('/api/organizations/join', { code }, 'u2')
    assert.equal(late.status, 409)
    assert.deepEqual(await late.json(), { error: 'NO_CURRENT_COHORT' })
    const api = appOf(testDb)
    for (const bad of [{}, { code: '' }, { code: '   ' }, { code: 'A'.repeat(17) }, { code: 'AB\u0000CD' }, { code: '\uD800' }, { code, extra: 1 }]) {
      assert.equal((await api.post('/api/organizations/join', bad, 'u2')).status, 400, JSON.stringify(bad))
    }
    assert.equal((await api.post('/api/organizations/join', { code })).status, 401)
    assert.equal((await membershipsOf(testDb, 'u2')).rows.length, 0)
  } finally {
    await testDb.close()
  }
})
```

Run: `cd apps/api && npx tsx --test src/invites/invites.test.ts`
Expected: FAIL (`Cannot find module` … `routes.js`)

- [ ] **Step 4: 들어오기와 초대 경로를 만든다**

`apps/api/src/invites/service.ts`:

```ts
import { and, eq, gte, lte } from 'drizzle-orm'
import { koreanDate } from '../access/actor.js'
import { linkMember } from '../councils/link.js'
import { cohort, council, councilMembership, inviteCode } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { clockNow, createRecord, updateRecord, type Db, type Tx } from '../records/records.js'

// 초대 코드로 학생회를 찾는다. 형식이 틀린 코드와 없는 코드를 구분하지 않는다. 둘 다 404다.
export async function invitedCouncil(db: Pick<Db, 'select'>, code: string) {
  const [found] = await db.select({ id: council.id, name: council.name }).from(inviteCode)
    .innerJoin(council, eq(council.id, inviteCode.councilId)).where(eq(inviteCode.code, code))
  if (!found) throw new ApiError('NOT_FOUND', 404)
  return found
}

// 초대 링크로 들어오기(바탕 spec G3, G4): 지금 기수에 직급과 부서 없이 바로 들어온다.
// 이미 지금 소속이면 아무것도 바꾸지 않는다. 내보내졌던 사람은 같은 소속을 다시 연다. 직급과 부서는 돌아오지 않는다.
export async function joinCouncil(tx: Tx, userId: string, code: string, now: Date): Promise<string> {
  const { id: councilId } = await invitedCouncil(tx, code)
  // 학생회 행을 잠가 코드 바꾸기, 내보내기와 한 번에 하나씩 처리한다(FOR NO KEY UPDATE, authorizeChange와 같다). 잠근 뒤 코드가 아직 그 학생회의 것인지 다시 본다.
  await tx.select({ id: council.id }).from(council).where(eq(council.id, councilId)).for('no key update')
  const [still] = await tx.select({ code: inviteCode.code }).from(inviteCode).where(and(eq(inviteCode.councilId, councilId), eq(inviteCode.code, code)))
  if (!still) throw new ApiError('NOT_FOUND', 404)
  const today = koreanDate(now)
  const [current] = await tx.select({ id: cohort.id }).from(cohort)
    .where(and(eq(cohort.councilId, councilId), lte(cohort.startsOn, today), gte(cohort.endsOn, today)))
  if (!current) throw new ApiError('NO_CURRENT_COHORT', 409)
  const memberId = await linkMember(tx, userId)
  const [membership] = await tx.select({ id: councilMembership.id, endsAt: councilMembership.endsAt }).from(councilMembership)
    .where(and(eq(councilMembership.memberId, memberId), eq(councilMembership.cohortId, current.id)))
  if (!membership) {
    await createRecord(tx, { kind: 'council_membership', councilId, actor: memberId, values: { memberId, cohortId: current.id, startsAt: clockNow } })
  } else if (membership.endsAt !== null) {
    await updateRecord(tx, { kind: 'council_membership', id: membership.id, actor: memberId, reason: null,
      changes: { startsAt: clockNow, endsAt: null, councilRank: null } })
  }
  return councilId
}
```

`apps/api/src/invites/routes.ts`:

```ts
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { EmptyRequestSchema, InviteCodeSchema, JoinCouncilSchema, type InviteCodeResponse, type InvitePreviewResponse,
  type JoinCouncilResponse } from '@vada/contracts'
import { actorOf } from '../access/actor.js'
import { authorize, authorizeChange, councilIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import { myCouncils } from '../councils/queries.js'
import { inviteCode } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { json } from '../http/validate.js'
import { clockNow, type Db } from '../records/records.js'
import { freshInviteCode } from './code.js'
import { invitedCouncil, joinCouncil } from './service.js'

// 초대: 초대 확인과 들어오기(로그인한 누구나), 초대 코드 보기와 바꾸기(회장단, DEC-47).
export function createInviteRoutes(db: Db, getSession: SessionReader, clock: () => Date = () => new Date()) {
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)
  routes.get('/invites/:code', auth, async c => {
    const code = InviteCodeSchema.safeParse(c.req.param('code'))
    if (!code.success) throw new ApiError('NOT_FOUND', 404)
    const found = await invitedCouncil(db, code.data)
    const joined = await actorOf(db, c.get('userId'), found.id, clock()) !== null
    return c.json({ council: found, joined } satisfies InvitePreviewResponse)
  })
  routes.post('/organizations/join', json(JoinCouncilSchema), auth, async c => {
    const now = clock()
    const userId = c.get('userId')
    const councilId = await db.transaction(tx => joinCouncil(tx, userId, c.req.valid('json').code, now))
    const council = (await myCouncils(db, userId, now)).find(item => item.id === councilId)
    if (!council) throw new Error('Council missing after join')
    return c.json({ council } satisfies JoinCouncilResponse)
  })
  routes.get('/organizations/:councilId/invite', auth, async c => {
    const councilId = councilIdOf(c.req.param('councilId'))
    await authorize(db, c.get('userId'), councilId, 'invite.manage', clock())
    const [row] = await db.select({ code: inviteCode.code }).from(inviteCode).where(eq(inviteCode.councilId, councilId))
    if (!row) throw new Error('Invite code missing')
    return c.json({ code: row.code } satisfies InviteCodeResponse)
  })
  // 바꾸면 옛 코드로는 들어올 수 없다. 이미 들어온 운영진은 그대로다(DEC-47).
  routes.post('/organizations/:councilId/invite/rotate', json(EmptyRequestSchema), auth, async c => {
    const councilId = councilIdOf(c.req.param('councilId'))
    const userId = c.get('userId')
    const now = clock()
    const code = await db.transaction(async tx => {
      const actor = await authorizeChange(tx, userId, councilId, 'invite.manage', now)
      const next = await freshInviteCode(tx)
      await tx.update(inviteCode).set({ code: next, createdBy: actor.memberId, createdAt: clockNow }).where(eq(inviteCode.councilId, councilId))
      return next
    })
    return c.json({ code } satisfies InviteCodeResponse)
  })
  return routes
}
```

- [ ] **Step 5: 앱과 서버, 경계 시험에 잇는다**

`apps/api/src/app.ts`를 다음으로 바꾼다:

```ts
import { Hono } from 'hono'
import type { HealthResponse } from '@vada/contracts'
import type { createCouncilRoutes } from './councils/routes.js'
import type { createInviteRoutes } from './invites/routes.js'
import type { createPushRoutes } from './push/routes.js'
import { handleError } from './http/on-error.js'
import { limitBody, mutationGuard } from './http/guard.js'

type AuthHandler = { handler: (request: Request) => Promise<Response> }
export type AppOptions = {
  auth: AuthHandler
  trustedOrigin: string
  // 학생회: 내 학생회 목록, 만들기, 보기, 설정, 기수
  councils?: ReturnType<typeof createCouncilRoutes>
  // 초대: 초대 확인, 들어오기, 초대 코드 보기와 바꾸기
  invites?: ReturnType<typeof createInviteRoutes>
  // 휴대폰 알림. 알림 열쇠(VAPID)가 없으면 만들지 않는다.
  push?: ReturnType<typeof createPushRoutes>
}

export function createApp({ auth, trustedOrigin, councils, invites, push }: AppOptions) {
  const app = new Hono()
  app.use('/api/organizations/*', mutationGuard(trustedOrigin))
  // 로그인한 사람 자신의 것(휴대폰 알림)도 같은 가드를 건다.
  app.use('/api/me/*', mutationGuard(trustedOrigin))
  // 로그인 없이 쓰는 공개 경로(참가 신청)도 같은 화면에서만 보내므로 같은 가드를 건다.
  app.use('/api/public/*', mutationGuard(trustedOrigin))
  app.get('/api/health', (c) => c.json({ status: 'ok' } satisfies HealthResponse))
  // better-auth는 출처 검사 전에 본문 전체를 읽으므로 크기만 먼저 제한한다.
  app.use('/api/auth/*', limitBody())
  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))
  if (councils) app.route('/api', councils)
  if (invites) app.route('/api', invites)
  if (push) app.route('/api', push)
  app.onError(handleError)
  return app
}
```

`apps/api/src/serve.ts`에서:
1. `import { startErrorReporting, stopErrorReporting } from './http/sentry.js'` 아래에 `import { createInviteRoutes } from './invites/routes.js'`를 더한다.
2. `  const councils = createCouncilRoutes(db, session)` 아래에 `  const invites = createInviteRoutes(db, session)`를 더한다.
3. `createApp({ auth, trustedOrigin: env.BETTER_AUTH_URL!, councils, push })`를 `createApp({ auth, trustedOrigin: env.BETTER_AUTH_URL!, councils, invites, push })`로 바꾼다.

`apps/api/src/http/boundary.test.ts`에서:
1. `import { createCouncilRoutes } from '../councils/routes.js'` 아래에 `import { createInviteRoutes } from '../invites/routes.js'`를 더한다.
2. `modules`의 `    councils: createCouncilRoutes(db, session),` 아래에 `    invites: createInviteRoutes(db, session),`를 더한다.
3. `assert.ok(mutating.length >= 2,`를 `assert.ok(mutating.length >= 4,`로 바꾼다.

`apps/api/package.json`의 `test` 스크립트 끝에 ` src/invites/invites.test.ts`를 더한다.

- [ ] **Step 6: 시험이 통과하는지 본다**

Run: `cd apps/api && npx tsx --test --test-concurrency=2 src/invites/invites.test.ts src/http/boundary.test.ts`
Expected: PASS (invites 7, boundary 3)

Run: `npm run typecheck && cd apps/api && npx tsx --test --test-concurrency=2 $(node -p "require('./package.json').scripts.test.replace('tsx --test ', '')")`
Expected: 타입 오류 없음, `# fail 0`

- [ ] **Step 7: 커밋**

```bash
git add packages/contracts apps/api/src/invites apps/api/src/app.ts apps/api/src/serve.ts apps/api/src/http/boundary.test.ts apps/api/package.json
git commit -m "초대 링크로 들어오기와 초대 코드 바꾸기 더하기"
```

---

### Task 8: 운영진 편성 — 목록, 부서 배정과 빼기, 직급, 회장 넘기기, 내보내기

운영진 목록(이메일 없음, G12)과 회장단의 편성이다. 내보내면 학생회 소속과 그 기수의 부서 소속을 함께 끝내고(G4), 회장은 넘긴 뒤에만 내보낸다. 회장 넘기기는 한 번에 거두고 준다(P10). 모든 변경은 목록 전체를 돌려준다(P21). spec의 흐름 시험(만들기 → 들어오기 → 배정 → 내보내기 → 다시 들어오기 → 넘기기)도 여기서 잇는다.

**Files:**
- Create: `packages/contracts/src/team.ts`, `packages/contracts/src/team.test.ts`
- Modify: `packages/contracts/src/index.ts`, `packages/contracts/package.json`
- Create: `apps/api/src/team/queries.ts`, `apps/api/src/team/service.ts`, `apps/api/src/team/routes.ts`
- Create: `apps/api/src/team/team.test.ts`, `apps/api/src/team/flow.test.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/serve.ts`, `apps/api/src/http/boundary.test.ts`, `apps/api/package.json`

**Interfaces:**
- Consumes: `createRecord`, `updateRecord`, `updateRecords`, `clockNow`, `type AnyRecordChange`(Task 4), `can`, `authorize`, `authorizeChange`, `councilIdOf`, `recordIdOf`, `type Actor`(Task 5), `createCouncilRoutes`(Task 6), `createInviteRoutes`(Task 7), 시험용 `caller`, `testSession`, `ORIGIN`, `addUser`
- Produces:
  - 계약: `recordIdInput`(uuid, 소문자로 맞춤), `TeamMember = { id; name; councilRank; departments: { id; rank }[]; joinedAt: string }`, `TeamDepartment = { id; name; role; memberCount }`, `TeamResponse = { members; departments }`, `AssignDepartmentSchema = { departmentId, rank: 'head' | 'vice_head' | null }`, `ChangeRankSchema = { rank: 'vice_president' | null }`, `TransferPresidentSchema = { memberId }`와 각 `…Request` 타입
  - `teamOf(db, actor): Promise<TeamResponse>`
  - `currentMembership(tx, actor, memberId)`, `departmentOf(tx, actor, departmentId)`(없으면 404), `assignDepartment(tx, actor, memberId, departmentId, rank)`, `removeFromDepartment(tx, actor, memberId, departmentId)`, `changeRank(tx, actor, memberId, rank)`, `transferPresident(tx, actor, memberId)`, `removeMember(tx, actor, memberId)`
  - `createTeamRoutes(db, getSession, clock?)`, `AppOptions.team`
  - HTTP(모두 `TeamResponse`): `GET /api/organizations/:councilId/members`, `POST …/members/:memberId/departments`, `POST …/members/:memberId/departments/:departmentId/remove`(`{}`), `POST …/members/:memberId/rank`, `POST …/president/transfer`, `POST …/members/:memberId/remove`(`{}`)

- [ ] **Step 1: 실패하는 계약 시험을 쓴다**

`packages/contracts/src/team.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isStrictObject } from './input.js'
import { AssignDepartmentSchema, ChangeRankSchema, TransferPresidentSchema } from './team.js'

const id = '0192F2A0-0000-7000-8000-000000000001'

test('부서 배정: 부서 번호는 uuid(소문자로 맞춤), 직급은 부장·부부장·없음이다', () => {
  assert.deepEqual(AssignDepartmentSchema.parse({ departmentId: id, rank: null }), { departmentId: id.toLowerCase(), rank: null })
  for (const rank of ['head', 'vice_head']) assert.equal(AssignDepartmentSchema.safeParse({ departmentId: id, rank }).success, true)
  const bad: unknown[] = [{}, { departmentId: id }, { rank: null }, { departmentId: '', rank: null }, { departmentId: 'probe', rank: null },
    { departmentId: `${id}0`, rank: null }, { departmentId: `${id.slice(0, -1)}\u0000`, rank: null }, { departmentId: id, rank: 'president' },
    { departmentId: id, rank: 'HEAD' }, { departmentId: id, rank: null, extra: 1 }]
  for (const value of bad) assert.equal(AssignDepartmentSchema.safeParse(value).success, false, JSON.stringify(value))
})

test('직급: 부회장 주고 거두기만 받는다. 회장은 넘기기로만 바뀐다', () => {
  assert.deepEqual(ChangeRankSchema.parse({ rank: 'vice_president' }), { rank: 'vice_president' })
  assert.deepEqual(ChangeRankSchema.parse({ rank: null }), { rank: null })
  for (const value of [{}, { rank: 'president' }, { rank: '' }, { rank: null, extra: 1 }]) {
    assert.equal(ChangeRankSchema.safeParse(value).success, false, JSON.stringify(value))
  }
})

test('회장 넘기기: 넘겨받을 운영진 번호 하나만 받는다', () => {
  assert.deepEqual(TransferPresidentSchema.parse({ memberId: id }), { memberId: id.toLowerCase() })
  for (const value of [{}, { memberId: '' }, { memberId: '😀'.repeat(37) }, { memberId: '\uD800' }, { memberId: id, extra: 1 }]) {
    assert.equal(TransferPresidentSchema.safeParse(value).success, false, JSON.stringify(value))
  }
  for (const schema of [AssignDepartmentSchema, ChangeRankSchema, TransferPresidentSchema]) assert.equal(isStrictObject(schema), true)
})
```

Run: `cd packages/contracts && npx tsx --test src/team.test.ts`
Expected: FAIL (`Cannot find module` … `team.js`)

- [ ] **Step 2: 운영진 계약을 만든다**

`packages/contracts/src/team.ts`:

```ts
import { z } from 'zod'
import { token } from './input.js'
import { DEPARTMENT_RANKS, type CouncilRank, type DepartmentRank, type DepartmentRole } from './permissions.js'

// 본문으로 받는 기록 번호(부서, 넘겨받을 운영진). uuid가 아니면 400이다. 소문자로 맞춘다.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const recordIdInput = token(36).refine(value => uuid.test(value)).transform(value => value.toLowerCase())

// 운영진 목록의 한 줄. 들어온 순서와 시각을 보인다(DEC-47). 이메일은 보이지 않는다(바탕 spec G12).
export interface TeamMember {
  id: string
  name: string
  councilRank: CouncilRank | null
  departments: { id: string; rank: DepartmentRank | null }[]
  // 지금 소속을 연 시각(ISO). 다시 들어오면 다시 들어온 시각이다.
  joinedAt: string
}
export interface TeamDepartment { id: string; name: string; role: DepartmentRole | null; memberCount: number }
// 운영진 > 사람과 부서 화면이 같이 쓴다. 회장단의 변경도 이 응답을 돌려주고, 화면은 받은 값으로 목록을 통째로 바꾼다.
export interface TeamResponse { members: TeamMember[]; departments: TeamDepartment[] }

// 부서 배정과 부서 직급(부장, 부부장, 없음). 이미 그 부서면 직급만 바꾼다.
export const AssignDepartmentSchema = z.strictObject({ departmentId: recordIdInput, rank: z.enum(DEPARTMENT_RANKS).nullable() })
export type AssignDepartmentRequest = z.infer<typeof AssignDepartmentSchema>
// 부회장 주고 거두기. 회장 직급은 넘기기로만 바뀐다.
export const ChangeRankSchema = z.strictObject({ rank: z.enum(['vice_president']).nullable() })
export type ChangeRankRequest = z.infer<typeof ChangeRankSchema>
// 회장 넘기기. 넘긴 사람은 직급 없음이 된다.
export const TransferPresidentSchema = z.strictObject({ memberId: recordIdInput })
export type TransferPresidentRequest = z.infer<typeof TransferPresidentSchema>
```

`packages/contracts/src/index.ts`를 다음으로 바꾼다:

```ts
export { codePoints, EmptyRequestSchema, isStrictObject, text, token } from './input.js'
export { koreanDateTime, dateFromKorean, koreanOf } from './korean-time.js'
export { PUSH_ENDPOINT_MAX, PUSH_TEST_RESULTS, PushSubscriptionSchema, type PushSubscriptionRequest, type PushTestResult,
  type PushKeyResponse, type PushTestResponse } from './push.js'
export { COUNCIL_RANKS, DEPARTMENT_RANKS, DEPARTMENT_ROLES, ACTIONS, type CouncilRank, type DepartmentRank, type DepartmentRole,
  type Action } from './permissions.js'
export { COUNCIL_NAME_MAX, SCHOOL_NAME_MAX, COHORT_NAME_MAX, COUNCIL_UNITS, dateInput, CreateCouncilSchema, type CouncilUnit,
  type CreateCouncilRequest, type MyCouncil, type MyCouncilsResponse, type CreateCouncilResponse, type CouncilTitles, type CouncilView } from './councils.js'
export { INVITE_CODE_MAX, InviteCodeSchema, JoinCouncilSchema, type JoinCouncilRequest, type InvitePreviewResponse,
  type JoinCouncilResponse, type InviteCodeResponse } from './invites.js'
export { recordIdInput, AssignDepartmentSchema, ChangeRankSchema, TransferPresidentSchema, type TeamMember, type TeamDepartment,
  type TeamResponse, type AssignDepartmentRequest, type ChangeRankRequest, type TransferPresidentRequest } from './team.js'
export interface HealthResponse {
  status: 'ok'
}
```

`packages/contracts/package.json`의 `test` 스크립트 끝에 ` src/team.test.ts`를 더한다.

Run: `npm test --workspace @vada/contracts`
Expected: PASS(`team.test.ts` 3 tests 포함)

- [ ] **Step 3: 실패하는 서버 시험을 쓴다**

`apps/api/src/team/team.test.ts`(목록, 배정·빼기·다시 넣기, 권한과 404·400, 부회장, 회장 넘기기, 내보내기, 넘기기와 내보내기가 겹칠 때. 겹침 시험은 PGlite가 거래를 하나씩 돌려 잠금이 없어도 통과한다는 것을 시험 안 주석에 적었다):

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CreateCouncilResponse, InviteCodeResponse, TeamResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createCouncilRoutes } from '../councils/routes.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import { createInviteRoutes } from '../invites/routes.js'
import { addUser } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createTeamRoutes } from './routes.js'

const noon = new Date('2026-10-19T03:00:00Z')
const body = { name: '컴퓨터학부 학생회', unit: 'department', schoolName: '한양대학교 ERICA', cohortName: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' }

function appOf(testDb: TestDb) {
  const clock = () => noon
  return caller(createApp({ auth: { handler: async () => new Response() }, trustedOrigin: ORIGIN,
    councils: createCouncilRoutes(testDb.db, testSession, clock), invites: createInviteRoutes(testDb.db, testSession, clock),
    team: createTeamRoutes(testDb.db, testSession, clock) }))
}

// 회장 u1이 학생회를 만들고 u2·u3·u4가 초대로 들어온다. u5는 다른 학생회의 회장이다.
async function setup(testDb: TestDb) {
  for (const user of ['u1', 'u2', 'u3', 'u4', 'u5']) await addUser(testDb.pg, user, `이름 ${user}`, `${user}@example.test`)
  const api = appOf(testDb)
  const { council } = await (await api.post('/api/organizations/create', body, 'u1')).json() as CreateCouncilResponse
  const { code } = await (await api.get(`/api/organizations/${council.id}/invite`, 'u1')).json() as InviteCodeResponse
  for (const user of ['u2', 'u3', 'u4']) await api.post('/api/organizations/join', { code }, user)
  const { council: other } = await (await api.post('/api/organizations/create', { ...body, name: '경영학부 학생회' }, 'u5')).json() as CreateCouncilResponse
  const team = await (await api.get(`/api/organizations/${council.id}/members`, 'u1')).json() as TeamResponse
  const otherTeam = await (await api.get(`/api/organizations/${other.id}/members`, 'u5')).json() as TeamResponse
  const id = (user: string) => team.members.find(item => item.name === `이름 ${user}`)!.id
  const base = `/api/organizations/${council.id}`
  return { api, base, council, other, finance: team.departments[0]!.id, otherFinance: otherTeam.departments[0]!.id,
    otherPresident: otherTeam.members[0]!.id, member: { u1: id('u1'), u2: id('u2'), u3: id('u3'), u4: id('u4') } }
}

// 그 학생회의 끝나지 않은 회장 소속
const presidentsOf = async (testDb: TestDb, councilId: string) => (await testDb.pg.query<{ member_id: string }>(
  `SELECT cm.member_id FROM council_membership cm JOIN cohort co ON co.id = cm.cohort_id
   WHERE co.council_id = $1 AND cm.council_rank = 'president' AND cm.ends_at IS NULL`, [councilId])).rows.map(row => row.member_id)

const versionsOf = async (testDb: TestDb, recordId: string) => (await testDb.pg.query<{ version_no: number }>(
  'SELECT version_no FROM record_version WHERE record_id = $1', [recordId])).rows.length

test('운영진 목록: 모든 운영진이 들어온 순서대로 이름, 직급, 부서, 들어온 시각을 보고 이메일은 없다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, member, finance } = await setup(testDb)
    const response = await api.get(`${base}/members`, 'u3')
    assert.equal(response.status, 200)
    const team = await response.json() as TeamResponse
    assert.deepEqual(team.members.map(item => [item.id, item.name, item.councilRank, item.departments]), [
      [member.u1, '이름 u1', 'president', []], [member.u2, '이름 u2', null, []], [member.u3, '이름 u3', null, []], [member.u4, '이름 u4', null, []]])
    assert.ok(team.members.every(item => !Number.isNaN(Date.parse(item.joinedAt))))
    assert.deepEqual(team.departments, [{ id: finance, name: '재정부', role: 'finance', memberCount: 0 }])
    assert.ok(!JSON.stringify(team).includes('@'))
    assert.deepEqual(Object.keys(team.members[0]!).sort(), ['councilRank', 'departments', 'id', 'joinedAt', 'name'])
    assert.equal((await api.get(`${base}/members`, 'u5')).status, 403)
    assert.equal((await api.get(`${base}/members`)).status, 401)
  } finally {
    await testDb.close()
  }
})

test('부서 배정과 부서 직급: 처음이면 만들고, 직급만 바꾸고, 같으면 그대로, 빼면 끝내고, 다시 넣으면 같은 소속을 연다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, member, finance } = await setup(testDb)
    const assign = (rank: string | null) => api.post(`${base}/members/${member.u2}/departments`, { departmentId: finance, rank }, 'u1')
    let team = await (await assign('head')).json() as TeamResponse
    assert.deepEqual(team.members.find(item => item.id === member.u2)!.departments, [{ id: finance, rank: 'head' }])
    assert.equal(team.departments[0]!.memberCount, 1)
    const [{ id: placement }] = (await testDb.pg.query<{ id: string }>('SELECT id FROM department_membership')).rows as [{ id: string }]
    team = await (await assign('vice_head')).json() as TeamResponse
    assert.deepEqual(team.members.find(item => item.id === member.u2)!.departments, [{ id: finance, rank: 'vice_head' }])
    assert.equal((await assign('vice_head')).status, 200)
    assert.equal(await versionsOf(testDb, placement), 2)
    team = await (await api.post(`${base}/members/${member.u2}/departments/${finance}/remove`, {}, 'u1')).json() as TeamResponse
    assert.deepEqual(team.members.find(item => item.id === member.u2)!.departments, [])
    assert.equal(team.departments[0]!.memberCount, 0)
    assert.equal((await api.post(`${base}/members/${member.u2}/departments/${finance}/remove`, {}, 'u1')).status, 404)
    team = await (await assign(null)).json() as TeamResponse
    assert.deepEqual(team.members.find(item => item.id === member.u2)!.departments, [{ id: finance, rank: null }])
    assert.equal((await testDb.pg.query('SELECT id FROM department_membership')).rows.length, 1)
    assert.equal(await versionsOf(testDb, placement), 4)
  } finally {
    await testDb.close()
  }
})

test('편성은 회장단만 한다. 다른 학생회의 부서나 운영진 번호는 404, 형식이 틀린 본문은 400이다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, member, finance, otherFinance, otherPresident } = await setup(testDb)
    const attempts = [
      [`${base}/members/${member.u2}/departments`, { departmentId: finance, rank: null }],
      [`${base}/members/${member.u2}/departments/${finance}/remove`, {}],
      [`${base}/members/${member.u2}/rank`, { rank: 'vice_president' }],
      [`${base}/president/transfer`, { memberId: member.u2 }],
      [`${base}/members/${member.u2}/remove`, {}],
    ] as const
    for (const [path, payload] of attempts) {
      assert.equal((await api.post(path, payload, 'u3')).status, 403, path)
      assert.equal((await api.post(path, payload, 'u5')).status, 403, path)
      assert.equal((await api.post(path, payload)).status, 401, path)
    }
    assert.equal((await api.post(`${base}/members/${member.u2}/departments`, { departmentId: otherFinance, rank: null }, 'u1')).status, 404)
    assert.equal((await api.post(`${base}/members/${otherPresident}/departments`, { departmentId: finance, rank: null }, 'u1')).status, 404)
    assert.equal((await api.post(`${base}/members/${otherPresident}/remove`, {}, 'u1')).status, 404)
    assert.equal((await api.post(`${base}/president/transfer`, { memberId: otherPresident }, 'u1')).status, 404)
    assert.equal((await api.post(`${base}/members/not-a-uuid/remove`, {}, 'u1')).status, 404)
    for (const payload of [{}, { departmentId: 'probe', rank: null }, { departmentId: finance, rank: 'president' }, { departmentId: finance, rank: null, extra: 1 }]) {
      assert.equal((await api.post(`${base}/members/${member.u2}/departments`, payload, 'u1')).status, 400, JSON.stringify(payload))
    }
    for (const payload of [{ rank: 'president' }, {}, { rank: null, extra: 1 }]) {
      assert.equal((await api.post(`${base}/members/${member.u2}/rank`, payload, 'u1')).status, 400, JSON.stringify(payload))
    }
    assert.equal((await api.post(`${base}/members/${member.u2}/remove`, { reason: 'x' }, 'u1')).status, 400)
  } finally {
    await testDb.close()
  }
})

test('부회장을 주면 회장단 권한이 생기고, 거두면 다음 요청부터 막힌다. 회장의 직급은 이 경로로 바꿀 수 없다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, member, finance } = await setup(testDb)
    const team = await (await api.post(`${base}/members/${member.u2}/rank`, { rank: 'vice_president' }, 'u1')).json() as TeamResponse
    assert.equal(team.members.find(item => item.id === member.u2)!.councilRank, 'vice_president')
    assert.equal((await api.post(`${base}/members/${member.u3}/departments`, { departmentId: finance, rank: 'head' }, 'u2')).status, 200)
    const president = await api.post(`${base}/members/${member.u1}/rank`, { rank: null }, 'u2')
    assert.equal(president.status, 409)
    assert.deepEqual(await president.json(), { error: 'PRESIDENT_REQUIRED' })
    assert.equal((await api.post(`${base}/members/${member.u2}/rank`, { rank: null }, 'u1')).status, 200)
    assert.equal((await api.post(`${base}/members/${member.u3}/departments/${finance}/remove`, {}, 'u2')).status, 403)
  } finally {
    await testDb.close()
  }
})

test('회장 넘기기는 회장만 한다. 넘긴 사람은 직급 없음이 되고, 자기에게 넘기면 409다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, council, member } = await setup(testDb)
    await api.post(`${base}/members/${member.u2}/rank`, { rank: 'vice_president' }, 'u1')
    assert.equal((await api.post(`${base}/president/transfer`, { memberId: member.u3 }, 'u2')).status, 403)
    const self = await api.post(`${base}/president/transfer`, { memberId: member.u1 }, 'u1')
    assert.equal(self.status, 409)
    assert.deepEqual(await self.json(), { error: 'ALREADY_PRESIDENT' })
    const team = await (await api.post(`${base}/president/transfer`, { memberId: member.u3 }, 'u1')).json() as TeamResponse
    assert.deepEqual(team.members.map(item => item.councilRank), [null, 'vice_president', 'president', null])
    assert.equal((await api.post(`${base}/president/transfer`, { memberId: member.u1 }, 'u1')).status, 403)
    assert.deepEqual(await presidentsOf(testDb, council.id), [member.u3])
  } finally {
    await testDb.close()
  }
})

test('내보내기: 회장은 409 PRESIDENT_CANNOT_LEAVE, 스스로는 409 CANNOT_REMOVE_SELF. 내보내면 부서 소속도 끝나고 다음 요청부터 403이다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, member, finance } = await setup(testDb)
    await api.post(`${base}/members/${member.u2}/rank`, { rank: 'vice_president' }, 'u1')
    await api.post(`${base}/members/${member.u4}/departments`, { departmentId: finance, rank: 'head' }, 'u1')
    const president = await api.post(`${base}/members/${member.u1}/remove`, {}, 'u2')
    assert.equal(president.status, 409)
    assert.deepEqual(await president.json(), { error: 'PRESIDENT_CANNOT_LEAVE' })
    const self = await api.post(`${base}/members/${member.u2}/remove`, {}, 'u2')
    assert.equal(self.status, 409)
    assert.deepEqual(await self.json(), { error: 'CANNOT_REMOVE_SELF' })
    assert.equal((await api.get(base, 'u4')).status, 200)
    const team = await (await api.post(`${base}/members/${member.u4}/remove`, {}, 'u2')).json() as TeamResponse
    assert.ok(!team.members.some(item => item.id === member.u4))
    assert.equal(team.departments[0]!.memberCount, 0)
    assert.equal((await testDb.pg.query('SELECT 1 FROM department_membership WHERE ends_at IS NULL')).rows.length, 0)
    assert.equal((await api.get(base, 'u4')).status, 403)
    assert.equal((await api.get(`${base}/members`, 'u4')).status, 403)
    assert.equal((await api.post(`${base}/members/${member.u4}/remove`, {}, 'u2')).status, 404)
  } finally {
    await testDb.close()
  }
})

test('회장 넘기기와 내보내기가 겹쳐도 회장은 늘 한 명이고, 내보낸 사람은 회장이 되지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, council, member } = await setup(testDb)
    await api.post(`${base}/members/${member.u2}/rank`, { rank: 'vice_president' }, 'u1')
    // PGlite는 거래를 하나씩 돌려 잠금이 없어도 이 시험은 통과한다. 실제 PostgreSQL의 동시 처리는 바꾸는 날 두 기기로 본다.
    const [transfer, removal] = await Promise.all([
      api.post(`${base}/president/transfer`, { memberId: member.u4 }, 'u1'),
      api.post(`${base}/members/${member.u4}/remove`, {}, 'u2'),
    ])
    assert.ok([[200, 409], [404, 200]].some(([a, b]) => transfer.status === a && removal.status === b), `${transfer.status} ${removal.status}`)
    const presidents = await presidentsOf(testDb, council.id)
    assert.equal(presidents.length, 1)
    const removed = (await testDb.pg.query('SELECT 1 FROM council_membership WHERE member_id = $1 AND ends_at IS NOT NULL', [member.u4])).rows.length === 1
    assert.equal(presidents[0], removed ? member.u1 : member.u4)
  } finally {
    await testDb.close()
  }
})
```

`apps/api/src/team/flow.test.ts`(spec '흐름'. 판의 개수와 바꾼 사람, 단계마다의 DB 상태):

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CreateCouncilResponse, InviteCodeResponse, MyCouncilsResponse, TeamResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createCouncilRoutes } from '../councils/routes.js'
import { createTestDb } from '../db/test-db.js'
import { createInviteRoutes } from '../invites/routes.js'
import { addUser } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createTeamRoutes } from './routes.js'

// 바탕 spec '흐름(서버 통합)': 만들기 → 링크로 들어오기 → 부서 배정 → 내보내기 → 다시 들어오기 → 회장 넘기기
test('흐름: 판의 개수와 바꾼 사람, 단계마다의 DB 상태', async () => {
  const testDb = await createTestDb()
  const { pg, db } = testDb
  try {
    const clock = () => new Date('2026-10-19T03:00:00Z')
    const api = caller(createApp({ auth: { handler: async () => new Response() }, trustedOrigin: ORIGIN,
      councils: createCouncilRoutes(db, testSession, clock), invites: createInviteRoutes(db, testSession, clock), team: createTeamRoutes(db, testSession, clock) }))
    await addUser(pg, 'kim', '김회장', 'kim@example.test')
    await addUser(pg, 'lee', '이운영', 'lee@example.test')
    const memberOf = async (user: string) => (await pg.query<{ member_id: string }>('SELECT member_id FROM member_login WHERE user_id = $1', [user])).rows[0]?.member_id
    const versions = async (recordId: string) => (await pg.query<{ changed_by: string | null; rank: string | null; department_rank: string | null; ended: boolean }>(
      `SELECT changed_by, data->>'council_rank' AS rank, data->>'department_rank' AS department_rank, data->>'ends_at' IS NOT NULL AS ended
       FROM record_version WHERE record_id = $1 ORDER BY version_no`, [recordId])).rows

    // 1. 학생회를 만든다.
    const { council } = await (await api.post('/api/organizations/create', { name: '컴퓨터학부 학생회', unit: 'department',
      schoolName: '한양대학교 ERICA', cohortName: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' }, 'kim')).json() as CreateCouncilResponse
    const base = `/api/organizations/${council.id}`
    const kim = (await memberOf('kim'))!
    const { code } = await (await api.get(`${base}/invite`, 'kim')).json() as InviteCodeResponse

    // 2. 링크로 들어온다.
    assert.equal((await api.post('/api/organizations/join', { code }, 'lee')).status, 200)
    const lee = (await memberOf('lee'))!
    const [{ id: leeMembership }] = (await pg.query<{ id: string }>('SELECT id FROM council_membership WHERE member_id = $1', [lee])).rows as [{ id: string }]
    assert.deepEqual(await versions(leeMembership), [{ changed_by: lee, rank: null, department_rank: null, ended: false }])

    // 3. 부서를 배정한다(재정부 부장).
    const before = await (await api.get(`${base}/members`, 'kim')).json() as TeamResponse
    const finance = before.departments[0]!.id
    assert.equal((await api.post(`${base}/members/${lee}/departments`, { departmentId: finance, rank: 'head' }, 'kim')).status, 200)
    const [{ id: placement }] = (await pg.query<{ id: string }>('SELECT id FROM department_membership WHERE member_id = $1', [lee])).rows as [{ id: string }]

    // 4. 내보낸다. 내보낸 사람의 다음 요청은 403이다.
    assert.equal((await api.post(`${base}/members/${lee}/remove`, {}, 'kim')).status, 200)
    assert.equal((await api.get(base, 'lee')).status, 403)
    assert.equal((await api.get(`${base}/members`, 'lee')).status, 403)
    assert.deepEqual(await (await api.get('/api/me/councils', 'lee')).json() as MyCouncilsResponse, { councils: [] })
    assert.deepEqual((await pg.query('SELECT ends_at IS NOT NULL AS ended FROM council_membership WHERE id = $1', [leeMembership])).rows, [{ ended: true }])
    assert.deepEqual((await pg.query('SELECT ends_at IS NOT NULL AS ended FROM department_membership WHERE id = $1', [placement])).rows, [{ ended: true }])

    // 5. 다시 들어온다. 같은 소속이 다시 열리고, 부서와 직급은 없다.
    assert.equal((await api.post('/api/organizations/join', { code }, 'lee')).status, 200)
    assert.equal((await api.get(base, 'lee')).status, 200)
    assert.deepEqual((await pg.query('SELECT id FROM council_membership WHERE member_id = $1', [lee])).rows, [{ id: leeMembership }])

    // 6. 회장을 넘긴다.
    const after = await (await api.post(`${base}/president/transfer`, { memberId: lee }, 'kim')).json() as TeamResponse
    assert.deepEqual(after.members.map(item => [item.name, item.councilRank, item.departments]), [['김회장', null, []], ['이운영', 'president', []]])

    // 판: 들어온 사람의 소속은 들어오기(본인) → 내보내기(회장) → 다시 들어오기(본인) → 회장 받기(넘긴 사람)
    assert.deepEqual(await versions(leeMembership), [
      { changed_by: lee, rank: null, department_rank: null, ended: false },
      { changed_by: kim, rank: null, department_rank: null, ended: true },
      { changed_by: lee, rank: null, department_rank: null, ended: false },
      { changed_by: kim, rank: 'president', department_rank: null, ended: false },
    ])
    const [{ id: kimMembership }] = (await pg.query<{ id: string }>('SELECT id FROM council_membership WHERE member_id = $1', [kim])).rows as [{ id: string }]
    assert.deepEqual(await versions(kimMembership), [
      { changed_by: kim, rank: 'president', department_rank: null, ended: false },
      { changed_by: kim, rank: null, department_rank: null, ended: false },
    ])
    assert.deepEqual(await versions(placement), [
      { changed_by: kim, rank: null, department_rank: 'head', ended: false },
      { changed_by: kim, rank: null, department_rank: 'head', ended: true },
    ])
    // 판은 기록마다 이어진다. 지금 판은 하나다.
    assert.deepEqual((await pg.query(`SELECT record_id FROM record_version WHERE upper(valid) IS NULL GROUP BY record_id HAVING count(*) > 1`)).rows, [])
  } finally {
    await testDb.close()
  }
})
```

Run: `cd apps/api && npx tsx --test --test-concurrency=2 src/team/team.test.ts src/team/flow.test.ts`
Expected: FAIL (`Cannot find module` … `team/routes.js`)

- [ ] **Step 4: 운영진 목록과 편성을 만든다**

`apps/api/src/team/queries.ts`:

```ts
import { and, asc, eq, isNull } from 'drizzle-orm'
import type { TeamResponse } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { councilMembership, department, departmentMembership, member } from '../db/schema.js'
import type { Db } from '../records/records.js'

// 운영진과 부서 목록. 지금 기수의 끝나지 않은 소속만 보인다. 들어온 순서대로 놓고, 이메일은 넣지 않는다(바탕 spec G12).
export async function teamOf(db: Pick<Db, 'select'>, actor: Actor): Promise<TeamResponse> {
  const members = await db.select({ id: member.id, name: member.name, councilRank: councilMembership.councilRank, joinedAt: councilMembership.startsAt })
    .from(councilMembership)
    .innerJoin(member, eq(member.id, councilMembership.memberId))
    .where(and(eq(councilMembership.cohortId, actor.cohortId), isNull(councilMembership.endsAt)))
    .orderBy(asc(councilMembership.startsAt), asc(member.id))
  const placements = await db.select({ memberId: departmentMembership.memberId, departmentId: departmentMembership.departmentId,
    rank: departmentMembership.departmentRank })
    .from(departmentMembership)
    .where(and(eq(departmentMembership.cohortId, actor.cohortId), isNull(departmentMembership.endsAt)))
    .orderBy(asc(departmentMembership.departmentId))
  const departments = await db.select({ id: department.id, name: department.name, role: department.role }).from(department)
    .where(eq(department.councilId, actor.councilId)).orderBy(asc(department.id))
  return {
    members: members.map(row => ({ id: row.id, name: row.name, councilRank: row.councilRank, joinedAt: row.joinedAt.toISOString(),
      departments: placements.filter(item => item.memberId === row.id).map(item => ({ id: item.departmentId, rank: item.rank })) })),
    departments: departments.map(row => ({ ...row, memberCount: placements.filter(item => item.departmentId === row.id).length })),
  }
}
```

`apps/api/src/team/service.ts`:

```ts
import { and, eq, isNull } from 'drizzle-orm'
import type { DepartmentRank } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { councilMembership, department, departmentMembership } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { clockNow, createRecord, updateRecord, updateRecords, type AnyRecordChange, type Tx } from '../records/records.js'

// 회장단이 하는 운영진 편성(DEC-28, DEC-47). 모두 학생회 행을 잠근 거래 안에서 부른다(authorizeChange).
// 대상은 요청한 사람과 같은 기수의 지금 소속이어야 한다. 다른 학생회의 운영진이나 내보낸 운영진은 404다.

export async function currentMembership(tx: Tx, actor: Actor, memberId: string) {
  const [row] = await tx.select({ id: councilMembership.id, councilRank: councilMembership.councilRank }).from(councilMembership)
    .where(and(eq(councilMembership.memberId, memberId), eq(councilMembership.cohortId, actor.cohortId), isNull(councilMembership.endsAt)))
  if (!row) throw new ApiError('NOT_FOUND', 404)
  return row
}

export async function departmentOf(tx: Tx, actor: Actor, departmentId: string) {
  const [row] = await tx.select({ id: department.id, name: department.name, role: department.role }).from(department)
    .where(and(eq(department.id, departmentId), eq(department.councilId, actor.councilId)))
  if (!row) throw new ApiError('NOT_FOUND', 404)
  return row
}

const placementOf = (tx: Tx, actor: Actor, memberId: string, departmentId: string) => tx
  .select({ id: departmentMembership.id, endsAt: departmentMembership.endsAt, rank: departmentMembership.departmentRank })
  .from(departmentMembership)
  .where(and(eq(departmentMembership.memberId, memberId), eq(departmentMembership.departmentId, departmentId), eq(departmentMembership.cohortId, actor.cohortId)))

// 부서 배정과 부서 직급. 처음이면 소속을 만들고, 빠졌던 부서면 같은 소속을 다시 열고, 이미 있으면 직급만 바꾼다.
export async function assignDepartment(tx: Tx, actor: Actor, memberId: string, departmentId: string, rank: DepartmentRank | null) {
  await currentMembership(tx, actor, memberId)
  await departmentOf(tx, actor, departmentId)
  const [placement] = await placementOf(tx, actor, memberId, departmentId)
  const current = placement && placement.endsAt === null ? placement : undefined
  // 부장과 부부장 직급을 주고 거두는 것은 직급 칸이다(DEC-28).
  if ((current?.rank ?? null) !== rank && !can(actor, 'rank.manage')) throw new ApiError('FORBIDDEN', 403)
  if (!placement) {
    await createRecord(tx, { kind: 'department_membership', councilId: actor.councilId, actor: actor.memberId,
      values: { memberId, departmentId, cohortId: actor.cohortId, departmentRank: rank, startsAt: clockNow } })
  } else if (!current) {
    await updateRecord(tx, { kind: 'department_membership', id: placement.id, actor: actor.memberId, reason: null,
      changes: { startsAt: clockNow, endsAt: null, departmentRank: rank } })
  } else if (current.rank !== rank) {
    await updateRecord(tx, { kind: 'department_membership', id: current.id, actor: actor.memberId, reason: null, changes: { departmentRank: rank } })
  }
}

// 부서에서 빼기. 소속을 지우지 않고 끝 시각을 적는다(DEC-27 기준 6).
export async function removeFromDepartment(tx: Tx, actor: Actor, memberId: string, departmentId: string) {
  await currentMembership(tx, actor, memberId)
  const [placement] = await placementOf(tx, actor, memberId, departmentId)
  if (!placement || placement.endsAt !== null) throw new ApiError('NOT_FOUND', 404)
  await updateRecord(tx, { kind: 'department_membership', id: placement.id, actor: actor.memberId, reason: null, changes: { endsAt: clockNow } })
}

// 부회장 주고 거두기. 회장의 직급을 바꾸면 회장이 없어지므로 기록 모듈이 409 PRESIDENT_REQUIRED로 막는다.
export async function changeRank(tx: Tx, actor: Actor, memberId: string, rank: 'vice_president' | null) {
  const target = await currentMembership(tx, actor, memberId)
  if (target.councilRank === rank) return
  await updateRecord(tx, { kind: 'council_membership', id: target.id, actor: actor.memberId, reason: null, changes: { councilRank: rank } })
}

// 회장 넘기기: 한 번에 거두고 준다. 넘긴 사람은 직급 없음이 된다(바탕 spec).
export async function transferPresident(tx: Tx, actor: Actor, memberId: string) {
  if (memberId === actor.memberId) throw new ApiError('ALREADY_PRESIDENT', 409)
  const target = await currentMembership(tx, actor, memberId)
  await updateRecords(tx, [
    { kind: 'council_membership', id: actor.membershipId, actor: actor.memberId, reason: null, changes: { councilRank: null } },
    { kind: 'council_membership', id: target.id, actor: actor.memberId, reason: null, changes: { councilRank: 'president' } },
  ])
}

// 내보내기: 학생회 소속과 그 기수의 부서 소속을 함께 끝낸다(바탕 spec G4). 회장은 넘긴 뒤에만, 스스로 나가기는 없다.
export async function removeMember(tx: Tx, actor: Actor, memberId: string) {
  const target = await currentMembership(tx, actor, memberId)
  if (target.councilRank === 'president') throw new ApiError('PRESIDENT_CANNOT_LEAVE', 409)
  if (memberId === actor.memberId) throw new ApiError('CANNOT_REMOVE_SELF', 409)
  const placements = await tx.select({ id: departmentMembership.id }).from(departmentMembership)
    .where(and(eq(departmentMembership.memberId, memberId), eq(departmentMembership.cohortId, actor.cohortId), isNull(departmentMembership.endsAt)))
  const changes: AnyRecordChange[] = [
    ...placements.map(item => ({ kind: 'department_membership' as const, id: item.id, actor: actor.memberId, reason: null, changes: { endsAt: clockNow } })),
    { kind: 'council_membership', id: target.id, actor: actor.memberId, reason: null, changes: { endsAt: clockNow } },
  ]
  await updateRecords(tx, changes)
}
```

`apps/api/src/team/routes.ts`:

```ts
import { Hono, type Context } from 'hono'
import { AssignDepartmentSchema, ChangeRankSchema, EmptyRequestSchema, TransferPresidentSchema, type Action, type TeamResponse } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { authorize, authorizeChange, councilIdOf, recordIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import { json } from '../http/validate.js'
import type { Db, Tx } from '../records/records.js'
import { teamOf } from './queries.js'
import { assignDepartment, changeRank, removeFromDepartment, removeMember, transferPresident } from './service.js'

// 운영진: 목록(모든 운영진)과 편성(회장단, 회장 넘기기는 회장). 변경도 목록 전체를 돌려준다.
export function createTeamRoutes(db: Db, getSession: SessionReader, clock: () => Date = () => new Date()) {
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)
  const root = '/organizations/:councilId'

  // 학생회 행을 잠근 거래 안에서 권한을 다시 보고 바꾼 뒤, 바뀐 목록을 돌려준다.
  async function change(c: Context<SessionEnv>, action: Action, run: (tx: Tx, actor: Actor) => Promise<void>) {
    const councilId = councilIdOf(c.req.param('councilId'))
    const userId = c.get('userId')
    const now = clock()
    const team = await db.transaction(async tx => {
      const actor = await authorizeChange(tx, userId, councilId, action, now)
      await run(tx, actor)
      return teamOf(tx, actor)
    })
    return c.json(team satisfies TeamResponse)
  }

  routes.get(`${root}/members`, auth, async c => {
    const actor = await authorize(db, c.get('userId'), councilIdOf(c.req.param('councilId')), 'council.view', clock())
    return c.json(await teamOf(db, actor) satisfies TeamResponse)
  })
  routes.post(`${root}/members/:memberId/departments`, json(AssignDepartmentSchema), auth, c => {
    const { departmentId, rank } = c.req.valid('json')
    const memberId = recordIdOf(c.req.param('memberId'))
    return change(c, 'member.manage', (tx, actor) => assignDepartment(tx, actor, memberId, departmentId, rank))
  })
  routes.post(`${root}/members/:memberId/departments/:departmentId/remove`, json(EmptyRequestSchema), auth, c => {
    const memberId = recordIdOf(c.req.param('memberId'))
    const departmentId = recordIdOf(c.req.param('departmentId'))
    return change(c, 'member.manage', (tx, actor) => removeFromDepartment(tx, actor, memberId, departmentId))
  })
  routes.post(`${root}/members/:memberId/rank`, json(ChangeRankSchema), auth, c => {
    const { rank } = c.req.valid('json')
    const memberId = recordIdOf(c.req.param('memberId'))
    return change(c, 'rank.manage', (tx, actor) => changeRank(tx, actor, memberId, rank))
  })
  routes.post(`${root}/president/transfer`, json(TransferPresidentSchema), auth, c => {
    const { memberId } = c.req.valid('json')
    return change(c, 'president.transfer', (tx, actor) => transferPresident(tx, actor, memberId))
  })
  routes.post(`${root}/members/:memberId/remove`, json(EmptyRequestSchema), auth, c => {
    const memberId = recordIdOf(c.req.param('memberId'))
    return change(c, 'member.manage', (tx, actor) => removeMember(tx, actor, memberId))
  })
  return routes
}
```

- [ ] **Step 5: 앱과 서버, 경계 시험에 잇는다**

`apps/api/src/app.ts`를 다음으로 바꾼다:

```ts
import { Hono } from 'hono'
import type { HealthResponse } from '@vada/contracts'
import type { createCouncilRoutes } from './councils/routes.js'
import type { createInviteRoutes } from './invites/routes.js'
import type { createPushRoutes } from './push/routes.js'
import type { createTeamRoutes } from './team/routes.js'
import { handleError } from './http/on-error.js'
import { limitBody, mutationGuard } from './http/guard.js'

type AuthHandler = { handler: (request: Request) => Promise<Response> }
export type AppOptions = {
  auth: AuthHandler
  trustedOrigin: string
  // 학생회: 내 학생회 목록, 만들기, 보기, 설정, 기수
  councils?: ReturnType<typeof createCouncilRoutes>
  // 초대: 초대 확인, 들어오기, 초대 코드 보기와 바꾸기
  invites?: ReturnType<typeof createInviteRoutes>
  // 운영진: 목록, 부서 배정과 빼기, 직급, 회장 넘기기, 내보내기, 부서
  team?: ReturnType<typeof createTeamRoutes>
  // 휴대폰 알림. 알림 열쇠(VAPID)가 없으면 만들지 않는다.
  push?: ReturnType<typeof createPushRoutes>
}

export function createApp({ auth, trustedOrigin, councils, invites, team, push }: AppOptions) {
  const app = new Hono()
  app.use('/api/organizations/*', mutationGuard(trustedOrigin))
  // 로그인한 사람 자신의 것(휴대폰 알림)도 같은 가드를 건다.
  app.use('/api/me/*', mutationGuard(trustedOrigin))
  // 로그인 없이 쓰는 공개 경로(참가 신청)도 같은 화면에서만 보내므로 같은 가드를 건다.
  app.use('/api/public/*', mutationGuard(trustedOrigin))
  app.get('/api/health', (c) => c.json({ status: 'ok' } satisfies HealthResponse))
  // better-auth는 출처 검사 전에 본문 전체를 읽으므로 크기만 먼저 제한한다.
  app.use('/api/auth/*', limitBody())
  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))
  if (councils) app.route('/api', councils)
  if (invites) app.route('/api', invites)
  if (team) app.route('/api', team)
  if (push) app.route('/api', push)
  app.onError(handleError)
  return app
}
```

`apps/api/src/serve.ts`에서:
1. `import { createPushSender } from './push/sender.js'` 아래에 `import { createTeamRoutes } from './team/routes.js'`를 더한다.
2. `  const invites = createInviteRoutes(db, session)` 아래에 `  const team = createTeamRoutes(db, session)`를 더한다.
3. `councils, invites, push })`를 `councils, invites, team, push })`로 바꾼다.

`apps/api/src/http/boundary.test.ts`에서:
1. `import { createPushRoutes } from '../push/routes.js'` 아래에 `import { createTeamRoutes } from '../team/routes.js'`를 더한다.
2. `modules`의 `    invites: createInviteRoutes(db, session),` 아래에 `    team: createTeamRoutes(db, session),`를 더한다.
3. `assert.ok(mutating.length >= 4,`를 `assert.ok(mutating.length >= 9,`로 바꾼다.

`apps/api/package.json`의 `test` 스크립트 끝에 ` src/team/team.test.ts src/team/flow.test.ts`를 더한다.

- [ ] **Step 6: 시험이 통과하는지 본다**

Run: `cd apps/api && npx tsx --test --test-concurrency=2 src/team/team.test.ts src/team/flow.test.ts src/http/boundary.test.ts`
Expected: PASS (team 7, flow 1, boundary 3)

Run: `npm run typecheck && cd apps/api && npx tsx --test --test-concurrency=2 $(node -p "require('./package.json').scripts.test.replace('tsx --test ', '')")`
Expected: 타입 오류 없음, `# fail 0`

- [ ] **Step 7: 커밋**

```bash
git add packages/contracts apps/api/src/team apps/api/src/app.ts apps/api/src/serve.ts apps/api/src/http/boundary.test.ts apps/api/package.json
git commit -m "운영진 목록과 배정, 직급, 넘기기, 내보내기 더하기"
```

---

### Task 9: 부서와 설정 — 부서 만들기·고치기·없애기, 학생회 정보, 기수

부서 만들기, 이름 바꾸기, 재정 역할 주고 거두기, 쓰인 적 없는 부서 없애기(판, 하위 행, 기록 행을 한 거래로 지운다. 확정한 기록은 지우지 않는다, P34)와 학생회 정보·직급 표시 이름, 지금 기수 고치기다. 모두 회장단이 한다. 기수 기간은 오늘을 담아야 한다(P15).

**Files:**
- Modify: `packages/contracts/src/councils.ts`, `packages/contracts/src/councils.test.ts`, `packages/contracts/src/team.ts`, `packages/contracts/src/team.test.ts`, `packages/contracts/src/index.ts`
- Modify: `apps/api/src/team/service.ts`, `apps/api/src/team/routes.ts`, `apps/api/src/councils/service.ts`, `apps/api/src/councils/routes.ts`
- Create: `apps/api/src/team/departments.test.ts`, `apps/api/src/councils/settings.test.ts`
- Modify: `apps/api/src/http/boundary.test.ts`, `apps/api/package.json`

**Interfaces:**
- Consumes: `departmentOf`, `teamOf`(Task 8), `assertCurrentPeriod`, `councilView`(Task 6), `createRecord`, `updateRecord`(Task 4), `authorizeChange`(Task 5), `sqlState`(`http/on-error.ts`)
- Produces:
  - 계약: `RANK_TITLE_MAX = 20`, `UpdateCouncilSettingsSchema = { name, unit, schoolName, titles: { president, vicePresident, head, viceHead } }`, `UpdateCohortSchema = { name, startsOn, endsOn }`(끝일 > 시작일), `DEPARTMENT_NAME_MAX = 20`, `CreateDepartmentSchema = { name }`, `UpdateDepartmentSchema = { name, role: 'finance' | null }`와 각 `…Request` 타입
  - `createDepartment(tx, actor, name)`, `updateDepartment(tx, actor, departmentId, { name, role })`, `deleteDepartment(tx, actor, departmentId)`(쓰인 부서는 `DEPARTMENT_IN_USE` 409, 확정한 기록은 `RECORD_CONFIRMED` 409, P34), 이름이 겹치면 `DEPARTMENT_NAME_TAKEN` 409
  - `updateSettings(tx, actor, input)`, `updateCohort(tx, actor, input, now)`(바뀐 것이 없으면 판을 만들지 않는다)
  - HTTP: `POST /api/organizations/:councilId/settings`·`/cohort` → `CouncilView`, `POST …/departments`, `POST …/departments/:departmentId`, `POST …/departments/:departmentId/delete`(`{}`) → `TeamResponse`

- [ ] **Step 1: 실패하는 계약 시험을 쓴다**

`packages/contracts/src/councils.test.ts`에서 첫 import를 다음으로 바꾸고:

```ts
import { COHORT_NAME_MAX, COUNCIL_NAME_MAX, CreateCouncilSchema, RANK_TITLE_MAX, SCHOOL_NAME_MAX, UpdateCohortSchema, UpdateCouncilSettingsSchema,
  dateInput } from './councils.js'
```

파일 끝에 더한다:

```ts
const settings = { name: '소프트웨어학부 학생회', unit: 'college', schoolName: '한양대학교 ERICA',
  titles: { president: '위원장', vicePresident: '부위원장', head: '국장', viceHead: '차장' } }

test('학생회 정보 고치기: 이름, 단위, 학교, 직급 표시 이름 넷을 모두 받는다', () => {
  assert.deepEqual(UpdateCouncilSettingsSchema.parse({ ...settings, titles: { ...settings.titles, head: ' 국장 ' } }), settings)
  assert.equal(UpdateCouncilSettingsSchema.safeParse({ ...settings, titles: { ...settings.titles, president: '😀'.repeat(RANK_TITLE_MAX) } }).success, true)
  const bad: unknown[] = [{}, { ...settings, titles: undefined }, { ...settings, titles: { ...settings.titles, viceHead: undefined } },
    { ...settings, titles: { ...settings.titles, head: ' ' } }, { ...settings, titles: { ...settings.titles, head: '😀'.repeat(RANK_TITLE_MAX + 1) } },
    { ...settings, titles: { ...settings.titles, head: 'a\u0000' } }, { ...settings, titles: { ...settings.titles, extra: 'x' } },
    { ...settings, name: '' }, { ...settings, unit: 'club' }, { ...settings, schoolName: '\uD800' }, { ...settings, extra: 1 }]
  for (const value of bad) assert.equal(UpdateCouncilSettingsSchema.safeParse(value).success, false, JSON.stringify(value))
  assert.equal(isStrictObject(UpdateCouncilSettingsSchema), true)
})

test('기수 고치기: 이름과 기간을 받고, 끝일은 시작일보다 뒤다', () => {
  assert.deepEqual(UpdateCohortSchema.parse({ name: ' 제38대 ', startsOn: '2026-03-01', endsOn: '2027-02-28' }),
    { name: '제38대', startsOn: '2026-03-01', endsOn: '2027-02-28' })
  for (const value of [{}, { name: '2026', startsOn: '2026-03-01' }, { name: '', startsOn: '2026-03-01', endsOn: '2027-02-28' },
    { name: '😀'.repeat(COHORT_NAME_MAX + 1), startsOn: '2026-03-01', endsOn: '2027-02-28' },
    { name: '2026', startsOn: '2026-03-01', endsOn: '2026-03-01' }, { name: '2026', startsOn: '2026-03-01', endsOn: '2027-02-29' },
    { name: '2026', startsOn: '2026-03-01', endsOn: '2027-02-28', extra: 1 }]) {
    assert.equal(UpdateCohortSchema.safeParse(value).success, false, JSON.stringify(value))
  }
  assert.equal(isStrictObject(UpdateCohortSchema), true)
})
```

`packages/contracts/src/team.test.ts`에서 `./team.js` import를 다음으로 바꾸고:

```ts
import { AssignDepartmentSchema, ChangeRankSchema, CreateDepartmentSchema, DEPARTMENT_NAME_MAX, TransferPresidentSchema, UpdateDepartmentSchema } from './team.js'
```

파일 끝에 더한다:

```ts
test('부서 만들기와 고치기: 이름은 20자까지, 역할은 재정이나 없음이다', () => {
  assert.deepEqual(CreateDepartmentSchema.parse({ name: ' 홍보부 ' }), { name: '홍보부' })
  assert.deepEqual(UpdateDepartmentSchema.parse({ name: '사무국', role: 'finance' }), { name: '사무국', role: 'finance' })
  assert.deepEqual(UpdateDepartmentSchema.parse({ name: '사무국', role: null }), { name: '사무국', role: null })
  assert.equal(CreateDepartmentSchema.safeParse({ name: '😀'.repeat(DEPARTMENT_NAME_MAX) }).success, true)
  const cases: [{ safeParse: (value: unknown) => { success: boolean } }, unknown][] = [
    [CreateDepartmentSchema, {}], [CreateDepartmentSchema, { name: ' ' }], [CreateDepartmentSchema, { name: '😀'.repeat(DEPARTMENT_NAME_MAX + 1) }],
    [CreateDepartmentSchema, { name: '부\u0000' }], [CreateDepartmentSchema, { name: '\uD800' }], [CreateDepartmentSchema, { name: '홍보부', role: 'finance' }],
    [UpdateDepartmentSchema, { name: '사무국' }], [UpdateDepartmentSchema, { name: '사무국', role: 'leadership' }],
    [UpdateDepartmentSchema, { name: '', role: null }], [UpdateDepartmentSchema, { name: '사무국', role: null, extra: 1 }],
  ]
  for (const [schema, value] of cases) assert.equal(schema.safeParse(value).success, false, JSON.stringify(value))
  for (const schema of [CreateDepartmentSchema, UpdateDepartmentSchema]) assert.equal(isStrictObject(schema), true)
})
```

Run: `cd packages/contracts && npx tsx --test src/councils.test.ts src/team.test.ts`
Expected: FAIL(`UpdateCouncilSettingsSchema`, `CreateDepartmentSchema` 등을 찾지 못한다)

- [ ] **Step 2: 설정과 부서 계약을 더한다**

`packages/contracts/src/councils.ts` 끝에 더한다:

```ts
// 직급 표시 이름의 상한
export const RANK_TITLE_MAX = 20
// 학생회 정보와 직급 표시 이름 고치기(회장단). 화면은 네 표시 이름을 모두 보낸다.
export const UpdateCouncilSettingsSchema = z.strictObject({
  name: text(COUNCIL_NAME_MAX),
  unit: z.enum(COUNCIL_UNITS),
  schoolName: text(SCHOOL_NAME_MAX),
  titles: z.strictObject({ president: text(RANK_TITLE_MAX), vicePresident: text(RANK_TITLE_MAX), head: text(RANK_TITLE_MAX),
    viceHead: text(RANK_TITLE_MAX) }),
})
export type UpdateCouncilSettingsRequest = z.infer<typeof UpdateCouncilSettingsSchema>
// 지금 기수의 이름과 기간 고치기(회장단). 기간은 오늘을 담아야 한다(서버가 본다).
export const UpdateCohortSchema = z.strictObject({ name: text(COHORT_NAME_MAX), startsOn: dateInput, endsOn: dateInput })
  .refine(value => value.endsOn > value.startsOn, { path: ['endsOn'] })
export type UpdateCohortRequest = z.infer<typeof UpdateCohortSchema>
```

`packages/contracts/src/team.ts`의 맨 위 두 import를 다음으로 바꾸고:

```ts
import { text, token } from './input.js'
import { DEPARTMENT_RANKS, DEPARTMENT_ROLES, type CouncilRank, type DepartmentRank, type DepartmentRole } from './permissions.js'
```

파일 끝에 더한다:

```ts
// 부서 이름의 상한. 지금 vada와 같은 20자다.
export const DEPARTMENT_NAME_MAX = 20
// 부서 만들기(회장단). 역할 없이 만든다.
export const CreateDepartmentSchema = z.strictObject({ name: text(DEPARTMENT_NAME_MAX) })
export type CreateDepartmentRequest = z.infer<typeof CreateDepartmentSchema>
// 이름 바꾸기와 재정 역할 주고 거두기(회장단). 화면은 이름과 역할을 함께 보낸다.
export const UpdateDepartmentSchema = z.strictObject({ name: text(DEPARTMENT_NAME_MAX), role: z.enum(DEPARTMENT_ROLES).nullable() })
export type UpdateDepartmentRequest = z.infer<typeof UpdateDepartmentSchema>
```

`packages/contracts/src/index.ts`를 다음으로 바꾼다:

```ts
export { codePoints, EmptyRequestSchema, isStrictObject, text, token } from './input.js'
export { koreanDateTime, dateFromKorean, koreanOf } from './korean-time.js'
export { PUSH_ENDPOINT_MAX, PUSH_TEST_RESULTS, PushSubscriptionSchema, type PushSubscriptionRequest, type PushTestResult,
  type PushKeyResponse, type PushTestResponse } from './push.js'
export { COUNCIL_RANKS, DEPARTMENT_RANKS, DEPARTMENT_ROLES, ACTIONS, type CouncilRank, type DepartmentRank, type DepartmentRole,
  type Action } from './permissions.js'
export { COUNCIL_NAME_MAX, SCHOOL_NAME_MAX, COHORT_NAME_MAX, COUNCIL_UNITS, dateInput, CreateCouncilSchema, type CouncilUnit,
  type CreateCouncilRequest, type MyCouncil, type MyCouncilsResponse, type CreateCouncilResponse, type CouncilTitles, type CouncilView,
  RANK_TITLE_MAX, UpdateCouncilSettingsSchema, UpdateCohortSchema, type UpdateCouncilSettingsRequest, type UpdateCohortRequest } from './councils.js'
export { INVITE_CODE_MAX, InviteCodeSchema, JoinCouncilSchema, type JoinCouncilRequest, type InvitePreviewResponse,
  type JoinCouncilResponse, type InviteCodeResponse } from './invites.js'
export { recordIdInput, AssignDepartmentSchema, ChangeRankSchema, TransferPresidentSchema, type TeamMember, type TeamDepartment,
  type TeamResponse, type AssignDepartmentRequest, type ChangeRankRequest, type TransferPresidentRequest, DEPARTMENT_NAME_MAX,
  CreateDepartmentSchema, UpdateDepartmentSchema, type CreateDepartmentRequest, type UpdateDepartmentRequest } from './team.js'
export interface HealthResponse {
  status: 'ok'
}
```

Run: `npm test --workspace @vada/contracts`
Expected: PASS(`councils.test.ts` 5 tests, `team.test.ts` 4 tests 포함)

- [ ] **Step 3: 실패하는 서버 시험을 쓴다**

`apps/api/src/team/departments.test.ts`(다른 기록이 가리키는 부서는 외래 키가 막는 것까지 본다. 확정한 부서 기록은 바탕에 확정하는 길이 없어 `deleteDepartment`를 바로 불러 본다):

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CreateCouncilResponse, InviteCodeResponse, TeamResponse } from '@vada/contracts'
import { actorOf } from '../access/actor.js'
import { createApp } from '../app.js'
import { createCouncilRoutes } from '../councils/routes.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import { createInviteRoutes } from '../invites/routes.js'
import { addUser } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createTeamRoutes } from './routes.js'
import { deleteDepartment } from './service.js'

const body = { name: '컴퓨터학부 학생회', unit: 'department', schoolName: '한양대학교 ERICA', cohortName: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' }

// 회장 u1의 학생회에 u2가 들어온다. u3은 다른 학생회의 회장이다.
async function setup(testDb: TestDb) {
  const clock = () => new Date('2026-10-19T03:00:00Z')
  const api = caller(createApp({ auth: { handler: async () => new Response() }, trustedOrigin: ORIGIN,
    councils: createCouncilRoutes(testDb.db, testSession, clock), invites: createInviteRoutes(testDb.db, testSession, clock),
    team: createTeamRoutes(testDb.db, testSession, clock) }))
  for (const user of ['u1', 'u2', 'u3']) await addUser(testDb.pg, user, `이름 ${user}`)
  const { council } = await (await api.post('/api/organizations/create', body, 'u1')).json() as CreateCouncilResponse
  const { code } = await (await api.get(`/api/organizations/${council.id}/invite`, 'u1')).json() as InviteCodeResponse
  await api.post('/api/organizations/join', { code }, 'u2')
  const { council: other } = await (await api.post('/api/organizations/create', { ...body, name: '경영학부 학생회' }, 'u3')).json() as CreateCouncilResponse
  const otherTeam = await (await api.get(`/api/organizations/${other.id}/members`, 'u3')).json() as TeamResponse
  const base = `/api/organizations/${council.id}`
  const create = async (name: string) => (await (await api.post(`${base}/departments`, { name }, 'u1')).json() as TeamResponse)
    .departments.find(item => item.name === name)!.id
  return { api, base, council, create, otherDepartment: otherTeam.departments[0]!.id }
}

test('부서 만들기, 이름 바꾸기, 재정 역할 주고 거두기는 회장단이 하고 판을 남긴다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, create } = await setup(testDb)
    const planning = await create('기획부')
    let team = await (await api.post(`${base}/departments/${planning}`, { name: '기획국', role: 'finance' }, 'u1')).json() as TeamResponse
    assert.deepEqual(team.departments.map(item => [item.name, item.role, item.memberCount]), [['재정부', 'finance', 0], ['기획국', 'finance', 0]])
    team = await (await api.post(`${base}/departments/${planning}`, { name: '기획국', role: null }, 'u1')).json() as TeamResponse
    assert.equal(team.departments.find(item => item.id === planning)!.role, null)
    assert.equal((await api.post(`${base}/departments/${planning}`, { name: '기획국', role: null }, 'u1')).status, 200)
    const versions = await testDb.pg.query<{ name: string; role: string | null }>(
      "SELECT data->>'name' AS name, data->>'role' AS role FROM record_version WHERE record_id = $1 ORDER BY version_no", [planning])
    assert.deepEqual(versions.rows, [{ name: '기획부', role: null }, { name: '기획국', role: 'finance' }, { name: '기획국', role: null }])
  } finally {
    await testDb.close()
  }
})

test('같은 이름의 부서는 409 DEPARTMENT_NAME_TAKEN이다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, create } = await setup(testDb)
    const planning = await create('기획부')
    for (const response of [await api.post(`${base}/departments`, { name: '재정부' }, 'u1'),
      await api.post(`${base}/departments/${planning}`, { name: '재정부', role: null }, 'u1')]) {
      assert.equal(response.status, 409)
      assert.deepEqual(await response.json(), { error: 'DEPARTMENT_NAME_TAKEN' })
    }
  } finally {
    await testDb.close()
  }
})

test('쓰인 적 없는 부서만 없앤다: 판, 하위 행, 기록 행을 함께 지우고, 한 번이라도 쓰인 부서는 409 DEPARTMENT_IN_USE다', async () => {
  const testDb = await createTestDb()
  const { pg } = testDb
  try {
    const { api, base, council, create } = await setup(testDb)
    const unused = await create('홍보부')
    await api.post(`${base}/departments/${unused}`, { name: '홍보국', role: null }, 'u1')
    const team = await (await api.post(`${base}/departments/${unused}/delete`, {}, 'u1')).json() as TeamResponse
    assert.ok(!team.departments.some(item => item.id === unused))
    for (const table of ['department', 'record', 'record_version']) {
      assert.equal((await pg.query(`SELECT 1 FROM ${table} WHERE ${table === 'record_version' ? 'record_id' : 'id'} = $1`, [unused])).rows.length, 0, table)
    }
    // 부서원이 들어왔다가 빠진 부서
    const used = await create('복지부')
    const lee = team.members.find(item => item.name === '이름 u2')!.id
    await api.post(`${base}/members/${lee}/departments`, { departmentId: used, rank: null }, 'u1')
    await api.post(`${base}/members/${lee}/departments/${used}/remove`, {}, 'u1')
    const blocked = await api.post(`${base}/departments/${used}/delete`, {}, 'u1')
    assert.equal(blocked.status, 409)
    assert.deepEqual(await blocked.json(), { error: 'DEPARTMENT_IN_USE' })
    // 다른 기록(업무)이 가리키는 부서는 외래 키가 막는다.
    const tasked = await create('체육부')
    const [{ id: taskId }] = (await pg.query<{ id: string }>("INSERT INTO record (kind, council_id) VALUES ('task', $1) RETURNING id", [council.id])).rows as [{ id: string }]
    await pg.query("INSERT INTO task (id, title, status, department_id) VALUES ($1, '현수막', 'open', $2)", [taskId, tasked])
    const referenced = await api.post(`${base}/departments/${tasked}/delete`, {}, 'u1')
    assert.equal(referenced.status, 409)
    assert.deepEqual(await referenced.json(), { error: 'DEPARTMENT_IN_USE' })
    assert.equal((await pg.query('SELECT 1 FROM department WHERE id = $1', [tasked])).rows.length, 1)
  } finally {
    await testDb.close()
  }
})

test('확정한 부서 기록은 쓰인 적 없어도 없애지 않는다(physical-model.md: 확정한 기록은 지우지 않는다)', async () => {
  const testDb = await createTestDb()
  const { db, pg } = testDb
  try {
    const { council, create } = await setup(testDb)
    const confirmed = await create('홍보부')
    const actor = (await actorOf(db, 'u1', council.id, new Date('2026-10-19T03:00:00Z')))!
    await pg.query('UPDATE record SET confirmed_by = $1, confirmed_at = now() WHERE id = $2', [actor.memberId, confirmed])
    // 바탕에는 부서를 확정하는 길이 없어 모듈을 바로 부른다.
    await assert.rejects(db.transaction(tx => deleteDepartment(tx, actor, confirmed)), { code: 'RECORD_CONFIRMED', status: 409 })
    for (const table of ['department', 'record']) assert.equal((await pg.query(`SELECT 1 FROM ${table} WHERE id = $1`, [confirmed])).rows.length, 1, table)
    assert.equal((await pg.query('SELECT 1 FROM record_version WHERE record_id = $1', [confirmed])).rows.length, 1)
  } finally {
    await testDb.close()
  }
})

test('부서 편성은 회장단만 한다. 다른 학생회의 부서는 404, 형식이 틀린 본문은 400, 로그인하지 않으면 401이다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, create, otherDepartment } = await setup(testDb)
    const planning = await create('기획부')
    const attempts = [[`${base}/departments`, { name: '홍보부' }], [`${base}/departments/${planning}`, { name: '기획국', role: null }],
      [`${base}/departments/${planning}/delete`, {}]] as const
    for (const [path, payload] of attempts) {
      assert.equal((await api.post(path, payload, 'u2')).status, 403, path)
      assert.equal((await api.post(path, payload, 'u3')).status, 403, path)
      assert.equal((await api.post(path, payload)).status, 401, path)
    }
    assert.equal((await api.post(`${base}/departments/${otherDepartment}`, { name: '빼앗기', role: null }, 'u1')).status, 404)
    assert.equal((await api.post(`${base}/departments/${otherDepartment}/delete`, {}, 'u1')).status, 404)
    assert.equal((await api.post(`${base}/departments/not-a-uuid/delete`, {}, 'u1')).status, 404)
    for (const payload of [{}, { name: '' }, { name: '   ' }, { name: '😀'.repeat(21) }, { name: '부\u0000' }, { name: '\uD800' }, { name: '홍보부', extra: 1 }]) {
      assert.equal((await api.post(`${base}/departments`, payload, 'u1')).status, 400, JSON.stringify(payload))
    }
    for (const payload of [{ name: '기획국' }, { name: '기획국', role: 'leadership' }, { name: '기획국', role: null, extra: 1 }]) {
      assert.equal((await api.post(`${base}/departments/${planning}`, payload, 'u1')).status, 400, JSON.stringify(payload))
    }
  } finally {
    await testDb.close()
  }
})
```

`apps/api/src/councils/settings.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CouncilView, CreateCouncilResponse, InviteCodeResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import { createInviteRoutes } from '../invites/routes.js'
import { addUser } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createCouncilRoutes } from './routes.js'

const body = { name: '컴퓨터학부 학생회', unit: 'department', schoolName: '한양대학교 ERICA', cohortName: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' }
const settings = { name: '소프트웨어학부 학생회', unit: 'college', schoolName: '한양대학교 ERICA',
  titles: { president: '위원장', vicePresident: '부위원장', head: '국장', viceHead: '차장' } }

// 회장 u1의 학생회에 u2가 들어온다. u3은 다른 학생회의 회장이다.
async function setup(testDb: TestDb) {
  const clock = () => new Date('2026-10-19T03:00:00Z')
  const api = caller(createApp({ auth: { handler: async () => new Response() }, trustedOrigin: ORIGIN,
    councils: createCouncilRoutes(testDb.db, testSession, clock), invites: createInviteRoutes(testDb.db, testSession, clock) }))
  for (const user of ['u1', 'u2', 'u3']) await addUser(testDb.pg, user)
  const { council } = await (await api.post('/api/organizations/create', body, 'u1')).json() as CreateCouncilResponse
  const { code } = await (await api.get(`/api/organizations/${council.id}/invite`, 'u1')).json() as InviteCodeResponse
  await api.post('/api/organizations/join', { code }, 'u2')
  await api.post('/api/organizations/create', { ...body, name: '경영학부 학생회' }, 'u3')
  return { api, council, base: `/api/organizations/${council.id}` }
}

test('학생회 정보와 직급 표시 이름은 회장단이 고치고, 모든 운영진이 본다. 바뀐 것이 없으면 판을 만들지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, council } = await setup(testDb)
    const response = await api.post(`${base}/settings`, settings, 'u1')
    assert.equal(response.status, 200)
    const view = await response.json() as CouncilView
    assert.deepEqual(view.council, { id: council.id, ...settings })
    assert.deepEqual((await (await api.get(base, 'u2')).json() as CouncilView).council.titles, settings.titles)
    assert.equal((await api.post(`${base}/settings`, settings, 'u1')).status, 200)
    const versions = await testDb.pg.query<{ name: string; president_title: string }>(
      "SELECT data->>'name' AS name, data->>'president_title' AS president_title FROM record_version WHERE record_id = $1 ORDER BY version_no", [council.id])
    assert.deepEqual(versions.rows, [{ name: '컴퓨터학부 학생회', president_title: '회장' }, { name: '소프트웨어학부 학생회', president_title: '위원장' }])
  } finally {
    await testDb.close()
  }
})

test('지금 기수의 이름과 기간은 회장단이 고친다. 기간이 오늘을 담지 않으면 409 COHORT_NOT_CURRENT다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base } = await setup(testDb)
    const view = await (await api.post(`${base}/cohort`, { name: '제38대', startsOn: '2026-03-01', endsOn: '2027-02-28' }, 'u1')).json() as CouncilView
    assert.deepEqual({ ...view.cohort, id: undefined }, { id: undefined, name: '제38대', startsOn: '2026-03-01', endsOn: '2027-02-28' })
    const outside = await api.post(`${base}/cohort`, { name: '제39대', startsOn: '2027-03-01', endsOn: '2028-02-29' }, 'u1')
    assert.equal(outside.status, 409)
    assert.deepEqual(await outside.json(), { error: 'COHORT_NOT_CURRENT' })
    assert.equal((await (await api.get(base, 'u2')).json() as CouncilView).cohort.name, '제38대')
  } finally {
    await testDb.close()
  }
})

test('설정과 기수는 회장단만 바꾼다. 형식이 틀리면 400, 로그인하지 않으면 401이다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base } = await setup(testDb)
    const cohort = { name: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' }
    for (const user of ['u2', 'u3']) {
      assert.equal((await api.post(`${base}/settings`, settings, user)).status, 403, user)
      assert.equal((await api.post(`${base}/cohort`, cohort, user)).status, 403, user)
    }
    assert.equal((await api.post(`${base}/settings`, settings)).status, 401)
    for (const payload of [{ ...settings, titles: { ...settings.titles, head: '' } }, { ...settings, titles: undefined }, { ...settings, unit: 'club' },
      { ...settings, name: '😀'.repeat(51) }, { ...settings, schoolName: 'a\u0000' }, { ...settings, extra: 1 }]) {
      assert.equal((await api.post(`${base}/settings`, payload, 'u1')).status, 400, JSON.stringify(payload))
    }
    for (const payload of [{ ...cohort, endsOn: '2026-01-01' }, { ...cohort, name: '\uD800' }, { ...cohort, startsOn: '2026-02-30' }, { name: '2026' }]) {
      assert.equal((await api.post(`${base}/cohort`, payload, 'u1')).status, 400, JSON.stringify(payload))
    }
  } finally {
    await testDb.close()
  }
})
```

Run: `cd apps/api && npx tsx --test --test-concurrency=2 src/team/departments.test.ts src/councils/settings.test.ts`
Expected: FAIL(새 경로가 없어 404가 나온다)

- [ ] **Step 4: 부서 편성을 만든다**

`apps/api/src/team/service.ts`에서 `../db/schema.js` import를 다음으로 바꾸고:

```ts
import { councilMembership, department, departmentMembership, record, recordVersion } from '../db/schema.js'
```

파일 끝에 더한다:

```ts
async function assertNameFree(tx: Tx, actor: Actor, name: string) {
  const [taken] = await tx.select({ id: department.id }).from(department).where(and(eq(department.councilId, actor.councilId), eq(department.name, name)))
  if (taken) throw new ApiError('DEPARTMENT_NAME_TAKEN', 409)
}

// 부서 만들기. 역할 없이 만든다.
export async function createDepartment(tx: Tx, actor: Actor, name: string) {
  await assertNameFree(tx, actor, name)
  await createRecord(tx, { kind: 'department', councilId: actor.councilId, actor: actor.memberId, values: { name } })
}

// 이름 바꾸기와 재정 역할 주고 거두기. 바뀐 것이 없으면 판을 만들지 않는다.
export async function updateDepartment(tx: Tx, actor: Actor, departmentId: string, input: { name: string; role: 'finance' | null }) {
  const current = await departmentOf(tx, actor, departmentId)
  if (current.name === input.name && current.role === input.role) return
  if (current.name !== input.name) await assertNameFree(tx, actor, input.name)
  await updateRecord(tx, { kind: 'department', id: departmentId, actor: actor.memberId, reason: null, changes: { name: input.name, role: input.role } })
}

// 쓰인 적 없는 부서만 없앤다(바탕 spec G8). 지우기는 기록 모듈의 일이 아니라서 여기서 판, 하위 행, 기록 행을 한 거래로 지운다.
// 부서 소속이 한 번이라도 있었으면(끝난 소속 포함) 409다. 다른 기록이 이 부서를 가리키면 외래 키가 막고, 라우트가 409로 바꾼다.
// 확정한 기록은 지우지 않는다(physical-model.md, DEC-27 기준 6). 바탕에는 부서를 확정하는 길이 없지만 여기서 지킨다.
export async function deleteDepartment(tx: Tx, actor: Actor, departmentId: string) {
  await departmentOf(tx, actor, departmentId)
  const [meta] = await tx.select({ confirmedAt: record.confirmedAt }).from(record).where(eq(record.id, departmentId))
  if (meta?.confirmedAt) throw new ApiError('RECORD_CONFIRMED', 409)
  const [used] = await tx.select({ id: departmentMembership.id }).from(departmentMembership).where(eq(departmentMembership.departmentId, departmentId)).limit(1)
  if (used) throw new ApiError('DEPARTMENT_IN_USE', 409)
  await tx.delete(recordVersion).where(eq(recordVersion.recordId, departmentId))
  await tx.delete(department).where(eq(department.id, departmentId))
  await tx.delete(record).where(eq(record.id, departmentId))
}
```

`apps/api/src/team/routes.ts`를 다음으로 바꾼다(제약 위반을 409로 바꾸는 `conflicts`를 `change`에 더했다):

```ts
import { Hono, type Context } from 'hono'
import { AssignDepartmentSchema, ChangeRankSchema, CreateDepartmentSchema, EmptyRequestSchema, TransferPresidentSchema, UpdateDepartmentSchema,
  type Action, type TeamResponse } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { authorize, authorizeChange, councilIdOf, recordIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import { ApiError } from '../http/errors.js'
import { sqlState } from '../http/on-error.js'
import { json } from '../http/validate.js'
import type { Db, Tx } from '../records/records.js'
import { teamOf } from './queries.js'
import { assignDepartment, changeRank, createDepartment, deleteDepartment, removeFromDepartment, removeMember, transferPresident,
  updateDepartment } from './service.js'

// 미리 본 뒤 다른 요청이나 다른 기록과 겹쳐 생긴 제약 위반을 같은 오류 코드로 바꾼다.
// 부서 이름이 겹치면 23505, 다른 기록이 부서를 가리키면 23503이다.
const departmentConflicts: Readonly<Record<string, string>> = { '23505': 'DEPARTMENT_NAME_TAKEN', '23503': 'DEPARTMENT_IN_USE' }

// 운영진: 목록(모든 운영진)과 편성(회장단, 회장 넘기기는 회장), 부서(회장단). 변경도 목록 전체를 돌려준다.
export function createTeamRoutes(db: Db, getSession: SessionReader, clock: () => Date = () => new Date()) {
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)
  const root = '/organizations/:councilId'

  // 학생회 행을 잠근 거래 안에서 권한을 다시 보고 바꾼 뒤, 바뀐 목록을 돌려준다.
  async function change(c: Context<SessionEnv>, action: Action, run: (tx: Tx, actor: Actor) => Promise<void>,
    conflicts: Readonly<Record<string, string>> = {}) {
    const councilId = councilIdOf(c.req.param('councilId'))
    const userId = c.get('userId')
    const now = clock()
    try {
      const team = await db.transaction(async tx => {
        const actor = await authorizeChange(tx, userId, councilId, action, now)
        await run(tx, actor)
        return teamOf(tx, actor)
      })
      return c.json(team satisfies TeamResponse)
    } catch (error) {
      const code = conflicts[sqlState(error) ?? '']
      if (code) throw new ApiError(code, 409)
      throw error
    }
  }

  routes.get(`${root}/members`, auth, async c => {
    const actor = await authorize(db, c.get('userId'), councilIdOf(c.req.param('councilId')), 'council.view', clock())
    return c.json(await teamOf(db, actor) satisfies TeamResponse)
  })
  routes.post(`${root}/members/:memberId/departments`, json(AssignDepartmentSchema), auth, c => {
    const { departmentId, rank } = c.req.valid('json')
    const memberId = recordIdOf(c.req.param('memberId'))
    return change(c, 'member.manage', (tx, actor) => assignDepartment(tx, actor, memberId, departmentId, rank))
  })
  routes.post(`${root}/members/:memberId/departments/:departmentId/remove`, json(EmptyRequestSchema), auth, c => {
    const memberId = recordIdOf(c.req.param('memberId'))
    const departmentId = recordIdOf(c.req.param('departmentId'))
    return change(c, 'member.manage', (tx, actor) => removeFromDepartment(tx, actor, memberId, departmentId))
  })
  routes.post(`${root}/members/:memberId/rank`, json(ChangeRankSchema), auth, c => {
    const { rank } = c.req.valid('json')
    const memberId = recordIdOf(c.req.param('memberId'))
    return change(c, 'rank.manage', (tx, actor) => changeRank(tx, actor, memberId, rank))
  })
  routes.post(`${root}/president/transfer`, json(TransferPresidentSchema), auth, c => {
    const { memberId } = c.req.valid('json')
    return change(c, 'president.transfer', (tx, actor) => transferPresident(tx, actor, memberId))
  })
  routes.post(`${root}/members/:memberId/remove`, json(EmptyRequestSchema), auth, c => {
    const memberId = recordIdOf(c.req.param('memberId'))
    return change(c, 'member.manage', (tx, actor) => removeMember(tx, actor, memberId))
  })
  routes.post(`${root}/departments`, json(CreateDepartmentSchema), auth, c =>
    change(c, 'department.manage', (tx, actor) => createDepartment(tx, actor, c.req.valid('json').name), departmentConflicts))
  routes.post(`${root}/departments/:departmentId`, json(UpdateDepartmentSchema), auth, c => {
    const departmentId = recordIdOf(c.req.param('departmentId'))
    return change(c, 'department.manage', (tx, actor) => updateDepartment(tx, actor, departmentId, c.req.valid('json')), departmentConflicts)
  })
  routes.post(`${root}/departments/:departmentId/delete`, json(EmptyRequestSchema), auth, c => {
    const departmentId = recordIdOf(c.req.param('departmentId'))
    return change(c, 'department.manage', (tx, actor) => deleteDepartment(tx, actor, departmentId), departmentConflicts)
  })
  return routes
}
```

- [ ] **Step 5: 학생회 정보와 기수 고치기를 만든다**

`apps/api/src/councils/service.ts`의 맨 위 import 세 줄(`@vada/contracts`, `../access/actor.js`, `../db/schema.js`)을 다음 네 줄로 바꾸고(`../http/errors.js` 줄부터는 그대로 둔다):

```ts
import { eq } from 'drizzle-orm'
import type { CreateCouncilRequest, UpdateCohortRequest, UpdateCouncilSettingsRequest } from '@vada/contracts'
import { koreanDate, type Actor } from '../access/actor.js'
import { cohort, council, inviteCode } from '../db/schema.js'
```

`import { clockNow, createRecord, type Tx } from '../records/records.js'`를 `import { clockNow, createRecord, updateRecord, type Tx } from '../records/records.js'`로 바꾼 뒤, 파일 끝에 더한다:

```ts
// 학생회 정보와 직급 표시 이름 고치기. 바뀐 것이 없으면 판을 만들지 않는다.
export async function updateSettings(tx: Tx, actor: Actor, input: UpdateCouncilSettingsRequest) {
  const changes = { name: input.name, unit: input.unit, schoolName: input.schoolName, presidentTitle: input.titles.president,
    vicePresidentTitle: input.titles.vicePresident, headTitle: input.titles.head, viceHeadTitle: input.titles.viceHead }
  const [current] = await tx.select().from(council).where(eq(council.id, actor.councilId))
  if (!current) throw new ApiError('NOT_FOUND', 404)
  if ((Object.keys(changes) as (keyof typeof changes)[]).every(key => current[key] === changes[key])) return
  await updateRecord(tx, { kind: 'council', id: actor.councilId, actor: actor.memberId, reason: null, changes })
}

// 지금 기수의 이름과 기간 고치기. 기간이 오늘을 담지 않으면 모두 학생회를 열 수 없게 되므로 409로 막는다.
export async function updateCohort(tx: Tx, actor: Actor, input: UpdateCohortRequest, now: Date) {
  assertCurrentPeriod(input, now)
  const [current] = await tx.select({ name: cohort.name, startsOn: cohort.startsOn, endsOn: cohort.endsOn }).from(cohort).where(eq(cohort.id, actor.cohortId))
  if (current?.name === input.name && current.startsOn === input.startsOn && current.endsOn === input.endsOn) return
  await updateRecord(tx, { kind: 'cohort', id: actor.cohortId, actor: actor.memberId, reason: null,
    changes: { name: input.name, startsOn: input.startsOn, endsOn: input.endsOn } })
}
```

`apps/api/src/councils/routes.ts`를 다음으로 바꾼다:

```ts
import { Hono, type Context } from 'hono'
import { CreateCouncilSchema, UpdateCohortSchema, UpdateCouncilSettingsSchema, type Action, type CouncilView, type CreateCouncilResponse,
  type MyCouncilsResponse } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { authorize, authorizeChange, councilIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import { json } from '../http/validate.js'
import type { Db, Tx } from '../records/records.js'
import { councilView, myCouncils } from './queries.js'
import { createCouncil, updateCohort, updateSettings } from './service.js'

// 학생회: 내 학생회 목록, 만들기, 학생회 하나 보기, 설정, 기수. clock은 시험에서 오늘을 정할 때만 바꾼다.
export function createCouncilRoutes(db: Db, getSession: SessionReader, clock: () => Date = () => new Date()) {
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)

  // 학생회 행을 잠근 거래 안에서 권한을 다시 보고 바꾼 뒤, 바뀐 학생회를 돌려준다.
  async function change(c: Context<SessionEnv>, action: Action, run: (tx: Tx, actor: Actor, now: Date) => Promise<void>) {
    const councilId = councilIdOf(c.req.param('councilId'))
    const userId = c.get('userId')
    const now = clock()
    const view = await db.transaction(async tx => {
      const actor = await authorizeChange(tx, userId, councilId, action, now)
      await run(tx, actor, now)
      return councilView(tx, actor)
    })
    return c.json(view satisfies CouncilView)
  }

  routes.get('/me/councils', auth, async c => c.json({ councils: await myCouncils(db, c.get('userId'), clock()) } satisfies MyCouncilsResponse))
  routes.post('/organizations/create', json(CreateCouncilSchema), auth, async c => {
    const now = clock()
    const userId = c.get('userId')
    const councilId = await db.transaction(tx => createCouncil(tx, userId, c.req.valid('json'), now))
    const council = (await myCouncils(db, userId, now)).find(item => item.id === councilId)
    if (!council) throw new Error('Council missing after create')
    return c.json({ council } satisfies CreateCouncilResponse, 201)
  })
  routes.get('/organizations/:councilId', auth, async c => {
    const actor = await authorize(db, c.get('userId'), councilIdOf(c.req.param('councilId')), 'council.view', clock())
    return c.json(await councilView(db, actor) satisfies CouncilView)
  })
  routes.post('/organizations/:councilId/settings', json(UpdateCouncilSettingsSchema), auth, c =>
    change(c, 'council.update', (tx, actor) => updateSettings(tx, actor, c.req.valid('json'))))
  routes.post('/organizations/:councilId/cohort', json(UpdateCohortSchema), auth, c =>
    change(c, 'cohort.update', (tx, actor, now) => updateCohort(tx, actor, c.req.valid('json'), now)))
  return routes
}
```

`apps/api/src/http/boundary.test.ts`의 `assert.ok(mutating.length >= 9,`를 `assert.ok(mutating.length >= 14,`로 바꾼다.

`apps/api/package.json`의 `test` 스크립트 끝에 ` src/team/departments.test.ts src/councils/settings.test.ts`를 더한다.

- [ ] **Step 6: 시험이 통과하는지 본다**

Run: `cd apps/api && npx tsx --test --test-concurrency=2 src/team/departments.test.ts src/councils/settings.test.ts src/http/boundary.test.ts`
Expected: PASS (departments 5, settings 3, boundary 3)

Run: `npm run typecheck && cd apps/api && npx tsx --test --test-concurrency=2 $(node -p "require('./package.json').scripts.test.replace('tsx --test ', '')")`
Expected: 타입 오류 없음, `# fail 0`

- [ ] **Step 7: 커밋**

```bash
git add packages/contracts apps/api/src/team apps/api/src/councils apps/api/src/http/boundary.test.ts apps/api/package.json
git commit -m "부서 편성과 학생회 정보, 기수 고치기 더하기"
```

---

### Task 10: 알림 받을 기기 저장

알림 받을 기기를 로그인 계정에 붙여 저장한다(G10). 학생회에 들어오기 전에도 알림을 켤 수 있다. 같은 구독 주소면 열쇠를 갱신하고, 지금 로그인한 계정의 기기로 둔다(P22). 화면의 '알림 켜기'는 구독을 만든 뒤 저장까지 한다(구독은 덩어리 1 그대로 누른 동작 안에서 바로 부른다). 대화상자를 열 때 이미 켜진(지금 열쇠의) 구독도 한 번 저장한다(덩어리 1에서 켠 기기도 저장된다). 열쇠가 바뀐 옛 구독은 덩어리 1이 대화상자를 열 때 지우는데, 그때 서버에서도 지운다. 끝난 구독도 서버에서 지운다(P23). 시험 알림이 `expired`면 서버가 보낸 사람의 그 기기 줄도 지운다(P22). 시험 알림의 나머지(5초 기다리기, 실패 로그)는 그대로다.

**Files:**
- Modify: `packages/contracts/src/push.ts`, `packages/contracts/src/push.test.ts`, `packages/contracts/src/index.ts`
- Create: `apps/api/src/push/devices.ts`, `apps/api/src/push/devices.test.ts`
- Modify: `apps/api/src/push/routes.ts`(끝난 구독의 기기 지우기 `forget`), `apps/api/src/app.ts`, `apps/api/src/serve.ts`, `apps/api/src/http/boundary.test.ts`, `apps/api/package.json`
- Modify: `apps/web/src/push/usePush.ts`, `apps/web/src/push/PushSettings.test.tsx`

**Interfaces:**
- Consumes: 덩어리 1(005e2ca)의 `PushSubscriptionSchema`, `isKnownPushService`, `createPushRoutes(getSession, publicKey, send, wait?)`(`send: PushSender`는 `PushOutcome = { result: PushTestResult; status?: number; code?: string }`를 돌려준다), `usePush`(열 때 옛 구독을 지우고, '알림 켜기'는 바로 구독), `BrowserSubscription`, `sameKey`, `PushSettingsBody`, 시험용 `subscriptionOf`·`serverWithKey`·`environment`(`PushSettings.test.tsx`), `schema.ts`의 `pushDevice`(Task 3), `createTestDb`, `addUser`, `caller`, `testSession`, `ORIGIN`
- Produces:
  - 계약: `RemovePushDeviceSchema = { endpoint }`, `type RemovePushDeviceRequest`
  - `forgetPushDevice(db: Db, userId: string, endpoint: string): Promise<void>`(그 사람의 기기 하나만 지운다), `createPushDeviceRoutes(db: Db, getSession: SessionReader)`, `AppOptions.pushDevices`
  - `type ForgetDevice = (userId, endpoint) => Promise<void>`, `createPushRoutes(getSession, publicKey, send, wait = sleep, forget: ForgetDevice = 아무것도 안 함)`(시험 알림 결과가 `expired`면 `forget(보낸 사람, endpoint)`)
  - HTTP: `POST /api/me/push/devices`(본문 = 브라우저 구독 `toJSON()`) → 204, `POST /api/me/push/devices/remove`(`{ endpoint }`) → 204
  - 화면: `usePush`가 대화상자를 열 때 이미 켜진 구독은 `POST /api/me/push/devices`, 지운 옛 구독은 `POST /api/me/push/devices/remove`. '알림 켜기' 뒤 `POST /api/me/push/devices`, 끝난 구독은 `POST /api/me/push/devices/remove`

- [ ] **Step 1: 실패하는 계약 시험을 쓴다**

`packages/contracts/src/push.test.ts`의 `./push.js` import를 `import { PUSH_ENDPOINT_MAX, PushSubscriptionSchema, RemovePushDeviceSchema } from './push.js'`로 바꾸고, 파일 끝에 더한다:

```ts

test('RemovePushDeviceSchema: 구독 주소 하나만 받는다', () => {
  assert.equal(RemovePushDeviceSchema.safeParse({ endpoint: valid.endpoint }).success, true)
  for (const value of [{}, { endpoint: '' }, { endpoint: 'http://fcm.googleapis.com/x' }, { endpoint: valid.endpoint, keys: valid.keys },
    { endpoint: `https://fcm.googleapis.com/${'a'.repeat(PUSH_ENDPOINT_MAX)}` }]) {
    assert.equal(RemovePushDeviceSchema.safeParse(value).success, false, JSON.stringify(value).slice(0, 80))
  }
})
```

Run: `cd packages/contracts && npx tsx --test src/push.test.ts`
Expected: FAIL(`RemovePushDeviceSchema`를 찾지 못한다)

- [ ] **Step 2: 기기 지우기 계약을 더한다**

`packages/contracts/src/push.ts` 끝에 더한다:

```ts

// 알림 받을 기기 지우기(바탕 spec G10). 지금 로그인한 계정의 기기만 지운다.
export const RemovePushDeviceSchema = z.strictObject({ endpoint: PushSubscriptionSchema.shape.endpoint })
export type RemovePushDeviceRequest = z.infer<typeof RemovePushDeviceSchema>
```

`packages/contracts/src/index.ts`를 다음으로 바꾼다:

```ts
export { codePoints, EmptyRequestSchema, isStrictObject, text, token } from './input.js'
export { koreanDateTime, dateFromKorean, koreanOf } from './korean-time.js'
export { PUSH_ENDPOINT_MAX, PUSH_TEST_RESULTS, PushSubscriptionSchema, type PushSubscriptionRequest, type PushTestResult,
  type PushKeyResponse, type PushTestResponse, RemovePushDeviceSchema, type RemovePushDeviceRequest } from './push.js'
export { COUNCIL_RANKS, DEPARTMENT_RANKS, DEPARTMENT_ROLES, ACTIONS, type CouncilRank, type DepartmentRank, type DepartmentRole,
  type Action } from './permissions.js'
export { COUNCIL_NAME_MAX, SCHOOL_NAME_MAX, COHORT_NAME_MAX, COUNCIL_UNITS, dateInput, CreateCouncilSchema, type CouncilUnit,
  type CreateCouncilRequest, type MyCouncil, type MyCouncilsResponse, type CreateCouncilResponse, type CouncilTitles, type CouncilView,
  RANK_TITLE_MAX, UpdateCouncilSettingsSchema, UpdateCohortSchema, type UpdateCouncilSettingsRequest, type UpdateCohortRequest } from './councils.js'
export { INVITE_CODE_MAX, InviteCodeSchema, JoinCouncilSchema, type JoinCouncilRequest, type InvitePreviewResponse,
  type JoinCouncilResponse, type InviteCodeResponse } from './invites.js'
export { recordIdInput, AssignDepartmentSchema, ChangeRankSchema, TransferPresidentSchema, type TeamMember, type TeamDepartment,
  type TeamResponse, type AssignDepartmentRequest, type ChangeRankRequest, type TransferPresidentRequest, DEPARTMENT_NAME_MAX,
  CreateDepartmentSchema, UpdateDepartmentSchema, type CreateDepartmentRequest, type UpdateDepartmentRequest } from './team.js'
export interface HealthResponse {
  status: 'ok'
}
```

Run: `npm test --workspace @vada/contracts`
Expected: PASS(`push.test.ts` 3 tests 포함)

- [ ] **Step 3: 실패하는 서버 시험을 쓴다**

`apps/api/src/push/devices.test.ts`(만료 시각은 밀리초로 꺼내 DB 세션의 시간대와 상관없게 한다. 마지막 시험은 시험 알림 경로와 함께 끝난 구독의 기기 지우기를 본다):

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApp } from '../app.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import { addUser } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createPushDeviceRoutes, forgetPushDevice } from './devices.js'
import { createPushRoutes } from './routes.js'

const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', expirationTime: null, keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) } }

async function setup(testDb: TestDb) {
  for (const user of ['u1', 'u2']) await addUser(testDb.pg, user)
  return caller(createApp({ auth: { handler: async () => new Response() }, trustedOrigin: ORIGIN, pushDevices: createPushDeviceRoutes(testDb.db, testSession) }))
}
// 만료 시각은 밀리초로 꺼낸다. 글자로 꺼내면 DB 세션의 시간대에 따라 모양이 달라진다.
const devicesOf = (testDb: TestDb) => testDb.pg.query<{ user_id: string; endpoint: string; p256dh: string; auth: string; expiration_ms: number | null }>(
  'SELECT user_id, endpoint, p256dh, auth, (extract(epoch FROM expiration_time) * 1000)::float8 AS expiration_ms FROM push_device ORDER BY endpoint')

test('알림 받을 기기를 로그인 계정에 저장하고, 같은 구독 주소면 열쇠를 갱신한다', async () => {
  const testDb = await createTestDb()
  try {
    const api = await setup(testDb)
    const saved = await api.post('/api/me/push/devices', subscription, 'u1')
    assert.equal(saved.status, 204)
    assert.equal(await saved.text(), '')
    assert.deepEqual((await devicesOf(testDb)).rows, [{ user_id: 'u1', endpoint: subscription.endpoint, p256dh: 'p'.repeat(87), auth: 'a'.repeat(22),
      expiration_ms: null }])
    await api.post('/api/me/push/devices', { ...subscription, expirationTime: 1_798_761_600_000, keys: { p256dh: 'q'.repeat(87), auth: 'b'.repeat(22) } }, 'u1')
    assert.deepEqual((await devicesOf(testDb)).rows.map(row => [row.p256dh[0], row.auth[0], row.expiration_ms]), [['q', 'b', 1_798_761_600_000]])
    // 한 브라우저에서 다른 계정으로 켜면 그 계정의 기기가 된다.
    await api.post('/api/me/push/devices', subscription, 'u2')
    assert.deepEqual((await devicesOf(testDb)).rows.map(row => row.user_id), ['u2'])
  } finally {
    await testDb.close()
  }
})

test('지우기는 내 기기만 지우고, 없으면 그냥 204다. 로그인 계정을 지우면 기기도 지워진다', async () => {
  const testDb = await createTestDb()
  try {
    const api = await setup(testDb)
    await api.post('/api/me/push/devices', subscription, 'u1')
    const other = { ...subscription, endpoint: 'https://web.push.apple.com/other' }
    await api.post('/api/me/push/devices', other, 'u2')
    assert.equal((await api.post('/api/me/push/devices/remove', { endpoint: other.endpoint }, 'u1')).status, 204)
    assert.equal((await devicesOf(testDb)).rows.length, 2)
    assert.equal((await api.post('/api/me/push/devices/remove', { endpoint: subscription.endpoint }, 'u1')).status, 204)
    assert.equal((await api.post('/api/me/push/devices/remove', { endpoint: subscription.endpoint }, 'u1')).status, 204)
    assert.deepEqual((await devicesOf(testDb)).rows.map(row => row.endpoint), [other.endpoint])
    await testDb.pg.query("DELETE FROM users WHERE id = 'u2'")
    assert.equal((await devicesOf(testDb)).rows.length, 0)
  } finally {
    await testDb.close()
  }
})

test('모르는 알림 서버는 400 PUSH_SERVICE_UNSUPPORTED, 틀린 본문은 400, 로그인하지 않으면 401이고 저장하지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    const api = await setup(testDb)
    const unknown = await api.post('/api/me/push/devices', { ...subscription, endpoint: 'https://evil.test/push' }, 'u1')
    assert.equal(unknown.status, 400)
    assert.deepEqual(await unknown.json(), { error: 'PUSH_SERVICE_UNSUPPORTED' })
    for (const bad of [{}, { ...subscription, keys: undefined }, { ...subscription, endpoint: 'http://fcm.googleapis.com/x' }, { ...subscription, extra: 1 },
      { ...subscription, keys: { ...subscription.keys, auth: '' } }, { ...subscription, keys: { ...subscription.keys, p256dh: 'p\u0000' } },
      { ...subscription, endpoint: `https://fcm.googleapis.com/${'a'.repeat(1024)}` }, { ...subscription, expirationTime: Number.MAX_SAFE_INTEGER }]) {
      assert.equal((await api.post('/api/me/push/devices', bad, 'u1')).status, 400, JSON.stringify(bad).slice(0, 80))
    }
    assert.equal((await api.post('/api/me/push/devices/remove', { endpoint: subscription.endpoint, extra: 1 }, 'u1')).status, 400)
    assert.equal((await api.post('/api/me/push/devices', subscription)).status, 401)
    assert.equal((await api.post('/api/me/push/devices/remove', { endpoint: subscription.endpoint })).status, 401)
    assert.equal((await devicesOf(testDb)).rows.length, 0)
  } finally {
    await testDb.close()
  }
})

test('시험 알림이 끝난 구독(expired)이면 보낸 사람의 그 기기 줄도 지운다. 보낸 알림이면 남기고, 다른 사람의 기기는 두고 간다', async (t) => {
  // 보내지 못한 시험 알림은 결과를 로그에 남긴다(덩어리 1). 이 시험에서는 조용히 둔다.
  t.mock.method(console, 'warn', () => {})
  const testDb = await createTestDb()
  try {
    for (const user of ['u1', 'u2']) await addUser(testDb.pg, user)
    let result: 'sent' | 'expired' = 'sent'
    const api = caller(createApp({ auth: { handler: async () => new Response() }, trustedOrigin: ORIGIN,
      pushDevices: createPushDeviceRoutes(testDb.db, testSession),
      push: createPushRoutes(testSession, 'PUBLIC', async () => ({ result }), async () => {}, (userId, endpoint) => forgetPushDevice(testDb.db, userId, endpoint)) }))
    const other = { ...subscription, endpoint: 'https://web.push.apple.com/other' }
    await api.post('/api/me/push/devices', subscription, 'u1')
    await api.post('/api/me/push/devices', other, 'u2')
    assert.deepEqual(await (await api.post('/api/me/push/test', subscription, 'u1')).json(), { result: 'sent' })
    assert.equal((await devicesOf(testDb)).rows.length, 2)
    result = 'expired'
    await api.post('/api/me/push/test', other, 'u1')
    assert.equal((await devicesOf(testDb)).rows.length, 2)
    assert.deepEqual(await (await api.post('/api/me/push/test', subscription, 'u1')).json(), { result: 'expired' })
    assert.deepEqual((await devicesOf(testDb)).rows.map(row => [row.user_id, row.endpoint]), [['u2', other.endpoint]])
  } finally {
    await testDb.close()
  }
})
```

Run: `cd apps/api && npx tsx --test src/push/devices.test.ts`
Expected: FAIL (`Cannot find module` … `devices.js`)

- [ ] **Step 4: 기기 경로를 만들고, 끝난 시험 알림이 기기를 지우게 하고, 잇는다**

`apps/api/src/push/devices.ts`:

```ts
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { PushSubscriptionSchema, RemovePushDeviceSchema } from '@vada/contracts'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import { pushDevice } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { json } from '../http/validate.js'
import type { Db } from '../records/records.js'
import { isKnownPushService } from './endpoint.js'

// JavaScript Date가 나타낼 수 있는 가장 늦은 시각(밀리초). 이보다 큰 만료 시각은 잘못된 값이다.
const DATE_MAX_MS = 8_640_000_000_000_000

// 그 사람의 기기 하나를 지운다. 없으면 아무것도 하지 않는다. 지우기 경로와 끝난 시험 알림(push/routes.ts)이 같이 쓴다.
export async function forgetPushDevice(db: Db, userId: string, endpoint: string) {
  await db.delete(pushDevice).where(and(eq(pushDevice.endpoint, endpoint), eq(pushDevice.userId, userId)))
}

// 알림 받을 기기(바탕 spec G10). 기기는 로그인 계정에 붙어, 학생회에 들어오기 전에도 알림을 켤 수 있다.
// 구독 주소는 기기를 가리키는 비밀 주소다. 로그와 응답에 넣지 않는다(응답은 본문 없는 204).
export function createPushDeviceRoutes(db: Db, getSession: SessionReader) {
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)
  // 같은 구독 주소면 열쇠와 만료 시각을 갱신하고, 지금 로그인한 계정의 기기로 둔다(한 브라우저는 마지막에 켠 계정이 쓴다).
  routes.post('/me/push/devices', json(PushSubscriptionSchema), auth, async c => {
    const { endpoint, keys, expirationTime } = c.req.valid('json')
    if (!isKnownPushService(endpoint)) throw new ApiError('PUSH_SERVICE_UNSUPPORTED', 400)
    if (expirationTime != null && expirationTime > DATE_MAX_MS) throw new ApiError('INVALID_INPUT', 400)
    const values = { userId: c.get('userId'), p256dh: keys.p256dh, auth: keys.auth, expirationTime: expirationTime == null ? null : new Date(expirationTime) }
    await db.insert(pushDevice).values({ endpoint, ...values }).onConflictDoUpdate({ target: pushDevice.endpoint, set: values })
    return c.body(null, 204)
  })
  // 지금 로그인한 계정의 기기만 지운다. 없으면 아무것도 하지 않는다.
  routes.post('/me/push/devices/remove', json(RemovePushDeviceSchema), auth, async c => {
    await forgetPushDevice(db, c.get('userId'), c.req.valid('json').endpoint)
    return c.body(null, 204)
  })
  return routes
}
```

`apps/api/src/push/routes.ts`에서:

1. 다음 두 줄을

```ts
// 휴대폰 알림. 이번에는 기기를 저장하지 않고, 시험 알림을 보낼 때만 구독을 받아 쓰고 버린다(휴대폰 길 spec).
export function createPushRoutes(getSession: SessionReader, publicKey: string, send: PushSender, wait: (ms: number) => Promise<void> = sleep) {
```

다음으로 바꾼다:

```ts
// 끝난 구독의 저장된 기기를 지운다(바탕 spec G10). 기기는 devices.ts가 맡아, 이 모듈은 DB를 모른다.
export type ForgetDevice = (userId: string, endpoint: string) => Promise<void>

// 휴대폰 알림. 시험 알림은 저장한 기기와 상관없이 받은 구독으로 보낸다(휴대폰 길 spec). 기기 저장은 devices.ts가 맡는다.
// 끝난(expired) 구독이면 보낸 사람의 그 기기 줄도 지운다. 화면의 지우기 요청이 실패해도 줄이 남지 않는다.
export function createPushRoutes(getSession: SessionReader, publicKey: string, send: PushSender, wait: (ms: number) => Promise<void> = sleep,
  forget: ForgetDevice = async () => {}) {
```

2. `    const { result, status, code } = await send({ endpoint, keys }, TEST_MESSAGE)` 줄 아래에 `    if (result === 'expired') await forget(c.get('userId'), endpoint)`를 더한다(덩어리 1의 실패 로그 줄은 그대로 그 아래에 남는다).

`apps/api/src/app.ts`를 다음으로 바꾼다:

```ts
import { Hono } from 'hono'
import type { HealthResponse } from '@vada/contracts'
import type { createCouncilRoutes } from './councils/routes.js'
import type { createInviteRoutes } from './invites/routes.js'
import type { createPushDeviceRoutes } from './push/devices.js'
import type { createPushRoutes } from './push/routes.js'
import type { createTeamRoutes } from './team/routes.js'
import { handleError } from './http/on-error.js'
import { limitBody, mutationGuard } from './http/guard.js'

type AuthHandler = { handler: (request: Request) => Promise<Response> }
export type AppOptions = {
  auth: AuthHandler
  trustedOrigin: string
  // 학생회: 내 학생회 목록, 만들기, 보기, 설정, 기수
  councils?: ReturnType<typeof createCouncilRoutes>
  // 초대: 초대 확인, 들어오기, 초대 코드 보기와 바꾸기
  invites?: ReturnType<typeof createInviteRoutes>
  // 운영진: 목록, 부서 배정과 빼기, 직급, 회장 넘기기, 내보내기, 부서
  team?: ReturnType<typeof createTeamRoutes>
  // 휴대폰 알림. 알림 열쇠(VAPID)가 없으면 만들지 않는다.
  push?: ReturnType<typeof createPushRoutes>
  // 알림 받을 기기 저장과 지우기
  pushDevices?: ReturnType<typeof createPushDeviceRoutes>
}

export function createApp({ auth, trustedOrigin, councils, invites, team, push, pushDevices }: AppOptions) {
  const app = new Hono()
  app.use('/api/organizations/*', mutationGuard(trustedOrigin))
  // 로그인한 사람 자신의 것(휴대폰 알림)도 같은 가드를 건다.
  app.use('/api/me/*', mutationGuard(trustedOrigin))
  // 로그인 없이 쓰는 공개 경로(참가 신청)도 같은 화면에서만 보내므로 같은 가드를 건다.
  app.use('/api/public/*', mutationGuard(trustedOrigin))
  app.get('/api/health', (c) => c.json({ status: 'ok' } satisfies HealthResponse))
  // better-auth는 출처 검사 전에 본문 전체를 읽으므로 크기만 먼저 제한한다.
  app.use('/api/auth/*', limitBody())
  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))
  if (councils) app.route('/api', councils)
  if (invites) app.route('/api', invites)
  if (team) app.route('/api', team)
  if (push) app.route('/api', push)
  if (pushDevices) app.route('/api', pushDevices)
  app.onError(handleError)
  return app
}
```

`apps/api/src/serve.ts`에서:
1. `import { pushConfigFrom } from './push/config.js'` 아래에 `import { createPushDeviceRoutes, forgetPushDevice } from './push/devices.js'`를 더한다.
2. `  const team = createTeamRoutes(db, session)` 아래에 `  const pushDevices = createPushDeviceRoutes(db, session)`를 더한다.
3. `    ? createPushRoutes(session, pushConfig.publicKey, createPushSender(pushConfig))`를 `    ? createPushRoutes(session, pushConfig.publicKey, createPushSender(pushConfig), undefined, (userId, endpoint) => forgetPushDevice(db, userId, endpoint))`로 바꾼다(넷째 인자 `undefined`는 기본 5초 기다리기다).
4. `councils, invites, team, push })`를 `councils, invites, team, push, pushDevices })`로 바꾼다.

`apps/api/src/http/boundary.test.ts`에서:
1. `import { createPushRoutes } from '../push/routes.js'` 위에 `import { createPushDeviceRoutes } from '../push/devices.js'`를 더한다.
2. `modules`의 `    push: createPushRoutes(session, 'PUBLIC', async () => ({ result: 'sent' }), async () => {}),` 아래에 `    pushDevices: createPushDeviceRoutes(db, session),`를 더한다.
3. `assert.ok(mutating.length >= 14,`를 `assert.ok(mutating.length >= 16,`로 바꾼다.

`apps/api/package.json`의 `test` 스크립트 끝에 ` src/push/devices.test.ts`를 더한다.

Run: `cd apps/api && npx tsx --test --test-concurrency=2 src/push/devices.test.ts src/push/routes.test.ts src/http/boundary.test.ts`
Expected: PASS (devices 4, routes 8, boundary 3). 덩어리 1의 `routes.test.ts`는 `forget`을 넘기지 않아 그대로 통과한다.

- [ ] **Step 5: 화면 — 실패하는 시험으로 바꾼다**

`apps/web/src/push/PushSettings.test.tsx`에서:

1. `serverWithKey`를 다음으로 바꾼다(대화상자를 열 때 이미 켜진 구독은 저장되고 옛 구독은 지워지므로 기기 저장과 지우기도 받는다):

```tsx
// 열쇠를 주고 기기 저장·지우기를 받는다. 대화상자를 열 때 이미 켜진 구독은 저장되고 옛 구독은 지워진다(바탕 Task 10).
// 저장 실패를 보는 시험은 이 경로를 다시 등록한다.
function serverWithKey() {
  const api = mockApi()
  api.on('GET', '/api/me/push', () => json({ publicKey: KEY }))
  api.on('POST', '/api/me/push/devices', () => new Response(null, { status: 204 }))
  api.on('POST', '/api/me/push/devices/remove', () => new Response(null, { status: 204 }))
  return api
}
```

2. 시험 `'알림 켜기는 누른 동작 안에서 기다림 없이 구독하고, 켜지면 시험 알림 버튼을 보여 준다'`를 통째로 다음 두 시험으로 바꾼다:

```tsx
test('알림 켜기는 누른 동작 안에서 기다림 없이 구독하고, 기기를 저장한 뒤 시험 알림 버튼을 보여 준다', async () => {
  const api = serverWithKey()
  const { env, subscribe } = environment()
  render(<PushSettingsBody environment={env} />)
  fireEvent.click(await screen.findByRole('button', { name: '알림 켜기' }))
  expect(subscribe).toHaveBeenCalledTimes(1)
  expect(subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: keyBytes })
  expect(await screen.findByText('이 기기에서 알림을 받아요.')).toBeTruthy()
  const saved = api.calls.filter(call => call.method === 'POST' && call.path === '/api/me/push/devices')
  expect(saved.map(call => call.body)).toEqual([subscriptionOf(keyBytes).toJSON()])
  api.assertNoUnexpectedRequests()
})

test('기기를 저장하지 못하면 구독을 지우고 다시 누르게 한다', async () => {
  const api = serverWithKey()
  api.on('POST', '/api/me/push/devices', () => json({ error: 'Internal server error' }, 500))
  const created = subscriptionOf(keyBytes)
  const { env } = environment({ subscribe: async () => created })
  render(<PushSettingsBody environment={env} />)
  fireEvent.click(await screen.findByRole('button', { name: '알림 켜기' }))
  expect(await screen.findByText('알림을 켜지 못했어요. 다시 눌러 주세요.')).toBeTruthy()
  expect(created.unsubscribe).toHaveBeenCalled()
  expect(screen.getByRole('button', { name: '알림 켜기' })).toBeTruthy()
})
```

3. 시험 `'서버 열쇠가 바뀐 옛 구독은 열 때 지우고, 켜기는 누른 동작 안에서 새 열쇠로 바로 구독한다'`를 통째로 다음으로 바꾼다(덩어리 1의 확인에 서버 지우기와 저장 확인을 더했다):

```tsx
test('서버 열쇠가 바뀐 옛 구독은 열 때 지우고 서버에서도 지우며, 켜기는 누른 동작 안에서 새 열쇠로 바로 구독한 뒤 기기를 저장한다', async () => {
  const api = serverWithKey()
  const old = subscriptionOf(Uint8Array.from([4, 9, 9, 9]), 'https://fcm.googleapis.com/fcm/send/old')
  const { env, subscribe } = environment({ permission: 'granted', existing: old })
  render(<PushSettingsBody environment={env} />)
  const enable = await screen.findByRole('button', { name: '알림 켜기' })
  expect(old.unsubscribe).toHaveBeenCalledTimes(1)
  expect(subscribe).not.toHaveBeenCalled()
  // 옛 구독은 서버에서도 지운다.
  await waitFor(() => expect(api.calls.filter(call => call.path === '/api/me/push/devices/remove').map(call => call.body))
    .toEqual([{ endpoint: 'https://fcm.googleapis.com/fcm/send/old' }]))
  fireEvent.click(enable)
  // 아이폰은 누른 동작 안에서만 허락을 묻는다. 기다리지 않고 누른 바로 뒤에 확인한다.
  expect(subscribe).toHaveBeenCalledTimes(1)
  expect(subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: keyBytes })
  expect(old.unsubscribe).toHaveBeenCalledTimes(1)
  expect(await screen.findByText('이 기기에서 알림을 받아요.')).toBeTruthy()
  expect(api.calls.filter(call => call.path === '/api/me/push/devices').map(call => call.body)).toEqual([subscriptionOf(keyBytes).toJSON()])
  api.assertNoUnexpectedRequests()
})
```

4. 시험 `'옛 구독을 지우지 못해도 켜기 전으로 보여 주고, 켜기는 바로 구독한다'`는 그대로 두고, 그 바로 뒤에 이미 켜진 구독의 시험 둘을 더한다:

```tsx
test('이미 켜진 구독은 열 때 서버에 기기를 저장한다(덩어리 1에서 켠 기기도 이 계정의 기기가 된다)', async () => {
  const api = serverWithKey()
  const existing = subscriptionOf(keyBytes)
  render(<PushSettingsBody environment={environment({ permission: 'granted', existing }).env} />)
  expect(await screen.findByText('이 기기에서 알림을 받아요.')).toBeTruthy()
  expect(api.calls.filter(call => call.method === 'POST' && call.path === '/api/me/push/devices').map(call => call.body)).toEqual([existing.toJSON()])
  expect(existing.unsubscribe).not.toHaveBeenCalled()
  api.assertNoUnexpectedRequests()
})

test('이미 켜진 구독을 열 때 저장하지 못하면 켜기에 실패한 것처럼 구독을 지우고 다시 누르게 한다', async () => {
  const api = serverWithKey()
  api.on('POST', '/api/me/push/devices', () => json({ error: 'Internal server error' }, 500))
  const existing = subscriptionOf(keyBytes)
  render(<PushSettingsBody environment={environment({ permission: 'granted', existing }).env} />)
  expect(await screen.findByText('알림을 켜지 못했어요. 다시 눌러 주세요.')).toBeTruthy()
  expect(existing.unsubscribe).toHaveBeenCalled()
  expect(screen.getByRole('button', { name: '알림 켜기' })).toBeTruthy()
  expect(screen.queryByText('이 기기에서 알림을 받아요.')).toBeNull()
})
```

5. 시험 `'시험 알림은 구독을 보내고, 보내는 동안 버튼을 막아 한 번만 보낸다'`의 `  const posts = api.calls.filter(call => call.method === 'POST')`를 `  const posts = api.calls.filter(call => call.path === '/api/me/push/test')`로 바꾼다(열 때 기기 저장 요청이 하나 더 있다).

6. 시험 `'구독이 끝났으면 지우고 다시 켜게 한다'`를 통째로 다음으로 바꾼다:

```tsx
test('구독이 끝났으면 지우고 다시 켜게 한다', async () => {
  const api = serverWithKey()
  api.on('POST', '/api/me/push/test', () => json({ result: 'expired' }))
  const existing = subscriptionOf(keyBytes)
  render(<PushSettingsBody environment={environment({ permission: 'granted', existing }).env} />)
  fireEvent.click(await screen.findByRole('button', { name: '시험 알림 보내기' }))
  expect(await screen.findByText('이 기기의 알림 등록이 끝났어요. 알림을 다시 켜 주세요.')).toBeTruthy()
  expect(existing.unsubscribe).toHaveBeenCalled()
  expect(screen.getByRole('button', { name: '알림 켜기' })).toBeTruthy()
  // 끝난 구독은 서버에서도 지운다.
  await waitFor(() => expect(api.calls.filter(call => call.path === '/api/me/push/devices/remove').map(call => call.body))
    .toEqual([{ endpoint: existing.endpoint }]))
})
```

덩어리 1 005e2ca의 나머지 시험(허락 창에서 거절하면 꺼짐 안내, 끝난 구독을 다시 켜면 안내가 사라짐, 알림 API가 없으면 서버를 부르지 않음 등)은 그대로 둔다. 바꾼 `serverWithKey`가 기기 저장과 지우기를 받아 그대로 통과한다.

Run: `cd apps/web && npx vitest run src/push/PushSettings.test.tsx`
Expected: FAIL, `6 failed | 16 passed (22)`(덩어리 1의 005e2ca 기준). 새 시험 넷과 바꾼 시험 둘이 기기를 저장하거나 지우는 요청을 찾지 못하거나(`expected [] to deeply equal …`), 저장하지 못한 구독에도 '이 기기에서 알림을 받아요.'를 본다.

- [ ] **Step 6: 대화상자와 '알림 켜기'가 기기를 저장하게 한다**

`apps/web/src/push/usePush.ts`에서:

1. `type Server = { kind: 'loading' } | …` 줄 바로 위에 빈 줄 하나를 두고 더한다:

```ts
// 알림 받을 기기를 서버에 저장한다(바탕 spec G10). 같은 구독 주소면 서버가 열쇠를 갱신한다. 저장했으면 true다.
async function saveDevice(subscription: BrowserSubscription) {
  try {
    const response = await fetch('/api/me/push/devices', { method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription.toJSON()) })
    return response.ok
  } catch {
    return false
  }
}

// 끝난 구독은 서버에서도 지운다(바탕 spec G10). 실패해도 화면은 그대로 둔다.
function forgetDevice(endpoint: string) {
  void fetch('/api/me/push/devices/remove', { method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint }) }).catch(() => undefined)
}
```

2. `load()` 안의 다음 부분을

```ts
        let existing = await manager.getSubscription()
        // 열쇠가 바뀐 옛 구독은 여기서 지운다. 못 지워도 넘어가고, 구독이 없는 것으로 본다.
        // 그래야 '알림 켜기'를 누른 동작 안에서 기다림 없이 구독할 수 있다.
        if (existing && !sameKey(existing, key)) {
          await existing.unsubscribe().catch(() => false)
          existing = null
        }
        if (cancelled) return
        setSubscription(existing)
        setServer({ kind: 'ready', key, manager })
```

다음으로 바꾼다(덩어리 1이 지우는 옛 구독은 서버에서도 지우고, 남은 지금 열쇠의 구독은 저장한다. 저장하지 못하면 켜기에 실패한 것과 똑같이 둔다, P23):

```ts
        let existing = await manager.getSubscription()
        // 열쇠가 바뀐 옛 구독은 여기서 지운다. 못 지워도 넘어가고, 구독이 없는 것으로 본다. 서버에 저장된 그 기기도 지운다(바탕 spec G10).
        // 그래야 '알림 켜기'를 누른 동작 안에서 기다림 없이 구독할 수 있다.
        if (existing && !sameKey(existing, key)) {
          await existing.unsubscribe().catch(() => false)
          forgetDevice(existing.endpoint)
          existing = null
        }
        // 이미 켜진(지금 열쇠의) 구독도 서버에 저장한다. 덩어리 1에서 켠 기기나 다른 계정으로 켰던 브라우저도 이 계정의 기기가 된다(바탕 spec G10).
        // 저장하지 못하면 켜기에 실패한 것처럼 구독을 지우고 다시 누르게 한다. 서버에 기기가 없는데 '켜짐'을 보이지 않는다(P23).
        let saveFailed = false
        if (existing && !await saveDevice(existing)) {
          await existing.unsubscribe().catch(() => false)
          existing = null
          saveFailed = true
        }
        if (cancelled) return
        setSubscription(existing)
        if (saveFailed) setEnableFailed(true)
        setServer({ kind: 'ready', key, manager })
```

3. 다음 부분을

```ts
  // 누른 동작 안에서 바로 구독한다. 열쇠가 바뀐 옛 구독은 대화상자를 열 때 이미 지웠으므로 여기서 기다릴 일이 없다.
  function enable() {
    if (!ready) return
    setEnableFailed(false)
    setTest({ kind: 'idle' })
    ready.manager.subscribe({ userVisibleOnly: true, applicationServerKey: ready.key }).then(next => {
      setSubscription(next)
      setPermission(browser.permission())
    }, () => {
```

다음으로 바꾼다:

```ts
  // 누른 동작 안에서 바로 구독한다. 열쇠가 바뀐 옛 구독은 대화상자를 열 때 이미 지웠으므로 여기서 기다릴 일이 없다.
  // 새 구독은 서버에 저장해야 이 기기로 알림이 간다. 저장하지 못하면 구독을 지우고 다시 누르게 한다.
  function enable() {
    if (!ready) return
    setEnableFailed(false)
    setTest({ kind: 'idle' })
    ready.manager.subscribe({ userVisibleOnly: true, applicationServerKey: ready.key }).then(async next => {
      if (!await saveDevice(next)) {
        await next.unsubscribe().catch(() => false)
        setSubscription(null)
        setPermission(browser.permission())
        setEnableFailed(true)
        return
      }
      setSubscription(next)
      setPermission(browser.permission())
    }, () => {
```

4. `sendTest`의 `if (result === 'expired') {` 안에서 `await subscription.unsubscribe().catch(() => false)` 줄 아래에 `        forgetDevice(subscription.endpoint)`를 더한다.

위 편집은 덩어리 1의 005e2ca에 맞췄다. 그 뒤에 `usePush.ts`나 `PushSettings.test.tsx`가 바뀌었으면 같은 뜻을 실제 코드에 넣는다: 저장 함수 둘, 열 때 옛 구독의 서버 지우기, 열 때 이미 켜진 구독 저장과 실패 시 구독 지우기, 켠 뒤 저장과 실패 시 구독 지우기, 끝난 구독 지우기. 구독(`ready.manager.subscribe`)은 덩어리 1처럼 누른 동작 안에서 기다림 없이 부른다(아이폰은 누른 동작 안에서만 허락을 묻는다). 저장은 구독이 끝난 뒤의 `then` 안에서 하고, 열 때의 저장과 지우기는 `load()` 안에서 하므로 이 규칙과 상관없다.

- [ ] **Step 7: 화면 시험과 전체 검사를 돌린다**

Run: `cd apps/web && npx vitest run src/push && npx tsc --noEmit`
Expected: PASS, 실패 0(`PushSettings.test.tsx`는 덩어리 1의 005e2ca 기준 22 tests, `src/push` 전체 26), 타입 오류 없음

Run: `npm run typecheck && cd apps/api && npx tsx --test --test-concurrency=2 $(node -p "require('./package.json').scripts.test.replace('tsx --test ', '')")`
Expected: 타입 오류 없음, `# fail 0`

- [ ] **Step 8: 커밋**

```bash
git add packages/contracts apps/api/src/push apps/api/src/app.ts apps/api/src/serve.ts apps/api/src/http/boundary.test.ts apps/api/package.json apps/web/src/push
git commit -m "알림 받을 기기 저장과 지우기 더하기"
```

---

### Task 11: 화면 — 학생회 없음, 만들기, 초대 링크, 작업 공간 틀, 운영진 목록

로그인한 뒤의 첫 화면을 새 API에 잇는다. 내 학생회 목록이 비면 [초대 코드로 들어가기]와 [학생회 만들기]를 보이고, 만들면 운영진 > 사람으로 간다. 초대 링크(`/join/코드`)는 "OOO에 들어갈까요?"를 묻고, 이미 들어왔으면 묻지 않고 그 학생회를 연다. 작업 공간 틀은 위 학생회 이름 메뉴(학생회 고르기), 옆 메뉴(운영진 > 사람), 아래 사용자 줄(이름, 직급, 휴대폰 알림, 로그아웃)이고, 휴대폰 폭에서는 옆 메뉴가 시트로 바뀐다. 이 작업의 운영진 > 사람은 목록만 보인다(동작은 Task 12). 학생회 하나 보기가 403이면 그 학생회를 닫고 내 학생회 목록을 다시 읽는다(P24, Review Focus 1). 메뉴 부품 `components/ui/menu.tsx`를 더하고 `/ui.html`에 보인다(P25).

**Files:**
- Create: `apps/web/src/lib/api.ts`, `apps/web/src/lib/api.test.ts`
- Create: `apps/web/src/components/ui/menu.tsx`
- Create: `apps/web/src/councils/invite-path.ts`, `apps/web/src/councils/invite-path.test.ts`, `apps/web/src/councils/useMyCouncils.ts`, `apps/web/src/councils/NoCouncil.tsx`, `apps/web/src/councils/CreateCouncilForm.tsx`, `apps/web/src/councils/JoinCouncil.tsx`, `apps/web/src/councils/MyCouncils.tsx`
- Create: `apps/web/src/workspace/useCouncilView.ts`, `apps/web/src/workspace/WorkspaceHeader.tsx`, `apps/web/src/workspace/WorkspaceSidebar.tsx`, `apps/web/src/workspace/Workspace.tsx`
- Create: `apps/web/src/team/team-view.ts`, `apps/web/src/team/team-view.test.ts`, `apps/web/src/team/useTeam.ts`, `apps/web/src/team/People.tsx`, `apps/web/src/team/People.test.tsx`
- Create: `apps/web/src/test-support/council-fixtures.ts`, `apps/web/src/App.integration.test.tsx`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`, `apps/web/src/ui-gallery/Gallery.tsx`, `apps/web/src/ui-gallery/Gallery.test.tsx`

**Interfaces:**
- Consumes:
  - 계약(Task 5~9): `ACTIONS`, `type Action`, `type CouncilRank`, `type DepartmentRank`, `COUNCIL_UNITS`, `type CouncilUnit`, `CreateCouncilSchema`, `type CreateCouncilResponse = { council: MyCouncil }`, `type MyCouncil = { id; name; councilRank; departments }`, `type MyCouncilsResponse = { councils: MyCouncil[] }`, `type CouncilView = { council: { id; name; unit; schoolName; titles }; cohort: { id; name; startsOn; endsOn }; me: { memberId; name; councilRank; departments }; permissions: Action[] }`, `type CouncilTitles = { president; vicePresident; head; viceHead }`, `InviteCodeSchema`, `type InvitePreviewResponse`, `type JoinCouncilResponse`, `type TeamResponse = { members: TeamMember[]; departments: TeamDepartment[] }`, `type TeamMember = { id; name; councilRank; departments: { id; rank }[]; joinedAt }`, `type TeamDepartment = { id; name; role; memberCount }`, `koreanOf`
  - HTTP(Task 6~8): `GET /api/me/councils`, `POST /api/organizations/create`(201), `GET /api/invites/:code`, `POST /api/organizations/join`, `GET /api/organizations/:councilId`, `GET /api/organizations/:councilId/members`
  - 덩어리 1: `PushSettingsButton`(`push/PushSettings.tsx` 기본 내보내기), `LoginPanel`, `startPopupLogin`, `AUTH_CHANNEL`, `AUTH_DONE_PATH`, `isIosHomeScreenApp`, `isKakaoInAppBrowser`
  - 지금 화면 부품: `Button`, `Input`, `Label`, `NativeSelect`, `NavItem`, `Card`, `Badge`, `Alert`, `Sheet`·`SheetContent`, `Avatar`, `BrandMark`, `AuthCard`, `StateMessage`, 시험용 `mockApi()`·`json()`(`test-support/mock-api.ts`)
- Produces:
  - `type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; code: string }`, `getJson<T>(path, signal?)`, `postJson<T>(path, body)`(연결 실패와 5xx는 `code: 'FAILED'`, 204는 `data: undefined`)
  - `Menu`, `MenuTrigger`, `MenuContent`(`align` 기본 `'end'`), `MenuItem`(`destructive?: boolean`), `MenuLabel`, `MenuSeparator`
  - `inviteCodeFromPath(pathname): string | null`, `inviteCodeFromText(text): string`, `invitePath(code)`, `inviteLink(code, origin?)`
  - `useMyCouncils(): { state: MyCouncilsState; reload(); add(council) }`, `NoCouncil`, `CreateCouncilForm`(+ `unitLabels: Record<CouncilUnit, string>`), `JoinCouncil`, `MyCouncils`
  - `useCouncilView(councilId): { state: CouncilViewState; reload(); replace(view) }`(`CouncilViewState`의 `'lost'`는 403), `WorkspaceHeader`, `WorkspaceSidebar`(`type Page = 'people'`), `Workspace`
  - `councilRankLabel(rank, titles)`, `departmentRankLabel(rank, titles)`, `joinedDay(iso)`, `placementsText(member, departments, titles)`
  - `useTeam(councilId, onForbidden): { data: TeamResponse | null; loadFailed; saving; change(path, body): Promise<string | null>; reload() }`, `type Team`, `People({ view, team })`
  - 시험용(`test-support/council-fixtures.ts`): `defaultTitles`, `MEMBER_PERMISSIONS`, `LEADER_PERMISSIONS`, `PRESIDENT_PERMISSIONS`, `myCouncil(id?, name?, councilRank?)`, `councilView(id?, { name?, councilRank?, permissions?, memberId? })`, `teamResponse()`(회장 김회장 m1, 재정부 부장 이재정 m2, 부서 없는 박새내 m3, 재정부 d1·기획부 d2)

- [ ] **Step 1: 실패하는 시험을 쓴다 — API 부르기, 초대 경로, 운영진 글**

`apps/web/src/lib/api.test.ts`:

```ts
import { afterEach, expect, test, vi } from 'vitest'
import { json, mockApi } from '@/test-support/mock-api'
import { getJson, postJson } from './api'

afterEach(() => vi.unstubAllGlobals())

test('성공하면 본문을, 204면 빈 성공을 돌려준다', async () => {
  const api = mockApi()
  api.on('GET', '/api/me/councils', () => json({ councils: [] }))
  api.on('POST', '/api/me/push/devices', () => new Response(null, { status: 204 }))
  expect(await getJson('/api/me/councils')).toEqual({ ok: true, data: { councils: [] } })
  expect(await postJson('/api/me/push/devices', { a: 1 })).toEqual({ ok: true, data: undefined })
  expect(api.calls.map(call => [call.method, call.path, call.body])).toEqual([['GET', '/api/me/councils', null], ['POST', '/api/me/push/devices', { a: 1 }]])
  api.assertNoUnexpectedRequests()
})

test('4xx는 서버의 오류 코드를, 5xx와 연결 실패와 코드 없는 응답은 FAILED를 돌려준다', async () => {
  const api = mockApi()
  api.on('POST', '/api/a', () => json({ error: 'DEPARTMENT_IN_USE' }, 409))
  api.on('POST', '/api/b', () => json({ error: 'Internal server error' }, 500))
  api.on('POST', '/api/c', () => new Response('not json', { status: 400 }))
  api.on('POST', '/api/d', () => { throw new TypeError('Load failed') })
  expect(await postJson('/api/a', {})).toEqual({ ok: false, status: 409, code: 'DEPARTMENT_IN_USE' })
  expect(await postJson('/api/b', {})).toEqual({ ok: false, status: 500, code: 'FAILED' })
  expect(await postJson('/api/c', {})).toEqual({ ok: false, status: 400, code: 'FAILED' })
  expect(await postJson('/api/d', {})).toEqual({ ok: false, status: 0, code: 'FAILED' })
})
```

`apps/web/src/councils/invite-path.test.ts`:

```ts
import { expect, test } from 'vitest'
import { inviteCodeFromPath, inviteCodeFromText, inviteLink, invitePath } from './invite-path'

test('초대 경로에서 코드를 꺼내고, 깨진 인코딩은 그대로 서버에 맡긴다', () => {
  expect(inviteCodeFromPath('/join/ABCD2345')).toBe('ABCD2345')
  expect(inviteCodeFromPath('/join/ab%20cd')).toBe('ab cd')
  expect(inviteCodeFromPath('/join/%E0%A4%A')).toBe('%E0%A4%A')
  expect(inviteCodeFromPath('/')).toBeNull()
  expect(inviteCodeFromPath('/join/')).toBeNull()
  expect(inviteCodeFromPath('/join/a/b')).toBeNull()
  expect(invitePath('AB CD')).toBe('/join/AB%20CD')
  expect(inviteLink('ABCD2345', 'https://vada.test')).toBe('https://vada.test/join/ABCD2345')
})

test('붙여 넣은 초대 링크에서 코드만 꺼내고, 코드만 쓴 입력은 그대로 둔다', () => {
  expect(inviteCodeFromText('https://vada-m1.onrender.com/join/ABCD2345')).toBe('ABCD2345')
  expect(inviteCodeFromText('vada-m1.onrender.com/join/abcd2345?from=kakao')).toBe('abcd2345')
  expect(inviteCodeFromText('https://vada-m1.onrender.com/join/%E0%A4%A')).toBe('%E0%A4%A')
  expect(inviteCodeFromText(' ABCD2345 ')).toBe(' ABCD2345 ')
})
```

`apps/web/src/team/team-view.test.ts`:

```ts
import { expect, test } from 'vitest'
import { councilRankLabel, departmentRankLabel, joinedDay, placementsText } from './team-view'

const titles = { president: '위원장', vicePresident: '부위원장', head: '국장', viceHead: '차장' }

test('직급은 학생회가 정한 표시 이름으로 보인다', () => {
  expect([councilRankLabel('president', titles), councilRankLabel('vice_president', titles), councilRankLabel(null, titles)])
    .toEqual(['위원장', '부위원장', null])
  expect([departmentRankLabel('head', titles), departmentRankLabel('vice_head', titles), departmentRankLabel(null, titles)]).toEqual(['국장', '차장', null])
})

test('들어온 날은 한국 날짜다', () => {
  expect(joinedDay('2026-10-18T15:00:00.000Z')).toBe('2026.10.19')
  expect(joinedDay('2026-10-18T14:59:59.000Z')).toBe('2026.10.18')
})

test('부서 글은 부서 이름과 부서 직급을 잇는다', () => {
  const departments = [{ id: 'f', name: '재정부' }, { id: 'p', name: '기획부' }]
  expect(placementsText({ departments: [{ id: 'f', rank: 'head' }, { id: 'p', rank: null }] }, departments, titles)).toBe('재정부 국장 · 기획부')
  expect(placementsText({ departments: [] }, departments, titles)).toBe('')
})
```

Run: `cd apps/web && npx vitest run src/lib/api.test.ts src/councils/invite-path.test.ts src/team/team-view.test.ts`
Expected: FAIL, `Test Files  3 failed`(`Cannot find module './api'`, `'./invite-path'`, `'./team-view'`)

- [ ] **Step 2: 도우미를 만든다**

`apps/web/src/lib/api.ts`:

```ts
// 서버 API를 같은 출처로 부른다. 성공하면 본문을, 실패하면 오류 코드를 돌려준다. 화면은 오류 코드로 문구를 고른다.
// 4xx는 서버가 준 코드(FORBIDDEN, DEPARTMENT_IN_USE 등)이고, 연결 실패와 5xx는 'FAILED'다. 204는 본문이 없다.
export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; code: string }

async function call<T>(path: string, init: RequestInit): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...init })
    if (response.status === 204) return { ok: true, data: undefined as T }
    const body: unknown = await response.json().catch(() => null)
    if (response.ok && body !== null) return { ok: true, data: body as T }
    const code = (body as { error?: unknown } | null)?.error
    return { ok: false, status: response.status, code: response.status < 500 && typeof code === 'string' ? code : 'FAILED' }
  } catch {
    return { ok: false, status: 0, code: 'FAILED' }
  }
}

export const getJson = <T>(path: string, signal?: AbortSignal) => call<T>(path, { signal })
export const postJson = <T>(path: string, body: unknown) =>
  call<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
```

`apps/web/src/councils/invite-path.ts`:

```ts
// 초대 링크 형식은 {origin}/join/{code}다. 코드가 맞는지는 서버가 판단한다(지금 vada와 같다).
const pattern = /^\/join\/([^/]+)$/
const decode = (segment: string) => { try { return decodeURIComponent(segment) } catch { return segment } }

export function inviteCodeFromPath(pathname: string) {
  const segment = pattern.exec(pathname)?.[1]
  return segment === undefined ? null : decode(segment)
}

// 받은 링크를 코드 칸에 통째로 붙여 넣어도 코드만 꺼낸다. https:// 없이 복사한 주소도 받는다.
export function inviteCodeFromText(text: string) {
  const segment = /\/join\/([^/?#\s]+)/.exec(text)?.[1]
  return segment === undefined ? text : decode(segment)
}

export const invitePath = (code: string) => `/join/${encodeURIComponent(code)}`
export const inviteLink = (code: string, origin = window.location.origin) => `${origin}${invitePath(code)}`
```

`apps/web/src/team/team-view.ts`:

```ts
import { koreanOf, type CouncilRank, type CouncilTitles, type DepartmentRank, type TeamDepartment, type TeamMember } from '@vada/contracts'

// 직급의 표시 이름. 학생회가 정한 이름을 쓴다(DEC-16). 직급이 없으면 null이다.
export const councilRankLabel = (rank: CouncilRank | null, titles: CouncilTitles) =>
  rank === 'president' ? titles.president : rank === 'vice_president' ? titles.vicePresident : null
export const departmentRankLabel = (rank: DepartmentRank | null, titles: CouncilTitles) =>
  rank === 'head' ? titles.head : rank === 'vice_head' ? titles.viceHead : null

// 들어온 날(한국 날짜). 예: 2026.10.19
export const joinedDay = (iso: string) => koreanOf(new Date(iso)).slice(0, 10).replaceAll('-', '.')

// 운영진 한 줄의 부서 글. 예: '재정부 부장 · 기획부'. 부서가 없으면 빈 글이다.
export function placementsText(member: Pick<TeamMember, 'departments'>, departments: Pick<TeamDepartment, 'id' | 'name'>[], titles: CouncilTitles) {
  return member.departments.map(item => {
    const name = departments.find(department => department.id === item.id)?.name ?? ''
    const rank = departmentRankLabel(item.rank, titles)
    return rank ? `${name} ${rank}` : name
  }).join(' · ')
}
```

Run: `cd apps/web && npx vitest run src/lib/api.test.ts src/councils/invite-path.test.ts src/team/team-view.test.ts`
Expected: PASS, `Tests  7 passed (7)`

- [ ] **Step 3: 실패하는 시험을 쓴다 — 동작 메뉴 부품**

`apps/web/src/ui-gallery/Gallery.test.tsx`에서:

1. 첫 시험의 이름 목록에서 `'메뉴·탭', '빈 화면·아바타·로고'`를 `'메뉴·탭', '동작 메뉴', '빈 화면·아바타·로고'`로 바꾼다.
2. 파일 끝에 더한다:

```tsx

test('동작 메뉴 예시는 키보드로 열고, 위험한 항목은 빨갛게 보인다', async () => {
  render(<Gallery />)
  fireEvent.keyDown(screen.getByRole('button', { name: '운영진 동작 예시' }), { key: 'Enter' })
  const menu = await screen.findByRole('menu')
  expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual(['부서 배정', '부회장으로 두기', '내보내기'])
  expect(within(menu).getByRole('menuitem', { name: '내보내기' }).className).toContain('text-destructive')
})
```

Run: `cd apps/web && npx vitest run src/ui-gallery`
Expected: FAIL, `Tests  2 failed | 4 passed (6)`(`"동작 메뉴"` 제목과 `"운영진 동작 예시"` 버튼을 찾지 못한다)

- [ ] **Step 4: 동작 메뉴 부품을 만들고 부품 확인 화면에 더한다**

`apps/web/src/components/ui/menu.tsx`:

```tsx
import type { ComponentProps } from 'react'
import { DropdownMenu as MenuPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

// 버튼 아래에 뜨는 짧은 동작 목록(학생회 이름 메뉴, 줄마다 ⋯ 메뉴). 키보드로도 고른다(Radix DropdownMenu).
export const Menu = MenuPrimitive.Root
export const MenuTrigger = MenuPrimitive.Trigger

// 카드와 같은 테두리·그림자, 반경 중간 값. 폭은 내용에 맞추되 너무 좁지 않게 둔다.
export function MenuContent({ className, sideOffset = 4, align = 'end', ...props }: ComponentProps<typeof MenuPrimitive.Content>) {
  return <MenuPrimitive.Portal>
    <MenuPrimitive.Content sideOffset={sideOffset} align={align} className={cn(
      'z-50 max-w-72 min-w-44 rounded-md border bg-white p-1 shadow-lg outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0',
      className)} {...props} />
  </MenuPrimitive.Portal>
}

// 메뉴 항목: 옆 메뉴 항목(NavItem)과 같은 글자 크기와 여백이다. 되돌리기 어려운 동작(내보내기)은 destructive로 빨갛게 둔다.
export function MenuItem({ className, destructive = false, ...props }: ComponentProps<typeof MenuPrimitive.Item> & { destructive?: boolean }) {
  return <MenuPrimitive.Item className={cn(
    'flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm wrap-anywhere text-gray-700 outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[highlighted]:bg-gray-100 [&_svg]:size-4 [&_svg]:shrink-0',
    destructive && 'text-destructive', className)} {...props} />
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label className={cn('px-3 py-1.5 text-xs text-gray-400', className)} {...props} />
}

export function MenuSeparator({ className, ...props }: ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn('my-1 h-px bg-gray-100', className)} {...props} />
}
```

`apps/web/src/ui-gallery/Gallery.tsx`에서:

1. `import { CalendarDays, Copy, Plus } from 'lucide-react'`를 `import { CalendarDays, Check, Copy, Ellipsis, Plus, Settings } from 'lucide-react'`로 바꾼다.
2. `import { Label } from '@/components/ui/label'` 아래에 `import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu'`를 더한다.
3. `<Section title="메뉴·탭">` 묶음이 끝나는 `    </Section>` 바로 다음 줄에 더한다:

```tsx
    <Section title="동작 메뉴">
      <Menu>
        <MenuTrigger asChild><Button variant="outline">학생회 메뉴 열기</Button></MenuTrigger>
        <MenuContent align="start">
          <MenuLabel>학생회 고르기</MenuLabel>
          <MenuItem><Check aria-hidden />컴퓨터학부 학생회</MenuItem>
          <MenuItem><span aria-hidden className="size-4 shrink-0" />{longName}</MenuItem>
          <MenuSeparator />
          <MenuItem><Settings aria-hidden />설정</MenuItem>
        </MenuContent>
      </Menu>
      <Menu>
        <MenuTrigger asChild><Button variant="ghost" size="icon" aria-label="운영진 동작 예시"><Ellipsis /></Button></MenuTrigger>
        <MenuContent>
          <MenuItem>부서 배정</MenuItem>
          <MenuItem>부회장으로 두기</MenuItem>
          <MenuItem destructive>내보내기</MenuItem>
        </MenuContent>
      </Menu>
    </Section>
```

Run: `cd apps/web && npx vitest run src/ui-gallery`
Expected: PASS(`Gallery.test.tsx` 6 tests)

- [ ] **Step 5: 실패하는 화면 시험을 쓴다**

`apps/web/src/test-support/council-fixtures.ts`(화면 시험이 같이 쓰는 서버 응답):

```ts
import { ACTIONS, type Action, type CouncilRank, type CouncilView, type MyCouncil, type TeamResponse } from '@vada/contracts'

// 화면 시험이 같이 쓰는 학생회 응답. 값은 서버 응답과 같은 모양이다.
export const defaultTitles = { president: '회장', vicePresident: '부회장', head: '부장', viceHead: '부부장' }
export const MEMBER_PERMISSIONS: Action[] = ['council.view']
export const LEADER_PERMISSIONS: Action[] = ACTIONS.filter(action => action !== 'president.transfer')
export const PRESIDENT_PERMISSIONS: Action[] = [...ACTIONS]

export const myCouncil = (id = 'c1', name = '컴퓨터학부 학생회', councilRank: CouncilRank | null = 'president'): MyCouncil =>
  ({ id, name, councilRank, departments: [] })

export function councilView(id = 'c1', options: { name?: string; councilRank?: CouncilRank | null; permissions?: Action[]; memberId?: string } = {}): CouncilView {
  const councilRank = options.councilRank === undefined ? 'president' : options.councilRank
  return {
    council: { id, name: options.name ?? '컴퓨터학부 학생회', unit: 'department', schoolName: '한양대학교 ERICA', titles: defaultTitles },
    cohort: { id: `${id}-2026`, name: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' },
    me: { memberId: options.memberId ?? 'm1', name: '김회장', councilRank, departments: [] },
    permissions: options.permissions ?? (councilRank === 'president' ? PRESIDENT_PERMISSIONS : councilRank ? LEADER_PERMISSIONS : MEMBER_PERMISSIONS),
  }
}

// 회장 김회장(m1), 재정부 부장 이재정(m2), 부서 없는 박새내(m3). 재정부(d1)와 기획부(d2)가 있다.
export function teamResponse(): TeamResponse {
  return {
    members: [
      { id: 'm1', name: '김회장', councilRank: 'president', departments: [], joinedAt: '2026-10-01T01:00:00.000Z' },
      { id: 'm2', name: '이재정', councilRank: null, departments: [{ id: 'd1', rank: 'head' }], joinedAt: '2026-10-02T01:00:00.000Z' },
      { id: 'm3', name: '박새내', councilRank: null, departments: [], joinedAt: '2026-10-18T15:30:00.000Z' },
    ],
    departments: [{ id: 'd1', name: '재정부', role: 'finance', memberCount: 1 }, { id: 'd2', name: '기획부', role: null, memberCount: 0 }],
  }
}
```

`apps/web/src/team/People.test.tsx`(이 작업의 운영진 > 사람은 목록만 보인다. Task 12가 동작 시험으로 바꾼다):

```tsx
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import People from './People'
import { useTeam } from './useTeam'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function Harness({ onForbidden = () => {} }: { onForbidden?: () => void }) {
  const team = useTeam('c1', onForbidden)
  return <People view={{ ...councilView(), council: { ...councilView().council, titles: { president: '위원장', vicePresident: '부위원장', head: '국장', viceHead: '차장' } } }}
    team={team} />
}

test('운영진 목록은 들어온 순서대로 이름, 학생회가 정한 직급 이름, 부서와 부서 직급, 들어온 날을 보이고 이메일은 없다', async () => {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/members', () => json(teamResponse()))
  render(<Harness />)
  expect(await screen.findByText('운영진 3명')).toBeTruthy()
  const rows = within(screen.getByRole('list', { name: '운영진' })).getAllByRole('listitem')
  expect(rows.map(row => row.textContent)).toEqual([
    '김회장위원장부서 없음 · 2026.10.01 들어옴',
    '이재정재정부 국장 · 2026.10.02 들어옴',
    '박새내부서 없음 · 2026.10.19 들어옴',
  ])
  expect(document.body.textContent).not.toContain('@')
})

test('목록을 불러오지 못하면 다시 시도할 수 있고, 403이면 학생회를 다시 읽게 한다', async () => {
  const api = mockApi()
  let calls = 0
  api.on('GET', '/api/organizations/c1/members', () => calls++ === 0 ? json({ error: 'Internal server error' }, 500) : json(teamResponse()))
  render(<Harness />)
  fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }))
  expect(await screen.findByText('운영진 3명')).toBeTruthy()
  cleanup()
  const forbidden = vi.fn()
  api.on('GET', '/api/organizations/c1/members', () => json({ error: 'FORBIDDEN' }, 403))
  render(<Harness onForbidden={forbidden} />)
  await screen.findByText('운영진을 불러오지 못했어요.')
  expect(forbidden).toHaveBeenCalled()
})
```

`apps/web/src/App.test.tsx`를 다음으로 바꾼다. 덩어리 1의 로그인 시험은 Task 1 판과 같고, 로그인 뒤 화면은 `MyCouncils`와 `JoinCouncil`을 가짜로 두고 App이 넘기는 것만 본다(초대 링크로 돌아오기 포함). 덩어리 1에 이 목록에 없는 로그인 시험이 더 있으면 그것도 그대로 옮긴다.

```tsx
// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'

const auth = vi.hoisted(() => ({ useSession: vi.fn(), social: vi.fn(), signOut: vi.fn(), refetch: vi.fn() }))
vi.mock('./auth/auth-client', () => ({ authClient: { useSession: auth.useSession, signIn: { social: auth.social }, signOut: auth.signOut } }))
// 로그인 뒤의 화면은 따로 시험한다(App.integration.test.tsx). 여기서는 App이 무엇을 넘기는지만 본다.
vi.mock('./councils/MyCouncils', () => ({ default: ({ card, initialCouncilId, onEnterCode }: { card: (content: ReactNode) => ReactNode
  initialCouncilId?: string; onEnterCode: (code: string) => void }) => <>{card(<>
  <p>학생회 목록 자리{initialCouncilId ? `: ${initialCouncilId}` : ''}</p>
  <button type="button" onClick={() => onEnterCode('WXYZ6789')}>코드 입력</button>
</>)}</> }))
vi.mock('./councils/JoinCouncil', () => ({ default: ({ code, onJoined, onLeave }: { code: string; onJoined: (id: string) => void; onLeave: () => void }) => <>
  <p>초대 확인 자리: {code}</p>
  <button type="button" onClick={() => onJoined('c9')}>들어가기</button>
  <button type="button" onClick={onLeave}>나가기</button>
</> }))
const signedIn = () => auth.useSession.mockReturnValue({ data: { user: { id: 'u1', name: '테스터', email: 'test@example.test' } }, isPending: false, error: null })
beforeEach(() => {
  vi.resetAllMocks()
  window.history.replaceState(null, '', '/')
  auth.useSession.mockReturnValue({ data: null, isPending: false, error: null, refetch: auth.refetch })
})
afterEach(cleanup)

test('anonymous user starts Google login with same-origin callbacks', async () => {
  auth.social.mockResolvedValue({ error: null })
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
  await waitFor(() => expect(auth.social).toHaveBeenCalledWith({ provider: 'google', callbackURL: '/', errorCallbackURL: '/' }))
})

test('session loading and failures are not presented as logged out', () => {
  auth.useSession.mockReturnValue({ data: null, isPending: true, error: null })
  const view = render(<App />)
  expect(screen.getByRole('status').textContent).toContain('확인 중')
  expect(screen.queryByRole('button', { name: 'Google로 로그인' })).toBeNull()
  auth.useSession.mockReturnValue({ data: null, isPending: false, error: { message: 'private error' }, refetch: auth.refetch })
  view.rerender(<App />)
  expect(screen.getByRole('alert').textContent).toContain('세션을 확인하지 못했어요')
  fireEvent.click(screen.getByRole('button', { name: '다시 확인' }))
  expect(auth.refetch).toHaveBeenCalled()
})

test('로그인하면 내 학생회 화면을 열고, 카드에 이름·휴대폰 알림·로그아웃이 있다', async () => {
  signedIn()
  auth.signOut.mockResolvedValue({ error: null })
  const view = render(<App />)
  expect(screen.getByText('학생회 목록 자리')).toBeTruthy()
  expect(screen.getByText('test@example.test')).toBeTruthy()
  expect(screen.getByRole('button', { name: '휴대폰 알림' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))
  await waitFor(() => expect(auth.signOut).toHaveBeenCalledOnce())
  auth.useSession.mockReturnValue({ data: null, isPending: false, error: null })
  view.rerender(<App />)
  expect(screen.getByRole('button', { name: 'Google로 로그인' })).toBeTruthy()
})

test('login failure allows retry without exposing the raw error', async () => {
  auth.social.mockRejectedValue(new Error('private error'))
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('로그인을 시작하지 못했어요'))
  expect(screen.getByRole('button', { name: 'Google로 로그인' }).hasAttribute('disabled')).toBe(false)
})

test('OAuth callback failure is explained without showing its raw value', () => {
  window.history.replaceState(null, '', '/?error=access_denied')
  render(<App />)
  expect(screen.getByRole('alert').textContent).toContain('로그인이 완료되지 않았어요')
})

test('logout failure keeps the signed-in state and enables retry', async () => {
  signedIn()
  auth.signOut.mockResolvedValue({ error: { message: 'private error' } })
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('로그아웃하지 못했어요'))
  expect(screen.getByRole('button', { name: '로그아웃' }).hasAttribute('disabled')).toBe(false)
})

test('초대 링크로 온 사람은 로그인 뒤 같은 초대로 돌아오고, 왜 로그인하는지 안다', async () => {
  window.history.replaceState(null, '', '/join/ABCD2345')
  auth.social.mockResolvedValue({ error: null })
  render(<App />)
  expect(screen.getByText('학생회 초대 링크로 들어왔어요. 로그인하면 들어갈 수 있어요.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
  await waitFor(() => expect(auth.social).toHaveBeenCalledWith({ provider: 'google', callbackURL: '/join/ABCD2345', errorCallbackURL: '/join/ABCD2345' }))
})

test('초대 링크의 로그인이 실패해도 초대를 지키고 까닭을 알린다', async () => {
  window.history.replaceState(null, '', '/join/ABCD2345?error=access_denied')
  render(<App />)
  expect(screen.getByRole('alert').textContent).toContain('로그인이 완료되지 않았어요')
  expect(screen.getByText('학생회 초대 링크로 들어왔어요. 로그인하면 들어갈 수 있어요.')).toBeTruthy()
})

test('로그인한 사람이 초대 링크로 오면 초대를 확인하고, 들어가면 주소를 지우고 그 학생회를 연다', () => {
  window.history.replaceState(null, '', '/join/ABCD2345')
  signedIn()
  render(<App />)
  expect(screen.getByText('초대 확인 자리: ABCD2345')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '들어가기' }))
  expect(window.location.pathname).toBe('/')
  expect(screen.getByText('학생회 목록 자리: c9')).toBeTruthy()
})

test('학생회가 없어 코드를 입력하면 초대 확인으로 가고, 나가면 목록으로 돌아온다', () => {
  signedIn()
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: '코드 입력' }))
  expect(screen.getByText('초대 확인 자리: WXYZ6789')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '나가기' }))
  expect(screen.getByText('학생회 목록 자리')).toBeTruthy()
})

test('KakaoTalk in-app browser offers the outside browser instead of Google login', () => {
  const agent = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Linux; Android 14) KAKAOTALK/10.9.0')
  try {
    render(<App />)
    expect(screen.getByText('카카오톡 안에서는 Google 로그인이 막혀 있어요. 바깥 브라우저로 열어 주세요.')).toBeTruthy()
    expect(screen.getByRole('button', { name: '바깥 브라우저로 열기' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Google로 로그인' })).toBeNull()
  } finally {
    agent.mockRestore()
  }
})

test('iOS home-screen app opens an in-app window before asking for the Google URL', async () => {
  Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
  const popup = { location: { href: 'about:blank' }, close: vi.fn() }
  const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
  auth.social.mockResolvedValue({ data: { url: 'https://accounts.google.com/x', redirect: false }, error: null })
  try {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
    expect(open).toHaveBeenCalledWith('about:blank', '_blank')
    await waitFor(() => expect(popup.location.href).toBe('https://accounts.google.com/x'))
    expect(auth.social).toHaveBeenCalledWith({ provider: 'google', callbackURL: '/auth-done', errorCallbackURL: '/auth-done?error=1', disableRedirect: true })
    expect(screen.getByRole('button', { name: '다른 방법으로 로그인' })).toBeTruthy()
  } finally {
    open.mockRestore()
    delete (navigator as { standalone?: boolean }).standalone
  }
})

test('iOS home-screen app rechecks the session when the login window reports back', () => {
  Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
  const listeners: (() => void)[] = []
  vi.stubGlobal('BroadcastChannel', class {
    set onmessage(listener: () => void) { listeners.push(listener) }
    postMessage() {}
    close() {}
  })
  try {
    render(<App />)
    expect(listeners).toHaveLength(1)
    listeners[0]!()
    expect(auth.refetch).toHaveBeenCalled()
  } finally {
    vi.unstubAllGlobals()
    delete (navigator as { standalone?: boolean }).standalone
  }
})

test('iOS home-screen app rechecks the session when it becomes visible again, and stops listening once signed in', () => {
  Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
  let visibility: DocumentVisibilityState = 'visible'
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
  const changeTo = (next: DocumentVisibilityState) => {
    visibility = next
    document.dispatchEvent(new Event('visibilitychange'))
  }
  const closed = vi.fn()
  vi.stubGlobal('BroadcastChannel', class {
    postMessage() {}
    close() { closed() }
  })
  try {
    const view = render(<App />)
    changeTo('hidden')
    expect(auth.refetch).not.toHaveBeenCalled()
    changeTo('visible')
    expect(auth.refetch).toHaveBeenCalledTimes(1)
    auth.useSession.mockReturnValue({ data: { user: { name: '테스터', email: 'test@example.test' } }, isPending: false, error: null, refetch: auth.refetch })
    view.rerender(<App />)
    expect(closed).toHaveBeenCalled()
    changeTo('visible')
    expect(auth.refetch).toHaveBeenCalledTimes(1)
  } finally {
    vi.unstubAllGlobals()
    delete (document as { visibilityState?: unknown }).visibilityState
    delete (navigator as { standalone?: boolean }).standalone
  }
})
```

`apps/web/src/App.integration.test.tsx`(서버 응답만 가짜로 두고 App 전체를 그린다. 마지막에서 두 번째 시험이 Review Focus 1이다):

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { MyCouncil } from '@vada/contracts'
import App from './App'
import { councilView, myCouncil, teamResponse } from './test-support/council-fixtures'
import { json, mockApi } from './test-support/mock-api'

const auth = vi.hoisted(() => ({ useSession: vi.fn(), social: vi.fn(), signOut: vi.fn() }))
vi.mock('./auth/auth-client', () => ({ authClient: { useSession: auth.useSession, signIn: { social: auth.social }, signOut: auth.signOut } }))
let api: ReturnType<typeof mockApi>
beforeEach(() => {
  window.history.replaceState(null, '', '/')
  vi.resetAllMocks()
  api = mockApi()
  auth.useSession.mockReturnValue({ data: { user: { id: 'u1', name: '김회장', email: 'kim@example.test' } }, isPending: false, error: null })
})
afterEach(() => {
  cleanup()
  try { api.assertNoUnexpectedRequests() } finally { vi.unstubAllGlobals(); vi.restoreAllMocks() }
})

// 내 학생회 목록을 차례로 돌려준다. 마지막 응답은 그 뒤로도 같다.
function councilsInSequence(...lists: MyCouncil[][]) {
  let call = 0
  api.on('GET', '/api/me/councils', () => json({ councils: lists[Math.min(call++, lists.length - 1)] }))
}
function openCouncil(id = 'c1', name = '컴퓨터학부 학생회') {
  api.on('GET', `/api/organizations/${id}`, () => json(councilView(id, { name })))
  api.on('GET', `/api/organizations/${id}/members`, () => json(teamResponse()))
}

test('학생회가 없으면 초대 코드와 학생회 만들기를 보이고, 만들면 운영진 > 사람으로 간다', async () => {
  councilsInSequence([])
  openCouncil()
  api.on('POST', '/api/organizations/create', () => json({ council: myCouncil() }, 201))
  render(<App />)
  expect(await screen.findByRole('heading', { name: '아직 들어간 학생회가 없어요' })).toBeTruthy()
  expect((screen.getByRole('button', { name: '초대 코드로 들어가기' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '학생회 만들기' }))
  const form = screen.getByRole('form', { name: '학생회 만들기' })
  const submit = within(form).getByRole('button', { name: '학생회 만들기' }) as HTMLButtonElement
  expect(submit.disabled).toBe(true)
  fireEvent.change(within(form).getByLabelText('학생회 이름'), { target: { value: '컴퓨터학부 학생회' } })
  fireEvent.change(within(form).getByLabelText('학교'), { target: { value: '한양대학교 ERICA' } })
  fireEvent.change(within(form).getByLabelText('단위'), { target: { value: 'college' } })
  expect(submit.disabled).toBe(false)
  fireEvent.click(submit)
  expect(await screen.findByRole('heading', { level: 1, name: '사람' })).toBeTruthy()
  expect(await screen.findByText('운영진 3명')).toBeTruthy()
  const year = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 4)
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({ name: '컴퓨터학부 학생회', unit: 'college', schoolName: '한양대학교 ERICA',
    cohortName: year, startsOn: `${year}-01-01`, endsOn: `${year}-12-31` })
})

test('임기에 오늘이 없으면 만들지 못한 까닭을 보여 준다', async () => {
  councilsInSequence([])
  api.on('POST', '/api/organizations/create', () => json({ error: 'COHORT_NOT_CURRENT' }, 409))
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: '학생회 만들기' }))
  const form = screen.getByRole('form', { name: '학생회 만들기' })
  fireEvent.change(within(form).getByLabelText('학생회 이름'), { target: { value: '학생회' } })
  fireEvent.change(within(form).getByLabelText('학교'), { target: { value: '학교' } })
  fireEvent.click(within(form).getByRole('button', { name: '학생회 만들기' }))
  expect(await screen.findByText('임기에 오늘이 들어 있어야 해요. 기간을 확인해 주세요.')).toBeTruthy()
})

test('초대 링크로 오면 학생회 이름을 묻고, 들어가면 그 학생회를 연다', async () => {
  window.history.replaceState(null, '', '/join/ABCD2345')
  api.on('GET', '/api/invites/ABCD2345', () => json({ council: { id: 'c1', name: '컴퓨터학부 학생회' }, joined: false }))
  api.on('POST', '/api/organizations/join', () => json({ council: myCouncil('c1', '컴퓨터학부 학생회', null) }))
  councilsInSequence([myCouncil('c1', '컴퓨터학부 학생회', null)])
  openCouncil()
  render(<App />)
  expect(await screen.findByRole('heading', { name: '컴퓨터학부 학생회에 들어갈까요?' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '들어가기' }))
  expect(await screen.findByText('운영진 3명')).toBeTruthy()
  expect(window.location.pathname).toBe('/')
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({ code: 'ABCD2345' })
})

test('이미 들어온 학생회의 초대 링크는 묻지 않고 그 학생회를 연다', async () => {
  window.history.replaceState(null, '', '/join/ABCD2345')
  api.on('GET', '/api/invites/ABCD2345', () => json({ council: { id: 'c2', name: '경영학부 학생회' }, joined: true }))
  councilsInSequence([myCouncil('c1'), myCouncil('c2', '경영학부 학생회')])
  openCouncil('c2', '경영학부 학생회')
  render(<App />)
  expect(await screen.findByRole('button', { name: '학생회 메뉴: 경영학부 학생회' })).toBeTruthy()
})

test('코드를 직접 입력하면 초대 확인으로 가고, 틀린 코드면 다시 입력할 수 있다', async () => {
  councilsInSequence([])
  api.on('GET', '/api/invites/ZZZZ2222', () => json({ error: 'NOT_FOUND' }, 404))
  render(<App />)
  fireEvent.change(await screen.findByLabelText('초대 코드'), { target: { value: 'https://vada.test/join/zzzz-2222' } })
  fireEvent.click(screen.getByRole('button', { name: '초대 코드로 들어가기' }))
  expect(await screen.findByText('초대 코드가 올바르지 않아요. 바뀌었을 수 있으니 학생회에 다시 받아 주세요.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '다시 입력' }))
  expect(await screen.findByRole('heading', { name: '아직 들어간 학생회가 없어요' })).toBeTruthy()
})

test('지금 기수가 없는 학생회에는 들어가지 못한 까닭을 보여 준다', async () => {
  window.history.replaceState(null, '', '/join/ABCD2345')
  api.on('GET', '/api/invites/ABCD2345', () => json({ council: { id: 'c1', name: '컴퓨터학부 학생회' }, joined: false }))
  api.on('POST', '/api/organizations/join', () => json({ error: 'NO_CURRENT_COHORT' }, 409))
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: '들어가기' }))
  expect(await screen.findByText('지금 들어갈 수 있는 기수가 없어요. 학생회 회장단에게 알려 주세요.')).toBeTruthy()
})

test('내보내진 사람의 다음 요청이 403이면 그 학생회를 닫고, 남은 학생회가 없으면 학생회 없음 안내로 돌아간다', async () => {
  councilsInSequence([myCouncil('c1', '컴퓨터학부 학생회', null)], [])
  api.on('GET', '/api/organizations/c1', () => json({ error: 'FORBIDDEN' }, 403))
  api.on('GET', '/api/organizations/c1/members', () => json({ error: 'FORBIDDEN' }, 403))
  render(<App />)
  expect(await screen.findByRole('heading', { name: '아직 들어간 학생회가 없어요' })).toBeTruthy()
  expect(api.calls.filter(call => call.path === '/api/me/councils').length).toBeGreaterThanOrEqual(2)
})

test('학생회 이름 메뉴로 다른 학생회를 고른다', async () => {
  councilsInSequence([myCouncil('c1'), myCouncil('c2', '경영학부 학생회', null)])
  openCouncil()
  openCouncil('c2', '경영학부 학생회')
  render(<App />)
  const menu = await screen.findByRole('button', { name: '학생회 메뉴: 컴퓨터학부 학생회' })
  fireEvent.keyDown(menu, { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: '경영학부 학생회' }))
  expect(await screen.findByRole('button', { name: '학생회 메뉴: 경영학부 학생회' })).toBeTruthy()
  await waitFor(() => expect(api.calls.some(call => call.path === '/api/organizations/c2/members')).toBe(true))
})

test('옆 메뉴 아래 사용자 줄에 이름, 직급, 휴대폰 알림, 로그아웃이 있고 휴대폰 폭에서는 시트로 연다', async () => {
  councilsInSequence([myCouncil()])
  openCouncil()
  auth.signOut.mockResolvedValue({ error: null })
  render(<App />)
  const aside = await screen.findByRole('complementary', { name: '학생회 작업 공간' })
  expect(await within(aside).findByText('회장')).toBeTruthy()
  expect(within(aside).getByText('김회장')).toBeTruthy()
  expect(within(aside).getByRole('button', { name: '휴대폰 알림' })).toBeTruthy()
  fireEvent.click(within(aside).getByRole('button', { name: '로그아웃' }))
  await waitFor(() => expect(auth.signOut).toHaveBeenCalledOnce())
  fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }))
  const sheet = await screen.findByRole('dialog', { name: '학생회 작업 공간' })
  expect(within(sheet).getByRole('button', { name: '로그아웃' })).toBeTruthy()
})
```

Run: `cd apps/web && npx vitest run src/team/People.test.tsx src/App.test.tsx src/App.integration.test.tsx`
Expected: FAIL. `People.test.tsx`는 `Failed to resolve import "./useTeam"`, `App.test.tsx`는 `5 failed`(학생회 목록 자리와 초대 링크 시험), `App.integration.test.tsx`는 `9 failed`(`"아직 들어간 학생회가 없어요"` 제목 등을 찾지 못한다)

- [ ] **Step 6: 학생회 없음, 만들기, 초대 화면을 만든다**

`apps/web/src/councils/useMyCouncils.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import type { MyCouncil, MyCouncilsResponse } from '@vada/contracts'
import { getJson } from '@/lib/api'

export type MyCouncilsState = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; councils: MyCouncil[] }

// 내 학생회 목록(지금 소속이 있는 학생회). 다시 읽는 동안에는 보던 목록을 그대로 둔다.
export function useMyCouncils() {
  const [state, setState] = useState<MyCouncilsState>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void getJson<MyCouncilsResponse>('/api/me/councils', controller.signal).then(result => {
      if (controller.signal.aborted) return
      if (result.ok) setState({ kind: 'ready', councils: result.data.councils })
      else setState(current => current.kind === 'ready' ? current : { kind: 'failed' })
    })
    return () => controller.abort()
  }, [attempt])
  const reload = useCallback(() => setAttempt(value => value + 1), [])
  // 방금 만든 학생회는 서버가 돌려준 줄을 바로 더한다.
  const add = useCallback((council: MyCouncil) => setState(current => ({ kind: 'ready',
    councils: [...(current.kind === 'ready' ? current.councils.filter(item => item.id !== council.id) : []), council] })), [])
  return { state, reload, add }
}
```

`apps/web/src/councils/NoCouncil.tsx`(붙여 넣은 초대 링크에서도 코드를 꺼낸다. 버튼은 `InviteCodeSchema.safeParse`로 켠다):

```tsx
import { useState, type FormEvent } from 'react'
import { InviteCodeSchema } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { inviteCodeFromText } from './invite-path'

type Props = { onEnterCode: (code: string) => void; onCreate: () => void }

// 학생회가 없을 때: [초대 코드로 들어가기]와 [학생회 만들기] 둘을 보인다(바탕 spec '화면').
export default function NoCouncil({ onEnterCode, onCreate }: Props) {
  const [value, setValue] = useState('')
  const parsed = InviteCodeSchema.safeParse(inviteCodeFromText(value))
  function submit(event: FormEvent) {
    event.preventDefault()
    if (parsed.success) onEnterCode(parsed.data)
  }
  return <div className="flex flex-col gap-6">
    <form aria-label="초대 코드로 들어가기" className="flex flex-col gap-4" onSubmit={submit}>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">아직 들어간 학생회가 없어요</h2>
        <p className="text-sm text-gray-500">학생회에서 받은 초대 링크를 누르거나, 초대 코드를 입력해 주세요.</p>
      </div>
      <Label className="flex flex-col gap-2">초대 코드
        <Input value={value} onChange={event => setValue(event.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false}
          className="px-4 py-3 text-center font-mono text-xl tracking-widest sm:text-xl" />
      </Label>
      <Button type="submit" disabled={!parsed.success}>초대 코드로 들어가기</Button>
    </form>
    <div className="flex flex-col items-center gap-2 border-t pt-4 text-center">
      <p className="text-sm text-gray-500">학생회를 처음 시작하나요?</p>
      <Button type="button" variant="outline" onClick={onCreate}>학생회 만들기</Button>
    </div>
  </div>
}
```

`apps/web/src/councils/CreateCouncilForm.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import { COUNCIL_UNITS, CreateCouncilSchema, koreanOf, type CouncilUnit, type CreateCouncilResponse, type MyCouncil } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { postJson } from '@/lib/api'

export const unitLabels: Record<CouncilUnit, string> = { department: '학과', college: '단과대', university: '총학생회' }
const errors: Record<string, string> = {
  COHORT_NOT_CURRENT: '임기에 오늘이 들어 있어야 해요. 기간을 확인해 주세요.',
  EMAIL_IN_USE: '이 Google 계정의 이메일을 다른 계정이 쓰고 있어요. 다른 계정으로 로그인해 주세요.',
}

type Props = { onCreated: (council: MyCouncil) => void; onCancel: () => void }

// 학생회 만들기(바탕 spec G6): 이름, 단위, 학교, 첫 기수의 이름과 임기. 기본 임기는 올해(한국 날짜) 1/1~12/31이다.
export default function CreateCouncilForm({ onCreated, onCancel }: Props) {
  const [year] = useState(() => koreanOf(new Date()).slice(0, 4))
  const [form, setForm] = useState({ name: '', unit: 'department' as CouncilUnit, schoolName: '', cohortName: year,
    startsOn: `${year}-01-01`, endsOn: `${year}-12-31` })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // 버튼은 서버와 같은 스키마로 판단한다.
  const parsed = CreateCouncilSchema.safeParse(form)
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm(current => ({ ...current, [key]: event.target.value }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!parsed.success || saving) return
    setSaving(true)
    setError('')
    const result = await postJson<CreateCouncilResponse>('/api/organizations/create', parsed.data)
    if (result.ok) return onCreated(result.data.council)
    setSaving(false)
    setError(errors[result.code] ?? '학생회를 만들지 못했어요. 다시 시도해 주세요.')
  }

  return <form aria-label="학생회 만들기" className="flex flex-col gap-4" onSubmit={event => { void submit(event) }}>
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">학생회 만들기</h2>
      <p className="text-sm text-gray-500">만든 사람이 회장이 되고, 재정부가 함께 생겨요.</p>
    </div>
    <Label className="flex flex-col gap-2">학생회 이름
      <Input value={form.name} placeholder="예: 소프트웨어학부 학생회" onChange={set('name')} />
    </Label>
    <Label className="flex flex-col gap-2">단위
      <NativeSelect value={form.unit} onChange={set('unit')}>
        {COUNCIL_UNITS.map(unit => <option key={unit} value={unit}>{unitLabels[unit]}</option>)}
      </NativeSelect>
    </Label>
    <Label className="flex flex-col gap-2">학교
      <Input value={form.schoolName} placeholder="예: 한양대학교 ERICA" onChange={set('schoolName')} />
    </Label>
    <Label className="flex flex-col gap-2">기수 이름
      <Input value={form.cohortName} onChange={set('cohortName')} />
    </Label>
    <div className="grid grid-cols-2 gap-3">
      <Label className="flex flex-col gap-2">임기 시작
        <Input type="date" value={form.startsOn} onChange={set('startsOn')} />
      </Label>
      <Label className="flex flex-col gap-2">임기 끝
        <Input type="date" value={form.endsOn} onChange={set('endsOn')} />
      </Label>
    </div>
    {error && <StateMessage kind="error">{error}</StateMessage>}
    <div className="flex gap-2">
      <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>취소</Button>
      <Button type="submit" className="flex-1" disabled={!parsed.success || saving}>{saving ? '만드는 중…' : '학생회 만들기'}</Button>
    </div>
  </form>
}
```

`apps/web/src/councils/JoinCouncil.tsx`:

```tsx
import { useEffect, useState } from 'react'
import type { InvitePreviewResponse, JoinCouncilResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { getJson, postJson } from '@/lib/api'

type Props = { code: string; leaveLabel: string; onJoined: (councilId: string) => void; onLeave: () => void }
type View = { kind: 'loading' } | { kind: 'invalid' } | { kind: 'failed' } | { kind: 'ready'; council: InvitePreviewResponse['council'] }
const errors: Record<string, string> = {
  NO_CURRENT_COHORT: '지금 들어갈 수 있는 기수가 없어요. 학생회 회장단에게 알려 주세요.',
  EMAIL_IN_USE: '이 Google 계정의 이메일을 다른 계정이 쓰고 있어요. 다른 계정으로 로그인해 주세요.',
}

// 초대 링크(/join/코드): "OOO에 들어갈까요?" [들어가기]. 이미 들어왔으면 묻지 않고 그 학생회를 연다(바탕 spec '화면').
export default function JoinCouncil({ code, leaveLabel, onJoined, onLeave }: Props) {
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    setView({ kind: 'loading' })
    void getJson<InvitePreviewResponse>(`/api/invites/${encodeURIComponent(code)}`, controller.signal).then(result => {
      if (controller.signal.aborted) return
      if (!result.ok) return setView({ kind: result.status === 404 ? 'invalid' : 'failed' })
      if (result.data.joined) onJoined(result.data.council.id)
      else setView({ kind: 'ready', council: result.data.council })
    })
    return () => controller.abort()
    // onJoined는 화면을 옮기는 일이라 다시 불러올 까닭이 아니다.
  }, [code, attempt])

  async function join() {
    setJoining(true)
    setError('')
    const result = await postJson<JoinCouncilResponse>('/api/organizations/join', { code })
    if (result.ok) return onJoined(result.data.council.id)
    setJoining(false)
    if (result.status === 404) setView({ kind: 'invalid' })
    else setError(errors[result.code] ?? '들어가지 못했어요. 연결을 확인하고 다시 시도해 주세요.')
  }

  if (view.kind === 'loading') return <StateMessage kind="loading">초대 확인 중…</StateMessage>
  if (view.kind === 'invalid') return <section aria-label="학생회 들어가기" className="flex flex-col gap-3">
    <StateMessage kind="error">초대 코드가 올바르지 않아요. 바뀌었을 수 있으니 학생회에 다시 받아 주세요.</StateMessage>
    <Button variant="outline" onClick={onLeave}>{leaveLabel}</Button>
  </section>
  if (view.kind === 'failed') return <section aria-label="학생회 들어가기" className="flex flex-col gap-3">
    <StateMessage kind="error">초대를 확인하지 못했어요. 연결을 확인하고 다시 시도해 주세요.</StateMessage>
    <Button onClick={() => setAttempt(value => value + 1)}>다시 시도</Button>
    <Button variant="ghost" size="sm" onClick={onLeave}>{leaveLabel}</Button>
  </section>
  return <section aria-label="학생회 들어가기" className="flex flex-col gap-4">
    <div className="rounded-lg border p-6">
      <h2 className="text-base font-semibold wrap-anywhere">{view.council.name}에 들어갈까요?</h2>
    </div>
    <p className="text-xs text-gray-400">들어가면 부서와 직급 없이 운영진이 돼요. 부서는 회장단이 정해요.</p>
    {error && <StateMessage kind="error">{error}</StateMessage>}
    <div className="flex flex-col gap-2">
      <Button disabled={joining} onClick={() => { void join() }}>{joining ? '들어가는 중…' : '들어가기'}</Button>
      <Button variant="ghost" size="sm" disabled={joining} onClick={onLeave}>들어가지 않기</Button>
    </div>
  </section>
}
```

`apps/web/src/councils/MyCouncils.tsx`:

```tsx
import { useState, type ReactNode } from 'react'
import Workspace from '../workspace/Workspace'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import CreateCouncilForm from './CreateCouncilForm'
import NoCouncil from './NoCouncil'
import { useMyCouncils } from './useMyCouncils'

type Props = {
  user: { name: string }
  // 방금 들어온 학생회. 있으면 그 학생회를 먼저 연다.
  initialCouncilId?: string
  // 가운데 카드 화면(로그인한 사람의 이름, 휴대폰 알림, 로그아웃이 함께 있다). App이 그린다.
  card: (content: ReactNode) => ReactNode
  onEnterCode: (code: string) => void
  logoutBusy: boolean
  onLogout: () => void
}

// 로그인한 뒤의 첫 화면: 학생회가 없으면 안내(초대 코드, 만들기), 있으면 작업 공간이다.
export default function MyCouncils({ user, initialCouncilId, card, onEnterCode, logoutBusy, onLogout }: Props) {
  const { state, reload, add } = useMyCouncils()
  const [creating, setCreating] = useState(false)
  const [opened, setOpened] = useState(initialCouncilId)
  if (state.kind === 'loading') return card(<StateMessage kind="loading">학생회 확인 중…</StateMessage>)
  if (state.kind === 'failed') return card(<div className="flex flex-col gap-3">
    <StateMessage kind="error">학생회를 확인하지 못했어요. 서버 연결을 확인해 주세요.</StateMessage>
    <Button variant="outline" onClick={reload}>다시 확인</Button>
  </div>)
  if (!state.councils.length) return card(creating
    ? <CreateCouncilForm onCancel={() => setCreating(false)} onCreated={council => { setCreating(false); setOpened(council.id); add(council) }} />
    : <NoCouncil onEnterCode={onEnterCode} onCreate={() => setCreating(true)} />)
  return <Workspace key={opened ?? ''} councils={state.councils} initialCouncilId={opened} user={user} logoutBusy={logoutBusy}
    onLogout={onLogout} onCouncilsChanged={reload} />
}
```

- [ ] **Step 7: 작업 공간 틀과 운영진 목록을 만든다**

`apps/web/src/workspace/useCouncilView.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import type { CouncilView } from '@vada/contracts'
import { getJson } from '@/lib/api'

export type CouncilViewState = { kind: 'loading' } | { kind: 'failed' } | { kind: 'lost' } | { kind: 'ready'; view: CouncilView }

// 학생회 하나(학생회 정보, 지금 기수, 내 직급과 부서, 내 권한). 서버가 요청마다 소속을 다시 보므로,
// 403이면 이 학생회의 운영진이 아니게 된 것이다(내보내졌거나 기수가 끝남). 다시 읽다 실패하면 보던 것을 그대로 둔다.
export function useCouncilView(councilId: string) {
  const [state, setState] = useState<CouncilViewState>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void getJson<CouncilView>(`/api/organizations/${encodeURIComponent(councilId)}`, controller.signal).then(result => {
      if (controller.signal.aborted) return
      if (result.ok) setState({ kind: 'ready', view: result.data })
      else if (result.status === 403) setState({ kind: 'lost' })
      else setState(current => current.kind === 'ready' ? current : { kind: 'failed' })
    })
    return () => controller.abort()
  }, [councilId, attempt])
  const reload = useCallback(() => setAttempt(value => value + 1), [])
  // 설정을 바꾸면 서버가 바뀐 학생회를 돌려준다. 그 값으로 바꾼다.
  const replace = useCallback((view: CouncilView) => setState({ kind: 'ready', view }), [])
  return { state, reload, replace }
}
```

`apps/web/src/workspace/WorkspaceHeader.tsx`:

```tsx
import { ChevronRight, Menu as MenuIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = { councilName: string; section: string; title: string; onMenu: () => void }

// 와이어프레임 헤더(56px): 경로(상위 gray-400, 마지막 gray-600)와 제목. 옆 메뉴가 숨는 폭(768px 미만)에서만 메뉴 버튼을 보여 준다.
export default function WorkspaceHeader({ councilName, section, title, onMenu }: Props) {
  return <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-white px-4 sm:px-6">
    <Button variant="ghost" size="icon" className="md:hidden" aria-label="메뉴 열기" onClick={onMenu}><MenuIcon /></Button>
    <div className="min-w-0 flex-1">
      <p className="flex items-center gap-1 text-xs text-gray-400">
        <span className="truncate">{councilName}</span>
        <ChevronRight aria-hidden className="size-3 shrink-0" />
        <span className="shrink-0 text-gray-600">{section}</span>
      </p>
      <h1 className="mt-0.5 truncate text-base font-semibold text-gray-900">{title}</h1>
    </div>
  </header>
}
```

`apps/web/src/workspace/WorkspaceSidebar.tsx`(이 작업의 옆 메뉴는 운영진 > 사람 하나다. Task 13이 부서와 설정을 더한다):

```tsx
import { Check, ChevronsUpDown, LogOut, Users } from 'lucide-react'
import type { CouncilView, MyCouncil } from '@vada/contracts'
import PushSettingsButton from '../push/PushSettings'
import { councilRankLabel, placementsText } from '../team/team-view'
import { Avatar } from '@/components/Avatar'
import { BrandMark } from '@/components/BrandMark'
import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from '@/components/ui/menu'
import { NavItem } from '@/components/ui/nav-item'

export type Page = 'people'
type Props = {
  council: MyCouncil
  councils: MyCouncil[]
  view: CouncilView | null
  page: Page
  onSelect: (councilId: string) => void
  onPage: (page: Page) => void
  user: { name: string }
  logoutBusy: boolean
  onLogout: () => void
}

// 옆 메뉴(와이어프레임 210px): 위 학생회 이름 메뉴, 가운데 메뉴(바탕에서는 운영진만), 아래 사용자 줄(이름, 휴대폰 알림, 로그아웃).
// 데스크톱 aside와 휴대폰 옆 메뉴(시트)가 같이 쓴다. 위 블록의 오른쪽 여백은 시트 닫기 버튼 자리다.
export default function WorkspaceSidebar({ council, councils, view, page, onSelect, onPage, user, logoutBusy, onLogout }: Props) {
  const position = view && (councilRankLabel(view.me.councilRank, view.council.titles)
    || placementsText({ departments: view.me.departments }, view.me.departments, view.council.titles))
  return <div className="flex h-full min-h-0 flex-col">
    <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 py-3 pr-10 pl-4">
      <BrandMark />
      <Menu>
        <MenuTrigger asChild>
          <Button variant="ghost" className="min-w-0 flex-1 justify-between px-2 text-gray-900" aria-label={`학생회 메뉴: ${council.name}`}>
            <span className="truncate text-sm font-semibold">{council.name}</span><ChevronsUpDown aria-hidden />
          </Button>
        </MenuTrigger>
        <MenuContent align="start">
          <MenuLabel>학생회 고르기</MenuLabel>
          {councils.map(item => <MenuItem key={item.id} onSelect={() => onSelect(item.id)}>
            {item.id === council.id ? <Check aria-hidden /> : <span aria-hidden className="size-4 shrink-0" />}{item.name}
          </MenuItem>)}
        </MenuContent>
      </Menu>
    </div>
    <nav aria-label="학생회 메뉴" className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
      <p className="px-3 pb-1 text-xs font-medium text-gray-400">운영진</p>
      <NavItem active={page === 'people'} className="flex items-center gap-2" onClick={() => onPage('people')}>
        <Users aria-hidden className="size-4" />사람
      </NavItem>
    </nav>
    <footer className="flex shrink-0 items-center gap-2 border-t border-gray-100 px-4 py-3">
      <Avatar />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-gray-700">{user.name}</p>
        {position && <p className="truncate text-xs text-gray-400">{position}</p>}
      </div>
      <PushSettingsButton />
      <Button variant="ghost" size="icon" aria-label="로그아웃" disabled={logoutBusy} onClick={onLogout}><LogOut /></Button>
    </footer>
  </div>
}
```

`apps/web/src/workspace/Workspace.tsx`:

```tsx
import { useEffect, useState } from 'react'
import type { MyCouncil } from '@vada/contracts'
import People from '../team/People'
import { useTeam } from '../team/useTeam'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useCouncilView } from './useCouncilView'
import WorkspaceHeader from './WorkspaceHeader'
import WorkspaceSidebar, { type Page } from './WorkspaceSidebar'

type Props = {
  councils: MyCouncil[]
  initialCouncilId?: string
  user: { name: string }
  logoutBusy: boolean
  onLogout: () => void
  // 학생회를 잃었을 때(내보내졌거나 기수가 끝남) 내 학생회 목록을 다시 읽게 한다.
  onCouncilsChanged: () => void
}
const titles: Record<Page, { section: string; title: string }> = { people: { section: '운영진', title: '사람' } }

// 작업 공간 틀. 방금 만들었거나 들어온 학생회가 있으면 그 학생회를 먼저 연다.
export default function Workspace({ councils, initialCouncilId, ...props }: Props) {
  const [councilId, setCouncilId] = useState(() => (councils.find(item => item.id === initialCouncilId) ?? councils[0])?.id)
  const council = councils.find(item => item.id === councilId) ?? councils[0]
  if (!council) return null
  return <CouncilWorkspace key={council.id} {...props} councils={councils} council={council} onSelect={setCouncilId} />
}

function CouncilWorkspace({ council, councils, onSelect, user, logoutBusy, onLogout, onCouncilsChanged }:
  Omit<Props, 'initialCouncilId'> & { council: MyCouncil; onSelect: (councilId: string) => void }) {
  const { state, reload } = useCouncilView(council.id)
  const team = useTeam(council.id, reload)
  const [page, setPage] = useState<Page>('people')
  // 768px 미만에서 옆 메뉴로 연 시트. 메뉴를 고르면 닫는다.
  const [navOpen, setNavOpen] = useState(false)
  useEffect(() => { if (state.kind === 'lost') onCouncilsChanged() }, [state.kind, onCouncilsChanged])
  const view = state.kind === 'ready' ? state.view : null
  const sidebar = <WorkspaceSidebar council={council} councils={councils} view={view} page={page} user={user} logoutBusy={logoutBusy} onLogout={onLogout}
    onSelect={councilId => { setNavOpen(false); onSelect(councilId) }} onPage={next => { setNavOpen(false); setPage(next) }} />
  return <div className="flex h-dvh">
    <aside className="hidden w-60 shrink-0 border-r bg-white md:flex md:flex-col" aria-label="학생회 작업 공간">{sidebar}</aside>
    <Sheet open={navOpen} onOpenChange={setNavOpen}><SheetContent title="학생회 작업 공간">{sidebar}</SheetContent></Sheet>
    <div className="flex min-w-0 flex-1 flex-col">
      <WorkspaceHeader councilName={council.name} section={titles[page].section} title={titles[page].title} onMenu={() => setNavOpen(true)} />
      <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {state.kind === 'lost' ? <StateMessage kind="notice">이 학생회의 운영진이 아니게 되었어요. 학생회 목록으로 돌아가요.</StateMessage>
          : state.kind === 'failed' ? <Card className="flex flex-col gap-3 p-6">
            <StateMessage kind="error">학생회를 불러오지 못했어요. 연결을 확인해 주세요.</StateMessage>
            <Button variant="outline" className="self-start" onClick={reload}>다시 시도</Button>
          </Card>
          : !view ? <StateMessage kind="loading">학생회 불러오는 중…</StateMessage>
          : <People view={view} team={team} />}
      </main>
    </div>
  </div>
}
```

`apps/web/src/team/useTeam.ts`(사람과 부서 화면이 같이 쓴다. 회장단의 변경은 서버가 돌려준 목록 전체로 바꾼다, P21):

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import type { TeamResponse } from '@vada/contracts'
import { getJson, postJson } from '@/lib/api'

// 운영진과 부서 목록(운영진 > 사람, 부서가 같이 쓴다). onForbidden은 권한이나 소속이 바뀌었을 때 학생회를 다시 읽게 한다.
export function useTeam(councilId: string, onForbidden: () => void) {
  const base = `/api/organizations/${encodeURIComponent(councilId)}`
  const [data, setData] = useState<TeamResponse | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const active = useRef(true)
  // 부르는 쪽이 매번 새 함수를 넘겨도 다시 불러오지 않도록 마지막 함수만 기억한다.
  const forbidden = useRef(onForbidden)
  useEffect(() => { forbidden.current = onForbidden })
  // 개발 모드(StrictMode)는 effect를 정리했다 다시 실행한다. 다시 실행될 때 true로 돌려놓는다.
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setLoadFailed(false)
    void getJson<TeamResponse>(`${base}/members`, controller.signal).then(result => {
      if (controller.signal.aborted) return
      if (result.ok) return setData(result.data)
      if (result.status === 403) forbidden.current()
      setLoadFailed(true)
    })
    return () => controller.abort()
  }, [base, attempt])

  // 회장단의 변경은 목록 전체를 돌려준다. 성공하면 null을, 실패하면 오류 코드를 돌려준다.
  // 권한이 바뀌었으면(403) 학생회를 다시 읽고, 화면이 오래됐으면(403, 404) 목록도 다시 읽는다.
  async function change(path: string, body: unknown): Promise<string | null> {
    setSaving(true)
    const result = await postJson<TeamResponse>(`${base}${path}`, body)
    if (!active.current) return null
    setSaving(false)
    if (result.ok) {
      setData(result.data)
      return null
    }
    if (result.status === 403) forbidden.current()
    if (result.status === 403 || result.status === 404) setAttempt(value => value + 1)
    return result.code
  }

  const reload = useCallback(() => setAttempt(value => value + 1), [])
  return { data, loadFailed, saving, change, reload }
}
export type Team = ReturnType<typeof useTeam>
```

`apps/web/src/team/People.tsx`:

```tsx
import type { CouncilView } from '@vada/contracts'
import { Avatar } from '@/components/Avatar'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { councilRankLabel, joinedDay, placementsText } from './team-view'
import type { Team } from './useTeam'

// 운영진 > 사람: 이름, 직급(학생회가 정한 표시 이름), 부서와 부서 직급, 들어온 날. 들어온 순서대로다(DEC-47).
export default function People({ view, team }: { view: CouncilView; team: Team }) {
  const { data, loadFailed, reload } = team
  if (!data) return loadFailed
    ? <Card className="flex flex-col gap-3 p-6"><StateMessage kind="error">운영진을 불러오지 못했어요.</StateMessage>
      <Button variant="outline" className="self-start" onClick={reload}>다시 시도</Button></Card>
    : <StateMessage kind="loading">운영진 불러오는 중…</StateMessage>
  const titles = view.council.titles
  return <div className="mx-auto flex max-w-3xl flex-col gap-4">
    <h2 className="text-base font-semibold text-gray-900">운영진 {data.members.length}명</h2>
    <Card className="overflow-hidden">
      <ul aria-label="운영진" className="divide-y">
        {data.members.map(member => {
          const rank = councilRankLabel(member.councilRank, titles)
          const placements = placementsText(member, data.departments, titles)
          return <li key={member.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm wrap-anywhere text-gray-900">{member.name}
                {rank && <Badge tone="info">{rank}</Badge>}</p>
              <p className="text-xs wrap-anywhere text-gray-500">{placements || '부서 없음'} · {joinedDay(member.joinedAt)} 들어옴</p>
            </div>
          </li>
        })}
      </ul>
    </Card>
  </div>
}
```

- [ ] **Step 8: App이 내 학생회 목록과 초대 링크로 가게 한다**

`apps/web/src/App.tsx`를 다음으로 바꾼다. 로그인 부분(LoginPanel, 홈 화면 앱 안 로그인, 세션 다시 읽기)은 Task 1 판과 같다. 덩어리 1의 실제 파일과 로그인 부분이 다르면 실제 파일의 로그인 부분을 따른다.

```tsx
import { useEffect, useState, type ReactNode } from 'react'
import { authClient } from './auth/auth-client'
import LoginPanel from './auth/LoginPanel'
import { AUTH_CHANNEL, AUTH_DONE_PATH, startPopupLogin } from './auth/popup-login'
import { inviteCodeFromPath, invitePath } from './councils/invite-path'
import JoinCouncil from './councils/JoinCouncil'
import MyCouncils from './councils/MyCouncils'
import PushSettingsButton from './push/PushSettings'
import StateMessage from '@/components/StateMessage'
import { AuthCard } from '@/components/AuthCard'
import { BrandMark } from '@/components/BrandMark'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { isKakaoInAppBrowser } from '@/lib/in-app-browser'
import { isIosHomeScreenApp } from '@/lib/platform'

// 초대 링크(/join/코드)로 왔는지, 학생회가 없어 코드를 직접 입력했는지에 따라 돌아갈 곳이 다르다.
type Invite = { code: string; from: 'link' | 'form' }

// 로그인 전후의 가운데 카드 화면. 와이어프레임 SIGN-IN·INV-00과 같은 틀이다.
function AuthPage({ children }: { children: ReactNode }) {
  return <main className="flex min-h-dvh items-center justify-center p-4 sm:py-12">
    <AuthCard>
      <div className="flex flex-wrap items-center gap-2">
        <BrandMark />
        <h1 className="text-base font-semibold text-gray-900">VADA</h1>
        <p className="ml-auto text-xs text-gray-400">학생회를 위한 공간</p>
      </div>
      {children}
    </AuthCard>
  </main>
}

export default function App() {
  const { data: session, isPending, error, refetch } = authClient.useSession()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(() => new URLSearchParams(window.location.search).has('error')
    ? '로그인이 완료되지 않았어요. 다시 시도해 주세요.' : '')
  const [invite, setInvite] = useState<Invite | null>(() => {
    const code = inviteCodeFromPath(window.location.pathname)
    return code === null ? null : { code, from: 'link' }
  })
  // 초대로 방금 들어온 학생회. 작업 공간이 그 학생회를 먼저 연다.
  const [opened, setOpened] = useState<string>()
  const [homeScreenApp] = useState(() => isIosHomeScreenApp(navigator as { standalone?: boolean }))
  // iOS 홈 화면 앱: 로그인 창이 알리거나 앱이 다시 보이면 세션을 다시 읽는다.
  useEffect(() => {
    if (!homeScreenApp || session) return
    const recheck = () => { void refetch() }
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(AUTH_CHANNEL)
    if (channel) channel.onmessage = recheck
    const onVisible = () => { if (document.visibilityState === 'visible') recheck() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { channel?.close(); document.removeEventListener('visibilitychange', onVisible) }
  }, [homeScreenApp, session, refetch])

  function leaveInvite() {
    window.history.replaceState(null, '', '/')
    setInvite(null)
  }

  async function login() {
    setBusy(true)
    setMessage('')
    try {
      // 초대 링크로 왔으면 로그인 뒤 같은 초대로 돌아온다.
      const callbackURL = invite?.from === 'link' ? invitePath(invite.code) : '/'
      const result = await authClient.signIn.social({ provider: 'google', callbackURL, errorCallbackURL: callbackURL })
      if (result.error) throw new Error('Sign-in failed')
    } catch {
      setMessage('로그인을 시작하지 못했어요. 연결을 확인하고 다시 시도해 주세요.')
      setBusy(false)
    }
  }

  // iOS 홈 화면 앱: 누른 순간 앱 안 창을 열고 그 창에서 Google 로그인을 한다(휴대폰 길 spec 길 B).
  async function loginInApp() {
    setBusy(true)
    setMessage('')
    const result = await startPopupLogin(() => window.open('about:blank', '_blank'),
      () => authClient.signIn.social({ provider: 'google', callbackURL: AUTH_DONE_PATH, errorCallbackURL: `${AUTH_DONE_PATH}?error=1`, disableRedirect: true }))
    setBusy(false)
    if (result === 'blocked') setMessage('로그인 창을 열지 못했어요. 다른 방법으로 로그인해 주세요.')
    if (result === 'failed') setMessage('로그인을 시작하지 못했어요. 연결을 확인하고 다시 시도해 주세요.')
  }

  async function logout() {
    setBusy(true)
    setMessage('')
    try {
      const result = await authClient.signOut()
      if (result.error) throw new Error('Sign-out failed')
    } catch {
      setMessage('로그아웃하지 못했어요. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  if (!isPending && !error && session) {
    const card = (content: ReactNode) => <AuthPage>
      <div className="flex flex-col gap-0.5 rounded-md bg-gray-50 px-3 py-2">
        <h2 className="text-xs font-medium text-gray-500">로그인 완료</h2>
        <p className="text-sm font-medium text-gray-900">{session.user.name}</p>
        <p className="text-xs wrap-anywhere text-gray-500">{session.user.email}</p>
      </div>
      {content}
      <div className="flex items-center gap-2">
        <PushSettingsButton />
        <Button variant="outline" className="flex-1" disabled={busy} onClick={() => { void logout() }}>{busy ? '로그아웃 중…' : '로그아웃'}</Button>
      </div>
    </AuthPage>
    // 로그아웃 실패는 카드 화면과 작업 공간 어디서나 맨 위 한 줄로 알린다.
    const banner = message && <StateMessage kind="error" className="border-b bg-white px-6 py-3">{message}</StateMessage>
    if (invite) return <>{banner}{card(<JoinCouncil key={invite.code} code={invite.code} leaveLabel={invite.from === 'link' ? 'VADA로 가기' : '다시 입력'}
      onJoined={councilId => { leaveInvite(); setOpened(councilId) }} onLeave={leaveInvite} />)}</>
    return <>
      {banner}
      <MyCouncils key={`${session.user.id}:${opened ?? ''}`} user={session.user} initialCouncilId={opened} card={card}
        onEnterCode={code => setInvite({ code, from: 'form' })} logoutBusy={busy} onLogout={() => { void logout() }} />
    </>
  }

  return <AuthPage>
    {isPending ? <StateMessage kind="loading">로그인 상태 확인 중…</StateMessage> : error ? <div className="flex flex-col gap-3">
      <StateMessage kind="error">세션을 확인하지 못했어요. 서버 연결을 확인해 주세요.</StateMessage>
      <Button onClick={() => { void refetch() }}>다시 확인</Button>
    </div> : <div className="flex flex-col gap-3">
      {invite?.from === 'link' && <Alert tone="info">학생회 초대 링크로 들어왔어요. 로그인하면 들어갈 수 있어요.</Alert>}
      <LoginPanel kakao={isKakaoInAppBrowser(navigator.userAgent)} homeScreenApp={homeScreenApp} busy={busy}
        onLogin={() => { void login() }} onLoginInApp={() => { void loginInApp() }} />
    </div>}
    {message && <StateMessage kind="error">{message}</StateMessage>}
  </AuthPage>
}
```

- [ ] **Step 9: 시험과 타입, 빌드를 본다**

Run: `cd apps/web && npx vitest run src/team src/App.test.tsx src/App.integration.test.tsx`
Expected: PASS(`People.test.tsx` 2, `team-view.test.ts` 3, `App.test.tsx` 14, `App.integration.test.tsx` 9)

Run: `npm run typecheck && npm test --workspace @vada/web && npm run build`
Expected: 타입 오류 없음, 실패 0, 빌드 성공

- [ ] **Step 10: 눈 확인은 컨트롤러에게 넘긴다**

구현자는 브라우저를 열지 않는다(P36). 보고에 "`/ui.html`의 '동작 메뉴' 묶음 확인 필요"를 적는다. 메뉴를 키보드로 여는 것은 Step 3의 시험이 본다.

컨트롤러: `npm run dev --workspace @vada/web`을 띄우고 `http://127.0.0.1:5180/ui.html`을 헤드리스 브라우저로 데스크톱 폭과 390px iframe에서 찍는다. 두 메뉴는 버튼에 Enter를 보내 연 상태로도 찍는다.
Expected(컨트롤러): 메뉴가 버튼 아래에 화면 밖으로 넘치지 않게 뜨고, 긴 학생회 이름은 줄을 바꾸며, '내보내기'만 빨갛다.

로그인 뒤 화면과 Figma 비교는 새 표가 있는 DB가 있어야 한다. 로컬 `.env`는 아직 옛 DB를 가리키므로 `npm run dev:api`로 보지 않고, 아래 '바꾸는 날' 2단계에서 사람이 휴대폰 폭과 데스크톱 폭으로 본다.

- [ ] **Step 11: 커밋**

```bash
git add apps/web/src
git commit -m "학생회 없음·만들기·초대 화면과 작업 공간 틀 더하기"
```

---

### Task 12: 화면 — 운영진 > 사람의 초대 링크와 편성 동작

회장단은 운영진 > 사람 위에서 초대 링크를 복사하고 코드를 바꾼다(바꾼 뒤 옛 링크가 막혔다고 알린다, P27). 줄마다 ⋯ 메뉴로 부서 배정(부서와 부서 직급, 빼기), 부회장 직급 주기·거두기(P26), 내보내기를 하고, 회장은 회장 넘기기를 더 본다. 내보내기와 회장 넘기기는 확인 대화상자를 거친다. 동작은 서버가 준 내 권한 목록으로만 보인다(DEC-38). 확인 대화상자 부품 `components/ConfirmDialog.tsx`를 더하고 `/ui.html`에 보인다(P25).

**Files:**
- Create: `apps/web/src/components/ConfirmDialog.tsx`
- Create: `apps/web/src/team/InviteCard.tsx`, `apps/web/src/team/MemberDepartmentsDialog.tsx`
- Modify: `apps/web/src/team/People.tsx`, `apps/web/src/team/People.test.tsx`
- Modify: `apps/web/src/workspace/Workspace.tsx`, `apps/web/src/App.integration.test.tsx`
- Modify: `apps/web/src/ui-gallery/Gallery.tsx`, `apps/web/src/ui-gallery/Gallery.test.tsx`

**Interfaces:**
- Consumes:
  - Task 11: `useTeam`의 `change(path, body): Promise<string | null>`(성공 null, 실패 오류 코드)·`saving`, `type Team`, `Menu`·`MenuTrigger`·`MenuContent`·`MenuItem`, `inviteLink`, `getJson`, `postJson`, `councilRankLabel`, `joinedDay`, `placementsText`, 시험용 `councilView`·`teamResponse`·`MEMBER_PERMISSIONS`·`LEADER_PERMISSIONS`·`PRESIDENT_PERMISSIONS`
  - 계약: `type InviteCodeResponse = { code: string }`, `type TeamMember`, `type TeamDepartment`, `type CouncilTitles`, `type DepartmentRank`, `type Action`
  - HTTP(Task 7~8): `GET /api/organizations/:councilId/invite`, `POST …/invite/rotate`(`{}`), `POST …/members/:memberId/departments`(`{ departmentId, rank }`), `POST …/members/:memberId/departments/:departmentId/remove`(`{}`), `POST …/members/:memberId/rank`(`{ rank: 'vice_president' | null }`), `POST …/president/transfer`(`{ memberId }`), `POST …/members/:memberId/remove`(`{}`). 운영진 변경은 `TeamResponse` 전체를 돌려준다.
  - 오류 코드: `PRESIDENT_CANNOT_LEAVE`, `CANNOT_REMOVE_SELF`, `PRESIDENT_REQUIRED`, `ALREADY_PRESIDENT`, `FORBIDDEN`, `NOT_FOUND`
- Produces:
  - `ConfirmDialog({ open, title, description, confirmLabel, destructive?, busy?, error?, onConfirm, onCancel })`(보내는 동안 닫히지 않는다)
  - `InviteCard({ councilId })`, `MemberDepartmentsDialog({ member, departments, titles, saving, error, onAssign(departmentId, rank), onRemove(departmentId), onClose })`
  - `People({ view, team, onCouncilChanged })`: 내 직급이나 소속이 바뀌는 변경 뒤 `onCouncilChanged()`로 학생회(내 권한)를 다시 읽게 한다

- [ ] **Step 1: 실패하는 시험을 쓴다**

`apps/web/src/team/People.test.tsx`를 다음으로 바꾼다(권한마다 보이는 동작, 초대 링크, 부서 배정, 부회장, 내보내기, 회장 넘기기):

```tsx
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Action, TeamResponse } from '@vada/contracts'
import { councilView, LEADER_PERMISSIONS, MEMBER_PERMISSIONS, PRESIDENT_PERMISSIONS, teamResponse } from '@/test-support/council-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import People from './People'
import { useTeam } from './useTeam'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const titles = { president: '위원장', vicePresident: '부위원장', head: '국장', viceHead: '차장' }

function Harness({ permissions, onCouncilChanged = () => {} }: { permissions: Action[]; onCouncilChanged?: () => void }) {
  const team = useTeam('c1', () => {})
  const base = councilView('c1', { permissions })
  return <People view={{ ...base, council: { ...base.council, titles } }} team={team} onCouncilChanged={onCouncilChanged} />
}
function serve(team: TeamResponse = teamResponse()) {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/members', () => json(team))
  api.on('GET', '/api/organizations/c1/invite', () => json({ code: 'ABCD2345' }))
  return api
}
// 대화상자가 열리면 뒤의 목록은 숨겨진다(aria-hidden). 그래도 줄의 글을 본다.
const row = (name: string) => screen.getAllByRole('listitem', { hidden: true }).find(item => item.textContent?.startsWith(name))!
async function openMenu(name: string) {
  fireEvent.keyDown(await screen.findByRole('button', { name: `${name} 동작` }), { key: 'Enter' })
  return screen.findByRole('menu')
}

test('운영진 목록은 들어온 순서대로 이름, 학생회가 정한 직급 이름, 부서와 부서 직급, 들어온 날을 보이고 이메일은 없다', async () => {
  serve()
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  expect(await screen.findByText('운영진 3명')).toBeTruthy()
  expect(within(screen.getByRole('list', { name: '운영진' })).getAllByRole('listitem').map(item => item.textContent)).toEqual([
    '김회장위원장부서 없음 · 2026.10.01 들어옴',
    '이재정재정부 국장 · 2026.10.02 들어옴',
    '박새내부서 없음 · 2026.10.19 들어옴',
  ])
  expect(document.body.textContent).not.toContain('@')
})

test('직급 없는 운영진은 초대 링크와 ⋯ 메뉴를 보지 않고 서버에 초대 코드를 묻지 않는다', async () => {
  const api = serve()
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  await screen.findByText('운영진 3명')
  expect(screen.queryByRole('region', { name: '초대 링크' })).toBeNull()
  expect(screen.queryByRole('button', { name: /동작$/ })).toBeNull()
  expect(api.calls.some(call => call.path.endsWith('/invite'))).toBe(false)
})

test('회장단은 초대 링크를 복사하고 코드를 바꾼다. 바꾸면 새 링크를 보여 주고 옛 링크는 막혔다고 알린다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/invite/rotate', () => json({ code: 'WXYZ6789' }))
  const writeText = vi.fn(async (_text: string) => {})
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  const card = await screen.findByRole('region', { name: '초대 링크' })
  expect((within(card).getByLabelText('초대 링크') as HTMLInputElement).value).toBe(`${window.location.origin}/join/ABCD2345`)
  fireEvent.click(within(card).getByRole('button', { name: '링크 복사' }))
  expect(await within(card).findByText('초대 링크를 복사했어요. 단톡방에 붙여 넣어 주세요.')).toBeTruthy()
  expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/join/ABCD2345`)
  fireEvent.click(within(card).getByRole('button', { name: '코드 바꾸기' }))
  expect(await within(card).findByText('코드를 바꿨어요. 옛 링크로는 이제 들어올 수 없어요.')).toBeTruthy()
  expect((within(card).getByLabelText('초대 링크') as HTMLInputElement).value).toBe(`${window.location.origin}/join/WXYZ6789`)
})

test('회장단의 ⋯ 메뉴: 회장 줄에는 직급과 내보내기가 없고, 내 줄에는 내보내기가 없고, 회장 넘기기는 회장에게만 있다', async () => {
  serve()
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  let menu = await openMenu('김회장')
  expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual(['부서 배정'])
  fireEvent.keyDown(menu, { key: 'Escape' })
  menu = await openMenu('이재정')
  expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual(['부서 배정', '부위원장 직급 주기', '내보내기'])
  cleanup()
  serve()
  render(<Harness permissions={PRESIDENT_PERMISSIONS} />)
  menu = await openMenu('이재정')
  expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual(['부서 배정', '부위원장 직급 주기', '위원장 넘기기', '내보내기'])
})

test('부서 배정 대화상자에서 부서와 부서 직급을 정하고, 부서에서 뺀다', async () => {
  const api = serve()
  const assigned = teamResponse()
  assigned.members[2]!.departments = [{ id: 'd2', rank: 'vice_head' }]
  api.on('POST', '/api/organizations/c1/members/m3/departments', () => json(assigned))
  api.on('POST', '/api/organizations/c1/members/m3/departments/d2/remove', () => json(teamResponse()))
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('박새내')).getByRole('menuitem', { name: '부서 배정' }))
  const dialog = await screen.findByRole('dialog', { name: '박새내의 부서' })
  fireEvent.change(within(dialog).getByLabelText('부서'), { target: { value: 'd2' } })
  fireEvent.change(within(dialog).getByLabelText('부서 직급'), { target: { value: 'vice_head' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '부서에 넣기' }))
  expect(await within(dialog).findByLabelText('기획부 부서 직급')).toBeTruthy()
  expect(api.calls.find(call => call.path.endsWith('/members/m3/departments'))?.body).toEqual({ departmentId: 'd2', rank: 'vice_head' })
  expect(row('박새내').textContent).toContain('기획부 차장')
  fireEvent.click(within(dialog).getByRole('button', { name: '기획부에서 빼기' }))
  await waitFor(() => expect(within(dialog).getByText('아직 부서가 없어요.')).toBeTruthy())
})

test('부회장 직급은 확인 없이 바로 주고, 내 직급을 바꾸면 학생회를 다시 읽는다', async () => {
  const api = serve()
  const promoted = teamResponse()
  promoted.members[1]!.councilRank = 'vice_president'
  api.on('POST', '/api/organizations/c1/members/m2/rank', () => json(promoted))
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('이재정')).getByRole('menuitem', { name: '부위원장 직급 주기' }))
  await waitFor(() => expect(row('이재정').textContent).toContain('부위원장'))
  expect(api.calls.find(call => call.path.endsWith('/rank'))?.body).toEqual({ rank: 'vice_president' })
})

test('내보내기는 확인 대화상자를 거치고, 취소하면 아무것도 보내지 않는다', async () => {
  const api = serve()
  const removed = teamResponse()
  removed.members = removed.members.filter(member => member.id !== 'm3')
  api.on('POST', '/api/organizations/c1/members/m3/remove', () => json(removed))
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('박새내')).getByRole('menuitem', { name: '내보내기' }))
  let dialog = await screen.findByRole('dialog', { name: '박새내님을 내보낼까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '취소' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
  fireEvent.click(within(await openMenu('박새내')).getByRole('menuitem', { name: '내보내기' }))
  dialog = await screen.findByRole('dialog', { name: '박새내님을 내보낼까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '내보내기' }))
  expect(await screen.findByText('운영진 2명')).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('회장 넘기기는 확인한 뒤 넘기고 학생회를 다시 읽는다. 서버가 거절하면 대화상자에 까닭을 보인다', async () => {
  const api = serve()
  let first = true
  api.on('POST', '/api/organizations/c1/president/transfer', () => {
    if (first) { first = false; return json({ error: 'NOT_FOUND' }, 404) }
    return json(teamResponse())
  })
  const changed = vi.fn()
  render(<Harness permissions={PRESIDENT_PERMISSIONS} onCouncilChanged={changed} />)
  fireEvent.click(within(await openMenu('이재정')).getByRole('menuitem', { name: '위원장 넘기기' }))
  const dialog = await screen.findByRole('dialog', { name: '이재정님에게 위원장 직급을 넘길까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '넘기기' }))
  expect(await within(dialog).findByText('이미 바뀌었어요. 목록을 새로 불러왔어요.')).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('button', { name: '넘기기' }))
  await waitFor(() => expect(changed).toHaveBeenCalled())
  expect(api.calls.filter(call => call.path.endsWith('/president/transfer')).map(call => call.body)).toEqual([{ memberId: 'm2' }, { memberId: 'm2' }])
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})
```

`apps/web/src/ui-gallery/Gallery.test.tsx`에서:

1. 첫 시험의 이름 목록에서 `'대화상자·옆 메뉴', '상태 문구'`를 `'대화상자·옆 메뉴', '확인 대화상자', '상태 문구'`로 바꾼다.
2. 파일 끝에 더한다:

```tsx

test('확인 대화상자 예시는 빨간 확인 버튼과 오류 문구를 보이고, 취소로 닫는다', async () => {
  render(<Gallery />)
  fireEvent.click(screen.getByRole('button', { name: '확인 대화상자 열기' }))
  const dialog = await screen.findByRole('dialog', { name: '박새내님을 내보낼까요?' })
  expect(within(dialog).getByRole('button', { name: '내보내기' }).className).toContain('bg-destructive')
  expect(within(dialog).getByRole('alert').textContent).toBe('저장하지 못했어요. 다시 시도해 주세요.')
  fireEvent.click(within(dialog).getByRole('button', { name: '취소' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})
```

`apps/web/src/App.integration.test.tsx`의 `openCouncil` 안, `` api.on('GET', `/api/organizations/${id}/members`, () => json(teamResponse())) `` 줄 아래에 더한다(회장단의 운영진 > 사람이 초대 코드를 묻는다. 없으면 `assertNoUnexpectedRequests`가 실패한다):

```tsx
  // 회장단에게는 운영진 > 사람 위에 초대 링크가 보인다.
  api.on('GET', `/api/organizations/${id}/invite`, () => json({ code: 'ABCD2345' }))
```

Run: `cd apps/web && npx vitest run src/team/People.test.tsx src/ui-gallery src/App.integration.test.tsx`
Expected: FAIL, `Tests  8 failed | 16 passed (24)`. `People.test.tsx` 6개가 `"초대 링크"` 영역과 `"김회장 동작"` 같은 ⋯ 버튼을 찾지 못하고, `Gallery.test.tsx` 2개가 `"확인 대화상자"`를 찾지 못한다.

- [ ] **Step 2: 확인 대화상자 부품을 만들고 부품 확인 화면에 더한다**

`apps/web/src/components/ConfirmDialog.tsx`:

```tsx
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Props = {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  // 되돌리기 어려운 동작(내보내기)은 빨간 버튼이다.
  destructive?: boolean
  busy?: boolean
  error?: string
  onConfirm: () => void
  onCancel: () => void
}

// 확인 대화상자: 되돌리기 어려운 동작(내보내기, 회장 넘기기) 앞에 한 번 묻는다. 보내는 동안에는 닫지 않는다.
export function ConfirmDialog({ open, title, description, confirmLabel, destructive = false, busy = false, error, onConfirm, onCancel }: Props) {
  return <Dialog open={open} onOpenChange={next => { if (!next && !busy) onCancel() }}>
    <DialogContent>
      <DialogHeader><DialogTitle className="wrap-anywhere">{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      {error && <StateMessage kind="error">{error}</StateMessage>}
      <DialogFooter>
        <Button variant="outline" disabled={busy} onClick={onCancel}>취소</Button>
        <Button variant={destructive ? 'destructive' : 'default'} disabled={busy} onClick={onConfirm}>{confirmLabel}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
```

`apps/web/src/ui-gallery/Gallery.tsx`에서:

1. `import { BrandMark } from '@/components/BrandMark'` 아래에 `import { ConfirmDialog } from '@/components/ConfirmDialog'`를 더한다.
2. `  const [panelOpen, setPanelOpen] = useState(false)` 아래에 `  const [confirmOpen, setConfirmOpen] = useState(false)`를 더한다.
3. `    <Section title="상태 문구">` 바로 위에 더한다:

```tsx
    <Section title="확인 대화상자">
      <Button variant="outline" onClick={() => setConfirmOpen(true)}>확인 대화상자 열기</Button>
      <ConfirmDialog open={confirmOpen} destructive title="박새내님을 내보낼까요?" error="저장하지 못했어요. 다시 시도해 주세요."
        description="학생회 소속과 부서 소속이 함께 끝나요. 초대 링크로 다시 들어올 수 있지만, 부서와 직급은 다시 정해야 해요."
        confirmLabel="내보내기" onCancel={() => setConfirmOpen(false)} onConfirm={() => setConfirmOpen(false)} />
    </Section>
```

Run: `cd apps/web && npx vitest run src/ui-gallery`
Expected: PASS(`Gallery.test.tsx` 7 tests)

- [ ] **Step 3: 초대 링크와 부서 배정 대화상자를 만든다**

`apps/web/src/team/InviteCard.tsx`:

```tsx
import { useEffect, useId, useState } from 'react'
import { Copy, RefreshCw } from 'lucide-react'
import type { InviteCodeResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getJson, postJson } from '@/lib/api'
import { inviteLink } from '../councils/invite-path'

type Notice = 'copied' | 'copy-failed' | 'rotated' | 'failed' | null
const notices: Record<Exclude<Notice, null>, { kind: 'notice' | 'error'; text: string }> = {
  copied: { kind: 'notice', text: '초대 링크를 복사했어요. 단톡방에 붙여 넣어 주세요.' },
  'copy-failed': { kind: 'error', text: '복사하지 못했어요. 링크를 직접 선택해 복사해 주세요.' },
  rotated: { kind: 'notice', text: '코드를 바꿨어요. 옛 링크로는 이제 들어올 수 없어요.' },
  failed: { kind: 'error', text: '코드를 바꾸지 못했어요. 다시 시도해 주세요.' },
}

// 초대 링크(회장단): 링크 복사와 코드 바꾸기. 바꾸면 옛 코드는 막히고 만료는 없다(바탕 spec G2).
export default function InviteCard({ councilId }: { councilId: string }) {
  const base = `/api/organizations/${encodeURIComponent(councilId)}/invite`
  const linkId = useId()
  const [code, setCode] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  useEffect(() => {
    const controller = new AbortController()
    void getJson<InviteCodeResponse>(base, controller.signal).then(result => {
      if (controller.signal.aborted) return
      if (result.ok) setCode(result.data.code)
      else setLoadFailed(true)
    })
    return () => controller.abort()
  }, [base])

  async function copy(link: string) {
    try {
      // HTTP 접속이나 오래된 브라우저에는 클립보드 API가 없다.
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(link)
      setNotice('copied')
    } catch {
      setNotice('copy-failed')
    }
  }
  async function rotate() {
    setRotating(true)
    setNotice(null)
    const result = await postJson<InviteCodeResponse>(`${base}/rotate`, {})
    setRotating(false)
    if (!result.ok) return setNotice('failed')
    setCode(result.data.code)
    setNotice('rotated')
  }

  if (!code) return loadFailed ? <StateMessage kind="error">초대 링크를 불러오지 못했어요.</StateMessage> : null
  const link = inviteLink(code)
  return <Card className="flex flex-col gap-3 p-4">
    <section aria-label="초대 링크" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor={linkId} className="text-sm font-semibold text-gray-900">초대 링크</Label>
        <p className="text-xs text-gray-500">단톡방에 올리면 누른 사람이 바로 운영진으로 들어와요. 잘못 들어온 사람은 내보내고 코드를 바꿔 주세요.</p>
      </div>
      <Input id={linkId} readOnly value={link} className="font-mono text-base text-gray-500 sm:text-xs" onFocus={event => event.currentTarget.select()} />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => { void copy(link) }}><Copy />링크 복사</Button>
        <Button variant="outline" size="sm" disabled={rotating} onClick={() => { void rotate() }}><RefreshCw />{rotating ? '바꾸는 중…' : '코드 바꾸기'}</Button>
      </div>
      {notice && <StateMessage kind={notices[notice].kind}>{notices[notice].text}</StateMessage>}
    </section>
  </Card>
}
```

`apps/web/src/team/MemberDepartmentsDialog.tsx`(바꾸면 바로 저장한다. 서버가 돌려준 목록으로 대화상자 안의 부서도 바뀐다):

```tsx
import { useState } from 'react'
import { X } from 'lucide-react'
import type { CouncilTitles, DepartmentRank, TeamDepartment, TeamMember } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'

type Props = {
  member: TeamMember
  departments: TeamDepartment[]
  titles: CouncilTitles
  saving: boolean
  error: string
  onAssign: (departmentId: string, rank: DepartmentRank | null) => void
  onRemove: (departmentId: string) => void
  onClose: () => void
}

const rankValue = (rank: DepartmentRank | null) => rank ?? ''
const rankOf = (value: string): DepartmentRank | null => value === 'head' || value === 'vice_head' ? value : null

// 부서 배정(회장단): 지금 부서마다 부서 직급을 바꾸거나 빼고, 다른 부서에 더한다. 한 사람이 여러 부서에 있을 수 있다(DEC-16).
export default function MemberDepartmentsDialog({ member, departments, titles, saving, error, onAssign, onRemove, onClose }: Props) {
  const others = departments.filter(department => !member.departments.some(item => item.id === department.id))
  const [adding, setAdding] = useState(others[0]?.id ?? '')
  const [addingRank, setAddingRank] = useState('')
  // 방금 넣은 부서는 고르는 칸에서 빠진다. 그때는 남은 첫 부서를 고른다.
  const selected = others.some(department => department.id === adding) ? adding : others[0]?.id ?? ''
  const rankOptions = <><option value="">직급 없음</option><option value="head">{titles.head}</option><option value="vice_head">{titles.viceHead}</option></>
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose() }}>
    <DialogContent>
      <DialogHeader><DialogTitle className="wrap-anywhere">{member.name}의 부서</DialogTitle>
        <DialogDescription>부서와 부서 직급을 정해요. 바꾸면 바로 저장돼요.</DialogDescription></DialogHeader>
      <section aria-label="지금 부서" className="flex flex-col gap-2">
        {member.departments.length === 0 && <p className="text-sm text-gray-500">아직 부서가 없어요.</p>}
        {member.departments.map(item => {
          const name = departments.find(department => department.id === item.id)?.name ?? ''
          return <div key={item.id} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 text-sm wrap-anywhere text-gray-800">{name}</span>
            <NativeSelect aria-label={`${name} 부서 직급`} className="w-32" value={rankValue(item.rank)} disabled={saving}
              onChange={event => onAssign(item.id, rankOf(event.target.value))}>{rankOptions}</NativeSelect>
            <Button variant="ghost" size="icon" aria-label={`${name}에서 빼기`} disabled={saving} onClick={() => onRemove(item.id)}><X /></Button>
          </div>
        })}
      </section>
      {others.length > 0
        ? <section aria-label="부서 더하기" className="flex flex-col gap-2 border-t pt-4">
          <div className="grid grid-cols-2 gap-2">
            <Label className="flex flex-col gap-1.5">부서
              <NativeSelect value={selected} onChange={event => setAdding(event.target.value)}>
                {others.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
              </NativeSelect>
            </Label>
            <Label className="flex flex-col gap-1.5">부서 직급
              <NativeSelect value={addingRank} onChange={event => setAddingRank(event.target.value)}>{rankOptions}</NativeSelect>
            </Label>
          </div>
          <Button variant="outline" className="self-start" disabled={saving} onClick={() => onAssign(selected, rankOf(addingRank))}>부서에 넣기</Button>
        </section>
        : departments.length === 0 && <p className="text-sm text-gray-500">부서가 없어요. 운영진 &gt; 부서에서 먼저 만들어 주세요.</p>}
      {error && <StateMessage kind="error">{error}</StateMessage>}
    </DialogContent>
  </Dialog>
}
```

- [ ] **Step 4: 운영진 > 사람에 동작을 더한다**

`apps/web/src/team/People.tsx`를 다음으로 바꾼다:

```tsx
import { useState } from 'react'
import { Ellipsis } from 'lucide-react'
import type { Action, CouncilView, DepartmentRank, TeamMember } from '@vada/contracts'
import { Avatar } from '@/components/Avatar'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import InviteCard from './InviteCard'
import MemberDepartmentsDialog from './MemberDepartmentsDialog'
import { councilRankLabel, joinedDay, placementsText } from './team-view'
import type { Team } from './useTeam'

const errors: Record<string, string> = {
  PRESIDENT_CANNOT_LEAVE: '회장은 내보낼 수 없어요. 먼저 회장을 넘겨 주세요.',
  CANNOT_REMOVE_SELF: '나를 내보낼 수는 없어요.',
  PRESIDENT_REQUIRED: '회장의 직급은 회장 넘기기로만 바꿀 수 있어요.',
  ALREADY_PRESIDENT: '이미 회장이에요.',
  FORBIDDEN: '권한이 바뀌었어요. 화면을 새로 불러왔어요.',
  NOT_FOUND: '이미 바뀌었어요. 목록을 새로 불러왔어요.',
}
const failure = '저장하지 못했어요. 다시 시도해 주세요.'
type Confirm = { kind: 'remove' | 'transfer'; member: TeamMember }

type Props = { view: CouncilView; team: Team; onCouncilChanged: () => void }

// 운영진 > 사람: 이름, 직급(학생회가 정한 표시 이름), 부서와 부서 직급, 들어온 날. 들어온 순서대로다(DEC-47).
// 회장단은 초대 링크와 줄마다 ⋯ 메뉴(부서 배정, 직급, 내보내기)를 보고, 회장은 회장 넘기기를 더 본다.
// 동작 버튼은 서버가 준 내 권한 목록으로만 보이거나 숨긴다(DEC-38).
export default function People({ view, team, onCouncilChanged }: Props) {
  const { data, loadFailed, saving, change, reload } = team
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  if (!data) return loadFailed
    ? <Card className="flex flex-col gap-3 p-6"><StateMessage kind="error">운영진을 불러오지 못했어요.</StateMessage>
      <Button variant="outline" className="self-start" onClick={reload}>다시 시도</Button></Card>
    : <StateMessage kind="loading">운영진 불러오는 중…</StateMessage>
  const current = data
  const titles = view.council.titles
  const me = view.me.memberId
  const can = (action: Action) => view.permissions.includes(action)
  const editingMember = current.members.find(member => member.id === editing) ?? null

  // 성공하면 true다. 실패하면 문구를 보여 준다. 내 직급이 바뀌면 학생회를 다시 읽어 권한을 새로 받는다.
  async function run(path: string, body: unknown, changesMe = false) {
    setMessage('')
    const code = await change(path, body)
    if (code) {
      setMessage(errors[code] ?? failure)
      return false
    }
    if (changesMe) onCouncilChanged()
    return true
  }
  const memberPath = (member: TeamMember) => `/members/${encodeURIComponent(member.id)}`
  function assign(member: TeamMember, departmentId: string, rank: DepartmentRank | null) {
    void run(`${memberPath(member)}/departments`, { departmentId, rank }, member.id === me)
  }
  function removeFrom(member: TeamMember, departmentId: string) {
    void run(`${memberPath(member)}/departments/${encodeURIComponent(departmentId)}/remove`, {}, member.id === me)
  }
  async function confirmed() {
    if (!confirm) return
    const done = confirm.kind === 'remove'
      ? await run(`${memberPath(confirm.member)}/remove`, {})
      : await run('/president/transfer', { memberId: confirm.member.id }, true)
    if (done) setConfirm(null)
  }

  return <div className="mx-auto flex max-w-3xl flex-col gap-4">
    {can('invite.manage') && <InviteCard councilId={view.council.id} />}
    <h2 className="text-base font-semibold text-gray-900">운영진 {current.members.length}명</h2>
    {message && !editing && !confirm && <StateMessage kind="error">{message}</StateMessage>}
    <Card className="overflow-hidden">
      <ul aria-label="운영진" className="divide-y">
        {current.members.map(member => {
          const rank = councilRankLabel(member.councilRank, titles)
          const placements = placementsText(member, current.departments, titles)
          const president = member.councilRank === 'president'
          return <li key={member.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm wrap-anywhere text-gray-900">{member.name}
                {rank && <Badge tone="info">{rank}</Badge>}</p>
              <p className="text-xs wrap-anywhere text-gray-500">{placements || '부서 없음'} · {joinedDay(member.joinedAt)} 들어옴</p>
            </div>
            {can('member.manage') && <Menu>
              <MenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`${member.name} 동작`} disabled={saving}><Ellipsis /></Button></MenuTrigger>
              <MenuContent>
                <MenuItem onSelect={() => { setMessage(''); setEditing(member.id) }}>부서 배정</MenuItem>
                {can('rank.manage') && !president && <MenuItem onSelect={() => {
                  void run(`${memberPath(member)}/rank`, { rank: member.councilRank === 'vice_president' ? null : 'vice_president' }, member.id === me)
                }}>{member.councilRank === 'vice_president' ? `${titles.vicePresident} 직급 거두기` : `${titles.vicePresident} 직급 주기`}</MenuItem>}
                {can('president.transfer') && member.id !== me && <MenuItem onSelect={() => { setMessage(''); setConfirm({ kind: 'transfer', member }) }}>
                  {titles.president} 넘기기</MenuItem>}
                {!president && member.id !== me && <MenuItem destructive onSelect={() => { setMessage(''); setConfirm({ kind: 'remove', member }) }}>
                  내보내기</MenuItem>}
              </MenuContent>
            </Menu>}
          </li>
        })}
      </ul>
    </Card>
    {editingMember && <MemberDepartmentsDialog key={editingMember.id} member={editingMember} departments={current.departments} titles={titles}
      saving={saving} error={message} onClose={() => { setEditing(null); setMessage('') }}
      onAssign={(departmentId, rank) => assign(editingMember, departmentId, rank)} onRemove={departmentId => removeFrom(editingMember, departmentId)} />}
    <ConfirmDialog open={confirm?.kind === 'remove'} destructive busy={saving} error={confirm ? message : ''}
      title={`${confirm?.member.name ?? ''}님을 내보낼까요?`}
      description="학생회 소속과 부서 소속이 함께 끝나요. 초대 링크로 다시 들어올 수 있지만, 부서와 직급은 다시 정해야 해요."
      confirmLabel="내보내기" onCancel={() => { setConfirm(null); setMessage('') }} onConfirm={() => { void confirmed() }} />
    <ConfirmDialog open={confirm?.kind === 'transfer'} busy={saving} error={confirm ? message : ''}
      title={`${confirm?.member.name ?? ''}님에게 ${titles.president} 직급을 넘길까요?`}
      description={`넘기면 나는 직급이 없어지고, ${titles.president}만 하던 일은 넘겨받은 사람이 해요.`}
      confirmLabel="넘기기" onCancel={() => { setConfirm(null); setMessage('') }} onConfirm={() => { void confirmed() }} />
  </div>
}
```

`apps/web/src/workspace/Workspace.tsx`에서 `          : <People view={view} team={team} />}`를 `          : <People view={view} team={team} onCouncilChanged={reload} />}`로 바꾼다.

- [ ] **Step 5: 시험과 타입, 빌드를 본다**

Run: `cd apps/web && npx vitest run src/team/People.test.tsx src/ui-gallery src/App.integration.test.tsx`
Expected: PASS(`People.test.tsx` 8, `Gallery.test.tsx` 7, `App.integration.test.tsx` 9)

Run: `npm run typecheck && npm test --workspace @vada/web && npm run build`
Expected: 타입 오류 없음, 실패 0, 빌드 성공

- [ ] **Step 6: 눈 확인은 컨트롤러에게 넘긴다**

구현자는 브라우저를 열지 않는다(P36). 보고에 "`/ui.html`의 '확인 대화상자' 묶음 확인 필요"를 적는다. 열고 닫기는 Step 1의 시험이 본다.

컨트롤러: `npm run dev --workspace @vada/web`을 띄우고 `http://127.0.0.1:5180/ui.html`에서 [확인 대화상자 열기]를 누른 상태를 헤드리스 브라우저로 데스크톱 폭과 390px iframe에서 찍는다.
Expected(컨트롤러): 제목, 설명, 오류 문구, [취소]·[내보내기](빨강)가 겹침 없이 보인다.

운영진 > 사람의 ⋯ 메뉴와 대화상자는 '바꾸는 날' 2단계에서 사람이 본다.

- [ ] **Step 7: 커밋**

```bash
git add apps/web/src
git commit -m "운영진 > 사람의 초대 링크와 편성 동작 더하기"
```

---

### Task 13: 화면 — 운영진 > 부서와 설정 > 학생회 정보

옆 메뉴에 운영진 > 부서를 더하고, 학생회 이름 메뉴에 설정을 더한다. 부서 화면은 이름, 역할(재정), 부서원 수를 보이고, 회장단은 부서 만들기와 줄마다 이름 바꾸기, 재정 역할 주고 거두기, 없애기를 한다(쓰인 부서는 409 `DEPARTMENT_IN_USE`의 까닭을 보인다). 설정 > 학생회 정보는 이름, 단위, 학교, 직급 표시 이름 4개, 지금 기수의 이름과 기간이고, 회장단만 고친다. 학생회 이름을 바꾸면 옆 메뉴와 학생회 고르기의 이름도 바뀐다.

**Files:**
- Create: `apps/web/src/team/Departments.tsx`, `apps/web/src/team/Departments.test.tsx`
- Create: `apps/web/src/settings/CouncilSettings.tsx`, `apps/web/src/settings/CouncilSettings.test.tsx`
- Modify: `apps/web/src/workspace/WorkspaceSidebar.tsx`, `apps/web/src/workspace/Workspace.tsx`, `apps/web/src/App.integration.test.tsx`

**Interfaces:**
- Consumes:
  - Task 11~12: `useTeam`의 `change`·`saving`·`reload`, `type Team`, `useCouncilView`의 `replace(view)`, `Menu`·`MenuItem`·`MenuSeparator`, `unitLabels`(`councils/CreateCouncilForm.tsx`), `postJson`, `People`, 시험용 `councilView`·`teamResponse`·`MEMBER_PERMISSIONS`·`LEADER_PERMISSIONS`
  - 계약(Task 9): `CreateDepartmentSchema = { name }`, `UpdateDepartmentSchema = { name, role }`, `UpdateCouncilSettingsSchema = { name, unit, schoolName, titles }`, `UpdateCohortSchema = { name, startsOn, endsOn }`, `COUNCIL_UNITS`, `type CouncilView`, `type TeamDepartment`
  - HTTP(Task 9): `POST /api/organizations/:councilId/departments`, `POST …/departments/:departmentId`, `POST …/departments/:departmentId/delete`(`{}`)는 `TeamResponse`를, `POST …/settings`와 `POST …/cohort`는 `CouncilView`를 돌려준다
  - 오류 코드: `DEPARTMENT_NAME_TAKEN`, `DEPARTMENT_IN_USE`, `COHORT_NOT_CURRENT`, `FORBIDDEN`, `NOT_FOUND`
- Produces:
  - `Departments({ view, team })`, `CouncilSettings({ view, onSaved(view), onForbidden() })`
  - `type Page = 'people' | 'departments' | 'settings'`(`WorkspaceSidebar.tsx`)

- [ ] **Step 1: 실패하는 시험을 쓴다**

`apps/web/src/team/Departments.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Action, TeamResponse } from '@vada/contracts'
import { councilView, LEADER_PERMISSIONS, MEMBER_PERMISSIONS, teamResponse } from '@/test-support/council-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import Departments from './Departments'
import { useTeam } from './useTeam'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function Harness({ permissions }: { permissions: Action[] }) {
  const team = useTeam('c1', () => {})
  return <Departments view={councilView('c1', { permissions })} team={team} />
}
function serve() {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/members', () => json(teamResponse()))
  return api
}
const withDepartments = (change: (team: TeamResponse) => void) => { const team = teamResponse(); change(team); return json(team) }
async function openMenu(name: string) {
  fireEvent.keyDown(await screen.findByRole('button', { name: `${name} 동작` }), { key: 'Enter' })
  return screen.findByRole('menu')
}

test('부서 목록은 이름, 재정 역할, 부서원 수를 보이고, 직급 없는 운영진에게는 동작이 없다', async () => {
  serve()
  render(<Harness permissions={MEMBER_PERMISSIONS} />)
  expect(await screen.findByText('부서 2개')).toBeTruthy()
  expect(within(screen.getByRole('list', { name: '부서' })).getAllByRole('listitem').map(item => item.textContent))
    .toEqual(['재정부재정부서원 1명', '기획부부서원 0명'])
  expect(screen.queryByRole('form', { name: '부서 만들기' })).toBeNull()
  expect(screen.queryByRole('button', { name: /동작$/ })).toBeNull()
})

test('회장단은 부서를 만든다. 이름이 맞을 때만 버튼이 켜지고, 같은 이름이면 까닭을 보인다', async () => {
  const api = serve()
  let taken = false
  api.on('POST', '/api/organizations/c1/departments', () => taken
    ? json({ error: 'DEPARTMENT_NAME_TAKEN' }, 409)
    : withDepartments(team => team.departments.push({ id: 'd3', name: '홍보부', role: null, memberCount: 0 })))
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  const form = await screen.findByRole('form', { name: '부서 만들기' })
  const submit = within(form).getByRole('button', { name: '부서 만들기' }) as HTMLButtonElement
  expect(submit.disabled).toBe(true)
  fireEvent.change(within(form).getByLabelText('새 부서 이름'), { target: { value: ' 홍보부 ' } })
  expect(submit.disabled).toBe(false)
  fireEvent.click(submit)
  expect(await screen.findByText('부서 3개')).toBeTruthy()
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({ name: '홍보부' })
  expect((within(form).getByLabelText('새 부서 이름') as HTMLInputElement).value).toBe('')
  taken = true
  fireEvent.change(within(form).getByLabelText('새 부서 이름'), { target: { value: '재정부' } })
  fireEvent.click(submit)
  expect(await screen.findByText('같은 이름의 부서가 있어요.')).toBeTruthy()
})

test('회장단은 줄마다 이름 바꾸기, 재정 역할 주고 거두기, 없애기를 한다. 쓰인 부서는 없애지 못한 까닭을 보인다', async () => {
  const api = serve()
  api.on('POST', '/api/organizations/c1/departments/d2', () => withDepartments(team => { team.departments[1] = { id: 'd2', name: '기획국', role: 'finance', memberCount: 0 } }))
  api.on('POST', '/api/organizations/c1/departments/d1/delete', () => json({ error: 'DEPARTMENT_IN_USE' }, 409))
  api.on('POST', '/api/organizations/c1/departments/d2/delete', () => withDepartments(team => { team.departments = team.departments.slice(0, 1) }))
  render(<Harness permissions={LEADER_PERMISSIONS} />)
  fireEvent.click(within(await openMenu('기획부')).getByRole('menuitem', { name: '이름 바꾸기' }))
  const dialog = await screen.findByRole('dialog', { name: '부서 이름 바꾸기' })
  fireEvent.change(within(dialog).getByLabelText('부서 이름'), { target: { value: '기획국' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '바꾸기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.calls.find(call => call.path.endsWith('/departments/d2'))?.body).toEqual({ name: '기획국', role: null })
  const finance = await openMenu('재정부')
  expect(within(finance).getByRole('menuitem', { name: '재정 역할 거두기' })).toBeTruthy()
  fireEvent.click(within(finance).getByRole('menuitem', { name: '없애기' }))
  expect(await screen.findByText('부서원이 있었던 부서는 없앨 수 없어요. 이름을 바꿔 쓰세요.')).toBeTruthy()
  fireEvent.click(within(await openMenu('기획국')).getByRole('menuitem', { name: '없애기' }))
  expect(await screen.findByText('부서 1개')).toBeTruthy()
})
```

`apps/web/src/settings/CouncilSettings.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { councilView, LEADER_PERMISSIONS, MEMBER_PERMISSIONS } from '@/test-support/council-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import CouncilSettings from './CouncilSettings'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

test('회장단은 학생회 정보와 직급 표시 이름을 고쳐 저장하고, 서버가 돌려준 학생회를 넘긴다', async () => {
  const api = mockApi()
  const saved = councilView('c1', { name: '소프트웨어학부 학생회' })
  api.on('POST', '/api/organizations/c1/settings', () => json(saved))
  const onSaved = vi.fn()
  render(<CouncilSettings view={councilView('c1', { permissions: LEADER_PERMISSIONS })} onSaved={onSaved} onForbidden={() => {}} />)
  const form = screen.getByRole('form', { name: '학생회 정보' })
  fireEvent.change(within(form).getByLabelText('학생회 이름'), { target: { value: '소프트웨어학부 학생회' } })
  fireEvent.change(within(form).getByLabelText('회장'), { target: { value: '위원장' } })
  fireEvent.change(within(form).getByLabelText('단위'), { target: { value: 'college' } })
  fireEvent.click(within(form).getByRole('button', { name: '학생회 정보 저장' }))
  expect(await within(form).findByText('저장했어요.')).toBeTruthy()
  expect(api.calls[0]?.body).toEqual({ name: '소프트웨어학부 학생회', unit: 'college', schoolName: '한양대학교 ERICA',
    titles: { president: '위원장', vicePresident: '부회장', head: '부장', viceHead: '부부장' } })
  expect(onSaved).toHaveBeenCalledWith(saved)
})

test('직급 표시 이름을 비우면 저장 버튼이 꺼진다', () => {
  mockApi()
  render(<CouncilSettings view={councilView('c1', { permissions: LEADER_PERMISSIONS })} onSaved={() => {}} onForbidden={() => {}} />)
  const form = screen.getByRole('form', { name: '학생회 정보' })
  fireEvent.change(within(form).getByLabelText('부부장'), { target: { value: '  ' } })
  expect((within(form).getByRole('button', { name: '학생회 정보 저장' }) as HTMLButtonElement).disabled).toBe(true)
})

test('기수 기간이 오늘을 담지 않으면 저장하지 못한 까닭을 보인다', async () => {
  const api = mockApi()
  api.on('POST', '/api/organizations/c1/cohort', () => json({ error: 'COHORT_NOT_CURRENT' }, 409))
  render(<CouncilSettings view={councilView('c1', { permissions: LEADER_PERMISSIONS })} onSaved={() => {}} onForbidden={() => {}} />)
  const form = screen.getByRole('form', { name: '지금 기수' })
  fireEvent.change(within(form).getByLabelText('임기 시작'), { target: { value: '2027-03-01' } })
  fireEvent.change(within(form).getByLabelText('임기 끝'), { target: { value: '2028-02-29' } })
  fireEvent.click(within(form).getByRole('button', { name: '기수 저장' }))
  expect(await within(form).findByText('기간에 오늘이 들어 있어야 해요. 그렇지 않으면 모든 운영진이 학생회를 열 수 없어요.')).toBeTruthy()
  expect(api.calls[0]?.body).toEqual({ name: '2026', startsOn: '2027-03-01', endsOn: '2028-02-29' })
})

test('직급 없는 운영진은 보기만 하고 저장 버튼이 없다', () => {
  const api = mockApi()
  render(<CouncilSettings view={councilView('c1', { councilRank: null, permissions: MEMBER_PERMISSIONS })} onSaved={() => {}} onForbidden={() => {}} />)
  expect(screen.getByText('회장단만 고칠 수 있어요.')).toBeTruthy()
  expect((screen.getByLabelText('학생회 이름') as HTMLInputElement).readOnly).toBe(true)
  expect((screen.getByLabelText('단위') as HTMLSelectElement).disabled).toBe(true)
  expect((screen.getByLabelText('기수 이름') as HTMLInputElement).readOnly).toBe(true)
  expect(screen.queryByRole('button')).toBeNull()
  expect(api.calls).toEqual([])
})
```

`apps/web/src/App.integration.test.tsx` 끝에 더한다:

```tsx

test('옆 메뉴로 운영진 > 부서를 열고, 학생회 이름 메뉴의 설정으로 학생회 정보를 연다', async () => {
  councilsInSequence([myCouncil()])
  openCouncil()
  render(<App />)
  const aside = await screen.findByRole('complementary', { name: '학생회 작업 공간' })
  fireEvent.click(within(aside).getByRole('button', { name: '부서' }))
  expect(await screen.findByRole('heading', { level: 1, name: '부서' })).toBeTruthy()
  expect(await screen.findByText('부서 2개')).toBeTruthy()
  fireEvent.keyDown(within(aside).getByRole('button', { name: '학생회 메뉴: 컴퓨터학부 학생회' }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: '설정' }))
  expect(await screen.findByRole('heading', { level: 1, name: '학생회 정보' })).toBeTruthy()
  expect((screen.getByLabelText('학교') as HTMLInputElement).value).toBe('한양대학교 ERICA')
})
```

Run: `cd apps/web && npx vitest run src/team/Departments.test.tsx src/settings src/App.integration.test.tsx`
Expected: FAIL. `Failed to resolve import "./Departments"`, `Failed to resolve import "./CouncilSettings"`, `App.integration.test.tsx`는 `1 failed | 9 passed`(`"부서"` 버튼을 찾지 못한다)

- [ ] **Step 2: 부서 화면을 만든다**

`apps/web/src/team/Departments.tsx`(이름 칸의 버튼은 `CreateDepartmentSchema`·`UpdateDepartmentSchema`의 `safeParse`로 켠다):

```tsx
import { useState, type FormEvent } from 'react'
import { Ellipsis, Plus } from 'lucide-react'
import { CreateDepartmentSchema, UpdateDepartmentSchema, type CouncilView, type TeamDepartment } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import type { Team } from './useTeam'

const errors: Record<string, string> = {
  DEPARTMENT_NAME_TAKEN: '같은 이름의 부서가 있어요.',
  DEPARTMENT_IN_USE: '부서원이 있었던 부서는 없앨 수 없어요. 이름을 바꿔 쓰세요.',
  FORBIDDEN: '권한이 바뀌었어요. 화면을 새로 불러왔어요.',
  NOT_FOUND: '이미 바뀌었어요. 목록을 새로 불러왔어요.',
}
const failure = '저장하지 못했어요. 다시 시도해 주세요.'

// 운영진 > 부서: 이름, 역할(재정), 부서원 수. 회장단은 부서 만들기와 줄마다 이름 바꾸기, 재정 역할 주고 거두기, 없애기를 본다.
// 없애기는 쓰인 적 없는 부서만 된다(서버가 409로 막는다).
export default function Departments({ view, team }: { view: CouncilView; team: Team }) {
  const { data, loadFailed, saving, change, reload } = team
  const [message, setMessage] = useState('')
  const [newName, setNewName] = useState('')
  const [renaming, setRenaming] = useState<TeamDepartment | null>(null)
  const [name, setName] = useState('')
  if (!data) return loadFailed
    ? <Card className="flex flex-col gap-3 p-6"><StateMessage kind="error">부서를 불러오지 못했어요.</StateMessage>
      <Button variant="outline" className="self-start" onClick={reload}>다시 시도</Button></Card>
    : <StateMessage kind="loading">부서 불러오는 중…</StateMessage>
  const current = data
  const manage = view.permissions.includes('department.manage')
  // 버튼은 서버와 같은 스키마로 판단한다.
  const created = CreateDepartmentSchema.safeParse({ name: newName })
  const renamed = renaming ? UpdateDepartmentSchema.safeParse({ name, role: renaming.role }) : null

  async function run(path: string, body: unknown) {
    setMessage('')
    const code = await change(path, body)
    if (code) setMessage(errors[code] ?? failure)
    return code === null
  }
  const departmentPath = (department: TeamDepartment) => `/departments/${encodeURIComponent(department.id)}`
  async function create(event: FormEvent) {
    event.preventDefault()
    if (created.success && await run('/departments', created.data)) setNewName('')
  }
  async function rename(event: FormEvent) {
    event.preventDefault()
    if (renaming && renamed?.success && await run(departmentPath(renaming), renamed.data)) setRenaming(null)
  }

  return <div className="mx-auto flex max-w-3xl flex-col gap-4">
    <h2 className="text-base font-semibold text-gray-900">부서 {current.departments.length}개</h2>
    {message && !renaming && <StateMessage kind="error">{message}</StateMessage>}
    <Card className="overflow-hidden">
      {current.departments.length === 0 ? <p className="px-4 py-6 text-sm text-gray-500">아직 부서가 없어요.</p>
        : <ul aria-label="부서" className="divide-y">
          {current.departments.map(department => <li key={department.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm wrap-anywhere text-gray-900">{department.name}
                {department.role === 'finance' && <Badge tone="info">재정</Badge>}</p>
              <p className="text-xs text-gray-500">부서원 {department.memberCount}명</p>
            </div>
            {manage && <Menu>
              <MenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`${department.name} 동작`} disabled={saving}><Ellipsis /></Button></MenuTrigger>
              <MenuContent>
                <MenuItem onSelect={() => { setMessage(''); setName(department.name); setRenaming(department) }}>이름 바꾸기</MenuItem>
                <MenuItem onSelect={() => { void run(departmentPath(department), { name: department.name, role: department.role === 'finance' ? null : 'finance' }) }}>
                  {department.role === 'finance' ? '재정 역할 거두기' : '재정 역할 주기'}</MenuItem>
                <MenuItem destructive onSelect={() => { void run(`${departmentPath(department)}/delete`, {}) }}>없애기</MenuItem>
              </MenuContent>
            </Menu>}
          </li>)}
        </ul>}
    </Card>
    {manage && <form aria-label="부서 만들기" className="flex gap-2" onSubmit={event => { void create(event) }}>
      <Input aria-label="새 부서 이름" placeholder="새 부서 이름" value={newName} onChange={event => setNewName(event.target.value)} />
      <Button type="submit" variant="outline" disabled={!created.success || saving}><Plus />부서 만들기</Button>
    </form>}
    <Dialog open={renaming !== null} onOpenChange={open => { if (!open && !saving) { setRenaming(null); setMessage('') } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>부서 이름 바꾸기</DialogTitle></DialogHeader>
        <form aria-label="부서 이름 바꾸기" className="flex flex-col gap-4" onSubmit={event => { void rename(event) }}>
          <Label className="flex flex-col gap-2">부서 이름
            <Input value={name} onChange={event => setName(event.target.value)} />
          </Label>
          {message && <StateMessage kind="error">{message}</StateMessage>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => { setRenaming(null); setMessage('') }}>취소</Button>
            <Button type="submit" disabled={!renamed?.success || saving}>바꾸기</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
}
```

- [ ] **Step 3: 학생회 정보 화면을 만든다**

`apps/web/src/settings/CouncilSettings.tsx`(학생회 정보와 기수는 경로가 달라 저장 버튼을 따로 둔다):

```tsx
import { useState, type FormEvent } from 'react'
import { COUNCIL_UNITS, UpdateCohortSchema, UpdateCouncilSettingsSchema, type CouncilUnit, type CouncilView } from '@vada/contracts'
import { unitLabels } from '../councils/CreateCouncilForm'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { postJson } from '@/lib/api'

type Form = 'council' | 'cohort'
type Message = { form: Form; kind: 'notice' | 'error'; text: string }
const errors: Record<string, string> = {
  COHORT_NOT_CURRENT: '기간에 오늘이 들어 있어야 해요. 그렇지 않으면 모든 운영진이 학생회를 열 수 없어요.',
  FORBIDDEN: '권한이 바뀌었어요. 화면을 새로 불러왔어요.',
}
const failure = '저장하지 못했어요. 다시 시도해 주세요.'
const titleFields = [['president', '회장'], ['vicePresident', '부회장'], ['head', '부장'], ['viceHead', '부부장']] as const

type Props = { view: CouncilView; onSaved: (view: CouncilView) => void; onForbidden: () => void }

// 설정 > 학생회 정보: 이름, 단위, 학교, 직급 표시 이름 4개, 지금 기수의 이름과 기간. 회장단만 고치고, 나머지 운영진은 보기만 한다.
export default function CouncilSettings({ view, onSaved, onForbidden }: Props) {
  const canCouncil = view.permissions.includes('council.update')
  const canCohort = view.permissions.includes('cohort.update')
  const [council, setCouncil] = useState({ name: view.council.name, unit: view.council.unit, schoolName: view.council.schoolName,
    titles: { ...view.council.titles } })
  const [cohort, setCohort] = useState({ name: view.cohort.name, startsOn: view.cohort.startsOn, endsOn: view.cohort.endsOn })
  const [saving, setSaving] = useState<Form | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  // 버튼은 서버와 같은 스키마로 판단한다.
  const councilParsed = UpdateCouncilSettingsSchema.safeParse(council)
  const cohortParsed = UpdateCohortSchema.safeParse(cohort)

  async function save(event: FormEvent, form: Form) {
    event.preventDefault()
    const parsed = form === 'council' ? councilParsed : cohortParsed
    if (!parsed.success || saving) return
    setSaving(form)
    setMessage(null)
    const result = await postJson<CouncilView>(`/api/organizations/${encodeURIComponent(view.council.id)}/${form === 'council' ? 'settings' : 'cohort'}`, parsed.data)
    setSaving(null)
    if (result.ok) {
      setMessage({ form, kind: 'notice', text: '저장했어요.' })
      onSaved(result.data)
      return
    }
    if (result.status === 403) onForbidden()
    setMessage({ form, kind: 'error', text: errors[result.code] ?? failure })
  }
  const note = (form: Form) => message?.form === form && <StateMessage kind={message.kind}>{message.text}</StateMessage>

  return <div className="mx-auto flex max-w-3xl flex-col gap-4">
    {!canCouncil && <p className="text-sm text-gray-500">회장단만 고칠 수 있어요.</p>}
    <Card className="p-6">
      <form aria-label="학생회 정보" className="flex flex-col gap-4" onSubmit={event => { void save(event, 'council') }}>
        <h2 className="text-base font-semibold text-gray-900">학생회 정보</h2>
        <Label className="flex flex-col gap-2">학생회 이름
          <Input value={council.name} readOnly={!canCouncil} onChange={event => setCouncil({ ...council, name: event.target.value })} />
        </Label>
        <Label className="flex flex-col gap-2">단위
          <NativeSelect value={council.unit} disabled={!canCouncil} onChange={event => setCouncil({ ...council, unit: event.target.value as CouncilUnit })}>
            {COUNCIL_UNITS.map(unit => <option key={unit} value={unit}>{unitLabels[unit]}</option>)}
          </NativeSelect>
        </Label>
        <Label className="flex flex-col gap-2">학교
          <Input value={council.schoolName} readOnly={!canCouncil} onChange={event => setCouncil({ ...council, schoolName: event.target.value })} />
        </Label>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xs font-medium text-gray-700">직급 표시 이름</legend>
          <div className="grid grid-cols-2 gap-3">
            {titleFields.map(([key, label]) => <Label key={key} className="flex flex-col gap-1.5 text-gray-500">{label}
              <Input value={council.titles[key]} readOnly={!canCouncil}
                onChange={event => setCouncil({ ...council, titles: { ...council.titles, [key]: event.target.value } })} />
            </Label>)}
          </div>
        </fieldset>
        {note('council')}
        {canCouncil && <Button type="submit" className="self-start" disabled={!councilParsed.success || saving !== null}>
          {saving === 'council' ? '저장하는 중…' : '학생회 정보 저장'}</Button>}
      </form>
    </Card>
    <Card className="p-6">
      <form aria-label="지금 기수" className="flex flex-col gap-4" onSubmit={event => { void save(event, 'cohort') }}>
        <h2 className="text-base font-semibold text-gray-900">지금 기수</h2>
        <Label className="flex flex-col gap-2">기수 이름
          <Input value={cohort.name} readOnly={!canCohort} onChange={event => setCohort({ ...cohort, name: event.target.value })} />
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <Label className="flex flex-col gap-2">임기 시작
            <Input type="date" value={cohort.startsOn} readOnly={!canCohort} onChange={event => setCohort({ ...cohort, startsOn: event.target.value })} />
          </Label>
          <Label className="flex flex-col gap-2">임기 끝
            <Input type="date" value={cohort.endsOn} readOnly={!canCohort} onChange={event => setCohort({ ...cohort, endsOn: event.target.value })} />
          </Label>
        </div>
        {note('cohort')}
        {canCohort && <Button type="submit" className="self-start" disabled={!cohortParsed.success || saving !== null}>
          {saving === 'cohort' ? '저장하는 중…' : '기수 저장'}</Button>}
      </form>
    </Card>
  </div>
}
```

- [ ] **Step 4: 옆 메뉴와 작업 공간에 잇는다**

`apps/web/src/workspace/WorkspaceSidebar.tsx`를 다음으로 바꾼다(옆 메뉴에 부서, 학생회 이름 메뉴에 설정):

```tsx
import { Check, ChevronsUpDown, LogOut, Network, Settings, Users } from 'lucide-react'
import type { CouncilView, MyCouncil } from '@vada/contracts'
import PushSettingsButton from '../push/PushSettings'
import { councilRankLabel, placementsText } from '../team/team-view'
import { Avatar } from '@/components/Avatar'
import { BrandMark } from '@/components/BrandMark'
import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { NavItem } from '@/components/ui/nav-item'

export type Page = 'people' | 'departments' | 'settings'
type Props = {
  council: MyCouncil
  councils: MyCouncil[]
  view: CouncilView | null
  page: Page
  onSelect: (councilId: string) => void
  onPage: (page: Page) => void
  user: { name: string }
  logoutBusy: boolean
  onLogout: () => void
}

// 옆 메뉴(와이어프레임 210px): 위 학생회 이름 메뉴, 가운데 메뉴(바탕에서는 운영진만), 아래 사용자 줄(이름, 휴대폰 알림, 로그아웃).
// 데스크톱 aside와 휴대폰 옆 메뉴(시트)가 같이 쓴다. 위 블록의 오른쪽 여백은 시트 닫기 버튼 자리다.
export default function WorkspaceSidebar({ council, councils, view, page, onSelect, onPage, user, logoutBusy, onLogout }: Props) {
  const position = view && (councilRankLabel(view.me.councilRank, view.council.titles)
    || placementsText({ departments: view.me.departments }, view.me.departments, view.council.titles))
  return <div className="flex h-full min-h-0 flex-col">
    <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 py-3 pr-10 pl-4">
      <BrandMark />
      <Menu>
        <MenuTrigger asChild>
          <Button variant="ghost" className="min-w-0 flex-1 justify-between px-2 text-gray-900" aria-label={`학생회 메뉴: ${council.name}`}>
            <span className="truncate text-sm font-semibold">{council.name}</span><ChevronsUpDown aria-hidden />
          </Button>
        </MenuTrigger>
        <MenuContent align="start">
          <MenuLabel>학생회 고르기</MenuLabel>
          {councils.map(item => <MenuItem key={item.id} onSelect={() => onSelect(item.id)}>
            {item.id === council.id ? <Check aria-hidden /> : <span aria-hidden className="size-4 shrink-0" />}{item.name}
          </MenuItem>)}
          <MenuSeparator />
          <MenuItem onSelect={() => onPage('settings')}><Settings aria-hidden />설정</MenuItem>
        </MenuContent>
      </Menu>
    </div>
    <nav aria-label="학생회 메뉴" className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
      <p className="px-3 pb-1 text-xs font-medium text-gray-400">운영진</p>
      <NavItem active={page === 'people'} className="flex items-center gap-2" onClick={() => onPage('people')}>
        <Users aria-hidden className="size-4" />사람
      </NavItem>
      <NavItem active={page === 'departments'} className="flex items-center gap-2" onClick={() => onPage('departments')}>
        <Network aria-hidden className="size-4" />부서
      </NavItem>
    </nav>
    <footer className="flex shrink-0 items-center gap-2 border-t border-gray-100 px-4 py-3">
      <Avatar />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-gray-700">{user.name}</p>
        {position && <p className="truncate text-xs text-gray-400">{position}</p>}
      </div>
      <PushSettingsButton />
      <Button variant="ghost" size="icon" aria-label="로그아웃" disabled={logoutBusy} onClick={onLogout}><LogOut /></Button>
    </footer>
  </div>
}
```

`apps/web/src/workspace/Workspace.tsx`를 다음으로 바꾼다:

```tsx
import { useEffect, useState } from 'react'
import type { MyCouncil } from '@vada/contracts'
import CouncilSettings from '../settings/CouncilSettings'
import Departments from '../team/Departments'
import People from '../team/People'
import { useTeam } from '../team/useTeam'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useCouncilView } from './useCouncilView'
import WorkspaceHeader from './WorkspaceHeader'
import WorkspaceSidebar, { type Page } from './WorkspaceSidebar'

type Props = {
  councils: MyCouncil[]
  initialCouncilId?: string
  user: { name: string }
  logoutBusy: boolean
  onLogout: () => void
  // 학생회를 잃었을 때(내보내졌거나 기수가 끝남) 내 학생회 목록을 다시 읽게 한다.
  onCouncilsChanged: () => void
}
const titles: Record<Page, { section: string; title: string }> = {
  people: { section: '운영진', title: '사람' },
  departments: { section: '운영진', title: '부서' },
  settings: { section: '설정', title: '학생회 정보' },
}

// 작업 공간 틀. 방금 만들었거나 들어온 학생회가 있으면 그 학생회를 먼저 연다.
export default function Workspace({ councils, initialCouncilId, ...props }: Props) {
  const [councilId, setCouncilId] = useState(() => (councils.find(item => item.id === initialCouncilId) ?? councils[0])?.id)
  const council = councils.find(item => item.id === councilId) ?? councils[0]
  if (!council) return null
  return <CouncilWorkspace key={council.id} {...props} councils={councils} council={council} onSelect={setCouncilId} />
}

function CouncilWorkspace({ council, councils, onSelect, user, logoutBusy, onLogout, onCouncilsChanged }:
  Omit<Props, 'initialCouncilId'> & { council: MyCouncil; onSelect: (councilId: string) => void }) {
  const { state, reload, replace } = useCouncilView(council.id)
  const team = useTeam(council.id, reload)
  const [page, setPage] = useState<Page>('people')
  // 768px 미만에서 옆 메뉴로 연 시트. 메뉴를 고르면 닫는다.
  const [navOpen, setNavOpen] = useState(false)
  useEffect(() => { if (state.kind === 'lost') onCouncilsChanged() }, [state.kind, onCouncilsChanged])
  const view = state.kind === 'ready' ? state.view : null
  const sidebar = <WorkspaceSidebar council={council} councils={councils} view={view} page={page} user={user} logoutBusy={logoutBusy} onLogout={onLogout}
    onSelect={councilId => { setNavOpen(false); onSelect(councilId) }} onPage={next => { setNavOpen(false); setPage(next) }} />
  return <div className="flex h-dvh">
    <aside className="hidden w-60 shrink-0 border-r bg-white md:flex md:flex-col" aria-label="학생회 작업 공간">{sidebar}</aside>
    <Sheet open={navOpen} onOpenChange={setNavOpen}><SheetContent title="학생회 작업 공간">{sidebar}</SheetContent></Sheet>
    <div className="flex min-w-0 flex-1 flex-col">
      <WorkspaceHeader councilName={council.name} section={titles[page].section} title={titles[page].title} onMenu={() => setNavOpen(true)} />
      <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {state.kind === 'lost' ? <StateMessage kind="notice">이 학생회의 운영진이 아니게 되었어요. 학생회 목록으로 돌아가요.</StateMessage>
          : state.kind === 'failed' ? <Card className="flex flex-col gap-3 p-6">
            <StateMessage kind="error">학생회를 불러오지 못했어요. 연결을 확인해 주세요.</StateMessage>
            <Button variant="outline" className="self-start" onClick={reload}>다시 시도</Button>
          </Card>
          : !view ? <StateMessage kind="loading">학생회 불러오는 중…</StateMessage>
          : page === 'people' ? <People view={view} team={team} onCouncilChanged={reload} />
          : page === 'departments' ? <Departments view={view} team={team} />
          // 학생회 이름이 바뀌면 옆 메뉴와 학생회 고르기의 이름도 바뀌도록 내 학생회 목록을 다시 읽는다.
          : <CouncilSettings view={view} onForbidden={reload} onSaved={next => { replace(next); onCouncilsChanged() }} />}
      </main>
    </div>
  </div>
}
```

- [ ] **Step 5: 시험과 타입, 빌드를 본다**

Run: `cd apps/web && npx vitest run src/team src/settings src/App.integration.test.tsx`
Expected: PASS(`Departments.test.tsx` 3, `CouncilSettings.test.tsx` 4, `People.test.tsx` 8, `team-view.test.ts` 3, `App.integration.test.tsx` 10)

Run: `npm run typecheck && npm test --workspace @vada/web && npm run build`
Expected: 타입 오류 없음, 실패 0, 빌드 성공

Run: `git grep -n -e "-\[[0-9#]" -- apps/web/src/councils apps/web/src/workspace apps/web/src/team apps/web/src/settings apps/web/src/components/ui/menu.tsx apps/web/src/components/ConfirmDialog.tsx`
Expected: 아무것도 나오지 않는다(임의 값 클래스가 없다, AGENTS.md 화면 절).

이 작업은 새 부품이 없어 `/ui.html` 확인이 없다. 구현자는 브라우저를 열지 않고(P36), 부서와 학생회 정보 화면은 사람이 '바꾸는 날' 2단계에서 본다.

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src
git commit -m "운영진 > 부서와 설정 > 학생회 정보 화면 더하기"
```

---

### Task 14: 바꾸는 날 준비 — 적용 점검, 시험 데이터, 저장소 규칙

바꾸는 날에 사람이 새 DB에 첫 마이그레이션을 안전하게 적용하도록 `db:migrate`에 대상 표시와 점검, `--dry-run`, `--from-shell`을 더한다(P30). 대상은 `.env`의 DB가 기본이고, 셸의 `DATABASE_URL`은 `--from-shell`을 줄 때만 쓴다. 기록이 없거나 기록 표가 빈 DB는 비어 있어야 하고, 기록이 있으면 로컬 파일과 순서·해시·시각이 같아야 한다. 그래서 옛 DB(옛 마이그레이션 29개)를 가리키면 적용하지 않고 멈춘다. 시험 데이터 스크립트를 새 표로 다시 쓴다(P29). AGENTS.md의 마이그레이션 절을 새 방법(설계 먼저, 첫 마이그레이션은 생성 파일, 새 Neon 가지)으로 바꾸고, README의 파일 지도에 바탕에서 생긴 폴더를 더한다(P35). 이 작업의 명령은 실제 DB에 닿지 않는다.

**Files:**
- Create: `apps/api/src/db/migrate-check.ts`, `apps/api/src/db/migrate-check.test.ts`
- Modify: `apps/api/src/db/migrate.ts`
- Create: `apps/api/scripts/test-data.ts`, `apps/api/scripts/test-data.test.ts`, `apps/api/scripts/manage-test-data.ts`
- Modify: `apps/api/package.json`, `AGENTS.md`, `README.md`

**Interfaces:**
- Consumes: `createTestDb()`, `migrationsFolder`(Task 2), `type Db`, `type Tx`(Task 4), `actorOf(db, userId, councilId, now)`, `koreanDate(now)`(Task 5), `createCouncil(tx, userId, input: CreateCouncilRequest, now): Promise<string>`(Task 6), `joinCouncil(tx, userId, code, now): Promise<string>`(Task 7), `assignDepartment(tx, actor, memberId, departmentId, rank)`(Task 8), `createDepartment(tx, actor, name)`(Task 9), `schema.ts`의 `accounts`, `cohort`, `council`, `councilMembership`, `department`, `inviteCode`, `memberLogin`(Task 3)
- Produces:
  - `type AppliedMigration = { hash: string; createdAt: number }`, `type TargetState = { publicTables: number; applied: AppliedMigration[] | null }`, `type LocalMigration = { hash: string; folderMillis: number }`, `type MigrationCheck = { ok: true; pending: number } | { ok: false; reason: 'NOT_EMPTY' | 'HISTORY_MISMATCH' }`
  - `checkTarget(state, local): MigrationCheck`(`applied`가 `null`이거나 `[]`이면 표가 0개여야 한다), `localMigrations(migrationsFolder): LocalMigration[]`, `readTargetState(query: (text: string) => Promise<Record<string, unknown>[]>): Promise<TargetState>`, `describeTarget(url): string`(호스트와 DB 이름만)
  - `type TargetSource = { source: 'shell'; url: string } | { source: '.env' } | { stop: 'SHELL_URL_WITHOUT_FLAG' | 'FLAG_WITHOUT_SHELL_URL' }`, `targetSourceOf(fromShell: boolean, shellUrl: string | undefined): TargetSource`
  - `TEST_SCHOOL_NAME = 'VADA 시험 학교'`, `TEST_INVITE_CODE = 'TESTDATA'`, `TEST_DEPARTMENTS = { finance: '재정부', planning: '기획부' }`, `type TestDepartment`, `seedTestCouncil(db, userId, now): Promise<string>`, `assignTestMember(db, userId, target, now): Promise<void>`
  - npm 스크립트: `db:migrate`(`-- --dry-run`, `-- --from-shell`), `test-data`(`-- seed <user-id> --apply`, `-- assign <user-id> <planning|finance> --apply`)

- [ ] **Step 1: 실패하는 시험을 쓴다 — 적용 전 점검과 대상 고르기**

`apps/api/src/db/migrate-check.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkTarget, describeTarget, localMigrations, readTargetState, targetSourceOf } from './migrate-check.js'
import { createTestDb, migrationsFolder } from './test-db.js'

const local = [{ hash: 'a', folderMillis: 1 }, { hash: 'b', folderMillis: 2 }]

test('기록이 없는 DB는 비어 있어야 적용한다', () => {
  assert.deepEqual(checkTarget({ publicTables: 0, applied: null }, local), { ok: true, pending: 2 })
  assert.deepEqual(checkTarget({ publicTables: 3, applied: null }, local), { ok: false, reason: 'NOT_EMPTY' })
})

test('기록 표만 있고 줄이 없어도 빈 DB일 때만 적용한다', () => {
  assert.deepEqual(checkTarget({ publicTables: 0, applied: [] }, local), { ok: true, pending: 2 })
  assert.deepEqual(checkTarget({ publicTables: 3, applied: [] }, local), { ok: false, reason: 'NOT_EMPTY' })
})

test('기록이 있으면 로컬과 순서·해시·시각이 같아야 하고, 남은 것만 적용한다', () => {
  assert.deepEqual(checkTarget({ publicTables: 52, applied: [{ hash: 'a', createdAt: 1 }] }, local), { ok: true, pending: 1 })
  assert.deepEqual(checkTarget({ publicTables: 52, applied: [{ hash: 'a', createdAt: 1 }, { hash: 'b', createdAt: 2 }] }, local), { ok: true, pending: 0 })
  for (const applied of [[{ hash: 'x', createdAt: 1 }], [{ hash: 'a', createdAt: 9 }], [{ hash: 'b', createdAt: 2 }],
    [{ hash: 'a', createdAt: 1 }, { hash: 'b', createdAt: 2 }, { hash: 'c', createdAt: 3 }]]) {
    assert.deepEqual(checkTarget({ publicTables: 52, applied }, local), { ok: false, reason: 'HISTORY_MISMATCH' }, JSON.stringify(applied))
  }
})

test('대상은 .env가 기본이고, 셸의 DATABASE_URL은 --from-shell을 줄 때만 쓴다. 어긋나면 멈춘다', () => {
  const url = 'postgres://vada:secret@host/vada'
  assert.deepEqual(targetSourceOf(false, undefined), { source: '.env' })
  assert.deepEqual(targetSourceOf(false, '   '), { source: '.env' })
  assert.deepEqual(targetSourceOf(true, ` ${url} `), { source: 'shell', url })
  assert.deepEqual(targetSourceOf(false, url), { stop: 'SHELL_URL_WITHOUT_FLAG' })
  assert.deepEqual(targetSourceOf(true, undefined), { stop: 'FLAG_WITHOUT_SHELL_URL' })
  assert.deepEqual(targetSourceOf(true, ''), { stop: 'FLAG_WITHOUT_SHELL_URL' })
})

test('마이그레이션을 적용한 DB의 상태를 읽으면 로컬과 같고 남은 것이 없다', async () => {
  const { pg, close } = await createTestDb()
  try {
    const state = await readTargetState(async text => (await pg.query<Record<string, unknown>>(text)).rows)
    assert.equal(state.publicTables, 52)
    assert.deepEqual(checkTarget(state, localMigrations(migrationsFolder)), { ok: true, pending: 0 })
  } finally {
    await close()
  }
})

test('대상 설명에는 호스트와 DB 이름만 나온다', () => {
  assert.equal(describeTarget('postgres://vada:secret-password@ep-cool-1234.ap-southeast-1.aws.neon.tech/vada?sslmode=require'),
    'ep-cool-1234.ap-southeast-1.aws.neon.tech/vada')
  assert.ok(!describeTarget('postgres://vada:secret-password@host/db').includes('secret'))
  assert.equal(describeTarget('not a url'), '(주소를 읽지 못했다)')
})
```

Run: `cd apps/api && npx tsx --test src/db/migrate-check.test.ts`
Expected: FAIL (`Cannot find module` … `migrate-check.js`)

- [ ] **Step 2: 적용 전 점검과 대상 고르기를 만든다**

`apps/api/src/db/migrate-check.ts`:

```ts
import { readMigrationFiles } from 'drizzle-orm/migrator'

export type AppliedMigration = { hash: string; createdAt: number }
// applied가 null이면 drizzle 적용 기록 표가 없다(마이그레이션을 한 번도 적용하지 않은 DB).
export type TargetState = { publicTables: number; applied: AppliedMigration[] | null }
export type LocalMigration = { hash: string; folderMillis: number }
export type MigrationCheck = { ok: true; pending: number } | { ok: false; reason: 'NOT_EMPTY' | 'HISTORY_MISMATCH' }

// 적용 전 점검(AGENTS.md 마이그레이션 절). 기록이 없는 DB는 비어 있어야 한다(바꾸는 날의 새 DB).
// 기록 표만 있고 줄이 없어도 같다. 기록이 있으면 로컬 파일과 순서·해시·시각까지 같아야 한다. 옛 DB(옛 마이그레이션 29개)를 가리키면 여기서 멈춘다.
export function checkTarget(state: TargetState, local: readonly LocalMigration[]): MigrationCheck {
  if (!state.applied?.length) return state.publicTables === 0 ? { ok: true, pending: local.length } : { ok: false, reason: 'NOT_EMPTY' }
  if (state.applied.length > local.length) return { ok: false, reason: 'HISTORY_MISMATCH' }
  const same = state.applied.every((applied, index) => applied.hash === local[index]!.hash && applied.createdAt === local[index]!.folderMillis)
  return same ? { ok: true, pending: local.length - state.applied.length } : { ok: false, reason: 'HISTORY_MISMATCH' }
}

// 적용 대상. 기본은 이 프로젝트의 .env다. 셸의 DATABASE_URL은 --from-shell을 줄 때만 쓴다.
// 셸에 남은 주소로 모르게 배포 DB에 적용하지 않도록, 플래그 없이 셸에 주소가 있으면 멈춘다.
export type TargetSource = { source: 'shell'; url: string } | { source: '.env' } | { stop: 'SHELL_URL_WITHOUT_FLAG' | 'FLAG_WITHOUT_SHELL_URL' }
export function targetSourceOf(fromShell: boolean, shellUrl: string | undefined): TargetSource {
  const url = shellUrl?.trim()
  if (fromShell) return url ? { source: 'shell', url } : { stop: 'FLAG_WITHOUT_SHELL_URL' }
  return url ? { stop: 'SHELL_URL_WITHOUT_FLAG' } : { source: '.env' }
}

export const localMigrations = (migrationsFolder: string): LocalMigration[] =>
  readMigrationFiles({ migrationsFolder }).map(({ hash, folderMillis }) => ({ hash, folderMillis }))

// 대상 DB의 상태를 읽기만 한다. query는 SQL 하나를 실행해 행을 돌려준다(postgres-js의 unsafe, PGlite의 query 모두 맞춘다).
export async function readTargetState(query: (text: string) => Promise<Record<string, unknown>[]>): Promise<TargetState> {
  const [tables] = await query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'")
  const [history] = await query("SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present")
  const applied = history?.present
    ? (await query('SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at')).map(row => ({ hash: String(row.hash), createdAt: Number(row.created_at) }))
    : null
  return { publicTables: Number(tables?.n ?? 0), applied }
}

// 화면에 찍을 대상: 호스트와 DB 이름만. 사용자 이름과 비밀번호, 쿼리는 찍지 않는다.
export function describeTarget(url: string) {
  try {
    const parsed = new URL(url)
    return `${parsed.hostname}${parsed.pathname}`
  } catch {
    return '(주소를 읽지 못했다)'
  }
}
```

Run: `cd apps/api && npx tsx --test src/db/migrate-check.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 3: 적용 스크립트가 대상을 고르고 찍고 점검하게 한다**

`apps/api/src/db/migrate.ts`를 다음으로 바꾼다:

```ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { checkTarget, describeTarget, localMigrations, readTargetState, targetSourceOf } from './migrate-check.js'

const migrationsFolder = fileURLToPath(new URL('../../migrations', import.meta.url))

// 사용법(3e092f7 이후): npm run db:migrate --workspace @vada/api -- [--apply] [--dry-run] [--from-shell]. 기본은 미리 보기다
// 대상은 이 프로젝트의 .env다. 다른 DB(배포)는 셸에 DATABASE_URL을 주고 --from-shell을 붙일 때만 쓴다.
// 셸에 DATABASE_URL이 있는데 --from-shell이 없으면 멈춘다. 남은 셸 주소로 모르게 배포 DB에 적용하지 않는다.
// 적용 전에 대상을 점검한다: 기록이 없으면 빈 DB여야 하고, 기록이 있으면 로컬 파일과 순서·해시가 같아야 한다.
// --dry-run은 대상과 점검 결과만 찍고 아무것도 바꾸지 않는다.
async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const target = targetSourceOf(process.argv.includes('--from-shell'), process.env.DATABASE_URL)
  if ('stop' in target) {
    console.error(target.stop === 'SHELL_URL_WITHOUT_FLAG'
      ? '셸에 DATABASE_URL이 있다. 그 DB에 적용하려면 --from-shell을 붙이고, .env의 DB에 적용하려면 셸의 DATABASE_URL을 지운다. 아무것도 하지 않았다.'
      : '--from-shell을 줬지만 셸에 DATABASE_URL이 없다. 아무것도 하지 않았다.')
    process.exitCode = 1
    return
  }
  const url = target.source === 'shell' ? target.url : parseEnv(readFileSync(new URL('../../../../.env', import.meta.url), 'utf8')).DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is missing')
  console.log(`대상: ${describeTarget(url)} (${target.source === 'shell' ? '셸의 DATABASE_URL' : '.env'})`)
  const client = postgres(url, { max: 1, ssl: { rejectUnauthorized: true }, connect_timeout: 15, onnotice: () => {} })
  try {
    const local = localMigrations(migrationsFolder)
    const state = await readTargetState(async text => [...await client.unsafe(text)])
    console.log(`public 표 ${state.publicTables}개, 적용 기록 ${state.applied?.length ?? '없음'}, 로컬 마이그레이션 ${local.length}개`)
    const check = checkTarget(state, local)
    if (!check.ok) {
      console.error(check.reason === 'NOT_EMPTY'
        ? '적용 기록이 없는데 표가 있다. 빈 DB가 아니므로 적용하지 않는다.'
        : '이미 적용된 기록이 로컬 마이그레이션과 순서나 해시가 다르다. 적용하지 않는다.')
      process.exitCode = 1
      return
    }
    if (dryRun) {
      console.log(`적용할 마이그레이션 ${check.pending}개. --dry-run이라 바꾸지 않았다.`)
      return
    }
    await migrate(drizzle(client), { migrationsFolder })
    console.log(`마이그레이션 적용 완료(${check.pending}개)`)
  } finally {
    await client.end({ timeout: 5 })
  }
}

main().catch((error: unknown) => {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  console.error('마이그레이션 실패. 연결 문자열과 오류 원문은 출력하지 않습니다.',
    /^[A-Z0-9_]+$/.test(code) ? code : '')
  process.exitCode = 1
})
```

닿을 수 없는 주소로 멈추는 길과 실패 길만 본다. 아래 두 명령은 어떤 DB에도 닿지 않는다. `DATABASE_URL=…`을 빼고 실행하지 않는다(빼면 `.env`의 개발 DB에 닿는다).

Run: `cd apps/api && DATABASE_URL='postgres://someone:secret-pw@127.0.0.1:1/vada_x?sslmode=require' npx tsx src/db/migrate.ts --dry-run; echo "exit=$?"`
Expected(셸에 주소가 있는데 `--from-shell`이 없어 `.env`도 읽지 않고 멈춘다):
```
셸에 DATABASE_URL이 있다. 그 DB에 적용하려면 --from-shell을 붙이고, .env의 DB에 적용하려면 셸의 DATABASE_URL을 지운다. 아무것도 하지 않았다.
exit=1
```

Run: `cd apps/api && DATABASE_URL='postgres://someone:secret-pw@127.0.0.1:1/vada_x?sslmode=require' npx tsx src/db/migrate.ts --from-shell --dry-run; echo "exit=$?"`
Expected:
```
대상: 127.0.0.1/vada_x (셸의 DATABASE_URL)
마이그레이션 실패. 연결 문자열과 오류 원문은 출력하지 않습니다. ECONNREFUSED
exit=1
```
(`someone`과 `secret-pw`가 찍히지 않는다)

- [ ] **Step 4: 실패하는 시험을 쓴다 — 시험 데이터**

`apps/api/scripts/test-data.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PGlite } from '@electric-sql/pglite'
import { createTestDb } from '../src/db/test-db.js'
import { assignTestMember, seedTestCouncil, TEST_INVITE_CODE } from './test-data.js'

const now = new Date('2026-10-19T03:00:00Z')

async function googleUser(pg: PGlite, id: string) {
  await pg.query('INSERT INTO users (id, name, email) VALUES ($1, $1, $2)', [id, `${id}@example.test`])
  await pg.query("INSERT INTO accounts (id, user_id, provider_id, account_id) VALUES ($1, $2, 'google', $3)", [`a-${id}`, id, `sub-${id}`])
}

test('시험 학생회는 다시 돌려도 하나이고, 회장, 초대 코드 TESTDATA, 재정부와 기획부를 맞춘다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    await googleUser(pg, 'u1')
    await googleUser(pg, 'u2')
    await pg.query("INSERT INTO users (id, name, email) VALUES ('no-google', 'x', 'x@example.test')")
    await assert.rejects(seedTestCouncil(db, 'no-google', now))
    const first = await seedTestCouncil(db, 'u1', now)
    // 화면에서 코드를 바꾼 뒤에 다시 돌려도 TESTDATA로 돌아온다.
    await pg.query("UPDATE invite_code SET code = 'ZZZZ2222'")
    assert.equal(await seedTestCouncil(db, 'u1', now), first)
    assert.equal((await pg.query('SELECT 1 FROM council')).rows.length, 1)
    assert.deepEqual((await pg.query('SELECT code FROM invite_code')).rows, [{ code: TEST_INVITE_CODE }])
    assert.deepEqual((await pg.query('SELECT name, role FROM department ORDER BY id')).rows, [{ name: '재정부', role: 'finance' }, { name: '기획부', role: null }])
    assert.deepEqual((await pg.query(`SELECT ml.user_id FROM council_membership cm JOIN member_login ml ON ml.member_id = cm.member_id
      WHERE cm.council_rank = 'president'`)).rows, [{ user_id: 'u1' }])
    await assert.rejects(seedTestCouncil(db, 'u2', now))
  } finally {
    await close()
  }
})

test('부서원 넣기는 다시 돌려도 같고, 이미 다른 부서인 사람은 바꾸지 않는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    for (const user of ['u1', 'u2', 'u3']) await googleUser(pg, user)
    await assert.rejects(assignTestMember(db, 'u2', 'planning', now))
    await seedTestCouncil(db, 'u1', now)
    await assignTestMember(db, 'u2', 'planning', now)
    await assignTestMember(db, 'u2', 'planning', now)
    await assert.rejects(assignTestMember(db, 'u2', 'finance', now))
    await assignTestMember(db, 'u3', 'finance', now)
    const rows = await pg.query(`SELECT ml.user_id, d.name FROM department_membership dm JOIN department d ON d.id = dm.department_id
      JOIN member_login ml ON ml.member_id = dm.member_id WHERE dm.ends_at IS NULL ORDER BY ml.user_id`)
    assert.deepEqual(rows.rows, [{ user_id: 'u2', name: '기획부' }, { user_id: 'u3', name: '재정부' }])
    assert.equal((await pg.query('SELECT 1 FROM council_membership')).rows.length, 3)
  } finally {
    await close()
  }
})
```

Run: `cd apps/api && npx tsx --test scripts/test-data.test.ts`
Expected: FAIL (`Cannot find module` … `test-data.js`)

- [ ] **Step 5: 시험 데이터 스크립트를 쓴다**

`apps/api/scripts/test-data.ts`:

```ts
import { and, eq, gte, isNull, lte } from 'drizzle-orm'
import { actorOf, koreanDate } from '../src/access/actor.js'
import { createCouncil } from '../src/councils/service.js'
import { accounts, cohort, council, councilMembership, department, inviteCode, memberLogin } from '../src/db/schema.js'
import { joinCouncil } from '../src/invites/service.js'
import type { Db, Tx } from '../src/records/records.js'
import { assignDepartment, createDepartment } from '../src/team/service.js'

// 개발 DB의 시험 학생회. 학교 이름으로 찾고, 초대 코드는 늘 TESTDATA다(/join/TESTDATA로 들어온다).
// 다시 돌려도 같은 결과가 나온다. 시연 데이터는 덩어리 6에서 다시 쓴다.
export const TEST_SCHOOL_NAME = 'VADA 시험 학교'
export const TEST_INVITE_CODE = 'TESTDATA'
export const TEST_DEPARTMENTS = { finance: '재정부', planning: '기획부' } as const
export type TestDepartment = keyof typeof TEST_DEPARTMENTS

async function requireGoogleUser(tx: Tx, userId: string) {
  const [account] = await tx.select({ id: accounts.id }).from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'google'))).limit(1)
  if (!account) throw new Error('An existing Google user is required')
}

async function testCouncilId(tx: Tx) {
  const found = await tx.select({ id: council.id }).from(council).where(eq(council.schoolName, TEST_SCHOOL_NAME))
  if (found.length > 1) throw new Error('More than one test council')
  return found[0]?.id
}

// 지금 기수의 회장이 쓰는 로그인 계정
async function presidentUserOf(tx: Tx, councilId: string, now: Date) {
  const today = koreanDate(now)
  const [row] = await tx.select({ userId: memberLogin.userId }).from(councilMembership)
    .innerJoin(cohort, eq(cohort.id, councilMembership.cohortId))
    .innerJoin(memberLogin, eq(memberLogin.memberId, councilMembership.memberId))
    .where(and(eq(cohort.councilId, councilId), lte(cohort.startsOn, today), gte(cohort.endsOn, today),
      eq(councilMembership.councilRank, 'president'), isNull(councilMembership.endsAt)))
  return row?.userId
}

// 시험 학생회를 둔다. 회장은 주어진 Google 계정이다. 이미 있으면 회장이 같은지 보고, 초대 코드와 기획부를 맞춘다.
export async function seedTestCouncil(db: Db, userId: string, now: Date): Promise<string> {
  return db.transaction(async tx => {
    await requireGoogleUser(tx, userId)
    let councilId = await testCouncilId(tx)
    if (!councilId) {
      const year = koreanDate(now).slice(0, 4)
      councilId = await createCouncil(tx, userId, { name: 'VADA 시험 학생회', unit: 'department', schoolName: TEST_SCHOOL_NAME,
        cohortName: year, startsOn: `${year}-01-01`, endsOn: `${year}-12-31` }, now)
    } else if (await presidentUserOf(tx, councilId, now) !== userId) {
      throw new Error('Test council has another president')
    }
    await tx.update(inviteCode).set({ code: TEST_INVITE_CODE }).where(eq(inviteCode.councilId, councilId))
    const actor = await actorOf(tx, userId, councilId, now)
    if (!actor) throw new Error('Test council has no current cohort')
    const [planning] = await tx.select({ id: department.id }).from(department)
      .where(and(eq(department.councilId, councilId), eq(department.name, TEST_DEPARTMENTS.planning)))
    if (!planning) await createDepartment(tx, actor, TEST_DEPARTMENTS.planning)
    return councilId
  })
}

// 기존 Google 계정을 시험 학생회의 부서원으로 넣는다. 이미 다른 부서면 바꾸지 않고 실패한다.
export async function assignTestMember(db: Db, userId: string, target: TestDepartment, now: Date) {
  await db.transaction(async tx => {
    await requireGoogleUser(tx, userId)
    const councilId = await testCouncilId(tx)
    if (!councilId) throw new Error('Seed the test council first')
    const presidentUser = await presidentUserOf(tx, councilId, now)
    if (!presidentUser) throw new Error('Test council has no president')
    await joinCouncil(tx, userId, TEST_INVITE_CODE, now)
    const president = await actorOf(tx, presidentUser, councilId, now)
    const member = await actorOf(tx, userId, councilId, now)
    if (!president || !member) throw new Error('Test council has no current cohort')
    const [wanted] = await tx.select({ id: department.id }).from(department)
      .where(and(eq(department.councilId, councilId), eq(department.name, TEST_DEPARTMENTS[target])))
    if (!wanted) throw new Error('Seed the test council first')
    if (member.departments.some(item => item.departmentId !== wanted.id)) throw new Error('Existing department assignment cannot be overwritten')
    await assignDepartment(tx, president, member.memberId, wanted.id, null)
  })
}
```

`apps/api/scripts/manage-test-data.ts`(인자가 맞을 때만 `.env`를 읽는다. 사람만 실행한다):

```ts
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { assignTestMember, seedTestCouncil, type TestDepartment } from './test-data.js'

// 사용법(저장소 맨 위에서):
//   npm run test-data --workspace @vada/api -- seed <user-id> --apply           시험 학생회를 두고 그 계정을 회장으로 둔다
//   npm run test-data --workspace @vada/api -- assign <user-id> <planning|finance> --apply   그 계정을 부서원으로 넣는다
// 명시적으로 실행한 경우에만 이 프로젝트 .env의 개발 DB에 연결한다. 사람만 실행한다.
async function main() {
  const args = process.argv.slice(2)
  const isSeed = args.length === 3 && args[0] === 'seed' && Boolean(args[1]?.trim()) && args[2] === '--apply'
  const isAssign = args.length === 4 && args[0] === 'assign' && Boolean(args[1]?.trim())
    && (args[2] === 'planning' || args[2] === 'finance') && args[3] === '--apply'
  if (!isSeed && !isAssign) {
    console.error('사용법: seed <user-id> --apply 또는 assign <user-id> <planning|finance> --apply')
    process.exitCode = 1
    return
  }
  const env = parseEnv(readFileSync(new URL('../../../.env', import.meta.url), 'utf8'))
  if (!env.DATABASE_URL) throw new Error('Missing configuration')
  const client = postgres(env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: true }, connect_timeout: 15, onnotice: () => {} })
  try {
    const db = drizzle(client)
    if (isSeed) await seedTestCouncil(db, args[1]!, new Date())
    else await assignTestMember(db, args[1]!, args[2] as TestDepartment, new Date())
    console.log(isSeed ? '시험 학생회 준비 완료(초대 코드 TESTDATA)' : '시험 학생회 부서 배정 완료')
  } finally {
    await client.end({ timeout: 5 })
  }
}

main().catch(() => {
  console.error('처리 실패. DB 연결, 기존 Google 계정, 시험 학생회의 회장과 부서를 확인하세요. 오류 원문은 출력하지 않습니다.')
  process.exitCode = 1
})
```

Run: `cd apps/api && npx tsx --test scripts/test-data.test.ts`
Expected: PASS (2 tests)

Run: `cd apps/api && npx tsx scripts/manage-test-data.ts seed; echo "exit=$?"`
Expected: `사용법: seed <user-id> --apply 또는 assign <user-id> <planning|finance> --apply`, `exit=1`(인자가 모자라 `.env`를 읽기 전에 멈춘다)

- [ ] **Step 6: npm 스크립트와 시험 목록을 더한다**

`apps/api/package.json`의 `test` 스크립트 끝에 ` src/db/migrate-check.test.ts scripts/test-data.test.ts`를 더하고, `"db:migrate"` 줄 아래에 `"test-data": "tsx scripts/manage-test-data.ts"`를 더한다. 다 하면 `scripts`는 다음과 같다(덩어리 1이 더한 시험 파일이 이 목록 밖에 더 있으면 그것도 남긴다):

```json
  "scripts": {
    "dev": "tsx watch src/serve.ts",
    "start": "tsx src/serve.ts --production",
    "typecheck": "tsc --noEmit",
    "test": "tsx --test src/app.test.ts src/runtime.test.ts src/web.test.ts src/auth/auth.test.ts src/http/boundary.test.ts src/http/sentry.test.ts src/storage/storage.test.ts src/push/config.test.ts src/push/endpoint.test.ts src/push/sender.test.ts src/push/routes.test.ts src/db/baseline.test.ts scripts/design-sql.test.ts src/db/schema-match.test.ts scripts/catalog.test.ts src/records/records.test.ts src/access/permissions.test.ts src/access/actor.test.ts src/councils/link.test.ts src/councils/councils.test.ts src/invites/invites.test.ts src/team/team.test.ts src/team/flow.test.ts src/team/departments.test.ts src/councils/settings.test.ts src/push/devices.test.ts src/db/migrate-check.test.ts scripts/test-data.test.ts",
    "db:generate": "drizzle-kit generate --custom",
    "check:design": "tsx scripts/check-design.ts",
    "db:migrate": "tsx src/db/migrate.ts",
    "test-data": "tsx scripts/manage-test-data.ts"
  },
```

Run: `cd apps/api && node -e "const fs=require('fs'),path=require('path');const list=require('./package.json').scripts.test.split(' ').slice(2);const files=['src','scripts'].flatMap(d=>fs.readdirSync(d,{recursive:true}).map(f=>[d,...f.split(path.sep)].join('/'))).filter(f=>f.endsWith('.test.ts'));console.log([...list.filter(f=>!fs.existsSync(f)).map(f=>'없음 '+f),...files.filter(f=>!list.includes(f)).map(f=>'목록 밖 '+f)].join(', ')||'ok')"`
Expected: `ok`(목록의 시험 파일이 모두 있고, 목록 밖 시험 파일이 없다)

- [ ] **Step 7: 저장소 규칙의 마이그레이션 절과 README를 바꾼다**

`AGENTS.md`의 `## 마이그레이션` 절 전체(제목 아래 다섯 줄)를 다음으로 바꾼다:

```markdown
## 마이그레이션
- 표를 바꿀 때는 vada-docs의 `physical-model.md`를 먼저 고친다. 그다음 `npm run db:generate --workspace @vada/api`(`drizzle-kit generate --custom`)로 빈 마이그레이션을 만들어 SQL을 쓰고, 조회용 정의 `apps/api/src/db/schema.ts`를 같이 고친다. CI의 맞춤 시험(`src/db/schema-match.test.ts`)이 정의와 마이그레이션 DB를, 로컬의 `npm run check:design --workspace @vada/api`가 마이그레이션 DB와 설계를 맞댄다.
- 첫 마이그레이션 `0000_baseline.sql`은 `apps/api/scripts/baseline-from-design.ts`가 physical-model.md에서 만든 파일이다. 손으로 고치거나 다시 만들지 않는다.
- 서버 시작 시 자동으로 적용하지 않는다. 적용 대상은 Neon 프로젝트 `vada`의 `dev` 가지(개발, 로컬 `.env`의 `DATABASE_URL`)와 `production` 가지(배포) 두 곳이다.
- 적용은 사람이 `npm run db:migrate --workspace @vada/api -- --apply`로 한다(3e092f7). `--apply`가 없으면 미리 보기라 쓰지 않는다. 모르는 인자나 `--` 없이 준 `--dry-run`은 연결하기 전에 멈춘다. 먼저 `--apply` 없이 돌려 대상(호스트와 DB 이름)과 적용할 개수를 본다. 대상은 `.env`의 DB가 기본이다. 배포 DB에는 셸에 `DATABASE_URL`을 주고 `-- --from-shell`을 붙인다(적용은 `-- --from-shell --apply`). 셸에 `DATABASE_URL`이 있는데 `--from-shell`이 없으면 아무것도 하지 않고 멈춘다. 적용 기록이 없거나 기록 표가 비었는데 표가 있으면, 또는 이미 적용된 기록이 로컬 파일과 순서·해시까지 같지 않으면 적용하지 않는다.
- 제약을 추가하는 마이그레이션은 코드 배포 → 두 DB에서 위반 행이 0건인지 조회 → 적용 순서로 한다.
- 새 컬럼을 읽는 코드는 반대로, 두 DB에 마이그레이션을 먼저 적용한 뒤 배포한다. 코드가 먼저 나가면 없는 컬럼을 읽다가 해당 요청이 모두 실패한다. 새 컬럼에 거는 제약은 위반 행이 생길 수 없으므로 이 순서를 따르고, 기존 컬럼에 거는 제약과는 한 마이그레이션에 섞지 않는다.
- 칸·표를 지우는 마이그레이션은 그것을 읽지 않는 코드를 먼저 배포한 뒤 적용한다. 적용 스크립트가 남은 마이그레이션을 모두 적용하므로, 지우는 마이그레이션 파일은 배포 뒤에 만든다.
- `.sql` 파일은 `.gitattributes`로 LF로 고정한다. drizzle이 남기는 적용 기록의 해시가 파일 내용 기준이라, 줄바꿈이 바뀌면 기록과 어긋나 보인다.
- 개발 DB의 시험 학생회는 사람이 `npm run test-data --workspace @vada/api -- seed <user-id> --apply`로 둔다(초대 코드 `TESTDATA`). 부서원은 `-- assign <user-id> <planning|finance> --apply`로 넣는다.
```

`AGENTS.md`의 `## 검사` 절에서 타입 검사 줄 아래에 더한다:

```markdown
- 설계 검사(로컬, 옆 폴더 `../vada-docs` 필요): `npm run check:design --workspace @vada/api`
```

`README.md`를 다음으로 바꾼다(Task 1의 지도에 바탕에서 생긴 폴더를 더했다):

````markdown
```text
vada-m1/
├─ AGENTS.md                  # 저장소 규칙. 에이전트와 사람이 같이 따른다
├─ .github/workflows/         # CI
├─ apps/
│  ├─ api/                    # API 서버(Hono, better-auth, drizzle)
│  │  ├─ migrations/          # 마이그레이션. 0000_baseline은 vada-docs physical-model.md에서 만든다(.sql은 LF)
│  │  ├─ scripts/             # 첫 마이그레이션 만들기, 설계 검사(check:design), 시험 데이터
│  │  └─ src/
│  │     ├─ access/           # 지금 소속(actorOf)과 권한표(can)
│  │     ├─ auth/             # Google 로그인과 세션 확인
│  │     ├─ councils/         # 로그인 잇기, 학생회 만들기·보기·설정
│  │     ├─ db/               # 조회용 표 정의, 시험 DB, 마이그레이션 적용
│  │     ├─ http/             # 공통 가드, 입력 검사, 오류 처리, Sentry
│  │     ├─ invites/          # 초대 코드와 들어오기
│  │     ├─ push/             # 휴대폰 알림과 알림 받을 기기
│  │     ├─ records/          # 기록과 판. 모든 쓰기가 거친다
│  │     ├─ storage/          # 영수증 저장소(R2). 쓰는 기능은 구매와 지출 덩어리가 다시 만든다
│  │     ├─ team/             # 운영진과 부서 편성
│  │     └─ test-support/     # 시험용 학생회와 요청
│  └─ web/                    # 화면(React, Vite, Tailwind)
│     ├─ public/              # 홈 화면 설정, 아이콘, 서비스 워커
│     └─ src/
│        ├─ auth/             # 로그인 화면
│        ├─ components/       # 화면 부품(ui/는 기본 부품)
│        ├─ councils/         # 학생회 없음, 만들기, 초대 링크, 내 학생회 목록
│        ├─ lib/
│        ├─ push/             # 휴대폰 알림 대화상자
│        ├─ settings/         # 설정 > 학생회 정보
│        ├─ team/             # 운영진 > 사람·부서
│        ├─ test-support/
│        ├─ ui-gallery/       # 부품 확인 화면(/ui.html)
│        └─ workspace/        # 작업 공간 틀
├─ docs/
│  ├─ device-checks.md        # 실제 기기 확인 기록
│  └─ superpowers/            # 설계서(specs)와 구현 계획(plans)
└─ packages/
   └─ contracts/              # 요청 스키마와 응답 타입(zod). 화면과 서버가 같이 쓴다
```
````

Run: `git grep -n -e "m1-preview" -e "브랜치" -- AGENTS.md`
Expected: 아무것도 나오지 않는다(옛 DB 이름이 남지 않았다).

Run: `for dir in apps/api/src/access apps/api/src/councils apps/api/src/invites apps/api/src/records apps/api/src/storage apps/api/src/team apps/api/src/test-support apps/api/scripts apps/web/src/councils apps/web/src/settings apps/web/src/team apps/web/src/workspace; do test -d "$dir" || echo "없음: $dir"; done`
Expected: 아무것도 찍히지 않는다(README의 폴더가 모두 있다).

- [ ] **Step 8: 전체 검사를 돌린다**

Run: `npm run typecheck`
Expected: 타입 오류 없음

Run: `cd apps/api && npx tsx --test --test-concurrency=2 $(node -p "require('./package.json').scripts.test.replace('tsx --test ', '')")`
Expected: `# fail 0`

Run: `npm test --workspace @vada/contracts && npm test --workspace @vada/web && npm run build`
Expected: 실패 0, 빌드 성공

Run: `npm run check:design --workspace @vada/api`
Expected: `설계와 같다: 45개 표 (…physical-model.md)`(worktree에서는 `-- <vada-docs 폴더>/physical-model.md`를 붙인다, P6)

- [ ] **Step 9: 커밋**

```bash
git add apps/api/src/db/migrate-check.ts apps/api/src/db/migrate-check.test.ts apps/api/src/db/migrate.ts apps/api/scripts apps/api/package.json AGENTS.md README.md
git commit -m "바꾸는 날 적용 점검과 시험 데이터 다시 쓰기"
```

---

## 바꾸는 날 (사람이 한다)

Task 1~14와 리뷰가 끝난 뒤, 사용자가 아래 차례로 한다(spec '바꾸는 날', 다시 만들기 설계서 '바꾸는 날'). 에이전트는 이 절의 명령을 실행하지 않고, push하지 않는다. Neon 프로젝트 `vada`(PostgreSQL 18, 지금 DB와 같은 지역, 기본 가지 `production`과 거기서 딴 `dev` 가지)는 바탕 전에 만들어 둔다.

1. **개발 DB 바꾸기:** 로컬 `.env`의 `DATABASE_URL`을 `vada`의 `dev` 가지 주소로 바꾼다. 이제부터 개발은 이 DB를 쓴다. 셸에 `DATABASE_URL`이 남아 있으면 지운다(남아 있으면 `db:migrate`가 멈춘다, P30).
2. **개발 DB에 적용하고 화면 보기**
   1. `npm run db:migrate --workspace @vada/api -- --dry-run`
      - 보이는 것: `대상: <dev 가지 호스트>/<DB 이름> (.env)`, `public 표 0개, 적용 기록 없음, 로컬 마이그레이션 1개`, `적용할 마이그레이션 1개. 미리 보기라 바꾸지 않았다. 실제로 적용하려면 --apply를 붙인다.`
      - 대상이 `dev` 가지가 아니거나 "…적용하지 않는다"나 "…아무것도 하지 않았다"로 끝나는 줄이 나오면 멈춘다. 옛 DB를 가리키면 옛 적용 기록 29개가 로컬과 달라 "이미 적용된 기록이 로컬 마이그레이션과 순서나 해시가 다르다"가 나온다.
   2. `npm run db:migrate --workspace @vada/api -- --apply` → `마이그레이션 적용 완료(1개)`. 다시 `-- --dry-run`을 하면 `public 표 52개, 적용 기록 1, 로컬 마이그레이션 1개`, `적용할 마이그레이션 0개`다.
   3. `npm run dev:api`와 `npm run dev:web`을 켜고 `http://127.0.0.1:5180`에서 Google로 로그인한다. 같은 브라우저로 `http://127.0.0.1:5180/api/auth/get-session`을 열어 `user`의 `id`를 본다.
   4. `npm run test-data --workspace @vada/api -- seed <user-id> --apply` → `시험 학생회 준비 완료(초대 코드 TESTDATA)`. 다른 Google 계정은 `/join/TESTDATA`로 들어오거나, 로그인을 한 번 한 뒤 `-- assign <user-id> planning --apply`로 기획부에 넣는다.
   5. 휴대폰 폭(390px)과 데스크톱 폭에서 본다: 학생회 없음(시험 학생회에 들지 않은 계정), 학생회 만들기, 초대 링크, 운영진 > 사람(초대 링크, ⋯ 메뉴, 확인 대화상자), 운영진 > 부서, 설정 > 학생회 정보, 휴대폰 알림 켜기. 기준은 vada-docs의 navigation.md와 screens.md이고, Figma(M1 와이어프레임)는 같은 화면이 있을 때만 맞댄다(P36). 고칠 것이 나오면 이 계획의 화면 작업처럼 시험부터 고친다.
   6. 동시 처리를 실제 PostgreSQL에서 본다(PGlite 시험은 거래를 하나씩 돌려 보지 못한다): 두 브라우저(또는 두 기기)에서 같은 계정으로 `/join/TESTDATA`의 [들어가기]를 거의 동시에 누른다. 둘 다 그 학생회가 열리고, 운영진 > 사람에 그 사람이 한 번만 보여야 한다.
3. **배포 DB에 적용(사용자 승인):** 주소가 셸 기록에 남지 않게 입력으로 받는다. 셸의 주소는 `--from-shell`을 붙일 때만 쓰인다(P30).
   - Git Bash: `read -rs DATABASE_URL && export DATABASE_URL` 뒤 `production` 가지 주소를 붙여 넣는다.
   - PowerShell: `$env:DATABASE_URL = Read-Host '배포 DB 주소'`
   1. `npm run db:migrate --workspace @vada/api -- --from-shell --dry-run` → `대상: <production 가지 호스트>/<DB 이름> (셸의 DATABASE_URL)`, `public 표 0개, 적용 기록 없음`이어야 한다. 표가 있거나 "…적용하지 않는다"가 나오면 멈추고 무엇이 들어 있는지 본다.
   2. 사용자가 승인하면 `npm run db:migrate --workspace @vada/api -- --from-shell --apply` → `마이그레이션 적용 완료(1개)`
   3. 셸에서 주소를 지운다: Git Bash `unset DATABASE_URL`, PowerShell `Remove-Item Env:DATABASE_URL`
4. **main에 합치고 올리기:** 사용자가 반영하라고 하면 바탕 커밋을 main에 합치고 push한다. push하면 Render가 새 코드를 배포한다. 다음 단계까지 몇 분은 화면이 깨진다(새 코드가 옛 DB를 본다). 받아들이기로 했다.
5. **Render 바꾸기:** Render 대시보드의 vada-m1 → Environment에서 `DATABASE_URL`을 `production` 가지 주소로 바꾸고 저장한다(다시 배포된다). 세션이 옛 DB에 있으므로 모두 다시 로그인한다.
6. **vada-m1에서 확인:** 휴대폰과 데스크톱에서 로그인, 학생회 만들기, 다른 계정으로 초대 링크 들어오기, 휴대폰 알림 켜기와 시험 알림을 한다. 덩어리 1에서 알림을 켠 휴대폰은 다시 켜지 않아도 된다. 휴대폰 알림 대화상자를 연 뒤 Neon SQL 편집기(`production` 가지)에서 `SELECT count(*) FROM push_device;`로 기기가 저장됐는지 본다(대화상자를 열 때 이미 켜진 구독을 저장한다, P23). 두 기기로 같은 초대 링크를 거의 동시에 눌러 한 번씩만 들어가는지도 본다. 결과는 `docs/device-checks.md`에 남긴다.
7. **막히면 되돌리기:** Render의 `DATABASE_URL`을 옛 주소로 돌리고, Render의 배포 기록에서 바탕 전 배포를 골라 Rollback한다. 옛 DB(`vada-m1-dev`)는 시범 운영이 시작할 때까지 지우지 않는다.
