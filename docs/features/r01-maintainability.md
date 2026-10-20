---
독자: 에이전트
---

# R01 유지보수성 정리(리팩터링)

예상: 6시간 안팎(실제로 도는 시간). 이 일은 기반이라 상한을 두지 않는다. 시간이 넘어도 조각을 빼거나 기준을 낮추지 않고, 예상이 틀린 까닭만 기록한다. 시작 2026-10-20 18:40. 양식은 `docs/work-method.md`의 기능 명세를 따른다. 가지는 `work/r01-조각번호`, 진행 기록은 `.superpowers/sdd/r01/progress.md`, 이슈는 vada-hq/vada-docs#8이다.

## 왜

기능 3~7이 지금 코드 위에 얹힌다. 정리를 미루면 같은 고치기가 기능마다 되풀이된다. 2026-10-20 main(c7076df, 코드는 f7211ad와 같다)에서 아래 '정한 것'의 규칙을 그대로 돌려 잰 결과다. 시험 파일(`*.test.ts(x)`)은 뺐다.

- **큰 화면 부품.** 함수 길이(빈 줄과 주석 제외)로 사람 화면 `People`이 231줄에 복잡도 31, 부서 화면 `Departments`가 229줄에 복잡도 21이다. `App`은 195줄, 학생회 설정은 176줄, 알림 훅 `usePush`는 136줄이다. 50줄을 넘는 함수가 32개(시험 도우미 2개 포함), 복잡도 10을 넘는 함수가 14개다.
- **그 큰 곳에서 다시 한 일이 나왔다.** 기능 2 검토의 Important 9건 중 6건이 사람 화면, 부서·설정 화면, 알림 훅에서 나왔다. 가장 많이 고친 종류(화면 상태 약 24개)도 그곳이다.
- **오류 코드가 두 곳에 따로 있다.** 서버는 `new ApiError('NOT_FOUND', 404)`처럼 코드와 상태 숫자를 매번 함께 쓴다(10개 파일에 29번, 같은 줄이 9번). 가드와 검증은 `c.json({ error: 'FORBIDDEN' }, 403)`처럼 따로 쓴다(5곳). 화면은 같은 코드 글자와 `403` 같은 숫자로 다시 가른다(7개 파일 16줄).
- **이름 없는 숫자가 157개다.** 49개는 아이콘을 그리는 스크립트(`make-icons.mjs`)의 PNG 형식 바이트와 좌표이고, 나머지 108개가 45개 파일에 있다. HTTP 상태 외에도 시간(1000, 2000, 40_000)과 길이(16, 32, 36) 값이다.
- **같은 문구가 여러 곳에 있다.** "저장하지 못했어요. 다시 시도해 주세요."가 4곳에 있고, 화면마다 오류 문구 표(`const errors`)가 5개, `InviteCard`의 `loadErrors`가 하나 더 있다.
- **폴더에 실행 코드와 운영 도구가 섞여 있다.** `api/src/db/`에 실행 중 DB 코드(`schema.ts`, `types.ts`, `error-code.ts`)와 운영 도구(`migrate-*`, `pg-smoke-*`)가 함께 있다. `schema.ts`가 584줄(빈 줄과 주석 빼면 518줄)이다.
- **안 쓰는 의존성과 내보내기가 있다.** knip이 찾은 후보는 의존성 `write-excel-file`, `fflate`, 내보내기 13개(8개 파일), 타입 10개(8개 파일)다. 안 쓰는 파일 3개(`baseline-from-design.ts`, `make-icons.mjs`, `ui-gallery/main.tsx`)는 손으로 돌리거나 주소로 부르는 입구라 오탐이다.
- **이런 것을 막는 린트 규칙이 꺼져 있다.** 그래서 검토가 사람 눈으로 잡았다.
- 좋은 것도 있다. 코드 중복은 0.15%(jscpd)이고, 기능별 폴더로 나뉘어 있으며, 글자 수 상한은 `packages/contracts` 한 곳에서 서버와 화면이 같이 쓴다.

리팩터링은 기능과 섞지 않고 따로 한다([Google 작은 변경, "Separate Out Refactorings"](https://google.github.io/eng-practices/review/developer/small-cls.html)).

## 범위 밖

- 동작, 화면 모양, API 응답 모양(오류 `code`와 상태 번호), DB 바꾸기. 이 정리 뒤에도 사용자에게 보이는 것은 같아야 한다.
- 모든 화면 글을 다국어 문구 파일로 옮기기. 한국어만 쓰는 지금은 과하다. 두 번째 언어가 생기면 다시 본다.
- 새 기능과 버그 고치기. 정리 중에 버그를 찾으면 기록만 하고, 정리가 끝난 뒤 버그 조각으로 고친다.

## 정한 것

| 무엇 | 정한 것 | 근거 | 되돌리기 |
|---|---|---|---|
| 복잡도 상한 | 함수마다 10(`eslint/complexity`). 지금 넘는 곳은 14곳(13개 파일) | [NIST SP 500-235](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication500-235.pdf): McCabe가 처음 제안한 10에는 뒷받침하는 증거가 많고, 15도 쓰인다. ESLint 기본은 [20](https://eslint.org/docs/latest/rules/complexity). 주인의 "간결하게"에 맞춰 엄한 쪽을 고른다 | 설정 숫자 하나 |
| 함수 길이 | 50줄(빈 줄과 주석 제외, `max-lines-per-function`) | [ESLint 기본](https://eslint.org/docs/latest/rules/max-lines-per-function). [React](https://react.dev/learn/thinking-in-react): 한 부품은 한 가지 일만, 커지면 나눈다 | 설정 숫자 |
| 파일 길이 | 300줄(빈 줄과 주석 제외, `max-lines`). 지금 넘는 곳은 `schema.ts`, `pg-smoke-cases.ts`, `ui-gallery/Gallery.tsx` | [ESLint 기본](https://eslint.org/docs/latest/rules/max-lines) | 설정 숫자 |
| 중첩 깊이 | 4(`max-depth`). 지금 넘는 곳은 `make-icons.mjs` 1곳 | ESLint 기본 | 설정 숫자 |
| 인자 수 | 4(`max-params`). ESLint 기본은 3이지만, 서비스 함수의 `(tx, 사람, 입력, 시각)` 꼴을 지키려고 하나 더 둔다. 넘는 7곳은 객체 하나로 받는다 | [ESLint](https://eslint.org/docs/latest/rules/max-params) | 설정 숫자 |
| 이름 없는 숫자 | `no-magic-numbers`. -1, 0, 1, 타입 안의 숫자, 배열 첨자, 기본값은 뺀다. `const`를 강제한다. 이름 붙은 상수 표(코드 → 값) 안의 값은 이름이 있는 것으로 본다. 규칙이 그 값을 잡으면 그 파일만 설정에서 이유와 함께 뺀다 | [Fowler, Replace Magic Literal](https://refactoring.com/catalog/replaceMagicLiteral.html), [oxlint 옵션](https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-magic-numbers.html) | 설정 |
| 시험 파일 | 함수 길이, 파일 길이, 이름 없는 숫자는 시험 파일(`*.test.ts(x)`)과 시험 도우미(`**/test-support/**`)에 걸지 않는다. 복잡도와 인자 수는 건다 | 시험의 기대값과 시험 자료는 눈에 보이는 값이어야 읽힌다 | 설정 |
| 아이콘 스크립트 | `make-icons.mjs`는 이름 없는 숫자에서 영구히 뺀다(설정에 이유). 49개가 PNG 형식 바이트(CRC 다항식, 덩어리 위치)와 그림 좌표라 이름을 붙이면 형식 명세를 다시 적게 된다. 중첩 깊이는 고친다 | 모양을 바꿀 때만 손으로 돌리는 생성기다 | 설정 |
| 들여오는 방식 | 규칙은 첫 조각에서 오류로 켠다. 지금 어긴 파일만 설정의 '임시 예외' 목록에 두고, 조각마다 고친 파일을 목록에서 뺀다. 새 코드는 바로 막힌다. 목록이 비면 끝난다 | 작게 나눠 내보낸다([DORA](https://dora.dev/capabilities/working-in-small-batches/)) | 목록 |
| 상수 자리 | 값마다 한 곳에서만 정의하고, 그 값을 주로 쓰는 모듈에 둔다. 서버와 화면이 같이 쓰면 `packages/contracts`에 둔다. 앱 전체 상수 파일 하나는 만들지 않는다 | 함께 바뀌는 것은 함께 둔다([Common Closure Principle](https://helix.sitecore.com/appendix/package-principles.html)). 전역 상수 묶음은 [반패턴](https://en.wikipedia.org/wiki/Constant_interface)이다 | 파일 옮기기 |
| 오류 코드 | `packages/contracts`에 오류 목록 하나(코드 → HTTP 상태)를 둔다. 서버는 코드만으로 오류를 던지고 상태는 목록에서 찾는다. 가드, 검증, 로그인 확인이 직접 만드는 오류 응답도 같은 목록을 쓴다. 화면은 코드로 가르고, 코드 → 한국어 문구는 화면 문구 파일 한 곳에 둔다. 응답 모양은 그대로다 | [Google AIP-193](https://google.aip.dev/193): 기계가 읽는 이유 값은 같은 오류에 늘 같게 쓰고, 문구가 아니라 그 값에 기댄다 | 모듈 하나 |
| 그 밖의 상태 숫자 | 성공 상태(200, 201, 204)와 외부 서비스가 주는 상태(알림 서버의 404·410, R2의 404)는 서버 공통(`apps/api/src/http`)에 이름을 붙여 한 곳에 둔다 | 위 '상수 자리' | 파일 옮기기 |
| 문구 | 두 화면 이상에서 쓰는 문구와 모든 오류 문구는 `apps/web/src/lib/messages.ts`에 둔다. 한 화면만 쓰는 버튼과 제목 글은 그 화면에 둔다 | AGENTS.md '두 번째 복사가 생기면 공유'. 다국어는 범위 밖 | 파일 옮기기 |
| 화면 나누기 | 상태와 서버 부르기는 훅(`useXxx`)으로, 목록 줄, 대화상자, 양식은 부품으로 나눈다. 나눈 파일도 그 기능 폴더 안에 둔다 | [React 커스텀 훅](https://react.dev/learn/reusing-logic-with-custom-hooks), [Thinking in React](https://react.dev/learn/thinking-in-react) | 파일 합치기 |
| 폴더 | `api/src/db/`에는 실행 중 DB 코드만 둔다. 운영 도구는 `api/src/ops/`(`migrate/`, `pg-smoke/`)로 옮긴다. `schema.ts`는 영역별 파일로 나눈다 | 모듈 하나는 한 가지 일(AGENTS.md '코드'). drizzle은 [여러 파일 스키마](https://orm.drizzle.team/docs/sql-schema-declaration)를 지원한다 | `git mv` |
| 죽은 코드 | knip을 `npm run check`에 넣고, 안 쓰는 의존성과 내보내기를 지운다. 오탐(브라우저가 주소로 부르는 `sw.js`, `ui.html` 입구, 손으로 돌리는 스크립트)은 설정에 이유와 함께 적는다. knip은 정확한 버전의 개발 의존성으로 넣는다 | [Fowler, Remove Dead Code](https://refactoring.com/catalog/removeDeadCode.html), [knip](https://knip.dev/) | 설정 |
| 동작 지키기 | 조각마다 시험 전체 통과, 화면 스크린샷이 전과 같아야 한다. 나눌 부품에 시험이 모자라면 나누기 전에 지금 동작을 그대로 적는 시험을 먼저 넣는다 | Fowler의 리팩터링 정의(겉 동작은 그대로), [특성 시험](https://en.wikipedia.org/wiki/Characterization_test) | — |

## 위험

- **화면 나누기에서 상태 흐름이 바뀔 수 있다.** 그러면 '자주 잡힌 것' 1~3(대상이 사라진 대화상자 닫기, 진행 중 버튼 막기, 오류 위치)이 깨진다. 지금 시험, 나누기 전에 넣는 특성 시험, 390px과 데스크톱 스크린샷 비교로 막는다. 그래서 사람·부서 화면 조각은 깊게 검토한다.
- **오류 목록은 모든 라우트를 건드린다.** `boundary.test.ts`와 라우트 시험이 상태 번호를 확인하므로, 시험을 고치지 않고 그대로 통과해야 한다. 오류는 권한 경계라서 깊게 검토한다.
- **운영 도구 나누기는 운영 DB 적용 경로를 건드린다.** `runMigration`의 점검 순서(기록 표, 해시, 시각 순서, `--from-shell`)가 바뀌면 운영 DB에 잘못 적용될 수 있다. 지금 시험이 그대로 통과해야 하고 깊게 검토한다. 나눈 뒤 진행 에이전트가 개발 DB에 미리 보기와 `pg-smoke`를 돌려 전과 같은 결과를 본다.
- **폴더 옮기기는 import를 많이 바꾼다.** 옮기기만 하는 커밋과 나누기 커밋을 따로 두고, 화면 조각과 서버 조각이 끝난 뒤에 한다. 동시에 도는 조각과 부딪히지 않게 하려는 것이다.
- **DB에는 닿지 않는다.** 마이그레이션도, 운영 동작 변화도 없다.

## 조각

위험이 크고 다른 조각이 기대는 것을 앞에 둔다. 1 → 2 → 3은 차례로, 4~7(화면)과 8(서버)은 파일이 겹치지 않아 두 작업자가 동시에 할 수 있다. 9~11은 그 뒤에 차례로 한다.

### 1. 린트 상한 켜기 [x]
- 할 수 있게 되는 것: 새로 쓰는 코드가 크기, 복잡도, 이름 없는 숫자 상한을 넘으면 커밋 전에 막힌다.
- 수용 기준: `npm run check`가 새 규칙으로 돈다. 임시 예외 목록 밖 파일은 위반이 0이다. 시험이 아닌 파일에 일부러 넣은 위반은 실패한다. AGENTS.md '코드' 절에 상한 숫자와 '값마다 한 곳' 규칙이 있다.
- 닿는 곳: 루트 `.oxlintrc.json`, AGENTS.md.
- 검토: 보통. 마이그레이션: 없음.

### 2. 오류 목록 하나로 [x]
- 할 수 있게 되는 것: 오류 코드와 상태를 `contracts` 한 곳에서 고치면 서버와 화면이 같이 따른다.
- 수용 기준: 모든 라우트가 전과 같은 상태 번호와 `code`를 돌려준다(지금 시험이 고치지 않고 그대로 통과한다). 오류 목록과 상태 이름을 정한 파일 밖의 서버와 화면 소스(시험 제외)에 HTTP 상태 숫자 글자가 0이다. 화면의 오류 문구 표 5개와 `loadErrors`가 `messages.ts` 한 곳으로 모인다.
- 닿는 곳: `packages/contracts`(새 오류 목록), `api/src/http/`(`errors.ts`, `guard.ts`, `validate.ts`, `on-error.ts`), `auth/require-session.ts`, 오류를 던지는 곳, `web/src/lib/api.ts`, `web/src/lib/messages.ts`, 화면들의 `errors` 표.
- 검토: 깊게. 마이그레이션: 없음.

### 3. 이름 없는 숫자와 겹친 문구 [ ]
- 할 수 있게 되는 것: 시간, 길이, 크기 값을 이름으로 찾고 한 곳에서 고친다.
- 수용 기준: `no-magic-numbers` 임시 예외 목록이 빈다. "저장하지 못했어요" 문구가 한 곳에만 있다. `make-icons.mjs`의 중첩 깊이와 `web/src/test-support/mock-api.ts`의 복잡도가 상한 안이다.
- 닿는 곳: 린트가 가리킨 파일(`team/service.ts`, `pg-smoke.ts`, `push/devices.ts`, `push/config.ts`, `on-error.ts`, `korean-time.ts`, `useTeam.ts`, `InviteCard.tsx` 등 45개).
- 검토: 보통.

### 4. 사람 화면 나누기 [ ]
- 할 수 있게 되는 것: 사람 화면을 고칠 때 바꿀 곳이 한 부품이나 한 훅으로 좁혀진다.
- 수용 기준: 사람 화면 시험이 모두 통과한다. `People.tsx`와 나온 파일이 모두 상한 안이다. 390px과 데스크톱 스크린샷이 전과 같다. 권한을 잃거나 대상이 사라진 대화상자는 전처럼 닫히고 이유를 보인다.
- 닿는 곳: `web/src/team/`(People, 사람 동작 훅, 사람 줄, 확인 대화상자).
- 검토: 깊게.

### 5. 부서 화면과 부서 배정 대화상자 나누기 [ ]
- 수용 기준은 4와 같은 꼴이다. 대상은 `Departments.tsx`, `MemberDepartmentsDialog.tsx`, `InviteCard.tsx`다.
- 검토: 깊게.

### 6. 학생회 설정·만들기·들어오기 양식 나누기 [ ]
- 수용 기준은 4와 같은 꼴이다. 대상은 `CouncilSettings.tsx`, `CreateCouncilForm.tsx`, `JoinCouncil.tsx`, `MyCouncils.tsx`다.
- 검토: 보통.

### 7. 앱 틀과 알림 나누기 [ ]
- 수용 기준은 4와 같은 꼴이고, 알림 켜기, 시험 알림, 카카오톡 안 브라우저 안내가 전처럼 동작한다. 대상은 `App.tsx`, `Workspace.tsx`, `WorkspaceSidebar.tsx`, `usePush.ts`, `PushPanel.tsx`, `KakaoBlock.tsx`다.
- 검토: 보통.

### 8. 서버 함수 나누기 [ ]
- 할 수 있게 되는 것: 서버 진입점과 라우트 묶음이 읽고 잇기만 하고, 판단은 시험이 있는 작은 함수에 있다.
- 수용 기준: API 시험이 모두 통과한다. 대상 함수가 모두 상한 안이다. 대상은 `runtime.ts readRuntime`(복잡도 26), `push/config.ts pushConfigFrom`(15), `serve.ts main`, `team/routes.ts`, `councils/routes.ts`, `invites/routes.ts`, `records.updateRecords`, `invites/service.joinCouncil`, `storage.createR2Storage`, `scripts/test-data.ts parseTestDataArgs`, 그리고 인자 5개 이상인 6곳(`authorize`, `authorizeChange`, `inCouncilChange`, `assignDepartment`, `createPushRoutes`, 시험 도우미 `addUser`)이다. 운영 모드 시작(CI 단계)이 그대로 통과한다.
- 검토: 깊게(로그인 잇기, 초대, 기록, 권한 확인이 권한과 데이터 경계다).

### 9. 운영 도구 폴더와 함수 [ ]
- 할 수 있게 되는 것: 실행 코드와 운영 도구를 폴더 이름으로 구별하고, 운영 DB 적용 경로를 작은 함수 단위로 읽는다.
- 수용 기준: `api/src/db/`에 운영 도구가 없다. `migrate-run.runMigration`(복잡도 20), `pg-smoke.runPgSmoke`, `pg-smoke-cases.ts`(파일 길이, 함수 길이, 인자 6개)가 상한 안이다. 옮기기만 한 커밋과 나누기 커밋이 따로 있다. AGENTS.md와 문서의 경로가 새 폴더를 가리킨다. 진행 에이전트가 개발 DB에 `pg-smoke`와 `db:migrate` 미리 보기를 돌려 전과 같은 결과를 본다.
- 닿는 곳: `api/src/db/`, `api/src/ops/`, `api/scripts/pg-smoke.ts`, `api/package.json` 스크립트, AGENTS.md, `docs/work-method.md`.
- 검토: 깊게(운영 DB).

### 10. 큰 파일 나누기 [ ]
- 할 수 있게 되는 것: 표 정의와 부품 확인 화면을 영역별 파일에서 찾는다.
- 수용 기준: `schema.ts`가 영역별 파일로 나뉘고 모두 300줄 안이다. 맞춤 시험(`schema-match.test.ts`)과 `npm run check:design`이 전과 같이 통과한다. `ui-gallery/Gallery.tsx`가 300줄 안이고 `/ui.html`이 전과 같게 보인다.
- 닿는 곳: `api/src/db/schema*.ts`, `drizzle.config.ts`, `web/src/ui-gallery/`.
- 검토: 보통.

### 11. 죽은 코드와 끝내기 [ ]
- 할 수 있게 되는 것: 안 쓰는 코드와 의존성이 생기면 `npm run check`가 막는다.
- 수용 기준: knip이 `npm run check`와 CI에서 0으로 끝난다. 안 쓰는 의존성과 내보내기를 지웠다. 린트 임시 예외 목록이 비어 있다. 빌드 크기가 늘지 않았다.
- 검토: 보통.

## 닫기

지표와 회고 세 줄. 특히 기능 3의 다시 한 비율과 Important 수를 기능 2(34%, 작업 하나에 0.64건)와 비교해, 이 정리가 다시 하는 일을 줄였는지 본다.
