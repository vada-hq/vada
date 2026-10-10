# M3b-1 행사 참가비와 입금 확인 구현 계획

> **For agentic workers:** 이 저장소는 사용자가 정한 방식(직접 구현 TDD → 새 컨텍스트 Opus 최종 리뷰)으로 실행한다. superpowers:executing-plans로 작업을 차례로 하고, 단계는 체크박스(`- [ ]`)로 따라간다.

**Goal:**
- 재정 담당자는 학생회 계좌와 학생회비 납부 명단을 정한다.
- 운영진은 참가 신청에 참가비를 정한다.
- 학생은 신청하자마자 금액·계좌·입금자명을 본다.
- 운영진은 신청자 명단에서 입금을 확인한다.

**Architecture:**
- 계좌는 `fee_accounts`(학생회당 하나)와 바꾼 기록 `fee_account_events`다. 명단은 `dues_rosters`(학생회당 하나)와 `dues_members`(CASCADE)다.
- 새 모듈 `apps/api/src/fees`가 참가비 설정(재정 전용)을 맡는다.
  - 명단 조회·대조·파기 함수는 `fees/roster.ts`에 두고, 참가 신청 모듈이 가져다 쓴다.
- 참가 신청은 `registration_forms.fee/member_fee`를 갖는다. 신청 한 건은 `registrations.dues_member`와 입금 칸 셋을 갖는다.
  - 낼 돈은 저장하지 않고 설정과 구분으로 계산한다(`registrations/fee.ts`). 입금을 확인하면 그때 금액을 남긴다.
- 입금 확인·확인 취소·참가비 바꾸기는 `requireOpenEvents`(행사 행 `FOR SHARE` + 정산 확인) 뒤에 조건을 건 `UPDATE`로 바꾼다.
- 공통 가드는 경로별 본문 상한(`bodyLimitOf`)을 갖는다. 명단 경로만 1 MiB다.

**Tech Stack:** Hono, drizzle-orm(PostgreSQL·PGlite), zod 4, React 19 + Tailwind, vitest, node:test.

**Spec:** `docs/superpowers/specs/2026-10-10-event-fees-design.md`

## Global Constraints

- 요청 본문은 contracts의 `z.strictObject`다. 문자열은 `text(max)`/`token(max)`으로만 만들고, 모든 문자열·배열·숫자에 상한을 둔다.
  - 참가비 0~1,000,000원. 납부자 참가비는 null이거나 0 이상 참가비 미만이다.
  - 은행 20자, 예금주 30자. 계좌번호는 공백을 빼고 `^\d+(-\d+)*$`, 30자, 숫자 8~20자리다.
  - 명단 이름 30자, 쓰는 기한은 날짜(2000~2999)다. 납부자는 1~10,000명이고 학번이 겹치지 않는다. 이름은 30자다.
- 라우트는 `json(Schema)`를 인증보다 앞에 두고 `c.req.valid('json')`만 쓴다. 실패는 `ApiError(code, status)`다.
- 길이·형식 제한이 있는 칸은 DB CHECK도 같은 값으로 둔다.
- 0021은 새 칸·새 표만 만든다. 두 DB(dev, m1-preview)에 먼저 적용한 뒤 배포한다.
- 개인정보(이름·학번·휴대폰)와 계좌번호·금액을 로그·오류 응답·Sentry에 넣지 않는다. 이름·학번을 API 주소에 넣지 않는다.
- 화면 규칙
  - `components/ui` 부품을 쓴다. 체크박스만 `size-4 accent-blue-600`이다.
  - Tailwind 기본 스케일과 테마 토큰만 쓴다. 긴 글에는 `wrap-anywhere`를 준다.
  - 버튼은 같은 스키마의 `safeParse`로 켠다. 길이 숫자를 화면에 다시 적지 않는다.
  - 화면 문구는 spec "화면 문구" 표를 그대로 쓴다.
- 시간에 기대는 테스트는 2999년 날짜나 주입한 시계만 쓴다.
- 커밋 제목은 한국어 명령형 50자 안이다. AI 서명·트레일러를 붙이지 않는다.
- 새 테스트 파일은 api·contracts의 `test` 스크립트 목록에 더한다.

## Review Focus

1. **이름 표기 차이:** 명단의 "김바다"와 신청의 "김 바다", 명단의 "Kim Bada"와 신청의 "KIM BADA"는 같은 사람으로 본다. 학번을 `2022-123456`으로 넣어도 같다. → Task 5 테스트
2. **엑셀 붙여 넣기의 모양**
   - CRLF, 끝의 빈 줄, 칸 앞뒤 공백, 제목 줄("학번\t이름")은 받아 준다.
   - 학번에 하이픈이 있어도 받고, 이름이 먼저 오는 순서도 받는다.
   - 세 칸 줄은 오류다. → Task 7 테스트
3. **쓰는 기한 경계:**
   - 기한 날 23:59(한국 시각)에 한 신청은 납부자다. 다음 날 00:00에는 미납자다.
   - 파기는 다음 날부터 지운다. → Task 4·5 테스트
4. **확인과 취소의 엇갈림:** 운영진이 입금을 확인한 뒤, 학생이 예전 화면에서 취소를 누르면 `PAYMENT_CONFIRMED`로 막힌다. 확인 금액도 그대로 남는다. → Task 6 테스트
5. **금액 잠금:**
   - 입금을 확인한 신청을 운영진이 취소해도 그 행은 확인 금액을 가진다. 그래서 금액을 바꾸면 여전히 `FEE_LOCKED`다.
   - 금액만 같으면 다른 설정은 저장된다. → Task 5 테스트

---

### Task 1: 참가비 계약

**Files:**
- Create: `packages/contracts/src/fees.ts`, `packages/contracts/src/fees.test.ts`
- Modify: `packages/contracts/src/registrations.ts`, `packages/contracts/src/registrations.test.ts`, `packages/contracts/src/index.ts`, `packages/contracts/package.json`(test 목록)

**Interfaces (Produces):**
- `registrations.ts`
  - `REGISTRATION_FEE_MAX = 1_000_000`
  - 신청 설정 `fields`에 `fee: z.number().int().min(0).max(1_000_000)`, `memberFee: 같은 것.nullable()`을 더한다.
    - `.refine`에 `memberFee === null || memberFee < fee`를 더한다.
  - `PaymentActionSchema = z.strictObject({})`
  - `SetDuesMemberSchema = z.strictObject({ duesMember: z.boolean() })`
  - `RegistrationFormView`에 `fee: number; memberFee: number | null; payments: { count: number; total: number }`
  - `RegistrationEntry`에 `duesMember: boolean | null; fee: number; paid: { amount: number; at: string; by: ExpensePerson } | null`
  - `RegistrationResponse`에 `account: FeeAccount | null; roster: { label: string; useUntil: string } | null`
  - `PublicRegistrationForm`에 `fee: number; memberFee: number | null`
  - `MyPayment { basis: 'flat' | 'member' | 'nonmember'; fee: number; paidAt: string | null; account: FeeAccount | null }`
  - `MyRegistration`에 `payment: MyPayment | null`
- `fees.ts`
  - 상한: `FEE_BANK_MAX = 20`, `FEE_HOLDER_MAX = 30`, `FEE_ACCOUNT_HISTORY_MAX = 20`, `DUES_ROSTER_LABEL_MAX = 30`, `DUES_ROSTER_MEMBERS_MAX = 10_000`, `DUES_ROSTER_USE_DAYS_MAX = 366`
  - `accountNumberInput = token(40).transform(v => v.replace(/\s/g, ''))`
    - `.refine`: `^\d+(-\d+)*$`, 길이 30 이하, 숫자 수 8~20
  - `SetFeeAccountSchema = z.strictObject({ version: 0.., bank: text(20), accountNumber, holder: text(30) })`
  - `duesMemberInput = z.strictObject({ studentId: studentIdInput, name: text(REGISTRATION_NAME_MAX) })`
  - `ReplaceDuesRosterSchema = z.strictObject({ version: 0.., label: text(30), useUntil: 날짜, members: z.array(duesMemberInput).min(1).max(10_000) })`
    - `.refine`: 정리한 학번이 겹치지 않는다.
  - `DeleteDuesRosterSchema = z.strictObject({ version: 1.. })`
  - 타입
    - `FeeAccount { bank; accountNumber; holder }`
    - `FeeAccountView extends FeeAccount { version; updatedAt; updatedBy: ExpensePerson }`
    - `FeeAccountChange { id; actor: ExpensePerson; from: FeeAccount | null; to: FeeAccount; createdAt }`
    - `DuesMember { studentId; name }`
    - `DuesRosterView { label; useUntil; version; uploadedAt; uploadedBy: ExpensePerson; members: DuesMember[] }`
    - `FeeSettingsResponse { account: FeeAccountView | null; accountHistory: FeeAccountChange[]; roster: DuesRosterView | null }`
  - 날짜는 `purchaseDate.refine(2000-01-01 ~ 2999-12-31)`로 incomes와 같게 만든다.
  - `fees.ts`는 `registrations.ts`의 값(`studentIdInput`, `REGISTRATION_NAME_MAX`)을 가져오고, `registrations.ts`는 `fees.ts`의 타입만 `import type`으로 쓴다.

- [ ] **Step 1: 실패하는 계약 테스트**
  - `registrations.test.ts`: 참가비 0·1,000,000은 받는다. 1,000,001·−1·1.5와 `fee` 빠짐은 거절한다.
    - 납부자 참가비 null·0은 받는다. 참가비와 같음·큼, 참가비 0원에 0, `memberFee` 빠짐은 거절한다.
    - `PaymentActionSchema`는 `{}`만 받는다. `SetDuesMemberSchema`는 불리언만 받고 모르는 키를 거절한다.
  - `fees.test.ts`
    - 계좌: 은행·예금주의 빈 값·공백만·이모지 상한+1·NUL·홀로 쓰인 서러게이트는 거절한다. 계좌번호 `3333 01 1234567` → `333301` + `1234567`(공백 뺌)이다.
      - 숫자 7자리는 거절, 8·20자리는 받음, 21자리는 거절한다. `12--34`, `-1234567890`, `12a4567890`은 거절한다.
      - 버전 0은 받는다. 모르는 키는 거절한다.
    - 명단
      - 이름 이모지 30자는 받고 31자는 거절한다. 기한 `2026-02-30`·`1999-12-31`은 거절한다.
      - 납부자 0명·10,001명은 거절한다. 10,000명은 받는다.
      - 학번 `2022-123456`과 `2022123456`이 함께 있으면 겹쳐서 거절한다.
      - 납부자 줄의 모르는 키, 이름 공백만은 거절한다.
    - 지우기는 버전 0을 거절한다.
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/fees.test.ts src/registrations.test.ts`(packages/contracts)
- [ ] **Step 3: 구현** — 위 Interfaces 그대로. `index.ts`에서 `fees.ts`를 내보낸다. `package.json` test 목록에 `src/fees.test.ts`를 더한다.
- [ ] **Step 4: 통과 확인** — `npm test --workspace @vada/contracts`
- [ ] **Step 5: 커밋** — `참가비 계약 추가`

### Task 2: 참가비 표와 마이그레이션 0021

**Files:**
- Modify: `apps/api/src/db/schema.ts`(새 표 넷, `registrationForms`·`registrations` 칸)
- Create: `apps/api/migrations/0021_event_fees.sql`, `meta/0021_snapshot.json`, `meta/_journal.json`(`npx drizzle-kit generate --name event_fees`)
- Test: `apps/api/src/db/migrations.test.ts`에 0021 테스트

**Interfaces (Produces):** `feeAccounts`, `feeAccountEvents`, `duesRosters`, `duesMembers`, `registrationForms.fee/memberFee`, `registrations.duesMember/paidAmount/paidAt/paidBy`(이름은 spec 데이터 절)

- [ ] **Step 1: 실패하는 마이그레이션 테스트** — `migrationsBefore('0021_event_fees')`에서 시작한다. 참가 신청 하나와 신청 하나를 넣고 올린다.
  - 기존 참가 신청은 `fee = 0`, `member_fee` NULL이다. 기존 신청의 새 칸은 모두 NULL이다.
  - `registration_forms`
    - `fee` −1·1,000,001은 `registration_forms_fee_range`다.
    - `member_fee`가 `fee`와 같거나 크거나 음수면 `registration_forms_member_fee_range`다.
  - `registrations`
    - 입금 칸이 일부만 있으면 `registrations_paid_triple`이다.
    - `paid_amount` 0·1,000,001은 `registrations_paid_amount_range`다.
    - 지운 행(`purged_at` 있음)도 입금 칸과 `dues_member`를 가질 수 있다.
  - `fee_accounts`
    - 은행 공백은 `fee_accounts_bank_not_blank`, 21자는 `fee_accounts_bank_length`다.
    - 계좌번호 `12-` 형식은 `fee_accounts_number_format`, 숫자 7자리·21자리는 `fee_accounts_number_digits`다.
    - 예금주 31자는 `fee_accounts_holder_length`, 버전 0은 `fee_accounts_version_positive`다.
  - `fee_account_events`: `changes`가 배열이면 `fee_account_events_changes_object`다.
  - `dues_rosters`: 이름 공백·31자, 기한 1999년, 버전 0을 거절한다.
  - `dues_members`
    - 학번 `abc`는 `dues_members_student_id_format`, 이름 31자는 `dues_members_name_length`다.
    - 같은 학번 둘째는 PK에 걸린다. 명단 없는 학생회의 납부자는 FK에 걸린다.
    - 명단 행을 지우면 납부자도 지워진다(CASCADE).
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/db/migrations.test.ts`(apps/api) → `Migration not found`
- [ ] **Step 3: 스키마와 생성**
  - spec 데이터 절의 칸과 CHECK를 schema.ts에 쓴다.
    - CHECK 이름은 위 테스트 이름이다.
    - 계좌번호 숫자 수: `char_length(regexp_replace(account_number, '-', '', 'g')) BETWEEN 8 AND 20`
  - `npx drizzle-kit generate --name event_fees`(apps/api)
  - 생성된 SQL을 읽어 새 표·새 칸만 있는지 확인한다. LF인지도 본다.
- [ ] **Step 4: 통과 확인** — `npx tsx --test src/db/migrations.test.ts src/db/schema.test.ts`
- [ ] **Step 5: 커밋** — `참가비 표와 마이그레이션 0021 추가`

### Task 3: 경로별 본문 상한

**Files:**
- Modify: `apps/api/src/http/guard.ts`, `apps/api/src/http/boundary.test.ts`

**Interfaces (Produces):** `bodyLimitOf(path: string): number`. 명단 경로 `/api/organizations/:id/dues-roster`만 1,048,576이고 나머지는 `MAX_BODY_BYTES`다.

- [ ] **Step 1: 실패하는 테스트**
  - boundary 테스트의 크기 검사가 `bodyLimitOf(실제 경로)`보다 큰 본문으로 413을 본다.
  - `bodyLimitOf` 단위 확인
    - `/api/organizations/a/dues-roster`는 1 MiB다.
    - `/api/organizations/a/dues-roster/delete`와 `/api/organizations/a/expenses`는 32KB다.
  - 명단 라우트는 Task 4에서 생기므로, 이 단계에서는 함수와 단위 확인만 실패한다.
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/http/boundary.test.ts`
- [ ] **Step 3: 구현**
  - `mutationGuard`가 요청 경로로 상한을 고른다.
  - 상한마다 `bodyLimit` 미들웨어를 한 번만 만든다.
- [ ] **Step 4: 통과 확인** — `npx tsx --test src/http/boundary.test.ts`
- [ ] **Step 5: 커밋** — `경로별 본문 상한을 가드 한 곳에 두기`

### Task 4: 참가비 설정 API (계좌·명단)

**Files:**
- Create: `apps/api/src/fees/roster.ts`, `apps/api/src/fees/service.ts`, `apps/api/src/fees/routes.ts`, `apps/api/src/fees/fees.test.ts`
- Modify: `apps/api/src/app.ts`(`AppOptions.fees`), `apps/api/src/serve.ts`, `apps/api/src/purchases/test-setup.ts`(`fees` 연결, 학생회 계좌·명단 도움 함수), `apps/api/src/http/boundary.test.ts`(모듈), `apps/api/src/registrations/purge.ts`(실행기가 명단도 지움), `apps/api/src/registrations/purge.test.ts`, `apps/api/package.json`(test 목록)

**Interfaces (Produces):**
- `fees/roster.ts`
  - `koreanToday(now: Date): string`: 한국 날짜 `YYYY-MM-DD`
  - `purgeExpiredRosters(db, today: string, organizationId?: string): Promise<number>`: `use_until < today`인 명단을 지운다(납부자는 CASCADE).
  - `activeRoster(db, organizationId, today): Promise<{ label: string; useUntil: string } | null>`
  - `isDuesMember(db, organizationId, studentId, name, today): Promise<boolean>`: 학번과 정리한 이름이 둘 다 맞는가
  - `nameKey(column)`: SQL `lower(regexp_replace(<column>, '[[:space:]]', '', 'g'))`
  - `rematchDues(tx, formId, organizationId, today)`: 지우지 않은 신청의 `dues_member`를 다시 정한다.
  - `feeAccountOf(db, organizationId): Promise<FeeAccount | null>`
- `fees/service.ts`: `createFeeService(db, now)` → `{ settings(scope), setAccount(scope, input), replaceRoster(scope, input), deleteRoster(scope, input) }`. 모두 `FeeSettingsResponse`를 돌려준다.
  - 변경
    - 순서: `requireFinance(tx, scope, true)` → advisory lock `['fees', organizationId]` → 기한 지난 명단 지우기 → 버전 → 변경
    - 계좌: 바뀐 것이 없으면 그대로 둔다. 바뀌면 `fee_account_events`에 `{ from, to }`를 남긴다.
    - 명단: 쓰는 기한이 오늘보다 앞이거나 오늘 + 366일보다 뒤면 `USE_UNTIL_INVALID`다. 바꿀 때는 납부자를 지우고 1,000명씩 넣는다.
  - 읽기도 먼저 기한 지난 명단을 지운다.
- `fees/routes.ts`: `createFeeRoutes(db, session, { now })`
  - `GET /organizations/:organizationId/fee-settings`
  - `POST …/fee-account`
  - `POST …/dues-roster`
  - `POST …/dues-roster/delete`
  - 모두 `requireSession` → `requireMembership`이다. 재정 권한은 서비스가 본다.
- 실행기: `createRegistrationPurger`의 `run`이 `purgeExpired(db)`와 `purgeExpiredRosters(db, koreanToday(new Date()))`를 함께 부른다.

- [ ] **Step 1: 실패하는 테스트** — `fees.test.ts`(setupPurchases 사용, 시계는 2999-08-01)
  - 권한
    - 재정(f)·회장단(l)은 GET과 세 변경을 쓴다.
    - 기획(p)·미배정(n)·다른 학생회(x)는 403 `FORBIDDEN`이다. 미인증은 401이다.
  - 계좌
    - 처음엔 `account: null`이다. 버전 0으로 정하면 버전 1이 되고, 기록 한 줄(`from: null`)이 생긴다.
    - 바꾸면 버전 2와 기록 둘(최근 순)이 된다. 같은 값으로 보내면 버전과 기록이 그대로다.
    - 버전이 틀리면 `VERSION_CONFLICT`다.
  - 명단
    - 올리면 버전 1이고, 학번 순 `members`, `uploadedBy`가 있다. 학번은 정리된 값이다.
    - 다시 올리면 이전 납부자가 사라지고 버전 2다.
    - 지우면 `roster: null`이다. 버전이 틀리면 `VERSION_CONFLICT`다.
    - 쓰는 기한
      - 어제는 `USE_UNTIL_INVALID`다. 오늘과 오늘+366일은 받는다. +367일은 `USE_UNTIL_INVALID`다.
      - 날짜는 주입한 시계의 한국 날짜다.
  - 파기
    - 기한이 지난 명단(DB에서 `use_until`을 어제로 바꿈)은 GET에서 사라진다. 버전도 0으로 돌아간다.
    - 실행기 `run()`도 지운다(purge.test).
  - 경계 입력: AGENTS.md 목록을 계좌·명단 본문에 돌린다(400 `INVALID_INPUT`, 인증 전).
  - 10,000명 명단을 한 번에 올린다(본문 1 MiB 안).
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/fees/fees.test.ts`
- [ ] **Step 3: 구현** — 위 Interfaces 그대로. 오류는 `ApiError`다. 로그에 값을 남기지 않는다.
- [ ] **Step 4: 통과 확인** — `npx tsx --test src/fees/fees.test.ts src/registrations/purge.test.ts src/http/boundary.test.ts`
- [ ] **Step 5: 커밋** — `학생회 계좌와 학생회비 명단 API`

### Task 5: 참가 신청의 참가비와 입금 확인 API

**Files:**
- Create: `apps/api/src/registrations/fee.ts`, `apps/api/src/registrations/payments.test.ts`
- Modify: `apps/api/src/registrations/service.ts`, `apps/api/src/registrations/routes.ts`, `apps/api/src/events/events.ts`(잠금 관례·ID 검사), `apps/api/src/events/events.test.ts`, `apps/api/src/registrations/registrations.test.ts`(응답 모양), `apps/api/package.json`

**Interfaces:**
- Consumes: Task 1 계약, Task 4 `roster.ts`, `settlement/lock.ts`의 `requireOpenEvents`
- Produces
  - `fee.ts`
    - `owedOf(form: { fee: number; memberFee: number | null }, entry: { duesMember: boolean | null; paidAmount: number | null }): number`
      - 입금 확인이 있으면 확인 금액이다.
      - 없으면 납부자 참가비가 있고 `duesMember`가 true일 때 납부자 참가비, 아니면 참가비다.
    - `basisOf(form, entry): 'flat' | 'member' | 'nonmember'`
  - 서비스에 더하는 것
    - `confirmPayment(scope, eventId, registrationId)`
    - `cancelPayment(scope, eventId, registrationId)`
    - `setDuesMember(scope, eventId, registrationId, duesMember)`
  - 라우트
    - `POST …/registration/entries/:registrationId/payment`
    - `POST …/payment/cancel`
    - `POST …/dues`
  - `eventOf(db, organizationId, eventId, lock?: 'no key update')`: 기존 `FOR UPDATE`를 `FOR NO KEY UPDATE`로 바꾼다. 행사 수정(events.ts)도 같게 바꾼다.

- [ ] **Step 1: 실패하는 테스트** — `payments.test.ts`. 시계는 2999-08-01이고 재정(f)이 계좌와 명단(`2022000001 김바다`, `2022000002 Kim Bada`)을 넣는다.
  - 설정
    - 참가비 5,000원을 계좌 없이 만들면 `FEE_ACCOUNT_REQUIRED`다.
    - 납부자 참가비를 명단 없이(또는 기한 지난 명단으로) 켜면 `DUES_ROSTER_REQUIRED`다.
    - `form.fee/memberFee/payments`와 응답의 `account`·`roster`가 맞다. 운영진에게 납부자 목록은 가지 않는다.
  - 정하기와 다시 맞추기
    - 납부자 참가비 없이 받은 신청 둘(김바다, 다른 사람)은 `duesMember` null, `fee` 5000이다.
    - 납부자 참가비 0을 켜면 김바다는 true·0원, 다른 사람은 false·5000원이 된다.
    - 끄면 둘 다 null이 된다.
    - 금액을 7,000원으로 바꾸면 신청의 `fee`가 따라 바뀐다.
  - 입금 확인
    - 다른 사람을 확인하면 `paid`(금액 7000·확인한 사람)와 `payments { count: 1, total: 7000 }`이다.
    - 다시 확인하면 `PAYMENT_CONFIRMED`다. 확인 취소하면 `paid: null`이다. 또 취소하면 `PAYMENT_NOT_CONFIRMED`다.
    - 0원인 김바다를 확인하면 `NO_FEE`다.
    - 확인한 신청의 참가비 바꾸기는 `PAYMENT_CONFIRMED`다. 납부자 참가비가 없는 신청의 참가비 바꾸기는 `INVALID_STATE`다.
    - 같은 구분으로 바꾸면 그대로다.
  - 금액 잠금(Review Focus 5)
    - 확인이 있으면 금액 변경은 `FEE_LOCKED`다. 금액이 같으면 안내 문구 변경은 된다.
    - 확인한 신청을 운영진이 취소해도 `payments.count`는 1이고, 금액 변경은 여전히 `FEE_LOCKED`다.
  - 정산
    - 행사를 정산하면 입금 확인·확인 취소·참가비 바꾸기·금액 변경이 `EVENT_SETTLED`다.
    - 정산 테스트 도움: 재정이 `POST /events/e/finance/settle { version: 0 }`. 지출·품목이 없으면 바로 정산된다.
  - 찾을 수 없음: 취소한 신청, 보관 기간이 지나 지운 신청(행사 날짜를 과거로 옮김), 다른 학생회 행사의 신청은 `NOT_FOUND`다.
  - 권한과 입력: 미배정(n)·다른 학생회(x)는 403, 미인증은 401이다. 본문 `{ extra: 1 }`·`{ duesMember: 'yes' }`는 400이다.
  - 명단 대조(Review Focus 1·3): 공개 신청으로 넣는다.
    - `김 바다`/`2022-000001`과 `KIM BADA`/`2022000002`는 납부자다.
    - 학번만 맞고 이름이 다르면 미납자다.
    - 기한 날 23:59에는 납부자, 다음 날 00:00에는 미납자다.
  - 행사 PATCH 경로의 eventId에 NUL(`%00`)을 넣으면 404다(events.test).
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/registrations/payments.test.ts src/events/events.test.ts`
- [ ] **Step 3: 구현**
  - **만들기·수정**
    - 금액이 바뀌는지(만들기는 0·null과 비교)를 먼저 본다.
    - 금액이 바뀌면 순서대로 확인한다: 정산 → `EVENT_SETTLED`, 입금 확인 있음 → `FEE_LOCKED`, 참가비 0 → 양수인데 계좌 없음 → `FEE_ACCOUNT_REQUIRED`, 납부자 참가비가 null → 값인데 기한 남은 명단 없음 → `DUES_ROSTER_REQUIRED`.
    - 저장한 뒤 납부자 참가비를 켰으면 `rematchDues`, 껐으면 `dues_member = NULL`이다.
  - **신청(공개):** 납부자 참가비가 있으면 `isDuesMember`로 정해 넣는다.
  - **확인·확인 취소·바꾸기**
    - 순서: `requireOpenEvents(tx, org, [eventId])` → 참가 신청 → `purgeExpired(tx, form.id)` → 지우지 않은 신청 → 상태 확인 → 조건을 건 `UPDATE … RETURNING`
    - 0행이면 다시 읽어 `PAYMENT_CONFIRMED`·`PAYMENT_NOT_CONFIRMED`·`NOT_FOUND` 가운데 알맞은 것을 낸다.
  - **`view`:** 계좌, 기한 남은 명단 요약, `payments`(확인한 모든 행: 취소·지운 행 포함), 신청마다 `duesMember`·`fee`·`paid`(확인한 사람 이름은 users 조인)
- [ ] **Step 4: 통과 확인** — `npx tsx --test src/registrations/*.test.ts src/events/events.test.ts src/settlement/settlement.test.ts`
- [ ] **Step 5: 커밋** — `참가 신청 참가비와 입금 확인 API`

### Task 6: 공개 신청·내 신청의 참가비

**Files:**
- Modify: `apps/api/src/registrations/service.ts`, `apps/api/src/registrations/public.test.ts`, `apps/api/src/registrations/payments.test.ts`

**Interfaces (Produces):**
- `publicForm` 응답에 `fee`·`memberFee`를 더한다.
- `lookup`·`cancelMine` 응답에 `payment`를 더한다.
  - 참가비가 0원이고 납부자 참가비도 없고 입금 확인도 없으면 null이다. 취소 응답도 null이다.
  - `account`는 낼 돈이 있고 확인 전일 때만 있다.
- `cancellable`은 마감 전이고 확인 전일 때만 true다.
- 스스로 취소는 확인한 신청이면 `PAYMENT_CONFIRMED`다. `UPDATE`에 `paid_at IS NULL`을 건다.

- [ ] **Step 1: 실패하는 테스트**
  - 공개 신청 화면에 `fee: 5000, memberFee: 0`이 있다. 무료면 `fee: 0, memberFee: null`이다. M3a 기대값도 고친다.
  - 내 신청
    - 미납자: `{ basis: 'nonmember', fee: 5000, paidAt: null, account }`
    - 납부자 0원: `{ basis: 'member', fee: 0, paidAt: null, account: null }`
    - 무료: `payment: null`
    - 확인 뒤: `fee`는 확인 금액, `paidAt`은 한국 시각, `account: null`, `cancellable: false`
  - 엇갈림(Review Focus 4): 학생이 조회(`cancellable: true`)한 뒤 운영진이 확인한다. 그 뒤 학생이 취소하면 `PAYMENT_CONFIRMED`다. 운영진 명단에 신청과 확인이 그대로 있다.
  - 지운 뒤: 보관 기간이 지나 개인 칸을 지운 행도 `paid_amount`·`paid_at`·`dues_member`를 그대로 갖는다(DB 조회).
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/registrations/public.test.ts src/registrations/payments.test.ts`
- [ ] **Step 3: 구현** — 위 Interfaces. `owedOf`·`basisOf`를 쓴다.
- [ ] **Step 4: 통과 확인** — `npm test --workspace @vada/api`
- [ ] **Step 5: 커밋** — `공개 신청과 내 신청에 참가비 보이기`

### Task 7: 명단 붙여 넣기 해석

**Files:**
- Create: `apps/web/src/fees/roster-paste.ts`, `apps/web/src/fees/roster-paste.test.ts`

**Interfaces (Produces):**
- `parseRoster(text: string): RosterParse`
- `RosterParse { members: DuesMember[]; merged: number; problems: RosterProblem[] }`
- `RosterProblem { line: number; reason: 'shape' | 'studentId' | 'name' | 'conflict' }`
- 규칙
  - 줄은 `\r?\n`으로 나눈다. 빈 줄(공백만 포함)은 건너뛴다.
  - 칸은 탭이나 쉼표로 나눈다. 칸 앞뒤 공백은 뺀다. 빈 칸은 무시한다.
  - 칸이 둘이 아니면 `shape`다.
  - 학번 칸: 한 칸이 `studentIdInput`을 통과하면 그것이 학번이고 다른 칸이 이름이다. 둘 다 통과하지 않으면 `studentId`다.
  - 이름 칸: `text(REGISTRATION_NAME_MAX)`를 통과하지 않으면 `name`이다.
  - 첫 줄이 학번이 아니고 "학번"이라는 글자를 포함하면 제목 줄로 보고 건너뛴다.
  - 같은 학번과 같은 이름(공백·대소문자 정리 뒤 같음)이 또 나오면 합치고 `merged`를 센다.
  - 같은 학번에 이름이 다르면 뒤 줄이 `conflict`다.
  - `members`는 처음 나온 순서다. 문제 줄은 `members`에 넣지 않는다.

- [ ] **Step 1: 실패하는 테스트** — Review Focus 2의 모든 모양, 10,001줄은 해석은 하되 화면이 스키마로 막는다(여기서는 수만 확인), 순서 바뀐 칸, 쉼표, 제목 줄이 둘째 줄이면 `studentId` 문제
- [ ] **Step 2: 실패 확인** — `npx vitest run src/fees/roster-paste.test.ts`(apps/web)
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — 같은 명령
- [ ] **Step 5: 커밋** — `학생회비 명단 붙여 넣기 해석`

### Task 8: 참가비 설정 화면

**Files:**
- Create: `apps/web/src/fees/FeeSettings.tsx`, `FeeAccountDialog.tsx`, `RosterUploadDialog.tsx`, `useFeeSettings.ts`, `fee-view.ts`, `fee-fixtures.ts`, `FeeSettings.test.tsx`, `fee-view.test.ts`
- Modify: `apps/web/src/workspace/WorkspaceSidebar.tsx`(재정에게만 "참가비 설정"), `apps/web/src/workspace/Workspace.tsx`(view `'fees'`), `apps/web/src/workspace/Workspace.test.tsx`

**Interfaces:**
- Consumes: Task 1 타입·스키마, Task 7 `parseRoster`
- Produces
  - `useFeeSettings(organizationId, enabled)` → `{ data, loadError, refresh, setAccount(input), replaceRoster(input), deleteRoster(version) }`
    - 바꾸는 함수는 `Promise<{ ok: true } | { ok: false; message: string }>`를 돌려준다. 실패하면 새로 불러온다.
  - `fee-view.ts`
    - `semesterEnd(today: string): string`: 3~8월은 그해 8월 31일, 9~12월은 다음 해 2월 말일, 1~2월은 그해 2월 말일
    - `useUntilRange(today): { min: string; max: string }`: 오늘 ~ 오늘+366일
    - `feeSettingsMessage(code)`: spec 오류(참가비 설정) 문구. `BODY_TOO_LARGE`는 "명단이 너무 커요."다.
    - `findMembers(members, query, limit = 50)`
  - `Workspace`의 view에 `'fees'`, 사이드바 props에 `feesActive`, `onFees: (() => void) | null`(재정이 아니면 null)

- [ ] **Step 1: 실패하는 테스트** — `FeeSettings.test.tsx`(mockApi `/api/organizations/o/fee-settings`)
  - 계좌
    - 없으면 안내와 [계좌 넣기]가 있다. 대화상자에서 은행·번호·예금주를 넣고 저장하면 POST 본문 `{ version: 0, … }`를 보낸다.
    - 번호가 숫자 7자리면 저장이 꺼진다.
    - 있으면 번호·예금주·바꾼 기록 줄을 보여 준다.
  - 명단
    - 없으면 안내와 [명단 올리기]가 있다.
    - 올리기 대화상자
      - 기본 기한은 `semesterEnd(오늘)`이다.
      - 붙여 넣으면 "N명을 찾았어요"와 합친 수를 보여 준다. 문제 줄이 있으면 줄 번호와 이유를 보여 주고 [올리기]가 꺼진다.
      - 고치면 켜지고, POST 본문의 `members`가 정리된 값이다.
    - 있으면 이름·N명·기한 문구·올린 사람을 보여 준다.
      - 찾기 `김`은 맞는 사람만 보여 준다. 51명 이상이 맞으면 "50명까지만 보여요"를 보여 준다.
      - [명단 지우기] 확인 → POST delete `{ version }`
    - 지금 명단이 있을 때 올리기 대화상자는 "지금 명단(…, N명)을 지우고 새 명단으로 바꿔요."를 보여 준다.
  - 409 `VERSION_CONFLICT`: 문구를 보여 주고 다시 불러온다.
  - `Workspace.test`: 재정(approvePurchases) 구성원에게만 "참가비 설정" 메뉴가 있다. 누르면 제목이 "참가비 설정"이다.
- [ ] **Step 2: 실패 확인** — `npx vitest run src/fees src/workspace`
- [ ] **Step 3: 구현**
  - 메뉴 아이콘은 lucide `Landmark`다.
  - 카드·대화상자는 `components/ui`를 쓴다. 명단 찾기 결과는 `ol`이다.
  - 큰 명단(10,000명)의 찾기는 입력할 때마다 거른다. 50명까지만 그린다.
- [ ] **Step 4: 통과 확인** — `npx vitest run src/fees src/workspace`, `npm run typecheck`
- [ ] **Step 5: 커밋** — `참가비 설정 화면: 계좌와 학생회비 명단`

### Task 9: 참가자 탭의 참가비와 입금 확인

**Files:**
- Create: `apps/web/src/registrations/RegistrantDialog.tsx`
- Modify: `apps/web/src/registrations/RegistrationPanel.tsx`, `RegistrationFormDialog.tsx`, `RegistrantList.tsx`, `useRegistration.ts`, `registration-view.ts`, `registration-view.test.ts`, `registration-fixtures.ts`, `RegistrationPanel.test.tsx`, `apps/web/src/public/registration-text.ts`(운영진 오류 문구)

**Interfaces:**
- Consumes: Task 1 타입, Task 5 경로
- Produces
  - `useRegistration`에 `confirmPayment(id)`, `cancelPayment(id)`, `setDuesMember(id, duesMember)`를 더한다.
  - `registration-view.ts`
    - `feeText(form): string`: "없음" / "5,000원" / "5,000원 · 학생회비 납부자 0원"
    - `paymentFilter(list, filter: 'all' | 'unpaid' | 'paid')`
      - `unpaid`는 `fee > 0`이고 확인 전인 신청이다.
      - `paid`는 확인한 신청이다.
    - `paymentChip(entry): { text: string; tone: Tone }`
  - `registrationMessage(code, overrides?)`: 화면마다 다른 문구를 덮어쓴다.

- [ ] **Step 1: 실패하는 테스트**
  - 참가 신청 카드
    - 참가비 줄과 계좌 줄, "받은 참가비 7,000원 · 1명"을 보여 준다.
    - 납부자 참가비가 있고 `roster: null`이면 경고를 보여 준다.
    - [신청 받기 멈추기]는 누르는 동안 꺼진다(응답을 늦춘 mock).
  - 설정 대화상자
    - 참가비 칸과 납부자 체크·칸이 있다. 계좌가 없으면 참가비를 넣을 때 안내가 나오고 저장이 꺼진다.
    - 명단이 없으면 납부자 체크에 안내가 나오고 저장이 꺼진다.
    - 납부자 참가비 ≥ 참가비면 안내가 나오고 저장이 꺼진다.
    - `payments.count > 0`이면 두 칸이 꺼지고 안내가 나온다.
    - 저장 본문에 `fee`·`memberFee`가 있다.
  - 명단
    - 거르기 "전체 3 · 입금 전 1 · 입금 확인 1"이 보이고, 누르면 걸러진다.
    - 칩 "7,000원 · 입금 전"/"7,000원 · 입금 확인"/"참가비 없음"과 "학생회비 납부" 칩이 있다.
    - 줄의 [입금 확인]은 POST payment를 보내고 응답으로 목록을 바꾼다.
    - [관리] 대화상자
      - 입금자명 "신청자13456"(이름+학번 뒤 4자리)을 보여 준다.
      - [입금 확인 취소]는 POST payment/cancel을 보낸다.
      - [미납자 참가비로 바꾸기]는 POST dues `{ duesMember: false }`를 보낸다. 확인한 신청이면 꺼진다.
      - [신청 취소]는 한 번 더 묻는다. 확인한 신청이면 "받은 참가비 7,000원은 그대로 남아요…"를 보여 준다.
    - 참가비가 없는 참가 신청이면 거르기와 칩이 없다(M3a 화면 그대로).
  - 오류: `FEE_LOCKED`, `EVENT_SETTLED`, `PAYMENT_CONFIRMED` 응답의 문구가 spec 표와 같다.
- [ ] **Step 2: 실패 확인** — `npx vitest run src/registrations`
- [ ] **Step 3: 구현**
  - 금액 입력은 수입 대화상자처럼 숫자만 받고 세 자리마다 쉼표를 보인다.
  - 휴대폰 폭에서 줄은 두 줄이다(정보 / 칩과 버튼).
- [ ] **Step 4: 통과 확인** — `npx vitest run src/registrations src/workspace`, `npm run typecheck`
- [ ] **Step 5: 커밋** — `참가자 탭에 참가비와 입금 확인`

### Task 10: 공개 화면의 참가비와 작은 고침

**Files:**
- Create: `apps/web/src/components/AccountInfo.tsx`
- Modify: `apps/web/src/public/ApplyPage.tsx`, `ApplyPage.test.tsx`, `MyRegistrationPage.tsx`, `MyRegistrationPage.test.tsx`, `PublicApp.tsx`, `registration-text.ts`, `registration-text.test.ts`, `saved-tokens.ts`, `apps/web/src/ui-gallery/Gallery.tsx`, `apps/web/src/ui-gallery/Gallery.test.tsx`

**Interfaces (Produces):**
- `AccountInfo({ account }: { account: FeeAccount })`
  - 은행·계좌번호·예금주와 [계좌번호 복사]를 그린다. 복사는 숫자만 한다.
  - 복사에 실패하면 "계좌번호를 복사하지 못했어요. 번호를 길게 눌러 복사해 주세요."를 보인다.
- `registration-text.ts`
  - `feeLine(fee, memberFee): string | null`: 무료면 null
  - `depositorName(name, studentId)`
  - `privacyNotice`에 `fee`, `memberFee` 인자를 더한다(정책 9).
- `saved-tokens.ts`: `forgetTokenValue(token)`. 저장된 신청 링크 가운데 값이 같은 것을 지운다.
- `PublicApp`: `hashchange`를 듣고 `MyRegistrationPage`에 새 토큰을 넘긴다(key로 다시 마운트).

- [ ] **Step 1: 실패하는 테스트**
  - 신청 화면
    - "참가비 5,000원 · 학생회비 납부자 무료"를 보여 준다. 무료면 줄이 없다.
    - 고지의 목적과 명단 대조 문장이 정책 9와 같다.
    - `pageshow`(`persisted: true`)가 오면 신청 버튼이 다시 켜진다. 저장된 토큰을 다시 읽고 신청 정보도 다시 받는다.
  - 내 신청
    - 미납자: 금액, 안내, `AccountInfo`, 입금자명 "김바다3456"과 복사(클립보드 값 확인), 확인 전 문구
    - 납부자 0원: "학생회비 납부자라 참가비가 없어요."
    - 확인됨: "입금 확인됨" 칩과 금액·시각. 계좌가 없다. 취소 버튼 대신 "입금을 확인한 신청은 학생회에 문의해 취소해 주세요."
    - 404(없는 신청): 이 토큰을 값으로 저장한 기기 항목을 지운다.
    - `hashchange`로 다른 토큰이 오면 다시 조회한다.
    - 클립보드 거부: 실패 문구
  - 갤러리: `AccountInfo` 예시가 있다.
- [ ] **Step 2: 실패 확인** — `npx vitest run src/public src/ui-gallery`
- [ ] **Step 3: 구현** — 위 Interfaces. 계좌번호는 글자로도 보여, 복사가 막힌 인앱 브라우저에서 길게 눌러 고를 수 있게 한다.
- [ ] **Step 4: 통과 확인** — `npx vitest run src/public src/ui-gallery src/components`, `npm run typecheck`
- [ ] **Step 5: 커밋** — `공개 신청과 내 신청에 참가비·계좌 보이기`

### Task 11: 문서와 전체 확인

**Files:**
- Modify: `docs/ERD.md`, `AGENTS.md`

- [ ] **Step 1: 문서**
  - `AGENTS.md` "새 API를 만들 때"에 한 줄을 더한다: "본문이 32KB보다 큰 경로는 `guard.ts`의 `bodyLimitOf`에 더한다. 라우트에서 크기를 따로 다루지 않는다."
  - ERD
    - "참가비" 절을 새로 쓴다: `fee_accounts`, `fee_account_events`, `dues_rosters`, `dues_members`
    - "참가 신청" 절의 두 표에 새 칸을 더한다.
- [ ] **Step 2: 전체 검사** — `npm run typecheck`, `npm test --workspace @vada/contracts`, `npm test --workspace @vada/api`, `npm test --workspace @vada/web`, `npm run build --workspace @vada/web`
- [ ] **Step 3: 커밋** — `참가비를 문서에 반영`

## 마무리(계획 밖 절차)

1. 새 컨텍스트 Opus 최종 리뷰. Critical·Important를 고친다.
2. 0021 적용
   - 두 DB에서 이미 적용된 기록이 로컬 파일과 순서·해시까지 같은지 점검한 뒤 적용한다.
   - DB 명령은 권한 확인 창으로 승인받는다.
3. dev 브라우저 확인
   - 참가비 설정(계좌·명단 붙여 넣기)
   - 참가자 탭(참가비 설정·입금 확인)
   - 공개 신청과 내 신청(390px iframe)
4. main에 ff 병합 → 푸시 → CI와 운영 health 확인
5. 진행 메모, known-issues, 상시 지시 메모를 정리한다.
