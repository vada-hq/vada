# M3b-2 행사 참가비를 정산에서 수입으로 넣기 구현 계획

> **For agentic workers:** 이 저장소는 사용자가 정한 방식(직접 구현 TDD → 새 컨텍스트 Opus 최종 리뷰)으로 실행한다. superpowers:executing-plans로 작업을 차례로 하고, 단계는 체크박스(`- [ ]`)로 따라간다.

**Goal:** 행사를 정산할 때 입금을 확인한 참가비를 그 행사가 든 회계 기간의 수입 한 건으로 넣고, 정산을 다시 열면 취소한다. 행사 재정 탭·정산서·수입 상세·편성 수정·참가자 탭이 이를 보인다.

**Architecture:** 참가비 수입은 `incomes.event_id`가 있는 보통 수입이다(이월금과 같은 방식). 받은 참가비는 `registrations/fee.ts`의 `eventFeesOf`가 한 곳에서 세고, 넣고 취소하는 함수는 이월금 함수 옆(`incomes/service.ts`)에 둔다. 정산은 학생회 예산 잠금을 같이 잡고 행사가 든 기간 행 → 행사 행 순서로 잠근 뒤 받은 참가비를 센다(다시 열기와 같은 순서).

**Tech Stack:** Hono, drizzle-orm(PostgreSQL·PGlite), zod 4, write-excel-file, React 19 + Tailwind, vitest, node:test.

**Spec:** `docs/superpowers/specs/2026-10-11-event-fee-income-design.md`

## Global Constraints

- 요청 본문은 contracts의 `z.strictObject`, 문자열은 `text(max)`/`token(max)`. `feeIncomeLineId`는 `token(64).nullable()`이고 꼭 보낸다.
- 라우트는 `json(Schema)`를 인증보다 앞에 두고 `c.req.valid('json')`만 쓴다. 실패는 `ApiError(code, status)`. 새 오류 코드는 `FEE_INCOME`(409) 하나다.
- 새 칸(`incomes.event_id`)을 새 코드가 읽으므로 0022는 두 DB에 먼저 적용한 뒤 배포한다. 새 칸에만 제약을 건다.
- 잠금 순서: 재정 권한 확인 → 학생회 예산 잠금 → 기간 행 → 행사 행. 정산·다시 열기 모두 이 순서다.
- 참가비 수입: 내용 "{행사 이름} 참가비"(100자 넘으면 이름을 줄이고 "…"), 메모 "입금 확인 N명", 받은 날은 마지막 입금 확인의 한국 날짜를 기간 안으로 당긴 날, 기록한 사람은 정산한 사람.
- 다시 열기 사유: "{행사 이름} 정산을 다시 열었어요"
- 화면 버튼은 같은 스키마의 `safeParse`로 켠다. `components/ui` 부품과 Tailwind 기본 스케일·테마 토큰만. 긴 이름에는 `wrap-anywhere`.
- 화면 문구는 spec "화면 문구" 표 그대로 쓴다.
- 로그·오류 응답에 행사 이름·금액·인원을 넣지 않는다. 재정 탭·정산서에는 참가비 합과 수만 나간다.
- 시간에 기대는 테스트는 먼 미래(2999년)나 SQL로 정한 시각만 쓴다. `paid_at`은 DB `now()`라 받은 날을 보려면 테스트에서 `UPDATE`로 정한다.
- 커밋 제목은 한국어 명령형 50자 안, AI 서명·트레일러를 붙이지 않는다.
- 새 테스트 파일은 워크스페이스 `test` 스크립트 목록에 더한다(api는 파일을 나열한다).

## Review Focus

1. 운영진이 입금을 확인한 뒤 신청을 취소했거나 보관 기간이 지나 정보를 지운 신청: 받은 참가비와 입금 확인 수에 들어가고, 입금 전에는 들지 않아야 한다 → Task 3 테스트.
2. 참가 신청은 있는데 신청자가 하나도 없음(LEFT JOIN 빈 줄): 입금 전 0명이어야 한다 → Task 3 테스트.
3. 다시 열고 입금을 더 확인한 뒤 다시 정산: 옛 참가비 수입은 취소로 남고, 새 금액의 수입이 하나만 생겨야 한다 → Task 3 테스트.
4. 행사 이름이 100자: 수입 내용이 100자 안("…"+" 참가비")이어야 DB에 들어간다 → Task 3 테스트(API로 넣어 본다).
5. 참가비 수입이 고른 수입 줄을 편성 수정에서 지우거나, 기간 날짜를 바꿔 참가비 수입을 밖으로 내보냄: 기존 규칙대로 `LINE_IN_USE`·`INCOMES_OUTSIDE_PERIOD`여야 한다 → Task 4 테스트.

---

### Task 1: 참가비 수입 계약

**Files:**
- Modify: `packages/contracts/src/settlement.ts`, `incomes.ts`, `budget.ts`, `registrations.ts`, `index.ts`
- Test: `packages/contracts/src/settlement.test.ts`

**Interfaces (Produces):**
- `SettleEventSchema = z.strictObject({ version, feeIncomeLineId: token(64).nullable() })`, `SettleEventRequest`
- `EventFees { received: number; count: number; unpaid: number }`
- `EventFeeIncome { id: string; amount: number; period: { id: string; name: string }; line: { id: string; name: string } | null }`
- `EventFinance.fees: EventFees | null`, `EventFinance.period: { id: string; name: string; incomes: { id: string; name: string }[] } | null`, `EventFinance.feeIncome: EventFeeIncome | null`
- `IncomeSummary.event: { id: string; name: string } | null`
- `BudgetEventLine.feeIncome: boolean`
- `BudgetPlanResponse.notices: { eventsWithMoney: number; operatingOutside: number }`(이름 바꿈)
- `RegistrationResponse.settled: boolean`

- [ ] **Step 1: 실패하는 계약 테스트** — `settlement.test.ts`의 정산 테스트를 바꾼다
  - 받는 것: `{ version: 0, feeIncomeLineId: null }`, `{ version: 1, feeIncomeLineId: 'l1' }`, 앞뒤 공백은 지운다(`' l1 '` → `'l1'`)
  - 거절: `{ version: 0 }`(빠짐), `''`, `' '`, `'x'.repeat(65)`, `` `a${nul}` ``, `` `a${String.fromCharCode(7)}` ``, `1`, `{ version: -1, feeIncomeLineId: null }`, 모르는 키
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/settlement.test.ts`(packages/contracts) → `{ version: 0 }`을 받아 실패
- [ ] **Step 3: 구현**

```ts
// settlement.ts
// 정산. 받은 참가비가 있으면 행사가 든 기간의 이 수입 줄로 넣는다. 고르지 않으면 null이고, 받은 참가비가 없으면 보지 않는다.
export const SettleEventSchema = z.strictObject({ version, feeIncomeLineId: token(64).nullable() })
// 받은 참가비: 입금을 확인한 신청의 확인 금액 합(취소했거나 정보를 지운 신청도 센다), count: 그 수,
// unpaid: 정보를 지우지 않은 신청 가운데 낼 돈이 있고 확인 전인 것의 수(참가자 탭의 "입금 전")
export interface EventFees { received: number; count: number; unpaid: number }
// 정산이 넣은 참가비 수입(취소하지 않은 것)
export interface EventFeeIncome { id: string; amount: number; period: { id: string; name: string }; line: { id: string; name: string } | null }
```

  `EventFinance`에 `fees`·`period`·`feeIncome`을 더하고(주석: null인 경우), 처리 기록 주석에 `settled: { budget, spent, expenseCount, fee: { amount, count, period, line } | null }`을 적는다. 나머지 응답 타입은 위 Interfaces 그대로 더하고, `index.ts`에서 `EventFees`·`EventFeeIncome`을 내보낸다.
- [ ] **Step 4: 통과 확인** — `npm test --workspace @vada/contracts`, `npx tsc --noEmit -p packages/contracts`(api·웹 고정값은 뒤 작업에서 고친다)
- [ ] **Step 5: 커밋** — `참가비 수입 계약 추가`

### Task 2: 참가비 수입 칸과 마이그레이션 0022

**Files:**
- Modify: `apps/api/src/db/schema.ts`(`incomes`)
- Create: `apps/api/migrations/0022_event_fee_income.sql`, `meta/0022_snapshot.json`, `meta/_journal.json`(drizzle-kit 생성)
- Test: `apps/api/src/db/migrations.test.ts`에 `0022` 테스트

- [ ] **Step 1: 실패하는 마이그레이션 테스트** — 0021 테스트 뒤에 더한다

```ts
test('0022 adds fee incomes tied to one event of the same council without touching existing incomes', async (t) => {
  const pg = new PGlite()
  const previous = migrationsBefore('0022_event_fee_income')
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: previous.folder })
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('u','재정','u@example.test');
      INSERT INTO organizations (id,name) VALUES ('o','Council'),('o2','Other');
      INSERT INTO events (id,organization_id,name,created_by) VALUES ('e','o','체육대회','u'),('e2','o','축제','u'),('x','o2','남의 행사','u');
      INSERT INTO budget_periods (id,organization_id,name,starts_on,ends_on,created_by) VALUES ('p','o','2026년 2학기','2026-09-01','2027-02-28','u'),
        ('q','o','2026년 1학기','2026-03-01','2026-08-31','u');
      INSERT INTO incomes (id,organization_id,period_id,description,amount,received_on,recorded_by) VALUES ('i','o','p','학생회비',750000,'2026-09-15','u');
    `)
    const before = await pg.query<Record<string, unknown>>('SELECT * FROM incomes ORDER BY id')
    await migrate(db, { migrationsFolder })
    const insert = (values: Record<string, string>) =>
      pg.exec(`INSERT INTO incomes (${Object.keys(values).join(',')}) VALUES (${Object.values(values).join(',')})`)
    const income = (id: string, change: Record<string, string> = {}) => insert({ id: `'${id}'`, organization_id: "'o'", period_id: "'p'",
      description: "'체육대회 참가비'", amount: '35000', received_on: "'2026-10-05'", recorded_by: "'u'", event_id: "'e'", ...change })

    await t.test('existing incomes keep their values and are not fee incomes', async () => {
      const after = await pg.query<Record<string, unknown>>('SELECT * FROM incomes ORDER BY id')
      assert.deepEqual(sameColumns(after.rows, before.rows), before.rows)
      assert.deepEqual(after.rows.map(row => row.event_id), [null])
    })
    await t.test('an event has one fee income while not voided, of the same council, and it is not also a carryover', async () => {
      await income('f1')
      await assert.rejects(income('f2'), { constraint: 'incomes_event_active_unique' })
      await assert.rejects(income('f3', { event_id: "'x'" }), { constraint: 'incomes_event_same_organization' })
      await assert.rejects(income('f4', { event_id: "'e2'", carried_from_period_id: "'q'" }), { constraint: 'incomes_single_source' })
      await pg.exec("UPDATE incomes SET voided_at = now(), voided_by = 'u', void_reason = '정산 다시 엶' WHERE id = 'f1'")
      await income('f5')
      // 참가비 수입이 가리키는 행사는 지울 수 없다.
      await assert.rejects(pg.exec("DELETE FROM events WHERE id = 'e'"), { constraint: 'incomes_event_same_organization' })
    })
  } finally {
    previous.remove()
    await pg.close()
  }
})
```

- [ ] **Step 2: 실패 확인** — `npx tsx --test src/db/migrations.test.ts`(apps/api) → 0022 폴더 없음
- [ ] **Step 3: 스키마** — `incomes`에 더한다

```ts
  // 참가비 수입이면 그 행사(M3b-2). 행사 정산이 만들고 다시 열면 취소한다. 손으로 고치거나 취소하지 않는다.
  eventId: text('event_id'),
  ...
  foreignKey({
    name: 'incomes_event_same_organization',
    columns: [table.organizationId, table.eventId],
    foreignColumns: [events.organizationId, events.id],
  }).onDelete('restrict'),
  // 이월금이면서 참가비 수입일 수 없다.
  check('incomes_single_source', sql`${table.carriedFromPeriodId} IS NULL OR ${table.eventId} IS NULL`),
  // 행사 하나의 취소하지 않은 참가비 수입은 한 건뿐이다.
  uniqueIndex('incomes_event_active_unique').on(table.eventId).where(sql`${table.eventId} IS NOT NULL AND ${table.voidedAt} IS NULL`),
```

- [ ] **Step 4: 생성** — `apps/api`에서 `npx drizzle-kit generate --name event_fee_income`. 생성된 SQL이 칸 추가·FK·CHECK·부분 unique 색인 넷만 담는지, 줄바꿈이 LF인지 본다.
- [ ] **Step 5: 통과 확인** — `npx tsx --test src/db/migrations.test.ts src/db/schema.test.ts`
- [ ] **Step 6: 커밋** — `참가비 수입 칸과 마이그레이션 0022 추가`

### Task 3: 정산이 참가비 수입을 넣고 다시 열면 취소

**Files:**
- Modify: `apps/api/src/registrations/fee.ts`(받은 참가비 세기), `apps/api/src/incomes/service.ts`(수입 줄·참가비 수입 넣기·취소·조회, 내용·받은 날 도움 함수), `apps/api/src/budget/lock.ts`(`requireOpenEventPeriod`가 기간을 돌려줌), `apps/api/src/budget/closing.ts`(다음 기간 수입 줄을 같은 함수로), `apps/api/src/settlement/service.ts`(정산·다시 열기·응답)
- Create: `apps/api/src/registrations/test-setup.ts`(참가비 테스트 도움 함수, `payments.test.ts`에서 옮김), `apps/api/src/settlement/fee-income.test.ts`
- Modify tests: `payments.test.ts`(도움 함수 import, 정산 테스트에 기간 넣기), `settlement.test.ts`·`closing.test.ts`·`budget.test.ts`(정산 본문에 `feeIncomeLineId: null`)
- Modify: `apps/api/package.json`(`test` 목록에 `src/settlement/fee-income.test.ts`)

**Interfaces:**
- Consumes: Task 1 타입, Task 2 `incomes.eventId`
- Produces:
  - `eventFeesOf(db: Reader, organizationId: string, eventId: string): Promise<(EventFees & { lastPaidAt: Date | null }) | null>`(`registrations/fee.ts`)
  - `incomeLinesOf(db: Reader, organizationId: string, periodId: string): Promise<{ id: string; name: string }[]>`(`incomes/service.ts`)
  - `feeIncomeDescription(eventName: string): string`, `feeIncomeDay(lastPaidAt: Date, period: { startsOn: string; endsOn: string }): string`(`incomes/service.ts`)
  - `insertFeeIncome(tx, scope, { event: { id; name }; period: { id; startsOn; endsOn }; amount; count; lastPaidAt: Date; budgetLineId: string | null })`
  - `voidFeeIncome(tx, scope, event: { id; name })`
  - `feeIncomeOf(db: Reader, organizationId: string, eventId: string): Promise<EventFeeIncome | null>`
  - `requireOpenEventPeriod(...)`: `Promise<typeof budgetPeriods.$inferSelect | null>`

- [ ] **Step 1: 테스트 도움 함수 옮기기** — `payments.test.ts`의 `at`, `formBody`, `account`, `roster`, `prepare`, `create`, `update`, `apply`, `entries`, `named`, `confirm`, `unconfirm`, `switchDues`, `refused`를 `registrations/test-setup.ts`로 옮겨 내보내고(`Env` 타입도), `payments.test.ts`는 import로 바꾼다. 동작은 그대로다. `npx tsx --test src/registrations/payments.test.ts`가 그대로 통과(정산 테스트 하나는 Step 2 뒤 실패가 맞다).
- [ ] **Step 2: 실패하는 테스트** — `settlement/fee-income.test.ts`

```ts
// 내용·받은 날 도움 함수
test('참가비 수입 내용은 100자 안이고, 받은 날은 마지막 입금 확인의 한국 날짜를 기간 안으로 당긴다', () => {
  assert.equal(feeIncomeDescription('체육대회'), '체육대회 참가비')
  const long = feeIncomeDescription('가'.repeat(100))
  assert.deepEqual([[...long].length, long.endsWith('… 참가비'), long.startsWith('가'.repeat(95))], [100, true, true])
  assert.equal(feeIncomeDescription('가'.repeat(96)), `${'가'.repeat(96)} 참가비`)
  const period = { startsOn: '2999-03-01', endsOn: '2999-08-31' }
  // 2999-08-10 23:30 한국 = 14:30 UTC
  assert.equal(feeIncomeDay(new Date('2999-08-10T14:30:00Z'), period), '2999-08-10')
  assert.equal(feeIncomeDay(new Date('2999-08-31T15:00:00Z'), period), '2999-08-31') // 한국 9월 1일 0시 → 끝일
  assert.equal(feeIncomeDay(new Date('2999-02-27T00:00:00Z'), period), '2999-03-01')
})
```

  API 테스트(`setupPurchases` + `registrations/test-setup.ts`). 준비: `prepare(env)` → 기획(p)이 참가비 7,000원·납부자 0원 신청을 만들고 김바다(납부자)·이윤슬·박해랑·최하나가 신청 → 이윤슬·박해랑 입금 확인 → 박해랑은 운영진 취소 → `UPDATE registrations SET paid_at = ...`로 확인 시각을 `2999-08-03T12:00+09`(이윤슬)·`2999-08-10T23:30+09`(박해랑)로 정한다.

  1. `'재정 탭: 받은 참가비·입금 확인 수·입금 전을 세고, 기간이 없으면 정산하지 못한다'`
     - 재정(f) `GET /events/e/finance`: `fees` = `{ received: 14000, count: 2, unpaid: 1 }`, `period` null, `feeIncome` null
     - 정산 `{ version: 0, feeIncomeLineId: null }` → 409 `NOT_READY_TO_SETTLE`
     - 기간 '2999년 1학기'(2999-03-01~2999-08-31)를 만들고 수입 줄 '학생회비'·'행사 참가비', 운영 줄 '회의비'를 넣고 행사 e를 넣는다. 다른 기간 '2999년 2학기'(2999-09-01~2999-12-31)에 수입 줄 '후원'
     - `GET` → `period` = `{ id, name: '2999년 1학기', incomes: [학생회비, 행사 참가비] }`
     - 참가 신청이 없는 행사 e2는 `fees` null. 무료 신청에 입금 확인이 없으면 `fees` null(행사 e2에 무료 신청을 만들어 본다)
  2. `'정산: 고른 수입 줄로 받은 참가비 한 건을 넣고 처리 기록에 남긴다'`
     - 수입 항목이 운영 줄·다른 기간의 줄·`'missing'` → 409 `BUDGET_LINE_INVALID`(세 번 모두 정산되지 않음: 이어서 버전 0으로 정산이 된다)
     - '행사 참가비'로 정산 → `feeIncome` = `{ id, amount: 14000, period: { id, name: '2999년 1학기' }, line: { id, name: '행사 참가비' } }`, `history` 끝 `changes.fee` = `{ amount: 14000, count: 2, period: '2999년 1학기', line: '행사 참가비' }`
     - 편성 `GET /budget/periods/:id`: `incomeRecords`의 그 수입 = 내용 '체육대회 참가비', 금액 14000, 받은 날 '2999-08-10', 메모 '입금 확인 2명', 기록한 사람 재정, 수입 항목 '행사 참가비', `event: { id: 'e', name: '체육대회' }`; '행사 참가비' 줄의 `received` 14000, `totals.received` 14000
  3. `'다시 열기: 참가비 수입을 취소하고, 입금을 더 확인한 뒤 다시 정산하면 새 금액으로 하나만 넣는다'`
     - 다시 열기 → `feeIncome` null, 옛 수입은 취소(`voided.reason` = '체육대회 정산을 다시 열었어요', 수입 상세 처리 기록 끝이 `voided`)
     - 기획(p)이 최하나 입금 확인 → 재정이 `feeIncomeLineId: null`로 다시 정산 → 새 수입 21000, `line` null, 메모 '입금 확인 3명'. 취소하지 않은 참가비 수입은 하나(`SELECT count(*) FROM incomes WHERE event_id = 'e' AND voided_at IS NULL` = 1)
  4. `'받은 참가비가 0원이면 기간 없이 정산하고 수입을 만들지 않는다. 행사 이름이 100자여도 넣는다'`
     - 행사 e2에 참가비 5,000원 신청, 신청 하나(입금 전) → `fees` = `{ received: 0, count: 0, unpaid: 1 }` → 기간 없이 정산 → 참가비 수입 없음, `changes.fee` null
     - 신청자가 없는 참가비 신청: `unpaid` 0(Review Focus 2) — e2를 다시 열고 신청을 운영진 취소한 뒤 본다
     - 행사 e 이름을 `'가'.repeat(100)`으로 바꾸고 기간을 넣어 정산 → 수입 내용이 100자이고 '… 참가비'로 끝난다
- [ ] **Step 3: 실패 확인** — `npx tsx --test src/settlement/fee-income.test.ts` → 내보내기 없음·`fees` 없음
- [ ] **Step 4: 받은 참가비 세기** — `registrations/fee.ts`

```ts
type Reader = Pick<PgDatabase<PgQueryResultHKT>, 'select'>
// 행사의 참가비 숫자(spec 정책 1). 참가 신청이 없거나, 참가비를 받지 않고 입금 확인도 없으면 null이다.
// lastPaidAt은 마지막으로 입금을 확인한 때이고, 정산이 참가비 수입의 받은 날로 쓴다.
export async function eventFeesOf(db: Reader, organizationId: string, eventId: string) {
  // 낼 돈은 owedOf와 같다: 납부자 참가비가 있고 납부자면 납부자 참가비, 아니면 참가비
  const owed = sql`CASE WHEN ${registrationForms.memberFee} IS NOT NULL AND ${registrations.duesMember} THEN ${registrationForms.memberFee} ELSE ${registrationForms.fee} END`
  const [row] = await db.select({
    fee: registrationForms.fee, memberFee: registrationForms.memberFee,
    received: sql<string>`coalesce(sum(${registrations.paidAmount}), 0)`,
    count: sql<number>`count(${registrations.paidAt})::int`,
    // 신청자가 없으면 LEFT JOIN이 빈 줄 하나를 만든다. 신청 ID가 있는 줄만 센다.
    unpaid: sql<number>`(count(*) filter (where ${registrations.id} is not null and ${registrations.purgedAt} is null
      and ${registrations.paidAt} is null and ${owed} > 0))::int`,
    lastPaidAt: sql`max(${registrations.paidAt})`.mapWith(registrations.paidAt),
  }).from(registrationForms)
    .leftJoin(registrations, eq(registrations.formId, registrationForms.id))
    .where(and(eq(registrationForms.organizationId, organizationId), eq(registrationForms.eventId, eventId)))
    .groupBy(registrationForms.id)
  if (!row || (row.fee === 0 && row.memberFee === null && row.count === 0)) return null
  return { received: Number(row.received), count: row.count, unpaid: row.unpaid, lastPaidAt: row.lastPaidAt as Date | null }
}
```

- [ ] **Step 5: 수입 쪽 함수** — `incomes/service.ts`

```ts
// 그 기간의 수입 줄(편성 순서). 이월금·참가비 수입 항목을 고를 때 쓴다.
export async function incomeLinesOf(db: Reader, organizationId: string, periodId: string) {
  const rows = await db.select({ id: budgetLines.id, name: budgetLines.name }).from(budgetLines)
    .where(and(eq(budgetLines.organizationId, organizationId), eq(budgetLines.periodId, periodId), eq(budgetLines.kind, 'income')))
    .orderBy(asc(budgetLines.position), asc(budgetLines.id))
  return rows.map(line => ({ id: line.id, name: line.name! }))
}
const FEE_SUFFIX = ' 참가비'
// 참가비 수입의 내용. 수입 내용 상한을 넘으면 행사 이름 뒤를 줄이고 "…"를 붙인다. 글자는 DB처럼 코드 포인트로 센다.
export function feeIncomeDescription(eventName: string) {
  const room = INCOME_DESCRIPTION_MAX - codePoints(FEE_SUFFIX)
  const chars = [...eventName]
  return `${chars.length > room ? `${chars.slice(0, room - 1).join('')}…` : eventName}${FEE_SUFFIX}`
}
// 참가비 수입의 받은 날: 마지막으로 입금을 확인한 한국 날짜. 기간 밖이면 가까운 쪽 끝날이다(수입 기록 대화상자의 기본값과 같다).
export function feeIncomeDay(lastPaidAt: Date, period: { startsOn: string; endsOn: string }) {
  const day = koreanOf(lastPaidAt).slice(0, 10)
  return day < period.startsOn ? period.startsOn : day > period.endsOn ? period.endsOn : day
}
// 정산한 행사의 받은 참가비를 그 행사가 든 기간의 수입 한 건으로 넣는다. 수입 항목이 그 기간의 수입 줄인지는 부르는 쪽이 확인한다.
export async function insertFeeIncome(tx: Transaction, scope: IncomeScope, input: { event: { id: string; name: string };
  period: { id: string; startsOn: string; endsOn: string }; amount: number; count: number; lastPaidAt: Date; budgetLineId: string | null }) {
  const id = randomUUID()
  await tx.insert(incomes).values({ id, organizationId: scope.organizationId, periodId: input.period.id, budgetLineId: input.budgetLineId,
    description: feeIncomeDescription(input.event.name), amount: input.amount, receivedOn: feeIncomeDay(input.lastPaidAt, input.period),
    note: `입금 확인 ${input.count}명`, recordedBy: scope.userId, eventId: input.event.id })
  await record(tx, scope, id, 'created')
}
// 행사 정산을 다시 열면 그 행사의 참가비 수입을 취소한다.
export async function voidFeeIncome(tx: Transaction, scope: IncomeScope, event: { id: string; name: string }) {
  const reason = `${event.name} 정산을 다시 열었어요`
  const voided = await tx.update(incomes).set({ voidedAt: sql`now()`, voidedBy: scope.userId, voidReason: reason, version: sql`${incomes.version} + 1` })
    .where(and(eq(incomes.organizationId, scope.organizationId), eq(incomes.eventId, event.id), isNull(incomes.voidedAt)))
    .returning({ id: incomes.id })
  for (const row of voided) await record(tx, scope, row.id, 'voided', { reason })
}
// 행사의 취소하지 않은 참가비 수입과 그 기간·수입 줄 이름
export async function feeIncomeOf(db: Reader, organizationId: string, eventId: string): Promise<EventFeeIncome | null> {
  const [row] = await db.select({ id: incomes.id, amount: incomes.amount, periodId: incomes.periodId, periodName: budgetPeriods.name,
    lineId: incomes.budgetLineId, lineName: lines.name }).from(incomes)
    .innerJoin(budgetPeriods, and(eq(budgetPeriods.id, incomes.periodId), eq(budgetPeriods.organizationId, incomes.organizationId)))
    .leftJoin(lines, and(eq(lines.id, incomes.budgetLineId), eq(lines.organizationId, incomes.organizationId)))
    .where(and(eq(incomes.organizationId, organizationId), eq(incomes.eventId, eventId), isNull(incomes.voidedAt)))
  if (!row) return null
  return { id: row.id, amount: row.amount, period: { id: row.periodId, name: row.periodName },
    line: row.lineId && row.lineName ? { id: row.lineId, name: row.lineName } : null }
}
```

  `budget/closing.ts`의 다음 기간 수입 줄 조회는 `incomeLinesOf`로 바꾼다.
- [ ] **Step 6: 기간 잠금이 기간을 돌려줌** — `budget/lock.ts`의 `requireOpenEventPeriod`는 기간이 없으면 `null`, 있으면 `FOR SHARE`로 잠근 기간 행을 돌려준다(마감이면 `PERIOD_CLOSED`). 주석에 "정산은 이 기간에 참가비 수입을 넣는다"를 더한다.
- [ ] **Step 7: 정산·다시 열기·응답** — `settlement/service.ts`
  - `responseOf`: 행사가 든 기간 조회를 `{ id, name, closedAt }`로 넓히고, `incomeLinesOf`·`eventFeesOf`·`feeIncomeOf`를 더해 `fees`(`lastPaidAt`은 빼고), `period`, `feeIncome`, `periodClosed`를 채운다.
  - `settle`:

```ts
    async settle(scope: SettlementScope, eventId: string, input: SettleEventRequest) {
      return db.transaction(async tx => {
        await requireFinance(tx, scope, true)
        // 참가비 수입을 넣을 기간이 편성 수정·마감과 엇갈리지 않게 예산 잠금을 같이 잡는다. 잠금 순서는 다시 열기와 같다(학생회 예산 → 기간 행 → 행사 행).
        await shareBudget(tx, scope.organizationId)
        const period = await requireOpenEventPeriod(tx, scope.organizationId, eventId)
        const row = await lockFinance(tx, scope, eventId, input.version)
        if (row?.settledAt) throw new ApiError('INVALID_STATE', 409)
        const numbers = await financeNumbers(tx, scope, eventId)
        // 행사 행을 잠근 뒤 센다. 입금 확인·확인 취소·금액 변경과 겹치지 않아, 정산이 끝날 때까지 그대로다.
        const fees = await eventFeesOf(tx, scope.organizationId, eventId)
        const received = fees?.received ?? 0
        if (numbers.missingEvidence || numbers.pendingRequests || numbers.unrecordedItems || (received > 0 && !period)) {
          throw new ApiError('NOT_READY_TO_SETTLE', 409)
        }
        let fee: { amount: number; count: number; period: string; line: string | null } | null = null
        // 받은 참가비가 0원이면 넣지 않고, 보낸 수입 항목도 보지 않는다.
        if (received > 0) {
          const line = input.feeIncomeLineId === null ? null
            : (await incomeLinesOf(tx, scope.organizationId, period!.id)).find(entry => entry.id === input.feeIncomeLineId)
          if (line === undefined) throw new ApiError('BUDGET_LINE_INVALID', 409)
          const event = await eventOf(tx, scope, eventId)
          await insertFeeIncome(tx, scope, { event: { id: eventId, name: event.name }, period: period!, amount: received, count: fees!.count,
            lastPaidAt: fees!.lastPaidAt!, budgetLineId: line?.id ?? null })
          fee = { amount: received, count: fees!.count, period: period!.name, line: line?.name ?? null }
        }
        await saveFinance(tx, scope, eventId, row !== null, { settledAt: sql`now()`, settledBy: scope.userId })
        await recordFinance(tx, scope, eventId, 'settled', { budget: row?.budget ?? null, spent: numbers.spent, expenseCount: numbers.expenseCount, fee })
        return responseOf(tx, scope, eventId)
      })
    },
```

  - `reopen`: 상태 확인 뒤 `voidFeeIncome(tx, scope, { id: eventId, name: (await eventOf(tx, scope, eventId)).name })`를 부른다. 주석: "정산에서 넣은 참가비 수입을 취소한다. 다시 정산하면 그때의 받은 참가비로 새로 넣는다."
- [ ] **Step 8: 기존 테스트의 정산 본문** — `settlement.test.ts`·`closing.test.ts`(두 곳)·`budget.test.ts`의 정산 본문에 `feeIncomeLineId: null`을 더한다. `payments.test.ts`의 "정산이 끝난 행사는…" 테스트는 받은 참가비가 있으므로, 재정(f)이 기간 '2999년 1학기'를 만들고 행사 e를 넣은 뒤 정산한다.
- [ ] **Step 9: 통과 확인** — `apps/api`에서 `npx tsx --test src/settlement/fee-income.test.ts src/settlement/settlement.test.ts src/registrations/payments.test.ts src/budget/closing.test.ts src/budget/budget.test.ts src/incomes/incomes.test.ts`
- [ ] **Step 10: 커밋** — `정산할 때 받은 참가비를 기간 수입으로 넣기`

### Task 4: 참가비 수입 잠금과 편성·알림

**Files:**
- Modify: `apps/api/src/incomes/service.ts`(`lockIncome`·`incomeSummaries`), `apps/api/src/budget/service.ts`(`periodNumbers`·`applyEvents`·`noticesOf`)
- Test: `apps/api/src/settlement/fee-income.test.ts`, `apps/api/src/budget/budget.test.ts`(알림 이름)

**Interfaces:**
- Consumes: Task 3의 정산이 만든 참가비 수입
- Produces: `FEE_INCOME`(409), `IncomeSummary.event`, `BudgetEventLine.feeIncome`, `notices.eventsWithMoney`

- [ ] **Step 1: 실패하는 테스트** — `fee-income.test.ts`에 더한다(준비는 Task 3과 같이 '행사 참가비' 줄로 정산한 상태)
  1. `'참가비 수입은 고치거나 취소할 수 없고, 수입 응답에 행사가 붙는다'`
     - 그 수입 `GET` → `event` = `{ id: 'e', name: '체육대회' }`. 보통 수입은 `event` null
     - `PATCH`(같은 칸, 버전 그대로) → 409 `FEE_INCOME`, `POST /void` → 409 `FEE_INCOME`
  2. `'편성 수정: 참가비 수입이 있는 행사는 빼지 못하고, 고른 수입 줄과 날짜도 지킨다'`
     - 편성 응답 `events[0].feeIncome` true
     - 행사 e를 뺀 편성 저장 → 409 `FEE_INCOME`
     - '행사 참가비' 줄을 뺀 편성 저장 → 409 `LINE_IN_USE`(Review Focus 5)
     - 끝일을 2999-08-09로 당기는 저장 → 409 `INCOMES_OUTSIDE_PERIOD`(받은 날 2999-08-10)
     - 정산을 다시 열면 `feeIncome` false이고 행사 e를 뺄 수 있다
  3. `'알림: 받은 참가비만 있고 기간에 넣지 않은 행사도 센다'`
     - 행사 e2에 참가비 신청과 입금 확인 하나, 기간에는 넣지 않음, 지출 없음 → 편성 응답 `notices.eventsWithMoney`가 그 행사를 센다. 확인을 취소하면 빠진다.
  - `budget.test.ts`의 `notices` 기대값 이름을 `eventsWithMoney`로 바꾼다.
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/settlement/fee-income.test.ts src/budget/budget.test.ts`
- [ ] **Step 3: 구현**
  - `lockIncome`: 이월금 확인 다음 줄에 `if (row.eventId) throw new ApiError('FEE_INCOME', 409)`. 주석에 "참가비 수입은 행사 정산을 다시 열어야만 바뀐다"를 더한다.
  - `incomeSummaries`: `const feeEvents = alias(events, 'income_fee_events')`를 왼쪽 조인하고 `event: income.eventId ? { id: income.eventId, name: row.eventName ?? '' } : null`
  - `periodNumbers`: 행사 줄의 취소하지 않은 참가비 수입을 한 번에 읽어 `feeIncome: boolean`을 채운다.

```ts
  const feeIncomes = eventIds.length ? await db.select({ eventId: incomes.eventId }).from(incomes)
    .where(and(eq(incomes.organizationId, scope.organizationId), inArray(incomes.eventId, eventIds), isNull(incomes.voidedAt))) : []
  const withFeeIncome = new Set(feeIncomes.map(row => row.eventId))
```

  - `applyEvents`: 뺄 줄이 있으면 먼저 확인한다.

```ts
  // 참가비 수입이 있는 행사는 빼지 않는다. 지출은 행사를 따라 기간을 옮기지만 수입은 기간에 붙어 있어 둘이 갈라진다.
  if (removed.length) {
    const [linked] = await tx.select({ id: incomes.id }).from(incomes).where(and(eq(incomes.organizationId, scope.organizationId),
      inArray(incomes.eventId, removed.map(line => line.eventId!)), isNull(incomes.voidedAt))).limit(1)
    if (linked) throw new ApiError('FEE_INCOME', 409)
  }
```

  - `noticesOf`: 행사 기준으로 센다. 기간에 넣지 않은 이 학생회 행사 가운데, 취소하지 않은 지출이 있거나 입금 확인한 신청이 있는 것.

```ts
  const spending = db.select({ one: sql`1` }).from(expenses)
    .where(and(eq(expenses.organizationId, events.organizationId), eq(expenses.eventId, events.id), isNull(expenses.voidedAt)))
  const fees = db.select({ one: sql`1` }).from(registrations)
    .innerJoin(registrationForms, and(eq(registrationForms.id, registrations.formId), eq(registrationForms.organizationId, registrations.organizationId)))
    .where(and(eq(registrationForms.organizationId, events.organizationId), eq(registrationForms.eventId, events.id), isNotNull(registrations.paidAt)))
  const [outsideEvents] = await db.select({ count: sql<number>`count(*)::int` }).from(events)
    .leftJoin(budgetLines, eq(budgetLines.eventId, events.id))
    .where(and(eq(events.organizationId, scope.organizationId), isNull(budgetLines.id), or(exists(spending), exists(fees))))
```

  `return { eventsWithMoney: outsideEvents!.count, operatingOutside: ... }`
- [ ] **Step 4: 통과 확인** — `npx tsx --test src/settlement/fee-income.test.ts src/budget/budget.test.ts src/budget/closing.test.ts src/incomes/incomes.test.ts`
- [ ] **Step 5: 커밋** — `참가비 수입을 잠그고 편성에서 행사를 못 빼게`

### Task 5: 정산서 참가비와 참가 신청의 정산 상태

**Files:**
- Modify: `apps/api/src/settlement/workbook.ts`(`SettlementSheetData`·요약 시트), `apps/api/src/settlement/service.ts`(`exportData`), `apps/api/src/registrations/service.ts`(`view`의 `settled`)
- Test: `apps/api/src/settlement/workbook.test.ts`, `apps/api/src/settlement/fee-income.test.ts`, `apps/api/src/registrations/payments.test.ts`

**Interfaces:**
- Produces: `SettlementSheetData.fees: { received: number; count: number } | null`, `SettlementSheetData.feeIncome: { period: string; line: string | null } | null`, `RegistrationResponse.settled`

- [ ] **Step 1: 실패하는 테스트**
  - `workbook.test.ts`: 기본 `data`에 `fees: null, feeIncome: null`. 새 테스트 `'참가비가 있으면 요약에 받은 참가비와 넣은 수입을 적는다'`: `fees: { received: 14000, count: 2 }`, `feeIncome: { period: '2999년 1학기', line: '행사 참가비' }` → `row('받은 참가비')` = `['14000', '입금 확인 2명']`, `row('참가비 수입')` = `['2999년 1학기 수입 · 행사 참가비']`, `summary`에 `['참가비']` 줄. `feeIncome` null이면 '참가비 수입' 줄이 없다. `fees` null이면 '참가비'·'받은 참가비' 줄이 없다.
  - `fee-income.test.ts`: 정산 전 `createSettlementService(db).exportData(...)`의 `fees` = `{ received: 14000, count: 2 }`, `feeIncome` null. 정산 뒤 `feeIncome` = `{ period: '2999년 1학기', line: '행사 참가비' }`
  - `payments.test.ts`의 정산 테스트: 정산 전 `GET` 응답 `settled` false, 정산 뒤 true. 신청 설정이 없는 행사의 `GET`도 `settled`가 있다(false).
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/settlement/workbook.test.ts src/settlement/fee-income.test.ts src/registrations/payments.test.ts`
- [ ] **Step 3: 구현**
  - `summarySheet`: "증빙 누락" 줄 다음에

```ts
    ...(data.fees ? [[], [bold('참가비')], [text('받은 참가비'), money(data.fees.received), text(`입금 확인 ${data.fees.count}명`)],
      ...(data.feeIncome ? [[text('참가비 수입'), text(`${data.feeIncome.period} 수입${data.feeIncome.line ? ` · ${data.feeIncome.line}` : ''}`)]] : [])] : []),
```

  - `exportData`: `eventFeesOf`·`feeIncomeOf`로 `fees: fees && { received, count }`, `feeIncome: feeIncome && { period: feeIncome.period.name, line: feeIncome.line?.name ?? null }`
  - `registrations/service.ts` `view`: `eventFinances.settledAt`을 읽어 `settled: Boolean(...)`을 두 반환 모두에 넣는다(설정이 없을 때도).
- [ ] **Step 4: 통과 확인** — Step 2 명령
- [ ] **Step 5: 커밋** — `정산서와 참가 신청에 참가비 정산 상태 더하기`

### Task 6: 행사 재정 탭의 참가비

**Files:**
- Create: `apps/web/src/settlement/EventFees.tsx`(참가비 묶음, 표시만)
- Modify: `apps/web/src/settlement/settlement-view.ts`(정산 조건·처리 기록·기본 수입 항목·오류), `useEventFinance.ts`(`settle(input)`), `EventFinance.tsx`, `settlement-fixtures.ts`
- Test: `apps/web/src/settlement/EventFinance.test.tsx`, `settlement-view.test.ts`

**Interfaces:**
- Consumes: Task 1 `EventFinance.fees·period·feeIncome`, `SettleEventRequest`
- Produces: `defaultFeeIncomeLine(lines: { id: string; name: string }[]): string`(이름에 "참가비"가 든 첫 줄 ID, 없으면 `''`)

- [ ] **Step 1: 실패하는 테스트**
  - `settlement-view.test.ts`
    - `requirements`: `fees` null이거나 받은 참가비 0원이면 셋 그대로. 받은 참가비가 있고 기간이 있으면 `{ key: 'feePeriod', label: '참가비를 넣을 회계 기간: 2999년 1학기', done: true }`, 없으면 `'참가비를 넣을 회계 기간이 없어요'`, `hint` '예산 화면의 편성 수정에서 이 행사를 회계 기간에 넣어 주세요.', `done` false
    - `financeHistoryText`: `fee`가 있으면 `'정산 완료 · 실제 지출 0원 · 참가비 14,000원 → 2999년 1학기 수입'`, 없거나 null이면 지금 문구
    - `defaultFeeIncomeLine`: '행사 참가비'가 있으면 그 ID, 없으면 `''`
  - `EventFinance.test.tsx`
    - 참가비 묶음: `fees: { received: 14000, count: 2, unpaid: 1 }` → '받은 참가비 14,000원 · 입금 확인 2명', '입금 전 1명', 재정 권한자에게만 '정산 뒤에는 입금을 확인할 수 없어요. 들어온 돈이면 참가자 탭에서 먼저 확인해 주세요.'. `fees` null이면 묶음이 없다.
    - 기간이 없으면 정산 버튼이 꺼지고 해결 방법이 보인다.
    - 정산 확인: '받은 참가비 14,000원은 2999년 1학기 수입으로 들어가요.', '정산 뒤에는 입금 확인과 참가비를 바꿀 수 없어요.', '참가비 수입 항목' 기본값 '행사 참가비'. 보낸 본문 `{ version: 0, feeIncomeLineId: 'l2' }`. '고르지 않음'을 고르면 `null`. 받은 참가비가 0원이면 고르기가 없고 `null`을 보낸다.
    - 정산 뒤: '14,000원을 2999년 1학기 수입으로 넣었어요.', '수입 항목: 행사 참가비', 다시 열기 안내 '다시 열면 참가비 수입 14,000원이 취소되고, 지출과 예산을 바꿀 수 있어요.'
    - 기존 테스트의 정산 본문 기대값 `{ version: 1 }` → `{ version: 1, feeIncomeLineId: null }`
- [ ] **Step 2: 실패 확인** — `npm test --workspace @vada/web -- src/settlement`
- [ ] **Step 3: 구현**
  - `settlement-view.ts`: `Requirement.key`에 `'feePeriod'`를 더하고, `requirements`가 받은 참가비가 있을 때만 넷째 줄을 붙인다. `settlementErrors.BUDGET_LINE_INVALID = '참가비 수입 항목을 다시 골라 주세요.'`. `financeHistoryText`의 `settled`는 `changes.fee`(`{ amount, period } | null | undefined`)를 읽는다.
  - `useEventFinance.ts`: `settle: (input: SettleEventRequest) => send('/settle', input)`
  - `EventFees.tsx`(새 파일, 표시만): props `{ fees: EventFees; feeIncome: EventFeeIncome | null; hint: boolean }`. `section aria-label="참가비"`, 제목 '참가비', 위 문구들. `hint`는 재정 권한자이고 정산 전이며 입금 전이 있을 때 true.
  - `EventFinance.tsx`:
    - 숫자 아래에 `{summary.fees && <EventFees fees={summary.fees} feeIncome={summary.feeIncome} hint={finance && !settled} />}`
    - 정산 확인에 문구 두 줄과 `NativeSelect`(받은 참가비가 있고 `period.incomes`가 있을 때). 고른 값은 `useState(() => defaultFeeIncomeLine(summary.period?.incomes ?? []))`. 보낼 때 `received > 0 && lines.some(line => line.id === lineId) ? lineId : null`
    - 다시 열기 안내를 `feeIncome`에 따라 바꾼다.
  - `settlement-fixtures.ts` 기본값에 `fees: null, period: null, feeIncome: null`
- [ ] **Step 4: 통과 확인** — `npm test --workspace @vada/web -- src/settlement src/workspace`
- [ ] **Step 5: 커밋** — `행사 재정 탭에 참가비와 참가비 수입 보이기`

### Task 7: 예산 화면의 참가비 수입

**Files:**
- Modify: `apps/web/src/budget/IncomeDetailDialog.tsx`, `income-view.ts`(오류), `BudgetPlanForm.tsx`, `budget-view.ts`(`DraftEvent.feeIncome`·오류), `BudgetPlanView.tsx`(알림), `budget-fixtures.ts`
- Test: `IncomeDetailDialog.test.tsx`, `BudgetPlanForm.test.tsx`, `Budget.test.tsx`, `budget-view.test.ts`

- [ ] **Step 1: 실패하는 테스트**
  - 수입 상세: `event: { id: 'e', name: '체육대회' }`인 수입 → '체육대회 정산에서 넣은 참가비예요. 바꾸려면 그 행사 정산을 다시 열어 주세요.'(재정 권한자, 열린 기간), [수정]·[수입 취소] 없음. 구성원에게는 앞 문장만. 취소된 참가비 수입·취소된 이월금에는 "바꾸려면…"이 붙지 않는다.
  - 편성 수정: `budgetEventLine({ feeIncome: true })` → [빼기] 꺼짐, '참가비 수입이 들어간 행사예요. 빼려면 행사 정산을 다시 열어 주세요.'. `feeIncome` false인 줄은 그대로 뺄 수 있다.
  - 예산 화면 알림: `notices: { eventsWithMoney: 2, operatingOutside: 1 }` → '지출이나 받은 참가비가 있는데 기간에 넣지 않은 행사 2개 — 편성 수정에서 행사를 넣어 주세요.'
  - 오류 문구: `incomeMessage('FEE_INCOME')` = '행사 정산에서 넣은 참가비 수입은 바꿀 수 없어요.', `budgetMessage('FEE_INCOME')` = '참가비 수입이 들어간 행사는 뺄 수 없어요. 행사 정산을 다시 연 뒤 빼 주세요.'
- [ ] **Step 2: 실패 확인** — `npm test --workspace @vada/web -- src/budget`
- [ ] **Step 3: 구현**
  - `IncomeDetailDialog.tsx`: `editable`에 `current.event === null`을 더한다. 이월금 안내의 덧붙임 조건에 `!current.voided`를 더한다. 참가비 수입 안내를 이월금 안내 옆에 같은 모양으로 둔다.
  - `budget-view.ts`: `DraftEvent`에 `feeIncome: boolean`, `eventDraft`는 `entry.feeIncome ?? false`(후보에는 없다). 오류 문구 더하기.
  - `BudgetPlanForm.tsx`: 행사 줄 [빼기]에 `disabled={line.feeIncome}`와 이유 문구(`text-xs text-gray-500`).
  - `BudgetPlanView.tsx`: 알림 이름과 문구
  - `income-view.ts`: 오류 문구
  - `budget-fixtures.ts`: 행사 줄 `feeIncome: false`, 알림 이름, 수입 `event: null`
- [ ] **Step 4: 통과 확인** — `npm test --workspace @vada/web -- src/budget`
- [ ] **Step 5: 커밋** — `예산 화면에 참가비 수입 안내와 빼기 막기`

### Task 8: 정산한 행사의 참가자 탭

**Files:**
- Modify: `apps/web/src/registrations/RegistrationPanel.tsx`, `RegistrantList.tsx`, `RegistrantDialog.tsx`, `RegistrationFormDialog.tsx`, `registration-fixtures.ts`
- Test: `apps/web/src/registrations/RegistrationPanel.test.tsx`

- [ ] **Step 1: 실패하는 테스트** — `feeResponse({ settled: true })`
  - 명단에 [입금 확인] 버튼이 없고 '정산이 끝난 행사라 입금과 참가비를 바꿀 수 없어요.'가 보인다. [관리]는 있다.
  - 관리 대화상자(이수강·박참여): [입금 확인]·[입금 확인 취소]·참가비 바꾸기 버튼이 없고 같은 문장이 보인다. [신청 취소]는 있다.
  - 설정 대화상자: 참가비 칸·납부자 체크가 꺼지고 '정산이 끝난 행사라 참가비를 바꿀 수 없어요.'
  - `settled` false인 기존 테스트는 그대로 통과한다.
- [ ] **Step 2: 실패 확인** — `npm test --workspace @vada/web -- src/registrations`
- [ ] **Step 3: 구현**
  - `RegistrationPanel`: `state.data.settled`를 `RegistrantList`와 `RegistrationFormDialog`에 넘긴다.
  - `RegistrantList`: props `settled`. 줄의 [입금 확인] 조건에 `!settled`. 참가비가 있으면(`fees`) 거르기 아래에 `StateMessage kind="notice"`로 문장. 관리 대화상자에 `settled`를 넘긴다.
  - `RegistrantDialog`: `settled`면 참가비 바꾸기·입금 버튼을 그리지 않고 참가비 묶음 아래에 같은 문장을 둔다.
  - `RegistrationFormDialog`: props `settled`. `locked = settled || payments.count > 0`, 문구는 `settled`가 먼저다.
  - `registration-fixtures.ts`의 `registrationResponse` 기본값에 `settled: false`
- [ ] **Step 4: 통과 확인** — `npm test --workspace @vada/web -- src/registrations`
- [ ] **Step 5: 커밋** — `정산한 행사의 참가자 탭에서 입금 버튼 감추기`

### Task 9: 문서와 전체 검사

**Files:**
- Modify: `docs/ERD.md`(incomes.event_id, 관계, 규칙 한 줄)

- [ ] **Step 1: ERD** — `incomes`에 `text event_id FK "참가비 수입이면 그 행사"`, 관계 `events |o..o{ incomes : "참가비 수입"`, 규칙: "참가비 수입: 행사를 정산하면 받은 참가비가 그 행사가 든 기간의 수입 한 건이 된다(`incomes.event_id`). 손으로 고치거나 취소하지 않고, 정산을 다시 열면 취소한다. 행사 하나의 취소하지 않은 참가비 수입은 한 건뿐이다(부분 unique 색인)."
- [ ] **Step 2: 전체 검사** — `npm run typecheck`, `npm test --workspace @vada/contracts`, `npm test --workspace @vada/api`, `npm test --workspace @vada/web`. 실패는 고치고 다시 돌린다.
- [ ] **Step 3: 커밋** — `참가비 수입을 문서에 반영`

### 이어서(계획 밖, 진행 방식대로)

1. 새 컨텍스트 Opus 최종 리뷰 → 고칠 것 고치기
2. 0022 적용 스크립트(`.superpowers/apply-0022.mts`): 적용 전 기록·해시 확인, "정산했는데 입금 확인이 있는 행사" 수 → 사용자 승인으로 dev·preview 적용
3. dev 브라우저 확인(재정 탭 정산·다시 열기, 수입 상세, 편성 수정, 참가자 탭) → main 병합·푸시 → CI·운영 health
4. 진행 위치·known-issues 메모 갱신
