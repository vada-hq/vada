# M2-3b 실제 수입 기록과 결산서 구현 계획

> **For agentic workers:** 이 저장소는 사용자가 정한 방식(직접 구현 TDD → 새 컨텍스트 Opus 최종 리뷰)으로 실행한다. superpowers:executing-plans로 작업을 차례로 하고, 단계는 체크박스(`- [ ]`)로 따라간다.

**Goal:** 회계 기간마다 실제 수입을 기록하고, 예산 화면에 실제 수입·남은 돈을 보이며, 기간 하나의 결산서를 엑셀로 내려받게 한다.

**Architecture:** 수입은 새 표 `incomes`(기간 FK, 선택 수입 줄)와 처리 기록 `income_events`에 둔다. 수입 API는 새 모듈 `apps/api/src/incomes`이고 `AppOptions.incomes`로 연결한다. 편성 응답(`planOf`)은 기간 숫자 함수(`periodNumbers`)로 나눠 화면과 결산서가 같은 정의를 쓴다. 결산서는 순수 함수(`budget/workbook.ts`)가 그리고, 자료는 읽기 전용 REPEATABLE READ 거래 하나에서 모은다.

**Tech Stack:** Hono, drizzle-orm(PostgreSQL·PGlite), zod 4, write-excel-file, React 19 + Tailwind, vitest, node:test.

**Spec:** `docs/superpowers/specs/2026-10-10-semester-settlement-design.md`

## Global Constraints

- 요청 본문은 contracts의 `z.strictObject`, 문자열은 `text(max)`/`token(max)`, 모든 문자열·배열·숫자에 상한.
- 라우트는 `json(Schema)`를 인증보다 앞에 두고 `c.req.valid('json')`만 쓴다. 실패는 `ApiError(code, status)`.
- 길이 제한 칸은 DB CHECK도 같은 값: 내용 100, 메모 200, 취소 사유 200.
- 화면 버튼은 같은 스키마의 `safeParse`로 켠다. 길이 숫자를 화면에 다시 적지 않는다.
- 화면은 `components/ui` 부품과 Tailwind 기본 스케일·테마 토큰만. 긴 글에는 `wrap-anywhere`.
- 로그·오류 응답에 내용·메모·금액·사유를 넣지 않는다.
- 커밋 제목은 한국어 명령형 50자 안, AI 서명·트레일러를 붙이지 않는다.
- 새 테스트 파일은 워크스페이스 `test` 스크립트 목록에 더한다(api·contracts는 파일을 나열한다).

## Review Focus

1. 기간 시작 전에 결제한 행사 지출: 3a 기준대로 결산서 내역에 들어가고, 잔액이 처음에 음수여도 합계가 요약과 같아야 한다 → Task 5 시트 테스트, Task 6 자료 테스트.
2. 취소한 수입만 새 기간 밖으로 나가는 날짜 변경: 막지 않아야 한다 → Task 4 테스트.
3. 금액을 "750,000"처럼 쉼표로 입력: 750000으로 저장돼야 한다 → Task 8 대화상자 테스트.
4. 지난 기간이나 다음 기간을 보면서 수입 기록: 받은 날 기본값이 가까운 쪽 끝날이고, 기간 밖 날짜는 저장을 끄고 안내한다 → Task 7 단위 테스트, Task 8 대화상자 테스트.
5. "="로 시작하거나 `<>&`가 든 내용: 엑셀에서 수식이 아니라 글로 남아야 한다 → Task 5 시트 테스트.

---

### Task 1: 수입 계약

**Files:**
- Create: `packages/contracts/src/incomes.ts`, `packages/contracts/src/incomes.test.ts`
- Modify: `packages/contracts/src/budget.ts`(응답 칸), `packages/contracts/src/index.ts`(내보내기), `packages/contracts/package.json`(test 목록)

**Interfaces (Produces):**
- `INCOME_DESCRIPTION_MAX = 100`, `INCOME_NOTE_MAX = 200`, `INCOME_VOID_REASON_MAX = 200`, `INCOME_RECORDS_MAX = 300`, `type IncomeAction = 'created' | 'updated' | 'voided'`
- `CreateIncomeSchema`: `{ description, amount(1..PURCHASE_INTEGER_MAX 정수), receivedOn(달력 날짜 2000-01-01~2999-12-31), budgetLineId: token(64) | null, note: text(200) | null }`
- `UpdateIncomeSchema = { version(1 이상), ...Create }`, `VoidIncomeSchema = { version, reason: text(200) }`
- `IncomeSummary { id, budgetLine: {id,name}|null, description, amount, receivedOn, note, recordedBy: ExpensePerson, voided: {by,at,reason}|null, version, createdAt, updatedAt }`
- `IncomeHistoryEntry { id, action, actor, changes, createdAt }`, `IncomeDetail extends IncomeSummary { history }`, `IncomeResponse { income }`
- `BudgetIncomeLine`에 `received`, `incomeCount`. `BudgetTotals`에 `received`, `balance`. `BudgetPlanResponse`에 `unassignedIncome: { received, count }`, `incomeRecords: IncomeSummary[]`, `incomeRecordsTruncated: boolean`.

- [ ] **Step 1: 실패하는 계약 테스트** — `incomes.test.ts`
  - 받는 것: 항목·메모가 있는 본문과 null인 본문, 앞뒤 공백 지움, 기간 끝 날짜, 상한 글자(이모지 100자)
  - 거절: 필수값 누락, `budgetLineId`·`note` 빠짐, 빈 값·공백만, 상한+1(이모지), NUL·홀로 쓰인 서러게이트, 금액 0·음수·소수·2147483648·문자열, 없는 날짜(2026-02-30)·형식(2026-9-1)·범위 밖, 버전 0·소수, 사유 공백, 모르는 키, 빈 `budgetLineId`
- [ ] **Step 2: 실행해 실패 확인** — `npx tsx --test src/incomes.test.ts`(packages/contracts) → 모듈 없음
- [ ] **Step 3: 구현** — `incomes.ts`(아래), `budget.ts` 응답 칸, `index.ts` 내보내기, `package.json` 목록

```ts
const id = token(64)
const version = z.number().int().min(1).max(PURCHASE_INTEGER_MAX)
const receivedOn = purchaseDate.refine(value => value >= '2000-01-01' && value <= '2999-12-31')
const fields = { description: text(INCOME_DESCRIPTION_MAX), amount: z.number().int().min(1).max(PURCHASE_INTEGER_MAX), receivedOn,
  budgetLineId: id.nullable(), note: text(INCOME_NOTE_MAX).nullable() }
export const CreateIncomeSchema = z.strictObject(fields)
export const UpdateIncomeSchema = z.strictObject({ version, ...fields })
export const VoidIncomeSchema = z.strictObject({ version, reason: text(INCOME_VOID_REASON_MAX) })
```

- [ ] **Step 4: 통과 확인** — `npm test --workspace @vada/contracts`, `npm run typecheck`(웹 고정값이 새 칸 없이 깨지면 Task 7에서 고친다. 이 단계에서는 contracts만 본다: `npx tsc --noEmit -p packages/contracts`)
- [ ] **Step 5: 커밋** — `수입 계약 추가`

### Task 2: 수입 표와 마이그레이션 0018

**Files:**
- Modify: `apps/api/src/db/schema.ts`(끝에 `incomes`, `incomeEvents`)
- Create: `apps/api/migrations/0018_incomes.sql`, `meta/0018_snapshot.json`, `meta/_journal.json`(drizzle-kit 생성)
- Test: `apps/api/src/db/migrations.test.ts`에 `0018` 테스트

**Interfaces (Produces):** `incomes`(id, organizationId, periodId, budgetLineId, description, amount, receivedOn, note, recordedBy, version, voidedAt, voidedBy, voidReason, createdAt, updatedAt), `incomeEvents`(id, organizationId, incomeId, actorId, action, changes, createdAt)

- [ ] **Step 1: 실패하는 마이그레이션 테스트** — 0017 테스트와 같은 꼴로 `migrationsBefore('0018_incomes')`에서 시작해 올린 뒤:
  - 기존 지출·기간·줄이 그대로다.
  - 수입: 정상 행, `incomes_description_not_blank`·`_length`(101자), `_amount_positive`(0), `_received_on_range`, `_note_not_blank`·`_length`, `_version_positive`, `_void_triple`(셋 중 하나만), `_void_reason_not_blank`·`_length`, `incomes_period_same_organization`(다른 학생회 기간), `incomes_budget_line_same_organization`(다른 학생회 줄), 수입이 고른 줄 지우기 거절
  - 처리 기록: `created/updated/voided`만, `changes`는 객체, 수입은 같은 학생회
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/db/migrations.test.ts`(apps/api) → 0018 폴더 없음
- [ ] **Step 3: 스키마 추가 후 생성** — `npx drizzle-kit generate --name incomes`(apps/api). SQL은 LF(`.gitattributes`). 스키마는 spec "데이터"의 칸·CHECK·색인 그대로(색인 `incomes_period_received_idx(period_id, received_on)`, `incomes_budget_line_idx(organization_id, budget_line_id)`, `income_events_income_idx(income_id, created_at)`).
- [ ] **Step 4: 통과 확인** — 같은 명령, `npx tsx --test src/db/schema.test.ts`
- [ ] **Step 5: 커밋** — `수입 표와 마이그레이션 0018 추가`

### Task 3: 수입 API

**Files:**
- Create: `apps/api/src/incomes/service.ts`, `apps/api/src/incomes/routes.ts`, `apps/api/src/incomes/incomes.test.ts`
- Modify: `apps/api/src/app.ts`(`incomes?: ReturnType<typeof createIncomeRoutes>`, `app.route`), `apps/api/src/serve.ts`, `apps/api/src/purchases/test-setup.ts`, `apps/api/src/http/boundary.test.ts`, `apps/api/package.json`

**Interfaces:**
- Consumes: `requireFinance(tx, scope, true)`, `ApiError`, `incomes`·`incomeEvents`·`budgetLines`·`budgetPeriods`
- Produces: `incomeSummaries(db, organizationId, where, limit): Promise<IncomeSummary[]>`(받은 날·기록 최근 순), `createIncomeService(db)`의 `get/create/update/void(scope, periodId, …)`, `createIncomeRoutes(db, session)`
- 경로: `POST|GET|PATCH /organizations/:organizationId/budget/periods/:periodId/incomes[/:incomeId]`, `POST …/:incomeId/void`

- [ ] **Step 1: 실패하는 API 테스트** — `incomes.test.ts`
  - 기록: p·n·x 403, 미인증 401, 회장 기록 성공(항목·메모·처리 기록 `created`), 첫날·끝날 받음, 8/31·3/1 `DATE_OUTSIDE_PERIOD`, 다른 기간 수입 줄·운영 줄·없는 줄·다른 학생회 줄 `BUDGET_LINE_INVALID`, 다른 학생회·없는 기간 404
  - 본문 오류 400: 내용 빠짐·공백·이모지 101자·메모 NUL·금액 0·모르는 키
  - 수정: 같은 값이면 버전·기록 그대로, 바꾸면 버전 2와 바뀐 칸(`description·amount·receivedOn·note·budgetLine{from 이름,to 이름}`), 옛 버전 409, 기간 밖 날짜 409, 다른 기간 경로 404, 없는 ID·65자 ID 404
  - 취소: p·n 403(수정도), 재정 취소(사유·버전 2·기록 `voided {reason}`), 다시 취소·수정 `INVALID_STATE`, n은 상세를 본다, x 403, 미인증 401
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/incomes/incomes.test.ts` → 404(라우트 없음)
- [ ] **Step 3: 구현**
  - 쓰기: `requireFinance(tx, scope, true)` → 기간 행 `FOR SHARE`(없으면 404) → 수정·취소는 수입 행 `FOR UPDATE`(학생회·기간·ID, 버전 → `VERSION_CONFLICT`, 취소됨 → `INVALID_STATE`) → 받은 날이 기간 밖이면 `DATE_OUTSIDE_PERIOD` → 줄이 없거나 수입 줄이 아니거나 다른 기간이면 `BUDGET_LINE_INVALID`
  - 수정은 바뀐 칸만 `{ from, to }`로 남기고, 바뀐 것이 없으면 그대로 돌려준다.
  - 상세는 학생회·기간·ID로 찾고(없으면 404) 처리 기록을 오래된 순으로 붙인다.
  - 라우트는 `json(Schema)`를 `auth`·`member`보다 앞에 두고, 경로 ID는 `token(64)`로 검사한다(틀리면 404).
- [ ] **Step 4: 통과 확인** — 같은 파일, `npx tsx --test src/http/boundary.test.ts`
- [ ] **Step 5: 커밋** — `수입 API: 기록·수정·취소와 상세`

### Task 4: 편성 응답에 실제 수입과 남은 돈

**Files:**
- Modify: `apps/api/src/budget/service.ts`, `apps/api/src/budget/budget.test.ts`

**Interfaces:**
- Consumes: `incomeSummaries`(Task 3)
- Produces: `periodNumbers(db, scope, period): Promise<PeriodNumbers>` — `{ incomes, events, operating, unassigned, unassignedIncome, totals }`. `planOf`는 여기에 `candidates·notices·history·incomeRecords·incomeRecordsTruncated`를 더한다.

- [ ] **Step 1: 실패하는 테스트**
  - 기존 "편성 읽기" 테스트의 기대값에 `received: 0, incomeCount: 0`, `totals.received: 0, balance: -72000`, `unassignedIncome`, `incomeRecords: []`를 더한다.
  - 새 테스트(편성 읽기): 학생회비 줄 수입 2건(하나는 10/2)·지원금 줄 취소한 수입 1건·항목 없는 수입 1건(10/2)·다른 기간 수입 1건·상시 운영 지출 12,000원 → 줄 `[학생회비 800000 750000 2]`, `[지원금 200000 0 0]`, 항목 없는 수입 `{30000,1}`, 합계 `received 780000, spent 12000, balance 768000`, 내역 순서(받은 날 최근, 같은 날 나중 기록 먼저, 취소한 것 포함)
  - 새 테스트(편성 저장): 수입이 고른 지원금 줄 지우기 409 `LINE_IN_USE` → 취소한 수입만 고른 줄 지우기 통과·표시 지움 → 취소한 수입만 밖으로 나가는 시작일 변경 통과 → 항목 있는 수입·없는 수입이 밖으로 나가는 시작일·끝일 변경 409 `INCOMES_OUTSIDE_PERIOD`
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/budget/budget.test.ts`
- [ ] **Step 3: 구현**
  - `periodNumbers`: 수입을 `budget_line_id`로 묶어(취소 제외) 줄마다 `received·incomeCount`, null 묶음이 `unassignedIncome`, 전부 합이 `totals.received`, `balance = received − spent`
  - `applyLines('income')`: 지우는 줄을 고른 취소하지 않은 수입이 있으면 `LINE_IN_USE`, 취소한 수입의 표시는 `updatedAt`을 그대로 두고 지운다.
  - `assertIncomesInside`: 날짜가 바뀔 때 이 기간의 취소하지 않은 수입이 새 날짜 밖이면 `INCOMES_OUTSIDE_PERIOD`
- [ ] **Step 4: 통과 확인** — 같은 파일
- [ ] **Step 5: 커밋** — `편성에 실제 수입과 남은 돈 더하기`

### Task 5: 결산서 시트

**Files:**
- Create: `apps/api/src/workbook/cells.ts`(셀 도움 함수·파일 이름·머리글 옮김), `apps/api/src/workbook/read-book.ts`(테스트용 xlsx 읽기 옮김), `apps/api/src/budget/workbook.ts`, `apps/api/src/budget/workbook.test.ts`
- Modify: `apps/api/src/settlement/workbook.ts`(옮긴 함수 가져다 쓰기, `contentDisposition`·`koreanTime`은 다시 내보냄), `apps/api/src/settlement/workbook.test.ts`(readBook 가져오기), `apps/api/package.json`

**Interfaces (Produces):**
- `cells.ts`: `text, bold, money(value, strong?), count, rate, day, link, header, koreanTime, workbookFileName(name, fallback, label, at), contentDisposition, XLSX_TYPE`
- `budget/workbook.ts`: `PeriodSheetData`, `SheetIncome { receivedOn, line|null, description, amount, note|null, recordedBy }`, `SheetLedgerExpense { paidOn, line, vendor, description, amount, method, payer, note|null, recordedBy, receipts[] }`, `periodWorkbook(data): Promise<Buffer>`, `periodFileName(name, at)`, 머리글 상수 `INCOME_HEADER, SPENDING_HEADER, LEDGER_HEADER, LEDGER_RECEIPT_HEADER`
- 시트: 요약 · 수입 결산 · 지출 결산 · 수입·지출 내역 · 증빙 (spec "결산서")
  - 항목 없는 수입·지출 줄은 건수가 있을 때만 둔다.
  - 남은 예산 서식은 `#,##0;#,##0" 초과"`, 비율·집행률은 `0.0%`이고 분모가 0이거나 미정이면 "—"다.
  - 내역은 날짜 순, 같은 날 수입 먼저, 같은 종류는 받은 순서다.

- [ ] **Step 1: 실패하는 시트 테스트**
  - 요약 값: 수입 예산·실제 수입·예산(미정 메모)·실제 지출·집행률·지출 예정(제외 메모)·남은 예산·남은 돈·건수, 취소·기준·잔액 알림 줄
  - 수입 결산: 0원 예산 비율 "—", 항목 없는 수입 줄, 합계
  - 지출 결산: 정산 완료·미정·초과 운영 줄, 항목 없는 지출 "1건", 합계
  - 내역: 기간 전 결제 행사 지출이 맨 위이고 잔액이 음수부터 시작, 같은 날 수입 먼저, "=후원금"은 글
  - 증빙: 내역 번호와 링크
  - 빈 기간: 머리글과 합계만, 알림 줄에 취소 줄 없음
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/budget/workbook.test.ts`
- [ ] **Step 3: 구현** — 셀 함수 옮기고 시트 다섯을 그린다. 정산서 테스트가 그대로 통과해야 한다.
- [ ] **Step 4: 통과 확인** — `npx tsx --test src/budget/workbook.test.ts src/settlement/workbook.test.ts src/settlement/settlement.test.ts`
- [ ] **Step 5: 커밋** — `결산서 시트 만들기`

### Task 6: 결산서 내려받기 API

**Files:**
- Modify: `apps/api/src/budget/service.ts`(`exportData`), `apps/api/src/budget/routes.ts`(`createBudgetRoutes(db, session, publicOrigin)`, `GET /:periodId/export`), `apps/api/src/serve.ts`, `apps/api/src/purchases/test-setup.ts`, `apps/api/src/http/boundary.test.ts`, `apps/api/src/budget/budget.test.ts`

**Interfaces:**
- Consumes: `periodNumbers`(Task 4), `periodWorkbook`·`periodFileName`·`contentDisposition`·`XLSX_TYPE`(Task 5)
- Produces: `exportData(scope, periodId, publicOrigin): Promise<PeriodSheetData>`

- [ ] **Step 1: 실패하는 테스트**
  - 자료: 기간 수입(취소 제외, 받은 날·기록 순), 지출은 기간에 넣은 행사의 지출 전부(기간 전 결제 포함)와 결제일이 기간 안인 상시 운영 지출(줄 있음·없음)이고, 기간 밖 상시 운영·기간에 없는 행사·취소한 지출은 뺀다. 증빙 링크, 취소 건수 `{incomes:1, expenses:1}`, 합계
  - 경로: n이 받음(머리글·파일 이름 `2026_2학기 결산 {오늘}.xlsx`·시트 이름 다섯), x 403, 미인증 401, 다른 학생회 기간 404, 지출 1,001건·수입 1,001건 각각 `EXPORT_TOO_LARGE`
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/budget/budget.test.ts`
- [ ] **Step 3: 구현** — `db.transaction(fn, { isolationLevel: 'repeatable read', accessMode: 'read only' })` 안에서 기간·숫자·수입·지출·증빙·취소 건수·학생회 이름을 읽는다. 상한은 1,000건씩(`limit(1001)`로 넘침 확인). 영수증 주소는 정산서와 같은 경로.
- [ ] **Step 4: 통과 확인** — `npx tsx --test src/budget/budget.test.ts src/http/boundary.test.ts`
- [ ] **Step 5: 커밋** — `결산서 내려받기 API`

### Task 7: 화면 도움 함수와 내려받기 함수

**Files:**
- Create: `apps/web/src/lib/download.ts`, `apps/web/src/lib/download.test.ts`, `apps/web/src/budget/income-view.ts`, `apps/web/src/budget/income-view.test.ts`, `apps/web/src/budget/useIncomes.ts`
- Modify: `apps/web/src/settlement/settlement-view.ts`(`downloadName` 옮김), `settlement-view.test.ts`, `useEventFinance.ts`(`downloadFile` 사용), `apps/web/src/budget/budget-fixtures.ts`(새 칸·`incomeSummary` 고정값), `apps/web/src/budget/budget-view.ts`(오류 문구·`shareText`·`periodDayText`)

**Interfaces (Produces):**
- `downloadName(disposition, fallback)`, `downloadFile(url, fallbackName): Promise<{ ok: true } | { ok: false; code: unknown }>`
- `incomeHistoryText(entry)`, `defaultReceivedOn(period, today)`, `incomeMessage(code)`, `incomeFailure`
- `IncomeResult`, `createIncome(org, period, input)`, `updateIncome(org, period, id, input)`, `voidIncome(org, period, id, input)`, `fetchIncome(org, period, id): Promise<IncomeDetail | null>`
- `shareText(received, amount)` → `예산의 N%` 또는 null, `periodDayText(day)` → `2026.9.1`, `budgetExportUrl(org, period)`(useBudget.ts)
- 오류 문구: `LINE_IN_USE` 바꿈, `INCOMES_OUTSIDE_PERIOD`·`EXPORT_TOO_LARGE` 더함

- [ ] **Step 1: 실패하는 단위 테스트** — 기본 날짜(안·전·후), 처리 기록 문구(기록·수정 칸·없음·금액·취소), 내려받기 이름(기본값 인자)
- [ ] **Step 2: 실패 확인** — `npx vitest run src/budget/income-view.test.ts src/lib/download.test.ts`(apps/web)
- [ ] **Step 3: 구현** — 위 함수, 고정값, 행사 재정 탭이 `downloadFile`을 쓰게 바꾼다.
- [ ] **Step 4: 통과 확인** — `npm test --workspace @vada/web`, `npm run typecheck`
- [ ] **Step 5: 커밋** — `수입 화면 도움 함수와 내려받기 함수 정리`

### Task 8: 수입 기록·상세 대화상자

**Files:**
- Create: `apps/web/src/budget/IncomeFormDialog.tsx`, `IncomeFormDialog.test.tsx`, `IncomeDetailDialog.tsx`, `IncomeDetailDialog.test.tsx`

**Interfaces:**
- `IncomeFormDialog({ open, period: {startsOn,endsOn}, lines: {id,name}[], income: IncomeDetail | null, onClose, onSubmit(input) => Promise<IncomeResult>, onSaved(income) })`
- `IncomeDetailDialog({ organizationId, periodId, incomeId: string | null, finance, onClose, onChanged, onEdit(income) })`

- [ ] **Step 1: 실패하는 테스트**
  - 기록: 수입 줄이 없으면 항목 고르기가 없다. "750,000" 입력이 750000으로 나간다. 빈 내용·기간 밖 날짜는 저장이 꺼지고 안내 문구가 보인다. 실패 문구가 보인다. 수정은 원래 값으로 열고 `저장`이다.
  - 상세: 칸·처리 기록. 재정 권한자는 수정·취소(사유 → 취소하기 → `onChanged`, 취소됨 문구)를 쓴다. 취소한 수입과 권한 없는 사람에게는 버튼이 없다.
- [ ] **Step 2: 실패 확인** — `npx vitest run src/budget/IncomeFormDialog.test.tsx src/budget/IncomeDetailDialog.test.tsx`
- [ ] **Step 3: 구현** — 지출 대화상자와 같은 꼴. 금액은 글 칸(`inputMode="numeric"`)이고 `budgetInput`으로 읽는다.
- [ ] **Step 4: 통과 확인** — 같은 명령
- [ ] **Step 5: 커밋** — `수입 기록·상세 대화상자`

### Task 9: 예산 화면 연결

**Files:**
- Create: `apps/web/src/budget/IncomeCard.tsx`
- Modify: `apps/web/src/budget/BudgetPlanView.tsx`, `Budget.tsx`, `BudgetPlanForm.tsx`, `Budget.test.tsx`, `BudgetPlanForm.test.tsx`

- [ ] **Step 1: 실패하는 테스트**
  - 보기: 수입 줄의 예산·실제 수입·`예산의 94%`, 항목 없는 수입 줄, `실제 수입 N원 · 남은 돈 N원`, 수입 내역 카드(취소됨). 카드를 누르면 상세가 열린다.
  - 남은 돈이 음수면 경고를 보이고, 재정 권한자에게만 확인 문구를 덧붙인다. 권한이 없으면 `수입 기록`이 없다.
  - 수입을 기록하면 편성을 다시 받고 상세가 열린다.
  - 결산서를 내려받으면 서버 파일 이름으로 받고, 409면 문구를 보인다.
  - 편성 수정에서 수입이 고른 줄의 지우기가 꺼지고 "이 항목을 고른 수입이 있어요"가 보인다.
- [ ] **Step 2: 실패 확인** — `npx vitest run src/budget`
- [ ] **Step 3: 구현** — spec "화면"대로. 내려받기·대화상자 상태는 `Budget.tsx`가 갖고, 보기는 콜백만 받는다.
- [ ] **Step 4: 통과 확인** — `npm test --workspace @vada/web`, `npm run typecheck`
- [ ] **Step 5: 커밋** — `예산 화면에 수입과 결산서 연결`

### Task 10: 문서와 전체 검사

**Files:** `docs/ERD.md`("수입" 절과 mermaid)

- [ ] **Step 1:** ERD에 `incomes`·`income_events`와 규칙(기간에 속함, 받은 날은 기간 안, 수입 줄만, 취소로 남김)을 더한다.
- [ ] **Step 2:** `npm test --workspace @vada/api`, `npm test --workspace @vada/contracts`, `npm test --workspace @vada/web`, `npm run typecheck` 모두 통과
- [ ] **Step 3: 커밋** — `수입과 결산서를 문서에 반영`
