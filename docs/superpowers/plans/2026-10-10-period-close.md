# M2-3c 회계 기간 마감과 이월 구현 계획

> **For agentic workers:** 이 저장소는 사용자가 정한 방식(직접 구현 TDD → 새 컨텍스트 Opus 최종 리뷰)으로 실행한다. superpowers:executing-plans로 작업을 차례로 하고, 단계는 체크박스(`- [ ]`)로 따라간다.

**Goal:** 회계 기간을 마감해 그 기간의 편성·수입·상시 운영 지출을 잠그고, 남은 돈을 다음 기간의 수입 한 건으로 넘기며, 사유를 남기고 다시 열게 한다.

**Architecture:** 마감 상태는 `budget_periods.closed_at/closed_by`, 이월금은 `incomes.carried_from_period_id`가 있는 보통 수입이다. 마감 조건·다음 기간·넘긴 이월금은 `budget/closing.ts`의 `closingOf`가 한 곳에서 세고, 편성 응답과 마감 요청이 같이 쓴다. 잠금 도움 함수는 `budget/lock.ts`에 모은다. 학생회 예산 advisory lock을 마감·다시 열기가 혼자, 지출 변경이 같이(shared) 잡아 마감 확인과 지출 변경을 한 줄로 세운다.

**Tech Stack:** Hono, drizzle-orm(PostgreSQL·PGlite), zod 4, write-excel-file, React 19 + Tailwind, vitest, node:test.

**Spec:** `docs/superpowers/specs/2026-10-10-period-close-design.md`

## Global Constraints

- 요청 본문은 contracts의 `z.strictObject`, 문자열은 `text(max)`/`token(max)`, 모든 문자열·숫자에 상한. 다시 열기 사유 200자.
- 라우트는 `json(Schema)`를 인증보다 앞에 두고 `c.req.valid('json')`만 쓴다. 실패는 `ApiError(code, status)`. 라우트별 `onError`를 만들지 않는다.
- 길이 제한 칸은 DB CHECK도 같은 값(`budget_period_events.reason` 200자).
- 새 칸을 새 코드가 읽으므로 0019는 두 DB에 먼저 적용한 뒤 배포한다. `action` 검사는 넓히기만 한다.
- 잠금 순서: 재정 권한 확인 → 학생회 예산 잠금 → 지출 행 → 기간 행 → 행사 행.
- 화면 버튼은 같은 스키마의 `safeParse`로 켠다. 길이 숫자를 화면에 다시 적지 않는다.
- 화면은 `components/ui` 부품과 Tailwind 기본 스케일·테마 토큰만. 긴 이름에는 `wrap-anywhere`.
- 화면 문구는 spec "화면 문구" 표 그대로 쓴다.
- 로그·오류 응답에 기간 이름·금액·사유를 넣지 않는다.
- 시간에 기대는 테스트는 확실히 지난 날짜(2025년 이전)나 먼 미래(2999년), 또는 테스트 안에서 계산한 한국 날짜만 쓴다.
- 커밋 제목은 한국어 명령형 50자 안, AI 서명·트레일러를 붙이지 않는다.
- 새 테스트 파일은 워크스페이스 `test` 스크립트 목록에 더한다(api·contracts는 파일을 나열한다).

## Review Focus

1. 결제일이 마감한 기간 안인 **행사 지출**인데 그 행사가 열린 기간에 있거나 어느 기간에도 없음: 막지 않아야 한다(잠금은 상시 운영 지출만 날짜로 본다) → Task 4 테스트.
2. 마감한 기간의 상시 운영 지출을 행사 지출로 옮기는 수정(바꾸기 전 결제일이 마감한 기간 안): `PERIOD_CLOSED`여야 한다 → Task 4 테스트.
3. 다시 연 뒤 수입을 더하고 다시 마감: 옛 이월금은 취소로 남고, 새 금액의 이월금이 하나만 생겨야 한다(부분 unique 색인) → Task 3 테스트.
4. 끝일 당일(한국 날짜): 마감할 수 없고, 다음 날부터 된다 → Task 3 테스트(테스트 안에서 오늘을 계산).
5. 남은 돈이 0원: 다음 기간이 없어도 마감되고, 있어도 이월금을 만들지 않는다 → Task 3 테스트.

---

### Task 1: 마감 계약

**Files:**
- Modify: `packages/contracts/src/budget.ts`, `incomes.ts`, `expenses.ts`, `settlement.ts`, `index.ts`
- Test: `packages/contracts/src/budget.test.ts`

**Interfaces (Produces):**
- `BUDGET_REOPEN_REASON_MAX = 200`
- `BudgetPeriodAction = 'created' | 'updated' | 'closed' | 'reopened'`
- `ClosePeriodSchema = z.strictObject({ version: 1..PURCHASE_INTEGER_MAX 정수, carryoverLineId: token(64).nullable() })`, `ClosePeriodRequest`
- `ReopenPeriodSchema = z.strictObject({ version, reason: text(200) })`, `ReopenPeriodRequest`
- `BudgetPeriodSummary.closed: boolean`
- `BudgetHistoryEntry.reason: string | null`
- `BudgetClosing { ended: boolean; earlierOpen: { id; name } | null; missingEvidence: number; next: { id; name; startsOn; closed: boolean; incomes: { id; name }[] } | null; carriedOver: { period: { id; name }; amount: number } | null }`
- `BudgetPlanResponse.period.closed: { by: ExpensePerson; at: string } | null`, `BudgetPlanResponse.closing: BudgetClosing`
- `IncomeSummary.carriedFrom: { id: string; name: string } | null`
- `ExpenseSummary.periodClosed: boolean`, `EventFinance.periodClosed: boolean`

- [ ] **Step 1: 실패하는 계약 테스트** — `budget.test.ts`에 더한다
  - 마감: `{ version: 1, carryoverLineId: null }`과 `'l1'`을 받는다. 버전 0·소수·문자열, `carryoverLineId` 빠짐·빈 문자열·65자, 모르는 키는 거절
  - 다시 열기: 사유 앞뒤 공백을 지운다. 이모지 200자는 받는다. 사유 빠짐·빈 값·공백만·이모지 201자·NUL·홀로 쓰인 서러게이트, 버전 빠짐, 모르는 키는 거절
  - `isStrictObject` 목록에 두 스키마를 더한다.
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/budget.test.ts`(packages/contracts) → 내보내기 없음
- [ ] **Step 3: 구현**

```ts
export const BUDGET_REOPEN_REASON_MAX = 200
const version = z.number().int().min(1).max(PURCHASE_INTEGER_MAX)
// 기간 마감. 남은 돈이 있으면 다음 기간의 이 수입 줄로 넘긴다(고르지 않으면 null).
export const ClosePeriodSchema = z.strictObject({ version, carryoverLineId: id.nullable() })
export const ReopenPeriodSchema = z.strictObject({ version, reason: text(BUDGET_REOPEN_REASON_MAX) })
```

  응답 타입은 위 Interfaces 그대로 더하고 `index.ts`에서 내보낸다.
- [ ] **Step 4: 통과 확인** — `npm test --workspace @vada/contracts`, `npx tsc --noEmit -p packages/contracts`(api·웹 고정값은 Task 3·6에서 고친다)
- [ ] **Step 5: 커밋** — `기간 마감 계약 추가`

### Task 2: 마감 칸과 마이그레이션 0019

**Files:**
- Modify: `apps/api/src/db/schema.ts`(`budgetPeriods`, `budgetPeriodEvents`, `incomes`)
- Create: `apps/api/migrations/0019_period_close.sql`, `meta/0019_snapshot.json`, `meta/_journal.json`(drizzle-kit 생성)
- Test: `apps/api/src/db/migrations.test.ts`에 `0019` 테스트

**Interfaces (Produces):** `budgetPeriods.closedAt/closedBy`, `budgetPeriodEvents.reason`(action 넷), `incomes.carriedFromPeriodId`

- [ ] **Step 1: 실패하는 마이그레이션 테스트** — 0018 테스트와 같은 꼴로 `migrationsBefore('0019_period_close')`에서 시작해 기간 둘(o: p·n, o2: q)·수입·처리 기록을 넣고 올린 뒤:
  - 기존 기간·수입·처리 기록이 그대로이고 새 칸은 NULL이다.
  - 기간: `closed_at`만 있거나 `closed_by`만 있으면 `budget_periods_closed_pair`, 둘 다 있으면 된다.
  - 처리 기록: `closed`(changes 객체)와 사유 있는 `reopened`는 된다. 사유 없는 `reopened`와 사유 있는 `created`는 `budget_period_events_reason_when_reopened`, 공백 사유 `_reason_not_blank`, 201자 `_reason_length`, `deleted`는 `_action_valid`
  - 수입: `carried_from_period_id`가 자기 기간이면 `incomes_carried_from_other_period`, 다른 학생회 기간이면 `incomes_carried_from_same_organization`. 같은 기간에서 넘긴 취소하지 않은 이월금 둘째는 `incomes_carried_from_active_unique`. 첫째를 취소하면 새 것을 넣을 수 있다.
  - 이월금이 가리키는 기간은 지울 수 없다(FK).
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/db/migrations.test.ts`(apps/api) → `Migration not found: 0019_period_close`
- [ ] **Step 3: 스키마 추가 후 생성**

```ts
// budgetPeriods에 더한다. 마감한 때와 사람(M2-3c). 둘이 함께 있거나 함께 없다.
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closedBy: text('closed_by').references(() => users.id, { onDelete: 'restrict' }),
  check('budget_periods_closed_pair', sql`(${table.closedAt} IS NULL) = (${table.closedBy} IS NULL)`),
// budgetPeriodEvents
  action: text('action', { enum: ['created', 'updated', 'closed', 'reopened'] }).notNull(),
  // 다시 열 때만 있다.
  reason: text('reason'),
  check('budget_period_events_action_valid', sql`${table.action} IN ('created','updated','closed','reopened')`),
  check('budget_period_events_reason_when_reopened', sql`(${table.action} = 'reopened') = (${table.reason} IS NOT NULL)`),
  check('budget_period_events_reason_not_blank', sql`${table.reason} ~ '[^[:space:]]'`),
  check('budget_period_events_reason_length', sql`char_length(${table.reason}) <= 200`),
// incomes. 이월금이면 넘겨준 기간. 손으로 고치거나 취소하지 않는다.
  carriedFromPeriodId: text('carried_from_period_id'),
  foreignKey({ name: 'incomes_carried_from_same_organization', columns: [table.organizationId, table.carriedFromPeriodId],
    foreignColumns: [budgetPeriods.organizationId, budgetPeriods.id] }).onDelete('restrict'),
  check('incomes_carried_from_other_period', sql`${table.carriedFromPeriodId} <> ${table.periodId}`),
  // 기간 하나가 넘기는 이월금은 취소하지 않은 것이 한 건뿐이다.
  uniqueIndex('incomes_carried_from_active_unique').on(table.carriedFromPeriodId)
    .where(sql`${table.carriedFromPeriodId} IS NOT NULL AND ${table.voidedAt} IS NULL`),
```

  `npx drizzle-kit generate --name period_close`(apps/api). 생성된 SQL에서 `action` 검사가 DROP 뒤 넓힌 ADD인지, 기존 칸에 다른 제약이 없는지 확인한다. SQL은 LF(`.gitattributes`).
- [ ] **Step 4: 통과 확인** — `npx tsx --test src/db/migrations.test.ts src/db/schema.test.ts`
- [ ] **Step 5: 커밋** — `기간 마감 칸과 마이그레이션 0019 추가`

### Task 3: 마감·다시 열기와 이월 API

**Files:**
- Create: `apps/api/src/budget/lock.ts`, `apps/api/src/budget/closing.ts`, `apps/api/src/budget/closing.test.ts`
- Modify: `apps/api/src/budget/service.ts`, `apps/api/src/budget/routes.ts`, `apps/api/src/incomes/service.ts`, `apps/api/src/budget/budget.test.ts`(응답 새 칸), `apps/api/src/incomes/incomes.test.ts`(`carriedFrom: null`), `apps/api/package.json`

**Interfaces:**
- Consumes: Task 1 계약, Task 2 칸, `periodNumbers`, `planOf`, `periodOf`, `recordPeriod`, `requireFinance`
- Produces:
  - `lock.ts`: `lockBudget(tx, organizationId)`(service.ts에서 옮김), `shareBudget(tx, organizationId)`
  - `closing.ts`: `closingOf(db, organizationId, period): Promise<BudgetClosing>`, `readyToClose(closing, numbers: PeriodNumbers): boolean`
  - `incomes/service.ts`: `insertCarryover(tx, scope, { from: {id,name}, to: {id,startsOn}, amount, budgetLineId })`, `voidCarryover(tx, scope, from: {id,name})`, `incomeSummaries`가 `carriedFrom`을 채운다. 수정·취소에서 이월금은 `CARRYOVER_INCOME`.
  - `service.ts`: `close(scope, periodId, ClosePeriodRequest)`, `reopen(scope, periodId, ReopenPeriodRequest)` → `BudgetPlanResponse`. `recordPeriod(tx, scope, periodId, action, changes, reason = null)`. `planOf`는 `period.closed`와 `closing`을, `periods()`는 `closed`를, 처리 기록은 `reason`을 준다.
  - 경로: `POST /organizations/:organizationId/budget/periods/:periodId/close`, `…/reopen`

- [ ] **Step 1: 실패하는 API 테스트** — `closing.test.ts`(재정 f가 만든다. P=2025년 2학기 2025-09-01~2026-02-28, N=2026년 1학기 2026-03-01~2026-08-31, 먼 기간 2999-01-01~2999-12-31)
  - **마감 조건:**
    - 먼 기간은 `closing.ended` false이고 마감하면 `NOT_READY_TO_CLOSE`다.
    - N을 먼저 마감하면 409이고, N의 `earlierOpen`은 P다.
    - P에 증빙 없는 상시 운영 지출(2025-10-01, 12,000원)이 있으면 `missingEvidence` 1, `balance` −12,000이고 409다.
    - 수입 100,000원을 더해도 증빙 때문에 409다. 증빙을 붙이면(`expense_receipts` ready 행) `missingEvidence` 0이다.
    - 편성으로 행사 e를 P에 넣으면 정산 전이라 409다. `/events/e/finance/settle`로 정산한다.
    - P의 `closing`은 `{ ended: true, earlierOpen: null, missingEvidence: 0, next: { N, startsOn '2026-03-01', closed: false, incomes: [이월금 줄] }, carriedOver: null }`이다.
  - **마감:**
    - N의 '이월금' 줄로 마감하면 200이다. `period.closed.by`는 재정, 버전 +1, `closing.carriedOver`는 `{ N, 88000 }`이다.
    - 처리 기록 끝은 `closed`, `{ received: 100000, spent: 12000, balance: 88000, carryover: { period: '2026년 1학기', amount: 88000, line: '이월금' } }`이다.
    - N의 수입 내역에 `'2025년 2학기 이월금'`이 있다: 88,000원, `receivedOn` '2026-03-01', 줄 '이월금', `carriedFrom` P. N의 '이월금' 줄 `received`와 `totals.received`가 88,000원이다.
    - 같은 버전으로 다시 마감하면 `VERSION_CONFLICT`, 새 버전이면 `INVALID_STATE`다. 기간 목록에서 P의 `closed`는 true다.
  - **남은 돈 0·다음 기간 없음:**
    - 기간이 P 하나이고 수입 50,000원이면 `next` null이라 409다.
    - 수입을 취소하면(남은 돈 0) 마감되고, `carriedOver` null, 기록의 `carryover` null이다.
    - 그 뒤 N을 만들어도 P의 `carriedOver`는 null이다.
  - **이월금 줄과 잠금:**
    - N의 운영 줄, P의 수입 줄, 'missing'으로 마감하면 `BUDGET_LINE_INVALID`다.
    - null로 마감하면 줄 없는 이월금이 생긴다.
    - 이월금을 PATCH·void하면 `CARRYOVER_INCOME`이다. 이월금이 고른 N의 줄을 편성에서 지우면 `LINE_IN_USE`다.
    - N 시작일을 이월금 뒤로 옮기면 `INCOMES_OUTSIDE_PERIOD`다.
  - **다시 열기:**
    - P(이월 88,000원 → N)는 p·n이 403, x가 403, 미인증 401이다.
    - N을 마감하려면 다음 기간 M(2026-09-01~2027-02-28)을 만들고 N을 null 줄로 마감한다. 그다음 P를 다시 열면 `LATER_PERIOD_CLOSED`다.
    - N을 다시 열면 M의 이월금이 취소되고(사유 '2026년 1학기 마감을 다시 열었어요', 수입 기록 `voided`), N 처리 기록 끝은 `reopened`, 사유가 남는다.
    - P를 다시 열고 수입 12,000원을 더해 다시 마감하면 N의 P 이월금은 취소 1건과 100,000원 1건이다.
    - 열린 기간을 다시 열면 `INVALID_STATE`다.
  - **끝일 경계:** 테스트 안에서 한국 오늘(`toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })`)을 구한다.
    - 2020-01-01~오늘 기간은 `ended` false이고 409다.
    - 편성으로 끝일을 어제로 바꾸면 `ended` true이고 마감된다.
  - **본문·경계:**
    - 마감: 버전 0, `carryoverLineId` 빠짐, 모르는 키는 400이다.
    - 다시 열기: 사유 공백·이모지 201자·NUL·홀로 쓰인 서러게이트는 400이다.
    - 다른 학생회 기간 'pb'·65자 ID는 404다.
  - 기존 `budget.test.ts`·`incomes.test.ts`의 기대값에 새 칸(`closed: null`, `carriedFrom: null`, 기간 목록 `closed: false`, 처리 기록 `reason: null`)을 더한다. `closing`은 시간에 기대므로 기존 테스트에서 통째로 비교하지 않는다.
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/budget/closing.test.ts`(apps/api) → 404(라우트 없음)
- [ ] **Step 3: 구현**

```ts
// lock.ts
const budgetKey = (organizationId: string) => sql`hashtextextended(${JSON.stringify(['budget', organizationId])}, 0)`
// 학생회 하나의 기간·편성 변경과 마감·다시 열기를 한 줄로 세운다.
export async function lockBudget(tx: Executor, organizationId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${budgetKey(organizationId)})`)
}
// 지출 변경이 같은 잠금을 같이 잡는다. 마감이 증빙·남은 돈을 세는 동안 지출이 바뀌지 않고, 마감 뒤의 지출 변경은 마감을 본다.
export async function shareBudget(tx: Executor, organizationId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock_shared(${budgetKey(organizationId)})`)
}

// closing.ts
export async function closingOf(db: Reader, organizationId: string, period: Period): Promise<BudgetClosing> {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
  // 마감하지 않은 앞 기간 가운데 가장 이른 것
  // 결제일이 기간 안인 상시 운영 지출(취소 제외) 가운데 확인된 증빙이 없는 것의 수(하위 질의는 질의 빌더로)
  // 시작일이 이 기간 끝일보다 뒤인 가장 이른 기간과 그 수입 줄(편성 순서)
  // 이 기간이 넘긴 취소하지 않은 이월금과 받은 기간 이름
  return { ended: today > period.endsOn, earlierOpen, missingEvidence, next, carriedOver }
}
export function readyToClose(closing: BudgetClosing, numbers: PeriodNumbers) {
  const { balance } = numbers.totals
  return closing.ended && closing.earlierOpen === null && numbers.events.every(line => line.settled) && closing.missingEvidence === 0
    && balance >= 0 && (balance === 0 || closing.next !== null)
}

// service.ts close (reopen도 같은 순서: 권한 → lockBudget → 기간 FOR UPDATE → 버전 → 상태)
const period = await periodOf(tx, scope, periodId, true)
if (period.version !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
if (period.closedAt) throw new ApiError('INVALID_STATE', 409)
const numbers = await periodNumbers(tx, scope, period)
const closing = await closingOf(tx, scope.organizationId, period)
if (!readyToClose(closing, numbers)) throw new ApiError('NOT_READY_TO_CLOSE', 409)
const { received, spent, balance } = numbers.totals
let carryover: { period: string; amount: number; line: string | null } | null = null
if (balance > 0) {
  const next = closing.next!
  const line = input.carryoverLineId === null ? null : next.incomes.find(entry => entry.id === input.carryoverLineId)
  if (line === undefined) throw new ApiError('BUDGET_LINE_INVALID', 409)
  await insertCarryover(tx, scope, { from: period, to: next, amount: balance, budgetLineId: line?.id ?? null })
  carryover = { period: next.name, amount: balance, line: line?.name ?? null }
}
await tx.update(budgetPeriods).set({ closedAt: sql`now()`, closedBy: scope.userId, version: sql`${budgetPeriods.version} + 1` })
  .where(eq(budgetPeriods.id, periodId))
await recordPeriod(tx, scope, periodId, 'closed', { received, spent, balance, carryover })
// reopen: 버전 → closedAt 없으면 INVALID_STATE → closingOf의 next?.closed면 LATER_PERIOD_CLOSED
//   → voidCarryover → closedAt·closedBy null, 버전 +1 → recordPeriod('reopened', {}, reason)
```

  - `insertCarryover`: 내용 `${from.name} 이월금`, 받은 날 `to.startsOn`, 메모 null, 기록한 사람·처리 기록 `created`는 마감한 사람이다.
  - `voidCarryover`: 사유 `${from.name} 마감을 다시 열었어요`, 버전 +1, 처리 기록 `voided { reason }`
  - `incomes/service.ts`의 수정·취소: 수입 행을 잠근 뒤 버전보다 먼저 `carriedFromPeriodId`면 `CARRYOVER_INCOME`
  - `incomeSummaries`: 넘겨준 기간을 별칭으로 left join해 `carriedFrom`을 채운다.
  - `planOf`: `period.closed`(마감한 사람 이름은 users에서)와 `closing`
  - 라우트: `json(ClosePeriodSchema)`·`json(ReopenPeriodSchema)`를 `auth`·`member`보다 앞에 둔다.
- [ ] **Step 4: 통과 확인** — `npx tsx --test src/budget/closing.test.ts src/budget/budget.test.ts src/incomes/incomes.test.ts src/http/boundary.test.ts`
- [ ] **Step 5: 커밋** — `기간 마감·다시 열기와 이월 API`

### Task 4: 마감한 기간 잠그기

**Files:**
- Modify: `apps/api/src/budget/lock.ts`, `apps/api/src/budget/closing.ts`, `apps/api/src/budget/service.ts`, `apps/api/src/incomes/service.ts`, `apps/api/src/expenses/service.ts`, `apps/api/src/expenses/receipts.ts`, `apps/api/src/expenses/summaries.ts`, `apps/api/src/settlement/service.ts`
- Test: `apps/api/src/budget/closing.test.ts`, 기존 지출·정산 테스트의 기대값(`periodClosed: false`)

**Interfaces:**
- Produces:
  - `lock.ts`: `requireOpenDays(tx, organizationId, days: string[])` — `shareBudget` 뒤 결제일이 마감한 기간 안이면 `PERIOD_CLOSED`. `requireOpenEventPeriod(tx, organizationId, eventId)` — 행사가 든 기간 행을 `FOR SHARE`로 잠그고 마감됐으면 `PERIOD_CLOSED`
  - `closing.ts`: `assertAfterClosed(db, organizationId, { endsOn }, exceptId?)` — `PERIOD_BEFORE_CLOSED`
  - `ExpenseSummary.periodClosed`, `EventFinance.periodClosed` 채움

- [ ] **Step 1: 실패하는 테스트** — `closing.test.ts`에 더한다
  - **잠금:** P(상시 운영 지출 X 2025-10-01·증빙 있음, 수입 I, 정산한 행사 e)를 마감한다. N은 열려 있고, 행사 e2는 어느 기간에도 없다.
    - 409 `PERIOD_CLOSED`인 것:
      - P 편성 저장
      - P 수입 기록·I 수정·I 취소
      - 상시 운영 지출 기록(2025-11-01)
      - X 수정(같은 날짜)·X 취소·X 증빙 삭제(`POST /expenses/X/receipts/r1/delete {}`)
      - N의 상시 운영 지출 Y(2026-03-05)의 결제일을 2025-12-01로 바꾸는 수정
      - X를 행사 e2 지출로 바꾸는 수정
      - e 정산 다시 열기
    - 되는 것:
      - 상시 운영 지출 기록(2026-03-02)
      - X 증빙 올리기 시작(`POST /expenses/X/receipts` 201)
      - e2의 행사 지출 기록(결제일 2025-10-15)
    - 응답: X·e의 `periodClosed`는 true, Y·e2는 false
    - P를 다시 열면 X 수정과 e 정산 다시 열기가 된다.
  - **기간 순서:** P(2025-09-01~2026-02-28)를 마감하며 N2(2026-09-01~2027-02-28)로 이월한다. 그 사이는 비어 있다.
    - 409 `PERIOD_BEFORE_CLOSED`인 것:
      - P 앞에 새 기간(2025-03-01~2025-08-31)
      - P와 N2 사이에 새 기간(2026-03-01~2026-08-31)
      - N2 뒤에 만든 기간을 그 사이로 옮기는 편성 저장
    - 되는 것:
      - N2 뒤에 새 기간(2027-03-01~2027-08-31)
      - N2 자신의 시작일을 2026-08-01로 당기는 편성 저장
    - P를 다시 열면 사이 기간을 만들 수 있다.
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/budget/closing.test.ts`
- [ ] **Step 3: 구현**

```ts
// lock.ts
// 결제일이 마감한 기간 안이면 상시 운영 지출을 바꾸지 않는다. 학생회 예산 잠금을 같이 잡은 뒤 본다.
export async function requireOpenDays(tx: Executor & Reader, organizationId: string, days: string[]) {
  await shareBudget(tx, organizationId)
  if (!days.length) return
  const [closed] = await tx.select({ id: budgetPeriods.id }).from(budgetPeriods).where(and(eq(budgetPeriods.organizationId, organizationId),
    isNotNull(budgetPeriods.closedAt), or(...days.map(day => and(lte(budgetPeriods.startsOn, day), gte(budgetPeriods.endsOn, day)))))).limit(1)
  if (closed) throw new ApiError('PERIOD_CLOSED', 409)
}
// 행사가 든 기간이 마감됐으면 막는다. 기간 행을 FOR SHARE로 잠가 마감(FOR UPDATE)과 겹치지 않게 하고, 행사 행보다 먼저 잠근다.
export async function requireOpenEventPeriod(tx: Reader, organizationId: string, eventId: string) {
  const [line] = await tx.select({ periodId: budgetLines.periodId }).from(budgetLines)
    .where(and(eq(budgetLines.organizationId, organizationId), eq(budgetLines.eventId, eventId)))
  if (!line) return
  const [period] = await tx.select({ closedAt: budgetPeriods.closedAt }).from(budgetPeriods).where(eq(budgetPeriods.id, line.periodId)).for('share')
  if (period?.closedAt) throw new ApiError('PERIOD_CLOSED', 409)
}
// 상시 운영 상태의 결제일. 행사 지출은 정산 잠금이 본다.
const operatingDays = (...states: { eventId: string | null; paidOn: string }[]) => states.flatMap(state => state.eventId === null ? [state.paidOn] : [])
```

  - 지출 기록: `requireFinance` 바로 뒤에 `requireOpenDays(tx, org, operatingDays(input))`
  - 지출 수정·취소, 증빙 삭제: `requireFinance` 바로 뒤에 `shareBudget`을 잡아 순서를 맞춘다. 지출 행을 잠그고 상태를 본 뒤 `requireOpenDays(tx, org, operatingDays(row, input))`(취소·삭제는 `row`만)
  - 편성 저장: 기간 행을 잠근 직후 `closedAt`이면 `PERIOD_CLOSED`(버전보다 먼저). 날짜가 바뀌면 `assertAfterClosed(tx, org, input, periodId)`
  - 기간 만들기: `assertPeriodFree` 뒤에 `assertAfterClosed(tx, org, input)`
  - 수입 `lockPeriod`: `closedAt`도 읽어 마감됐으면 `PERIOD_CLOSED`
  - 정산 다시 열기: `requireFinance` → `requireOpenEventPeriod` → `lockFinance`(`begin`을 쓰지 않고 풀어 쓴다)
  - `assertAfterClosed`: 고치는 기간을 뺀 기간 가운데 `starts_on > input.endsOn`이고 `closed_at IS NOT NULL`이거나 취소하지 않은 이월금을 받은(`exists` 하위 질의, 질의 빌더) 것이 있으면 `PERIOD_BEFORE_CLOSED`
  - `expenseSummaries`: `periodClosed`는 `event_id is null and exists(마감한 기간 중 결제일을 품은 것)`. 여러 표를 join한 select라 raw sql 열에 표 이름이 붙는다(receiptCount와 같다).
  - 행사 재정 응답: 그 행사의 기간 줄을 기간과 join해 `closedAt`이 있으면 `periodClosed` true
- [ ] **Step 4: 통과 확인** — `npx tsx --test src/budget/closing.test.ts src/budget/budget.test.ts src/incomes/incomes.test.ts src/expenses/expenses.test.ts src/expenses/receipts.test.ts src/settlement/settlement.test.ts src/settlement/lock.test.ts`
- [ ] **Step 5: 커밋** — `마감한 기간의 편성·수입·지출 잠그기`

### Task 5: 결산서에 마감과 넘긴 돈

**Files:**
- Modify: `apps/api/src/budget/workbook.ts`, `apps/api/src/budget/service.ts`(`exportData`), `apps/api/src/budget/workbook.test.ts`, `apps/api/src/budget/closing.test.ts`

**Interfaces:** `PeriodSheetData.closed: { by: string; at: Date } | null`, `PeriodSheetData.carriedOver: { periodName: string; amount: number } | null`

- [ ] **Step 1: 실패하는 테스트**
  - 시트: `closed` null이면 '마감' 줄이 '마감 전'이고 '다음 기간으로 넘긴 돈' 줄이 없다.
  - 시트: 마감했으면 '마감' 줄이 '2026-10-10 10:05 재정'이고, '다음 기간으로 넘긴 돈' 줄이 `['88000', '2026년 1학기']`다.
  - API(`closing.test.ts`): 마감한 P의 결산서 요약에 두 줄이 있다.
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/budget/workbook.test.ts src/budget/closing.test.ts`
- [ ] **Step 3: 구현**
  - 요약 머리: '내려받은 때' 다음에 `[text('마감'), text(closed ? `${koreanTime(closed.at)} ${closed.by}` : '마감 전')]`
  - '남은 돈' 다음: `carriedOver`가 있으면 `[text('다음 기간으로 넘긴 돈'), money(amount), text(periodName)]`
  - `exportData`: 같은 거래 안에서 `period.closed`와 `closingOf(...).carriedOver`를 채운다.
- [ ] **Step 4: 통과 확인** — 같은 명령
- [ ] **Step 5: 커밋** — `결산서에 마감과 넘긴 돈 적기`

### Task 6: 화면 도움 함수와 고정값

**Files:**
- Modify:
  - `apps/web/src/budget/budget-view.ts`, `budget-view.test.ts`, `useBudget.ts`, `budget-fixtures.ts`, `income-view.ts`, `income-view.test.ts`
  - `apps/web/src/expenses/expense-view.ts`, `expense-view.test.ts`, `expense-fixtures.ts`
  - `apps/web/src/settlement/settlement-view.ts`, `settlement-view.test.ts`, `settlement-fixtures.ts`

**Interfaces (Produces):**
- `ClosingRequirement { key: 'earlier' | 'events' | 'evidence' | 'balance' | 'next'; label; hint; done }`
- `closingRequirements(plan): ClosingRequirement[]`: `next`는 남은 돈이 0원보다 클 때만 넣는다.
- `readyToClose(plan)`: `ended`이고 모두 done
- `defaultCarryoverLine(lines): string`: 이름에 '이월'이 든 첫 줄 ID, 없으면 ''
- `closedDay(at)`: 한국 날짜를 `2027.3.5` 꼴로 바꾼다.
- `budgetHistoryText`: `closed`·`reopened` 문구
- `useBudgetPlan(...).close(input: ClosePeriodRequest)`, `.reopen(input: ReopenPeriodRequest)` → `BudgetResult`. 성공하면 응답으로 바꾸고, 실패하면 새로 불러온다(`save`와 같다).
- 오류 문구:
  - 예산: `NOT_READY_TO_CLOSE`, `INVALID_STATE`, `LATER_PERIOD_CLOSED`, `PERIOD_CLOSED`, `PERIOD_BEFORE_CLOSED`, `BUDGET_LINE_INVALID`
  - 수입: `PERIOD_CLOSED`, `CARRYOVER_INCOME`
  - 지출·행사 재정: `PERIOD_CLOSED`
- 고정값: 편성 `period.closed: null`, `closing: { ended: false, earlierOpen: null, missingEvidence: 0, next: null, carriedOver: null }`, 기간 `closed: false`, 수입 `carriedFrom: null`, 지출 `periodClosed: false`, 행사 재정 `periodClosed: false`

- [ ] **Step 1: 실패하는 단위 테스트**
  - 조건:
    - 모두 맞음(남은 돈 0이면 `next` 줄 없음)
    - 앞 기간 열림 이름
    - 정산 안 한 행사 이름 둘(`체육대회, 축제`)
    - 증빙 2건
    - 남은 돈 음수 문구, 남은 돈 양수에 다음 기간 없음
    - `ended` false면 `readyToClose` false
  - 기본 줄: '전기 이월금' 줄을 고른다. 없으면 ''이다.
  - 처리 기록: 넘김 있음, 넘김 없음(0원), 다시 엶 사유
  - 오류 문구 각 하나
- [ ] **Step 2: 실패 확인** — `npx vitest run src/budget/budget-view.test.ts src/budget/income-view.test.ts src/expenses/expense-view.test.ts src/settlement/settlement-view.test.ts`(apps/web)
- [ ] **Step 3: 구현** — 위 함수, 고정값, 오류 문구(spec 표 그대로)
- [ ] **Step 4: 통과 확인** — `npm test --workspace @vada/web`, `npm run typecheck`
- [ ] **Step 5: 커밋** — `기간 마감 화면 도움 함수와 고정값`

### Task 7: 예산 화면의 마감 묶음

**Files:**
- Create: `apps/web/src/budget/PeriodClosing.tsx`(`PeriodStatus`, `ClosingChecklist`), `apps/web/src/budget/PeriodClosing.test.tsx`
- Modify: `apps/web/src/budget/BudgetPlanView.tsx`, `Budget.tsx`, `Budget.test.tsx`

**Interfaces:**
- `PeriodStatus({ plan, finance, onReopen: (input: ReopenPeriodRequest) => Promise<BudgetResult> })`: 마감한 기간의 "마감 상태" 묶음
- `ClosingChecklist({ plan, onClose: (input: ClosePeriodRequest) => Promise<BudgetResult> })`: "마감하려면" 묶음
- `BudgetPlanView`에 `onClosePeriod`, `onReopenPeriod`를 더한다.
  - 두 묶음에 `key={plan.period.id}`를 준다.
  - [수입 기록]은 `finance && !closed`일 때만 보인다.

- [ ] **Step 1: 실패하는 테스트**
  - `PeriodClosing.test.tsx`:
    - 상태: 배지·날짜·마감한 사람, 넘긴 돈 문구와 없음 문구
    - 다시 열기: 사유를 넣어야 켜진다. `{ version, reason }`을 보내고, 성공하면 입력이 닫히며, 실패 문구가 보인다.
    - 다음 기간이 마감됐으면 버튼 대신 안내가 보이고, 재정 권한이 없으면 버튼이 없다.
    - 조건 목록: 체크와 해결 방법을 보인다. 조건이 안 맞으면 [기간 마감]이 꺼진다.
    - 마감 확인: 넘어가는 돈 문구, '전기 이월금'이 기본으로 골라진 항목, [그대로 두기], `{ version, carryoverLineId }` 본문
    - 남은 돈 0원: 항목 고르기 없이 '남은 돈이 없어 넘기는 돈은 없어요.'
  - `Budget.test.tsx`:
    - 끝난 열린 기간: 재정 권한자에게만 "마감하려면"이 보인다. 끝나지 않은 기간에는 없다.
    - 마감한 기간: [편성 수정]·[수입 기록]이 없고, 기간 고르기에 '(마감)'이 붙는다.
    - 마감하면 응답 편성으로 바뀌고 기간 목록을 다시 받는다.
- [ ] **Step 2: 실패 확인** — `npx vitest run src/budget`
- [ ] **Step 3: 구현** — 행사 재정 탭의 정산 묶음과 같은 꼴(카드, 체크 아이콘, 같은 자리 확인·사유 입력). 위치는 spec "화면"대로다.
- [ ] **Step 4: 통과 확인** — `npm test --workspace @vada/web`, `npm run typecheck`
- [ ] **Step 5: 커밋** — `예산 화면에 기간 마감과 다시 열기`

### Task 8: 마감으로 잠긴 기록의 버튼 감추기

**Files:**
- Modify:
  - `apps/web/src/budget/IncomeDetailDialog.tsx`·`.test.tsx`(`closed` 속성), `Budget.tsx`(넘김)
  - `apps/web/src/expenses/ExpenseDetailDialog.tsx`·`.test.tsx`, `ExpenseFormDialog.tsx`·`.test.tsx`
  - `apps/web/src/settlement/EventFinance.tsx`·`.test.tsx`

- [ ] **Step 1: 실패하는 테스트**
  - 수입 상세:
    - 마감한 기간: 재정 권한자에게 버튼이 없고 안내가 보인다.
    - 이월금: 모두에게 '{기간} 마감에서 넘어온 이월금이에요.'가 보이고, 재정 권한자에게 다시 열기 안내가 붙으며, 버튼이 없다.
  - 지출 상세: `periodClosed`면 수정·취소·증빙 삭제가 없고 안내가 보인다. 증빙 올리기는 남는다.
  - 지출 대화상자: 상시 운영이고 결제일이 마감한 기간 안이면 안내가 보이고 저장이 꺼진다. 결제일을 열린 기간으로 바꾸면 켜진다.
  - 행사 재정: 정산했고 `periodClosed`면 [정산 다시 열기] 대신 안내가 보인다.
- [ ] **Step 2: 실패 확인** — `npx vitest run src/budget/IncomeDetailDialog.test.tsx src/expenses src/settlement`
- [ ] **Step 3: 구현** — spec "화면"의 수입 상세·지출 상세·지출 대화상자·행사 재정 탭 그대로
- [ ] **Step 4: 통과 확인** — `npm test --workspace @vada/web`, `npm run typecheck`
- [ ] **Step 5: 커밋** — `마감으로 잠긴 수입·지출·정산의 버튼 감추기`

### Task 9: 문서와 전체 검사

**Files:** `docs/ERD.md`("예산 편성"·"수입" 절)

- [ ] **Step 1:** ERD를 고친다.
  - `budget_periods.closed_at/closed_by`
  - `budget_period_events.action` 넷과 `reason`
  - `incomes.carried_from_period_id`
  - 마감 규칙: 잠그는 것, 이월금, 다시 열기, 기간 순서
- [ ] **Step 2:** `npm test --workspace @vada/api`, `npm test --workspace @vada/contracts`, `npm test --workspace @vada/web`, `npm run typecheck`가 모두 통과한다.
- [ ] **Step 3: 커밋** — `기간 마감을 문서에 반영`
