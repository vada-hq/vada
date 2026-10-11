# M5a 행사 완료 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회장단이 정산한 행사를 완료하면, 그 행사는 서버가 모든 쓰기를 막는 기록이 되고 옆 메뉴 "기록"으로 옮겨진다.

**Architecture:** `events.completed_at·completed_by` 두 칸(마이그레이션 0025)이 완료를 나타낸다. 행사 기록을 바꾸는 모든 쓰기는 거래 맨 앞에서 `events/lock.ts`로 행사 행을 잠그고 완료를 본다. `completion-lock.test.ts`가 행사 아래 모든 변경 라우트를 표로 확인한다. 화면은 날짜로 단계(기획 중·진행 중·정리 중·완료)를 계산하고, 완료한 행사는 볼 수만 있게 그린다.

**Tech Stack:** Hono, drizzle-orm(PostgreSQL·PGlite), zod(`@vada/contracts`), React 19, Tailwind, vitest, node:test

**Spec:** `docs/superpowers/specs/2026-10-12-event-completion-design.md`

## Global Constraints

- 본문 스키마는 contracts의 `z.strictObject`, 라우트는 `json(Schema)`를 인증보다 앞에 둔다. `c.req.json()`을 부르지 않는다.
- 실패는 `ApiError(code, status)`로 던진다. 새 코드: `EVENT_COMPLETED`(409), `EVENT_NOT_SETTLED`(409).
- 완료·완료 취소는 회장단(`manageOrganization`)만 한다.
- 잠금 순서: 학생회 예산 → 기간 → 행사 → 신청서·품목·업무·배송 행. 행사 행을 `FOR NO KEY UPDATE`로 잠그는 곳은 `lockActiveEvent`, 나머지는 `requireActiveEvents`(`FOR SHARE`).
- 영수증 더 붙이기·확인은 막지 않는다(M2-1 결정). 지우기만 막는다.
- 화면: 버튼·입력·대화상자·칩은 `apps/web/src/components/ui` 부품, 모양은 Tailwind 표준 클래스, 긴 이름에는 `wrap-anywhere`.
- 커밋: 제목 50자 이내 명령형 한국어, AI 서명·Co-Authored-By 없음.
- API 테스트는 이 PC에서 `--test-concurrency=2`로 돌린다(여러 파일 동시 실행은 메모리 부족).

## Review Focus

1. 다른 회장단이 방금 완료한 행사를 열어 둔 화면에서 버튼을 누름 → "전송 결과를 확인하지 못했어요" 같은 일반 실패가 아니라 "완료한 행사라 바꿀 수 없어요"가 보여야 한다. (Task 6: 대화 전송·업무 상태 바꾸기 테스트)
2. 날짜 없는 행사(취소된 기획)를 완료 → 막지 않고 "아직 행사가 끝나지 않았어요" 알림만 보인다. (Task 5: 완료 대화상자 테스트)
3. 예산 화면에서 완료한 행사 이름을 눌러 엶 → 볼 수만 있는 화면이고 경로가 "기록"이다. (Task 7: Workspace 테스트)
4. 사용 내역에서 지출 기록·수정 → 완료한 행사는 행사 고르기에 없고, 이미 그 행사에 기록한 지출을 열면 그 행사가 그대로 보인다. (Task 7: ExpenseFormDialog 테스트)
5. 완료 뒤 공개 신청 링크를 연 학생 → "마감"으로 보이고 신청이 `REGISTRATION_NOT_OPEN`, 내 신청 취소가 `CANCEL_CLOSED`다. (Task 3 전수 테스트, Task 4 공개 화면 상태 테스트)

---

### Task 1: 완료 칸·마이그레이션 0025·계약

**Files:**
- Modify: `apps/api/src/db/schema.ts` (events 표)
- Create: `apps/api/migrations/0025_event_completion.sql`, `apps/api/migrations/meta/0025_snapshot.json`(drizzle-kit 생성), `_journal.json` 갱신
- Modify: `apps/api/src/events/events.ts` (serializeEvent, 만들기 INSERT … SELECT)
- Modify: `packages/contracts/src/events.ts`, `packages/contracts/src/index.ts`
- Modify: `docs/ERD.md`
- Test: `apps/api/src/db/schema.test.ts`, `apps/api/src/db/migrations.test.ts`, `apps/api/src/events/events.test.ts`, `packages/contracts/src/input.test.ts`
- Modify(타입): 웹·API의 `EventSummary` 테스트 고정값에 `completedAt: null`

**Interfaces:**
- Produces: `events.completedAt: Date | null`, `events.completedBy: string | null`(schema), `EventSummary.completedAt: string | null`(ISO), `CompleteEventSchema`·`CancelEventCompletionSchema`(`{ version }`), `CompleteEventRequest`, `EventCompletionResponse { settled: boolean; openTasks: number }`

- [ ] **Step 1: 실패하는 테스트 쓰기**

`apps/api/src/db/schema.test.ts`의 `events belong to an organization…` 테스트를 바꾼다.

```ts
  assert.deepEqual(config.columns.map(column => column.name), ['id', 'organization_id', 'name', 'created_by', 'created_at', 'starts_at', 'ends_at', 'place',
    'version', 'completed_at', 'completed_by'])
  // 일시·장소(M3a)와 완료(M5a)만 비울 수 있다.
  assert.deepEqual(config.columns.filter(column => !column.notNull).map(column => column.name), ['starts_at', 'ends_at', 'place', 'completed_at', 'completed_by'])
  assert.equal(config.foreignKeys.length, 3)
  for (const [columnName, parent] of [['organization_id', organizations], ['created_by', users], ['completed_by', users]] as const) {
```

`apps/api/src/db/migrations.test.ts` 끝에 더한다.

```ts
test('0025 adds event completion without touching existing events', async (t) => {
  const pg = new PGlite()
  const previous = migrationsBefore('0025_event_completion')
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: previous.folder })
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('u','기획','u@example.test');
      INSERT INTO organizations (id,name) VALUES ('o','Council');
      INSERT INTO events (id,organization_id,name,created_by,version) VALUES ('e','o','체육대회','u',3);
    `)
    await migrate(db, { migrationsFolder })
    await t.test('existing events are not completed and keep their version', async () => {
      const { rows } = await pg.query<Record<string, unknown>>("SELECT version, completed_at, completed_by FROM events WHERE id = 'e'")
      assert.deepEqual(rows[0], { version: 3, completed_at: null, completed_by: null })
    })
    await t.test('completion time and person come together', async () => {
      await assert.rejects(pg.exec("UPDATE events SET completed_at = now() WHERE id = 'e'"), { constraint: 'events_completed_pair' })
      await assert.rejects(pg.exec("UPDATE events SET completed_by = 'u' WHERE id = 'e'"), { constraint: 'events_completed_pair' })
      await assert.rejects(pg.exec("UPDATE events SET completed_at = now(), completed_by = 'nobody' WHERE id = 'e'"), { constraint: 'events_completed_by_users_id_fk' })
      await pg.exec("UPDATE events SET completed_at = now(), completed_by = 'u' WHERE id = 'e'")
    })
  } finally {
    previous.remove()
    await pg.close()
  }
})
```

`apps/api/src/events/events.test.ts`에서 행사 목록·만들기 응답을 확인하는 테스트에 `completedAt`을 더한다(만든 행사와 목록의 행사 모두 `completedAt: null`). 기존 `deepEqual`이 응답 전체를 비교하면 기대값에 `completedAt: null`을 넣는다.

`packages/contracts/src/input.test.ts` 끝에 더한다.

```ts
test('행사 완료 본문은 버전 하나만 받는다', () => {
  for (const schema of [CompleteEventSchema, CancelEventCompletionSchema]) {
    assert.equal(schema.safeParse({ version: 1 }).success, true)
    for (const body of [{}, { version: 0 }, { version: 1.5 }, { version: '1' }, { version: -1 }, { version: 1, extra: true }, null]) {
      assert.equal(schema.safeParse(body).success, false, JSON.stringify(body))
    }
  }
})
```
(맨 위 import에 `CompleteEventSchema, CancelEventCompletionSchema`를 `./events.js`에서 더한다.)

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api; npx tsx --test src/db/schema.test.ts src/events/events.test.ts` → FAIL(칸 목록 다름)
Run: `npm test --workspace @vada/contracts` → FAIL(`CompleteEventSchema` 없음)

- [ ] **Step 3: 스키마와 마이그레이션**

`apps/api/src/db/schema.ts` events 표의 `version` 다음에 더한다(칸 순서가 INSERT … SELECT와 맞아야 하므로 맨 뒤).

```ts
  version: integer('version').notNull().default(1),
  // 행사를 완료한 시각과 사람(M5a). 완료하지 않았으면 둘 다 없다. 완료한 행사는 기록을 바꾸지 않는다(events/lock.ts).
  completedAt: timestamp('completed_at', { withTimezone: true }),
  completedBy: text('completed_by').references(() => users.id, { onDelete: 'restrict' }),
}, (table) => [
```
CHECK 목록 끝에 더한다.
```ts
  check('events_completed_pair', sql`(${table.completedAt} IS NULL) = (${table.completedBy} IS NULL)`),
```

Run: `cd apps/api; npx drizzle-kit generate --name event_completion`
Expected: `migrations/0025_event_completion.sql`에 아래 네 문장(순서는 drizzle-kit이 정함)만 있다. 다른 표를 바꾸면 멈추고 원인을 찾는다.
```sql
ALTER TABLE "events" ADD COLUMN "completed_at" timestamp with time zone;
ALTER TABLE "events" ADD COLUMN "completed_by" text;
ALTER TABLE "events" ADD CONSTRAINT "events_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "events" ADD CONSTRAINT "events_completed_pair" CHECK (("events"."completed_at" IS NULL) = ("events"."completed_by" IS NULL));
```
`.sql`이 LF인지 확인한다(`.gitattributes`가 고정).

- [ ] **Step 4: 계약**

`packages/contracts/src/events.ts` 끝에 더한다.
```ts
// 행사 완료·완료 취소(M5a). 화면이 본 행사 버전을 보낸다.
export const CompleteEventSchema = z.strictObject({ version: z.number().int().min(1).max(PURCHASE_INTEGER_MAX) })
export const CancelEventCompletionSchema = CompleteEventSchema
export type CompleteEventRequest = z.infer<typeof CompleteEventSchema>
```
`packages/contracts/src/index.ts`
- events 내보내기 줄에 `CompleteEventSchema, CancelEventCompletionSchema, type CompleteEventRequest`를 더한다.
- `EventSummary`의 `version` 다음에 더한다.
```ts
  // 행사를 완료한 시각(ISO, M5a). 완료하지 않았으면 null이다.
  completedAt: string | null
```
- `EventsResponse` 다음에 더한다.
```ts
// 완료 확인 대화상자(M5a). 정산해야 완료할 수 있고, 끝나지 않은 업무는 알리기만 한다.
export interface EventCompletionResponse {
  settled: boolean
  openTasks: number
}
```

- [ ] **Step 5: 행사 응답과 만들기**

`apps/api/src/events/events.ts`
- `serializeEvent`의 `version: event.version` 뒤에 `completedAt: event.completedAt?.toISOString() ?? null`
- 만들기의 `version: sql<number>\`1\`.as('version'),` 다음에 더한다.
```ts
          completedAt: sql<Date | null>`null::timestamptz`.as('completed_at'),
          completedBy: sql<string | null>`null::text`.as('completed_by'),
```
- 주석 "일시·장소(M3a)는 빈 값과 첫 버전으로 채운다"를 "일시·장소(M3a)와 완료(M5a)는 빈 값, 버전은 1로 채운다"로 고친다.

`docs/ERD.md`의 events 블록에 두 줄과 설명을 더한다.
```
        timestamptz completed_at "완료 시각, 선택"
        text completed_by FK "완료한 사람, 완료 시각과 함께"
```
목록 설명의 `events` 항목 끝에 "완료(M5a)한 행사는 기록을 바꾸지 않는다. 완료 시각과 완료한 사람은 함께 있거나 함께 없다(CHECK)."를 더한다.

- [ ] **Step 6: 테스트 고정값과 타입**

Run: `npm run typecheck`
Expected: `EventSummary` 고정값에 `completedAt`이 없다는 오류. 알려 준 곳마다 `version: 1` 뒤에 `completedAt: null`을 더한다(예상: `apps/web/src/test-support/workflow-fixtures.ts`, `events/EventList.test.tsx`, `events/useEvents.test.tsx`, `tasks/EventTasks.test.tsx`, `tasks/task-view.test.ts`, `workspace/Workspace.test.tsx`의 `event`). 다시 돌려 오류 0.

- [ ] **Step 7: 통과 확인**

Run: `cd apps/api; npx tsx --test --test-concurrency=2 src/db/schema.test.ts src/db/migrations.test.ts src/events/events.test.ts`
Run: `npm test --workspace @vada/contracts`
Expected: PASS

- [ ] **Step 8: 커밋**

```bash
git add apps/api/src/db/schema.ts apps/api/migrations apps/api/src/events/events.ts apps/api/src/db/schema.test.ts apps/api/src/db/migrations.test.ts apps/api/src/events/events.test.ts packages/contracts/src docs/ERD.md apps/web/src
git commit -m "행사 완료 칸과 마이그레이션 0025 더하기"
```

---

### Task 2: 행사 잠금 함수와 완료 API

**Files:**
- Create: `apps/api/src/events/lock.ts`
- Modify: `apps/api/src/settlement/lock.ts` (requireOpenEvents)
- Modify: `apps/api/src/access/membership.ts` (requireOrganizationManager)
- Modify: `apps/api/src/events/events.ts` (완료 라우트 셋, 행사 수정의 잠금)
- Create: `apps/api/src/events/completion.test.ts`
- Modify: `apps/api/package.json` (test 목록에 새 파일)

**Interfaces:**
- Consumes: Task 1의 `events.completedAt`, `CompleteEventSchema`, `EventCompletionResponse`
- Produces:
  - `shareEvent(tx: Reader, organizationId: string, eventId: string): Promise<{ completedAt: Date | null }>` — FOR SHARE, 없으면 NOT_FOUND
  - `requireActiveEvents(tx: Reader, organizationId: string, eventIds: string[]): Promise<void>` — FOR SHARE(ID 순), 완료면 EVENT_COMPLETED
  - `lockActiveEvent(tx: Reader, organizationId: string, eventId: string): Promise<typeof events.$inferSelect>` — FOR NO KEY UPDATE
  - `checkActiveEvents(db: Reader, organizationId: string, eventIds: string[]): Promise<void>` — 잠그지 않는 미리 보기(외부 호출 전)
  - `requireOrganizationManager()` 미들웨어

- [ ] **Step 1: 실패하는 테스트 쓰기** — `apps/api/src/events/completion.test.ts`

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { EventCompletionResponse, EventResponse, EventsResponse, TaskResponse } from '@vada/contracts'
import { setupPurchases } from '../purchases/test-setup.js'

// 학생회 a: 기획부 p·q, 총무부(구매 승인) f, 회장단 l, 미배정 n. 학생회 b: x. 행사 e·e2(a), ex(b).
type Env = Awaited<ReturnType<typeof setupPurchases>>
async function refused(pending: Response | Promise<Response>, status: number, error: string) {
  const response = await pending
  assert.equal(response.status, status, error)
  assert.deepEqual(await response.json(), { error })
}
// 정산은 settlement 테스트가 본다. 여기서는 정산한 상태만 만든다.
const settle = (env: Env, event = 'e') =>
  env.pg.query(`INSERT INTO event_finances(event_id, organization_id, settled_at, settled_by) VALUES ($1, 'a', now(), 'f')`, [event])
const complete = (env: Env, version = 1, event = 'e') => env.request('POST', `/events/${event}/completion`, { version })
const cancel = (env: Env, version: number, event = 'e') => env.request('POST', `/events/${event}/completion/cancel`, { version })
const expense = { eventId: 'e', vendor: '쿠팡', description: '물품', amount: 1000, paidOn: '2026-10-09', method: 'council_card',
  payerMembershipId: 'mf', note: null, itemIds: [], budgetLineId: null }

test('회장단은 정산한 행사를 완료하고 완료를 취소한다. 행사 목록이 완료 시각을 준다', async () => {
  const env = await setupPurchases()
  try {
    await settle(env)
    env.as('l')
    const done = (await env.ok<EventResponse>(complete(env))).event
    assert.ok(done.completedAt)
    assert.equal(done.version, 2)
    const list = await env.ok<EventsResponse>(env.request('GET', '/events'))
    assert.equal(list.events.find(event => event.id === 'e')?.completedAt, done.completedAt)
    assert.equal(list.events.find(event => event.id === 'e2')?.completedAt, null)
    const back = (await env.ok<EventResponse>(cancel(env, 2))).event
    assert.equal(back.completedAt, null)
    assert.equal(back.version, 3)
    const { rows } = await env.pg.query<{ completed_by: string | null }>(`SELECT completed_by FROM events WHERE id = 'e'`)
    assert.equal(rows[0]!.completed_by, null)
  } finally { await env.pg.close() }
})

test('정산하지 않은 행사는 완료하지 않고, 버전이 다르거나 이미 그 상태면 거절한다', async () => {
  const env = await setupPurchases()
  try {
    env.as('l')
    await refused(complete(env), 409, 'EVENT_NOT_SETTLED')
    await settle(env)
    await refused(complete(env, 2), 409, 'VERSION_CONFLICT')
    await refused(cancel(env, 1), 409, 'INVALID_STATE')
    await env.ok(complete(env))
    await refused(complete(env, 2), 409, 'INVALID_STATE')
    await refused(cancel(env, 1), 409, 'VERSION_CONFLICT')
  } finally { await env.pg.close() }
})

test('회장단만 완료한다. 미인증·다른 학생회·없는 행사는 거절하고 아무것도 바꾸지 않는다', async () => {
  const env = await setupPurchases()
  try {
    await settle(env)
    for (const user of ['p', 'f', 'n']) {
      env.as(user)
      await refused(complete(env), 403, 'FORBIDDEN')
    }
    env.as('x')
    await refused(complete(env), 403, 'FORBIDDEN')
    env.as(null)
    assert.equal((await complete(env)).status, 401)
    env.as('l')
    await refused(complete(env, 1, 'ex'), 404, 'NOT_FOUND')
    await refused(complete(env, 1, 'nope'), 404, 'NOT_FOUND')
    const list = await env.ok<EventsResponse>(env.request('GET', '/events'))
    assert.deepEqual(list.events.filter(event => event.completedAt).map(event => event.id), [])
  } finally { await env.pg.close() }
})

test('완료 본문은 버전 하나만 받는다', async () => {
  const env = await setupPurchases()
  try {
    await settle(env)
    env.as('l')
    for (const body of [{}, { version: 0 }, { version: 1.5 }, { version: '1' }, { version: 1, extra: true }]) {
      for (const path of ['/events/e/completion', '/events/e/completion/cancel']) await refused(env.request('POST', path, body), 400, 'INVALID_INPUT')
    }
  } finally { await env.pg.close() }
})

test('완료 확인: 정산 여부와 끝나지 않은 업무 수를 구성원 누구나 본다', async () => {
  const env = await setupPurchases()
  try {
    const add = (title: string) => env.request('POST', '/events/e/tasks', { title, description: null, departmentId: null, assigneeMembershipId: null, dueOn: null })
    const first = (await env.ok<TaskResponse>(add('대관'), 201)).task
    await env.ok(add('정산'), 201)
    await env.ok(env.request('POST', `/events/e/tasks/${first.id}/status`, { version: 1, status: 'done' }))
    env.as('n')
    assert.deepEqual(await env.ok<EventCompletionResponse>(env.request('GET', '/events/e/completion')), { settled: false, openTasks: 1 })
    await settle(env)
    assert.deepEqual(await env.ok<EventCompletionResponse>(env.request('GET', '/events/e/completion')), { settled: true, openTasks: 1 })
    await refused(env.request('GET', '/events/ex/completion'), 404, 'NOT_FOUND')
  } finally { await env.pg.close() }
})

test('완료한 행사는 행사 정보를 바꿀 수 없고, 정산 잠금도 완료를 먼저 알린다. 완료를 취소하면 다시 된다', async () => {
  const env = await setupPurchases()
  try {
    await settle(env)
    env.as('l')
    await env.ok(complete(env))
    env.as('p')
    await refused(env.request('PATCH', '/events/e', { version: 2, startsAt: '2999-08-20T10:00', endsAt: null, place: null }), 409, 'EVENT_COMPLETED')
    env.as('f')
    await refused(env.request('POST', '/expenses', expense), 409, 'EVENT_COMPLETED')
    await refused(env.request('POST', '/events/e/finance/reopen', { version: 1, reason: '다시 확인' }), 409, 'EVENT_COMPLETED')
    env.as('l')
    await env.ok(cancel(env, 2))
    env.as('p')
    const updated = (await env.ok<EventResponse>(env.request('PATCH', '/events/e', { version: 3, startsAt: '2999-08-20T10:00', endsAt: null, place: null }))).event
    assert.equal(updated.startsAt, '2999-08-20T10:00')
    env.as('f')
    await refused(env.request('POST', '/expenses', expense), 409, 'EVENT_SETTLED')
  } finally { await env.pg.close() }
})
```

`apps/api/package.json`의 `test` 목록에서 `src/events/events.test.ts` 다음에 ` src/events/completion.test.ts`를 더한다.

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api; npx tsx --test src/events/completion.test.ts`
Expected: FAIL(완료 경로 404)

- [ ] **Step 3: 잠금 함수** — `apps/api/src/events/lock.ts`

```ts
import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { events } from '../db/schema.js'
import { ApiError } from '../http/errors.js'

type Reader = Pick<PgDatabase<PgQueryResultHKT>, 'select'>

// 완료한 행사(M5a)는 기록을 바꾸지 않는다. 행사 기록을 바꾸는 쓰기는 거래 맨 앞에서 아래 함수로 행사 행을 잠그고 완료를 본다.
// FOR SHARE끼리는 서로 기다리지 않고, 완료·완료 취소(FOR NO KEY UPDATE)와는 하나씩 진행된다. 나중에 잠근 쓰기는 완료를 보고 멈춘다.
// 다른 학생회의 행사는 없는 것으로 본다.
export async function shareEvent(tx: Reader, organizationId: string, eventId: string) {
  const [event] = await tx.select({ completedAt: events.completedAt }).from(events)
    .where(and(eq(events.organizationId, organizationId), eq(events.id, eventId))).for('share')
  if (!event) throw new ApiError('NOT_FOUND', 404)
  return event
}
// 여러 행사는 ID 순서로 잠근다.
export async function requireActiveEvents(tx: Reader, organizationId: string, eventIds: string[]) {
  for (const id of [...new Set(eventIds)].sort()) {
    if ((await shareEvent(tx, organizationId, id)).completedAt) throw new ApiError('EVENT_COMPLETED', 409)
  }
}
// 행사 행을 바꾸거나, 행사 행을 잠근 채 세고 더하는 쓰기가 쓴다(FOR NO KEY UPDATE).
// 같은 거래에서 FOR SHARE를 먼저 잡고 올리면 교착이 날 수 있어 처음부터 이것으로 잠근다.
export async function lockActiveEvent(tx: Reader, organizationId: string, eventId: string) {
  const [event] = await tx.select().from(events)
    .where(and(eq(events.organizationId, organizationId), eq(events.id, eventId))).for('no key update')
  if (!event) throw new ApiError('NOT_FOUND', 404)
  if (event.completedAt) throw new ApiError('EVENT_COMPLETED', 409)
  return event
}
// 잠그지 않고 미리 본다. 끼룩이·배송 조회처럼 비싼 바깥 호출 전에 쓴다. 저장 거래에서 위 함수로 다시 본다.
export async function checkActiveEvents(db: Reader, organizationId: string, eventIds: string[]) {
  if (!eventIds.length) return
  const [completed] = await db.select({ id: events.id }).from(events)
    .where(and(eq(events.organizationId, organizationId), inArray(events.id, eventIds), isNotNull(events.completedAt))).limit(1)
  if (completed) throw new ApiError('EVENT_COMPLETED', 409)
}
```

- [ ] **Step 4: 정산 잠금이 완료를 먼저 본다** — `apps/api/src/settlement/lock.ts`

```ts
    const [event] = await tx.select({ completedAt: events.completedAt }).from(events)
      .where(and(eq(events.organizationId, organizationId), eq(events.id, id))).for('share')
    if (!event) throw new ApiError('NOT_FOUND', 404)
    // 완료한 행사(M5a)는 정산보다 먼저 알린다. 완료하려면 정산이 끝나 있어야 하므로 화면에 더 맞는 이유다.
    if (event.completedAt) throw new ApiError('EVENT_COMPLETED', 409)
```
맨 위 주석에 "완료한 행사도 막는다(M5a)."를 더한다.

- [ ] **Step 5: 회장단 미들웨어** — `apps/api/src/access/membership.ts` 끝

```ts
// requireMembership 다음에 둔다. 회장단만 하는 일(행사 완료·완료 취소)에 쓴다.
export function requireOrganizationManager() {
  return createMiddleware<MembershipEnv>(async (c, next) => {
    if (!c.get('membership').permissions.manageOrganization) return c.json({ error: 'FORBIDDEN' }, 403)
    await next()
  })
}
```

- [ ] **Step 6: 완료 라우트와 행사 수정** — `apps/api/src/events/events.ts`

import를 더한다: `count, ne`(drizzle-orm), `CompleteEventSchema, CancelEventCompletionSchema, type EventCompletionResponse`(contracts), `eventFinances, tasks`(schema), `requireOrganizationManager`(membership), `lockActiveEvent`(`./lock.js`).

행사 수정(PATCH)의 잠금 select·NOT_FOUND 두 줄을 바꾼다.
```ts
      // 행사 행은 FOR NO KEY UPDATE로 잠근다(저장소 관례). 참가 신청 설정 변경·입금 확인과 겹치지 않고, 완료한 행사는 막는다.
      const current = await lockActiveEvent(tx, organizationId, eventId)
```

`return routes` 앞에 더한다.
```ts
  const leader = requireOrganizationManager()
  // 완료·완료 취소가 잠근다. 완료 여부와 상관없이 잠가야 하므로 lockActiveEvent를 쓰지 않는다.
  async function lockEvent(tx: Pick<PgDatabase<PgQueryResultHKT>, 'select'>, organizationId: string, eventId: string) {
    const [event] = await tx.select().from(events)
      .where(and(eq(events.organizationId, organizationId), eq(events.id, eventId))).for('no key update')
    if (!event) throw new ApiError('NOT_FOUND', 404)
    return event
  }
  // 완료 확인 대화상자가 연다. 정산 여부와 끝나지 않은 업무(예정·진행 중) 수다.
  routes.get(`${path}/:eventId/completion`, authenticated, member, async (c) => {
    const organizationId = c.req.param('organizationId')
    const eventId = idOf(c.req.param('eventId'))
    const [event] = await db.select({ id: events.id }).from(events).where(and(eq(events.organizationId, organizationId), eq(events.id, eventId)))
    if (!event) throw new ApiError('NOT_FOUND', 404)
    const [finance] = await db.select({ settledAt: eventFinances.settledAt }).from(eventFinances)
      .where(and(eq(eventFinances.organizationId, organizationId), eq(eventFinances.eventId, eventId)))
    const [open] = await db.select({ n: count() }).from(tasks)
      .where(and(eq(tasks.organizationId, organizationId), eq(tasks.eventId, eventId), ne(tasks.status, 'done')))
    return c.json({ settled: Boolean(finance?.settledAt), openTasks: open?.n ?? 0 } satisfies EventCompletionResponse)
  })
  // 완료: 회장단이 정산한 행사를 완료한다. 완료한 행사는 바꿀 수 없고 옆 메뉴 "기록"으로 옮겨진다.
  routes.post(`${path}/:eventId/completion`, json(CompleteEventSchema), authenticated, member, leader, async (c) => {
    const input = c.req.valid('json')
    const organizationId = c.req.param('organizationId')
    const eventId = idOf(c.req.param('eventId'))
    const event = await db.transaction(async tx => {
      const current = await lockEvent(tx, organizationId, eventId)
      if (current.version !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
      if (current.completedAt) throw new ApiError('INVALID_STATE', 409)
      // 정산·다시 열기도 이 행사 행을 FOR NO KEY UPDATE로 잠그므로, 여기서 본 정산 여부는 완료가 끝날 때까지 그대로다.
      const [finance] = await tx.select({ settledAt: eventFinances.settledAt }).from(eventFinances)
        .where(and(eq(eventFinances.organizationId, organizationId), eq(eventFinances.eventId, eventId)))
      if (!finance?.settledAt) throw new ApiError('EVENT_NOT_SETTLED', 409)
      const [updated] = await tx.update(events).set({ completedAt: sql`now()`, completedBy: c.get('userId'), version: current.version + 1 })
        .where(and(eq(events.organizationId, organizationId), eq(events.id, eventId))).returning()
      return updated!
    })
    return c.json({ event: serializeEvent(event) } satisfies EventResponse)
  })
  // 완료 취소: 실수로 완료했을 때 되돌린다. 정산은 그대로 두고, 돈이 바뀌지 않아 기록을 남기지 않는다.
  routes.post(`${path}/:eventId/completion/cancel`, json(CancelEventCompletionSchema), authenticated, member, leader, async (c) => {
    const input = c.req.valid('json')
    const organizationId = c.req.param('organizationId')
    const eventId = idOf(c.req.param('eventId'))
    const event = await db.transaction(async tx => {
      const current = await lockEvent(tx, organizationId, eventId)
      if (current.version !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
      if (!current.completedAt) throw new ApiError('INVALID_STATE', 409)
      const [updated] = await tx.update(events).set({ completedAt: null, completedBy: null, version: current.version + 1 })
        .where(and(eq(events.organizationId, organizationId), eq(events.id, eventId))).returning()
      return updated!
    })
    return c.json({ event: serializeEvent(event) } satisfies EventResponse)
  })
```
`createEventRoutes`의 `db` 타입은 `Pick<…, 'select' | 'transaction'>`이다. 거래 안의 `tx.update`는 그대로 쓸 수 있다(행사 수정이 이미 쓴다).

- [ ] **Step 7: 통과 확인**

Run: `cd apps/api; npx tsx --test --test-concurrency=2 src/events/completion.test.ts src/events/events.test.ts src/settlement/lock.test.ts src/http/boundary.test.ts`
Expected: PASS. 경계 테스트가 새 POST 둘을 자동으로 검사한다.

- [ ] **Step 8: 커밋**

```bash
git add apps/api/src/events apps/api/src/settlement/lock.ts apps/api/src/access/membership.ts apps/api/package.json
git commit -m "행사 완료·완료 취소 API와 행사 잠금 함수"
```

---

### Task 3: 행사를 바꾸는 모든 쓰기에 완료 잠금

**Files:**
- Create: `apps/api/src/events/completion-lock.test.ts`
- Modify: `apps/api/src/chat/chat.ts`, `apps/api/src/tasks/service.ts`, `apps/api/src/registrations/service.ts`, `apps/api/src/registrations/state.ts`, `apps/api/src/settlement/service.ts`, `apps/api/src/purchases/service.ts`, `apps/api/src/purchases/candidates.ts`, `apps/api/src/purchases/items.ts`, `apps/api/src/purchases/review.ts`, `apps/api/src/deliveries/service.ts`
- Modify: `AGENTS.md`, `apps/api/package.json`

**Interfaces:**
- Consumes: Task 2의 `shareEvent`, `requireActiveEvents`, `lockActiveEvent`, `checkActiveEvents`
- Produces: `eventIdsOfItems(db: Reader, organizationId: string, itemIds: string[]): Promise<string[]>`(purchases/items.ts), `stateOf(form, count, now, completed = false)`

- [ ] **Step 1: 실패하는 전수 테스트** — `apps/api/src/events/completion-lock.test.ts`

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { RegistrationCreated, RegistrationResponse, TaskResponse } from '@vada/contracts'
import { createApp, type AppOptions } from '../app.js'
import { createAccessRoutes } from '../access/access.js'
import { createBudgetRoutes } from '../budget/routes.js'
import { createChatRoutes } from '../chat/chat.js'
import { createDeliveryRoutes } from '../deliveries/routes.js'
import { createCallbackAddress, createDeliveryWebhook } from '../deliveries/webhook.js'
import { createExpenseRoutes } from '../expenses/routes.js'
import { createFeeRoutes } from '../fees/routes.js'
import { createIncomeRoutes } from '../incomes/routes.js'
import { createOrganizationRoutes } from '../organization/routes.js'
import { createPurchaseRoutes } from '../purchases/purchases.js'
import { fakeStorage, link, origin, setupPurchases } from '../purchases/test-setup.js'
import { createRegistrationRoutes } from '../registrations/routes.js'
import { createSettlementRoutes } from '../settlement/routes.js'
import { createTaskRoutes } from '../tasks/routes.js'
import { createEventRoutes } from './events.js'

const readOnly = new Set(['GET', 'HEAD', 'OPTIONS'])
const eventRoot = '/api/organizations/:organizationId/events/:eventId'
const isEventWrite = (path: string) => path === eventRoot || path.startsWith(`${eventRoot}/`)
// 완료를 바꾸는 두 경로. 완료한 행사에서도 되어야 한다(완료 취소).
const completionRoutes = new Set([`POST ${eventRoot}/completion`, `POST ${eventRoot}/completion/cancel`])
const taskBody = { title: '정리', description: null, departmentId: null, assigneeMembershipId: null, dueOn: null }
const formFields = { opensAt: null, closesAt: '2999-08-19T23:59', capacity: null, notice: null, collectPhone: false, fee: 0, memberFee: null }
const expenseBody = { eventId: 'e', vendor: '쿠팡', description: '체육대회 물품', amount: 46000, paidOn: '2026-10-09', method: 'council_card',
  payerMembershipId: 'mf', note: null, budgetLineId: null }

test('완료한 행사는 행사 아래 모든 변경 라우트와 행사 기록을 바꾸는 다른 경로에서 막힌다. 완료를 취소하면 다시 된다', async () => {
  const env = await setupPurchases()
  try {
    // 완료 전에 행사 e에 기록을 만든다: 일시, 신청서와 신청 하나, 업무, 작성 중·대기·승인 품목, 지출, 배송.
    await env.ok(env.request('PATCH', '/events/e', { version: 1, startsAt: '2999-08-20T10:00', endsAt: null, place: null }))
    const form = (await env.ok<RegistrationResponse>(env.request('POST', '/events/e/registration', formFields), 201)).form!
    const { token } = await env.ok<RegistrationCreated>(env.publicRequest('POST', `/public/registration-forms/${form.code}/entries`,
      { name: '김학생', studentId: '20260001', phone: null, agreed: true }), 201)
    const registrationId = (await env.ok<RegistrationResponse>(env.request('GET', '/events/e/registration'))).registrations[0]!.id
    const taskId = (await env.ok<TaskResponse>(env.request('POST', '/events/e/tasks', taskBody), 201)).task.id
    const [approvedId] = await env.approved([link(1)])
    env.as('p')
    const [pending] = await env.submitted([link(2)])
    const [draft] = await env.drafts([link(3)])
    const candidateId = await env.candidateOf(link(3))
    env.as('f')
    const expenseId = (await env.ok<{ expense: { id: string } }>(env.request('POST', '/expenses', { ...expenseBody, itemIds: [approvedId] }), 201)).expense.id
    await env.pg.exec(`
      INSERT INTO shipments(id, organization_id, carrier_id, tracking_number, created_by) VALUES ('s1','a','kr.cjlogistics','1234567890','f');
      INSERT INTO shipment_items(id, shipment_id, purchase_item_id, organization_id, linked_by) VALUES ('si1','s1','${approvedId}','a','f');
      INSERT INTO event_finances(event_id, organization_id, settled_at, settled_by) VALUES ('e','a', now(), 'f');
      UPDATE events SET completed_at = now(), completed_by = 'l' WHERE id = 'e';
    `)

    // 모든 모듈로 앱을 만들고 회장단(l)으로 보낸다. 회장단은 행사·구매 승인·조직 권한이 모두 있다.
    const session = async () => ({ user: { id: 'l' } })
    const db = env.db
    const modules = {
      access: createAccessRoutes(db, session), organization: createOrganizationRoutes(db, session), events: createEventRoutes(db, session),
      chat: createChatRoutes(db, session),
      purchases: createPurchaseRoutes(db, session, async () => { throw new Error('완료한 행사에서는 끼룩이를 부르지 않는다') }),
      // 배송 조회기는 부르지 않아야 한다. 부르면 {}에서 터져 500이 된다.
      deliveries: createDeliveryRoutes(db, session, {} as never),
      expenses: createExpenseRoutes(db, session, fakeStorage().storage),
      settlement: createSettlementRoutes(db, session, origin), budget: createBudgetRoutes(db, session, origin), incomes: createIncomeRoutes(db, session),
      registrations: createRegistrationRoutes(db, session), fees: createFeeRoutes(db, session), tasks: createTaskRoutes(db, session),
      webhook: createDeliveryWebhook(db, createCallbackAddress(origin, 'k'.repeat(32))),
    } satisfies Required<Omit<AppOptions, 'auth' | 'trustedOrigin'>>
    const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, ...modules })
    const send = (method: string, path: string, body: unknown) => app.request(path, { method,
      headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const at = (path = '') => `/api/organizations/a/events/e${path}`

    // 행사 아래 변경 라우트마다 본문을 둔다. 잠금이 먼저라 대상 ID·버전은 상관없다.
    const probes: Record<string, [path: string, body: unknown]> = {
      [`PATCH ${eventRoot}`]: [at(), { version: 2, startsAt: '2999-08-20T10:00', endsAt: null, place: '체육관' }],
      [`POST ${eventRoot}/finance/budget`]: [at('/finance/budget'), { version: 1, budget: 1000 }],
      [`POST ${eventRoot}/finance/reopen`]: [at('/finance/reopen'), { version: 1, reason: '다시 확인' }],
      [`POST ${eventRoot}/finance/settle`]: [at('/finance/settle'), { version: 1, feeIncomeLineId: null }],
      [`POST ${eventRoot}/messages`]: [at('/messages'), { content: '고마워요' }],
      [`POST ${eventRoot}/purchase-candidates/:candidateId/hidden`]: [at(`/purchase-candidates/${candidateId}/hidden`), { hidden: true }],
      [`PATCH ${eventRoot}/purchase-items/:itemId`]: [at(`/purchase-items/${draft!.id}`), { version: 1, note: '바꿈' }],
      [`POST ${eventRoot}/purchase-items/:itemId/cancel`]: [at(`/purchase-items/${pending!.id}/cancel`), { version: 1 }],
      [`POST ${eventRoot}/purchase-items/:itemId/delete`]: [at(`/purchase-items/${draft!.id}/delete`), { version: 1 }],
      [`POST ${eventRoot}/purchase-items/:itemId/re-add`]: [at(`/purchase-items/${pending!.id}/re-add`), { version: 1 }],
      [`POST ${eventRoot}/purchase-items/:itemId/received`]: [at(`/purchase-items/${approvedId}/received`), { version: 1, received: true }],
      [`POST ${eventRoot}/purchase-items/drafts`]: [at('/purchase-items/drafts'), { idempotencyKey: 'probe-key', candidateIds: [candidateId] }],
      [`POST ${eventRoot}/purchase-items/needed-by`]: [at('/purchase-items/needed-by'), { items: [{ id: draft!.id, version: 1 }], neededBy: null }],
      [`POST ${eventRoot}/purchase-items/submit`]: [at('/purchase-items/submit'), { items: [{ id: draft!.id, version: 1 }] }],
      [`POST ${eventRoot}/registration`]: [at('/registration'), formFields],
      [`PATCH ${eventRoot}/registration`]: [at('/registration'), { version: 1, accepting: false, ...formFields }],
      [`POST ${eventRoot}/registration/check-in`]: [at('/registration/check-in'), { code: 'a'.repeat(64) }],
      [`POST ${eventRoot}/registration/entries/:registrationId/cancel`]: [at(`/registration/entries/${registrationId}/cancel`), {}],
      [`POST ${eventRoot}/registration/entries/:registrationId/check-in`]: [at(`/registration/entries/${registrationId}/check-in`), {}],
      [`POST ${eventRoot}/registration/entries/:registrationId/check-in/cancel`]: [at(`/registration/entries/${registrationId}/check-in/cancel`), {}],
      [`POST ${eventRoot}/registration/entries/:registrationId/dues`]: [at(`/registration/entries/${registrationId}/dues`), { duesMember: true }],
      [`POST ${eventRoot}/registration/entries/:registrationId/payment`]: [at(`/registration/entries/${registrationId}/payment`), {}],
      [`POST ${eventRoot}/registration/entries/:registrationId/payment/cancel`]: [at(`/registration/entries/${registrationId}/payment/cancel`), {}],
      [`POST ${eventRoot}/tasks`]: [at('/tasks'), taskBody],
      [`PATCH ${eventRoot}/tasks/:taskId`]: [at(`/tasks/${taskId}`), { version: 1, ...taskBody }],
      [`POST ${eventRoot}/tasks/:taskId/status`]: [at(`/tasks/${taskId}/status`), { version: 1, status: 'done' }],
      [`POST ${eventRoot}/tasks/:taskId/delete`]: [at(`/tasks/${taskId}/delete`), { version: 1 }],
    }
    const writes = [...new Set(app.routes.filter(route => !readOnly.has(route.method) && isEventWrite(route.path))
      .map(route => `${route.method} ${route.path}`))].filter(key => !completionRoutes.has(key))
    assert.deepEqual(writes.sort(), Object.keys(probes).sort(), '행사 아래 변경 라우트는 모두 이 표에 본문을 두고 완료 잠금을 확인한다')
    for (const [key, [path, body]] of Object.entries(probes)) {
      const response = await send(key.slice(0, key.indexOf(' ')), path, body)
      assert.equal(response.status, 409, `${key}: ${await response.clone().text()}`)
      assert.deepEqual(await response.json(), { error: 'EVENT_COMPLETED' }, key)
    }

    // 행사 아래가 아닌 경로에서 행사 기록을 바꾸는 것. 학생에게는 "완료" 대신 지금 쓰는 마감 이유를 준다.
    const others: [method: string, path: string, body: unknown, error: string][] = [
      ['POST', '/api/organizations/a/expenses', { ...expenseBody, itemIds: [] }, 'EVENT_COMPLETED'],
      ['PATCH', `/api/organizations/a/expenses/${expenseId}`, { version: 1, ...expenseBody, itemIds: [approvedId] }, 'EVENT_COMPLETED'],
      ['POST', `/api/organizations/a/expenses/${expenseId}/void`, { version: 1, reason: '잘못 기록' }, 'EVENT_COMPLETED'],
      ['POST', '/api/organizations/a/purchase-review/decisions', { decisions: [{ id: pending!.id, version: 1, decision: 'approved' }] }, 'EVENT_COMPLETED'],
      ['POST', `/api/organizations/a/purchase-review/${approvedId}/revoke`, { version: 1 }, 'EVENT_COMPLETED'],
      ['POST', `/api/organizations/a/purchase-review/${approvedId}/purchased`, { version: 1, purchased: false }, 'EVENT_COMPLETED'],
      ['POST', '/api/organizations/a/shipments', { carrierId: 'kr.cjlogistics', trackingNumber: '9876543210', purchaseItemIds: [approvedId],
        idempotencyKey: 'probe-shipment' }, 'EVENT_COMPLETED'],
      ['POST', '/api/organizations/a/shipments/s1/unlink', { linkIds: ['si1'] }, 'EVENT_COMPLETED'],
      ['POST', `/api/public/registration-forms/${form.code}/entries`, { name: '박학생', studentId: '20260002', phone: null, agreed: true }, 'REGISTRATION_NOT_OPEN'],
      ['POST', '/api/public/registrations/cancel', { token }, 'CANCEL_CLOSED'],
    ]
    for (const [method, path, body, error] of others) {
      const response = await send(method, path, body)
      assert.equal(response.status, 409, `${method} ${path}: ${await response.clone().text()}`)
      assert.deepEqual(await response.json(), { error }, `${method} ${path}`)
    }

    // 완료를 취소하면 같은 쓰기가 다시 된다.
    assert.equal((await send('POST', at('/completion/cancel'), { version: 2 })).status, 200)
    assert.equal((await send('POST', at('/messages'), { content: '고마워요' })).status, 201)
  } finally { await env.pg.close() }
})
```

`apps/api/package.json`의 test 목록에 ` src/events/completion-lock.test.ts`를 `src/events/completion.test.ts` 다음에 더한다.

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api; npx tsx --test src/events/completion-lock.test.ts`
Expected: FAIL. 첫 실패가 아직 막지 않는 라우트를 알려 준다(예: `POST …/messages: 201`).

- [ ] **Step 3: 대화** — `apps/api/src/chat/chat.ts`

import `requireActiveEvents`(`../events/lock.js`). 보내기 거래의 첫 줄에 더한다.
```ts
      // 완료한 행사(M5a)에는 보내지 않는다. 행사 행을 FOR SHARE로 잠가 완료와 엇갈리지 않게 한다.
      await requireActiveEvents(tx, c.req.param('organizationId'), [c.req.param('eventId')])
```

- [ ] **Step 4: 업무** — `apps/api/src/tasks/service.ts`

import `lockActiveEvent, requireActiveEvents`(`../events/lock.js`).
- `create`: 행사 행을 잠그는 select와 NOT_FOUND 두 줄을 `await lockActiveEvent(tx, scope.organizationId, eventId)`로 바꾼다(위 주석 그대로).
- `update`·`changeStatus`·`remove`: 거래 첫 줄에 `await requireActiveEvents(tx, scope.organizationId, [eventId])`. `update`는 `lockDepartment`보다 앞이다.
- 위쪽 잠금 순서 주석(M4 spec과 같은 "행사(추가만) → 부서 → 업무 → 소속")이 있으면 "행사 → 부서 → 업무 → 소속"으로 고친다.

- [ ] **Step 5: 참가 신청** — `apps/api/src/registrations/state.ts`, `apps/api/src/registrations/service.ts`

`state.ts`
```ts
type FormTimes = { accepting: boolean; opensAt: Date | null; closesAt: Date; capacity: number | null }
// 위에서부터 먼저 맞는 것이다. 완료한 행사(M5a)와 마감이 지난 신청은 멈춤이어도 마감이고, 시작 전이면 정원이 차 있어도 시작 전이다.
export function stateOf(form: FormTimes, count: number, now: Date, completed = false): RegistrationState {
  if (completed || now >= form.closesAt) return 'closed'
```
`service.ts` (import `lockActiveEvent, requireActiveEvents, shareEvent`)
- `eventOf`의 `lock` 인자와 `FOR NO KEY UPDATE` 분기를 지우고(아래 두 곳이 `lockActiveEvent`를 쓴다), 그 위 잠금 설명 주석을 "행사 행 잠금은 `events/lock.ts`를 쓴다."로 줄인다.
- `create`·`update`: `const event = await eventOf(tx, scope.organizationId, eventId, true)`를 `const event = await lockActiveEvent(tx, scope.organizationId, eventId)`로.
- `cancel`(운영진 취소): 거래 첫 줄 `await requireActiveEvents(tx, scope.organizationId, [eventId])`.
- `attendeeOf`: 첫 줄 `await requireActiveEvents(tx, scope.organizationId, [eventId])`. 주석 "참석은 정산과 관계없어 행사 행을 잠그지 않는다"를 "참석은 정산과 관계없지만 완료한 행사는 막는다(FOR SHARE)."로.
- `entryOf`는 `requireOpenEvents`가 완료를 본다. 고치지 않는다.
- `register`: `formByCode(tx, code, true)` 앞에서 행사를 먼저 잠근다.
```ts
      // 행사 행을 먼저 FOR SHARE로 잠가 완료와 엇갈리지 않게 한다. 잠금 순서는 행사 → 신청서다.
      const { form: found } = await formByCode(tx, code)
      const event = await shareEvent(tx, found.organizationId, found.eventId)
      const { form } = await formByCode(tx, code, true)
```
  그리고 `const state = stateOf(form, tally?.total ?? 0, now(), event.completedAt !== null)`.
- `cancelMine`:
```ts
      // 행사 행을 먼저 잠근다(행사 → 신청서). 완료한 행사는 취소 기간이 끝난 것으로 알린다.
      const found = await registrationByToken(tx, token)
      if (!found) throw new ApiError('NOT_FOUND', 404)
      const event = await shareEvent(tx, found.form.organizationId, found.form.eventId)
      const current = await mine(tx, token, true)
      if (event.completedAt || now() >= current.form.closesAt) throw new ApiError('CANCEL_CLOSED', 409)
```

- [ ] **Step 6: 정산** — `apps/api/src/settlement/service.ts`

import `lockActiveEvent`. `lockFinance`의 `await eventOf(tx, scope, eventId, true)`를 `await lockActiveEvent(tx, scope.organizationId, eventId)`로 바꾼다. `eventOf`의 `lock` 인자를 쓰는 곳이 남지 않으면 지우고 주석을 고친다("바꿀 때는 lockFinance가 행사 행을 잠근다"). 이것으로 정산·다시 열기·행사 예산과 예산 편성의 행사 예산 바꾸기가 완료를 막는다.

- [ ] **Step 7: 구매·후보** — `apps/api/src/purchases/service.ts`, `apps/api/src/purchases/candidates.ts`, `apps/api/src/purchases/items.ts`

`items.ts` 끝에 더한다.
```ts
// 품목들의 행사. 품목의 행사는 바뀌지 않으므로 잠그지 않고 읽은 뒤 행사 행부터 잠근다(잠금 순서: 행사 → 품목).
export async function eventIdsOfItems(db: Reader, organizationId: string, itemIds: string[]) {
  if (!itemIds.length) return []
  const rows = await db.selectDistinct({ eventId: items.eventId }).from(items)
    .where(and(eq(items.organizationId, organizationId), inArray(items.id, itemIds)))
  return rows.map(row => row.eventId)
}
```
(`Reader`에 `selectDistinct`가 없으면 `Pick<…, 'select' | 'selectDistinct'>`로 넓힌다. 부르는 쪽은 거래·DB 모두 둘 다 있다.)

`service.ts` (import `checkActiveEvents, requireActiveEvents`)
- `createDrafts`: `const event = await eventOf(db, scope)` 다음 줄에 `await checkActiveEvents(db, scope.organizationId, [scope.eventId])`(끼룩이를 부르기 전에 막는다). 저장 거래의 `await member(tx, scope, true)` 다음에 `await requireActiveEvents(tx, scope.organizationId, [scope.eventId])`.
- `updateDraft`·`deleteDraft`·`changeNeededBy`·`cancel`·`reAdd`·`setReceived`: 거래의 `await member(tx, scope, true)` 다음에 `await requireActiveEvents(tx, scope.organizationId, [scope.eventId])`.
- `submit`은 `requireOpenEvents`가 완료를 본다. 고치지 않는다.

`candidates.ts`
- `Reader` 타입에 `'transaction'`을 더한다(`createCandidateService`를 부르는 곳은 모두 전체 DB를 넘긴다. 컴파일러가 아니라고 하면 그 호출에 맞춘다).
- `setHidden`을 거래로 감싼다.
```ts
    async setHidden(scope: PurchaseScope, id: string, hidden: boolean): Promise<PurchaseCandidate> {
      await event(scope)
      // 완료한 행사(M5a)의 후보는 바꾸지 않는다. 행사 행을 FOR SHARE로 잠근 채 바꾼다.
      await db.transaction(async tx => {
        await requireActiveEvents(tx, scope.organizationId, [scope.eventId])
        // 이미 그 상태면 그대로 둔다. 처음 숨긴 사람·시각을 덮어쓰지 않는다.
        await tx.update(candidates).set(hidden ? { hiddenBy: scope.userId, hiddenAt: sql`now()` } : { hiddenBy: null, hiddenAt: null })
          .where(and(eq(candidates.id, id), eq(candidates.organizationId, scope.organizationId), eq(candidates.eventId, scope.eventId),
            hidden ? isNull(candidates.hiddenAt) : isNotNull(candidates.hiddenAt)))
      })
      const [found] = (await summaries(scope, id)).candidates
      if (!found) throw new PurchaseError('NOT_FOUND', 404)
      return found
    },
```

- [ ] **Step 8: 구매 검토** — `apps/api/src/purchases/review.ts`

import `requireActiveEvents`(`../events/lock.js`), `eventIdsOfItems`(`./items.js`).
- `decide`: `await requireFinance(tx, scope, true)` 다음에 `await requireActiveEvents(tx, scope.organizationId, await eventIdsOfItems(tx, scope.organizationId, input.decisions.map(decision => decision.id)))`
- `revoke`·`setPurchased`: 같은 자리에 `await requireActiveEvents(tx, scope.organizationId, await eventIdsOfItems(tx, scope.organizationId, [id]))`

- [ ] **Step 9: 배송** — `apps/api/src/deliveries/service.ts`

import `checkActiveEvents, requireActiveEvents`(`../events/lock.js`), `eventIdsOfItems`(`../purchases/items.js`).
- `register`: 바깥 조회 전, `await selectedItems(db, scope, input.purchaseItemIds)` 다음에
```ts
      // 완료한 행사(M5a)의 품목이면 배송 조회를 부르기 전에 막는다. 저장 거래에서 다시 잠그고 본다.
      await checkActiveEvents(db, scope.organizationId, await eventIdsOfItems(db, scope.organizationId, input.purchaseItemIds))
```
  저장 거래의 `const items = await selectedItems(tx, scope, input.purchaseItemIds, true)` 앞에
```ts
        await requireActiveEvents(tx, scope.organizationId, await eventIdsOfItems(tx, scope.organizationId, input.purchaseItemIds))
```
- `unlink`: `await access(tx, scope, true, true)` 다음, 송장 행을 잠그기 전에
```ts
        // 끊을 연결의 품목이 완료한 행사(M5a)면 막는다. 잠금 순서는 행사 → 송장이다.
        const linked = await tx.select({ itemId: shipmentItems.purchaseItemId }).from(shipmentItems)
          .where(and(eq(shipmentItems.shipmentId, id), eq(shipmentItems.organizationId, scope.organizationId), inArray(shipmentItems.id, linkIds)))
        await requireActiveEvents(tx, scope.organizationId, await eventIdsOfItems(tx, scope.organizationId, linked.map(row => row.itemId)))
```

- [ ] **Step 10: 행사 수정** — Task 2에서 했다. 남은 실패가 있으면 그 라우트의 서비스 거래 맨 앞에 Step 3과 같은 줄을 더한다.

- [ ] **Step 11: 통과 확인**

Run: `cd apps/api; npx tsx --test src/events/completion-lock.test.ts`
Expected: PASS
Run: `cd apps/api; npx tsx --test --test-concurrency=2 src/chat/chat.test.ts src/tasks/tasks.test.ts src/registrations/registrations.test.ts src/registrations/public.test.ts src/registrations/payments.test.ts src/registrations/attendance.test.ts src/settlement/settlement.test.ts src/settlement/fee-income.test.ts src/budget/budget.test.ts src/purchases/purchases.test.ts src/purchases/review.test.ts src/purchases/candidates.test.ts src/deliveries/routes.test.ts src/expenses/expenses.test.ts src/expenses/receipts.test.ts`
Expected: PASS(기존 동작은 그대로다)

- [ ] **Step 12: 저장소 규칙** — `AGENTS.md`의 "새 API를 만들 때" 끝에 더한다.

```markdown
- 행사 기록을 바꾸는 라우트는 `/events/:eventId/` 아래에 두고, 거래 맨 앞에서 `apps/api/src/events/lock.ts`로 완료한 행사를 막는다(행사 행을 바꾸거나 잠근 채 세면 `lockActiveEvent`, 아니면 `requireActiveEvents`). `events/completion-lock.test.ts`가 그 아래 모든 변경 라우트를 확인한다. 다른 경로에서 행사 기록을 바꾸면 그 테스트의 "그 밖의 경로" 표에 더한다.
```

- [ ] **Step 13: 커밋**

```bash
git add apps/api/src AGENTS.md apps/api/package.json
git commit -m "완료한 행사의 모든 쓰기를 서버에서 막기"
```

---

### Task 4: 완료한 행사를 목록에서 빼기(서버)

**Files:**
- Modify: `apps/api/src/tasks/service.ts` (mine), `apps/api/src/purchases/review.ts` (list), `apps/api/src/registrations/service.ts` (view·publicForm·myView)
- Test: `apps/api/src/tasks/tasks.test.ts`, `apps/api/src/purchases/review.test.ts`, `apps/api/src/registrations/public.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`tasks.test.ts` 끝
```ts
test('내 업무는 완료한 행사의 업무를 빼고, 완료를 취소하면 다시 보인다', async () => {
  const env = await setupPurchases()
  try {
    const kept = await create(env, { title: '대관', assigneeMembershipId: 'mq' })
    const other = await create(env, { title: '후기', assigneeMembershipId: 'mq' }, '/events/e2/tasks')
    await env.pg.exec(`INSERT INTO event_finances(event_id, organization_id, settled_at, settled_by) VALUES ('e','a', now(), 'f')`)
    env.as('l')
    await env.ok(env.request('POST', '/events/e/completion', { version: 1 }))
    env.as('q')
    assert.deepEqual((await env.ok<MyTasksResponse>(env.request('GET', '/my-tasks'))).open.map(task => task.id), [other.id])
    env.as('l')
    await env.ok(env.request('POST', '/events/e/completion/cancel', { version: 2 }))
    env.as('q')
    assert.deepEqual((await env.ok<MyTasksResponse>(env.request('GET', '/my-tasks'))).open.map(task => task.id).sort(), [kept.id, other.id].sort())
  } finally { await env.pg.close() }
})
```

`review.test.ts` 끝(파일의 기존 import·헬퍼 이름을 따른다. `setupPurchases`, `link`, `PurchaseReviewResponse`)
```ts
test('구매 검토의 대기·살 품목은 완료한 행사의 품목을 뺀다', async () => {
  const env = await setupPurchases()
  try {
    const [approvedId] = await env.approved([link(1)])
    env.as('p')
    await env.submitted([link(2)], 'e2')
    await env.pg.exec(`INSERT INTO event_finances(event_id, organization_id, settled_at, settled_by) VALUES ('e','a', now(), 'f');
      UPDATE events SET completed_at = now(), completed_by = 'l' WHERE id = 'e';`)
    env.as('f')
    const review = await env.ok<PurchaseReviewResponse>(env.request('GET', '/purchase-review'))
    assert.ok(!review.approved.some(item => item.id === approvedId))
    assert.deepEqual(review.pending.map(item => item.event.id), ['e2'])
  } finally { await env.pg.close() }
})
```
(`PurchaseItemSummary`에 행사가 `event.id`가 아니라 다른 이름이면 그 이름으로 비교한다.)

`public.test.ts` 끝(파일의 기존 헬퍼로 신청서·신청을 만든다. 없으면 Task 3 전수 테스트의 순서를 따른다)
```ts
test('완료한 행사의 신청 화면은 마감이고, 내 신청은 취소할 수 없다. 운영진 화면도 마감이다', async () => {
  const env = await setupPurchases()
  try {
    await env.ok(env.request('PATCH', '/events/e', { version: 1, startsAt: '2999-08-20T10:00', endsAt: null, place: null }))
    const form = (await env.ok<RegistrationResponse>(env.request('POST', '/events/e/registration', { opensAt: null, closesAt: '2999-08-19T23:59',
      capacity: null, notice: null, collectPhone: false, fee: 0, memberFee: null }), 201)).form!
    const { token } = await env.ok<RegistrationCreated>(env.publicRequest('POST', `/public/registration-forms/${form.code}/entries`,
      { name: '김학생', studentId: '20260001', phone: null, agreed: true }), 201)
    await env.pg.exec(`INSERT INTO event_finances(event_id, organization_id, settled_at, settled_by) VALUES ('e','a', now(), 'f');
      UPDATE events SET completed_at = now(), completed_by = 'l' WHERE id = 'e';`)
    assert.equal((await env.ok<PublicRegistrationForm>(env.publicRequest('GET', `/public/registration-forms/${form.code}`))).state, 'closed')
    assert.equal((await env.ok<MyRegistration>(env.publicRequest('POST', '/public/registrations/lookup', { token }))).cancellable, false)
    assert.equal((await env.ok<RegistrationResponse>(env.request('GET', '/events/e/registration'))).form!.state, 'closed')
  } finally { await env.pg.close() }
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api; npx tsx --test --test-concurrency=2 src/tasks/tasks.test.ts src/purchases/review.test.ts src/registrations/public.test.ts`
Expected: 새 테스트 셋 FAIL

- [ ] **Step 3: 구현**

`tasks/service.ts` `mine` (import `isNull`)
```ts
    // 이 학생회에서 내가 맡은 업무. 완료한 행사(M5a)의 업무는 기록이라 뺀다. 할 일은 마감일 순, 완료는 최근 순이다.
    async mine(scope: TaskScope): Promise<MyTasksResponse> {
      const mine = and(inOrganization(scope), eq(tasks.assigneeId, scope.userId), isNull(events.completedAt))
```
(`summaries`가 `events`를 inner join 한다.)

`purchases/review.ts` `list` (import `events`, `isNull`)
```ts
      // 완료한 행사(M5a)의 품목은 기록이라 뺀다. 정산이 대기를 막으므로 남는 것은 받기 전 승인 품목이다.
      const active = isNull(events.completedAt)
      const pending = await itemSummaries(db, viewer(scope), and(eq(items.status, 'pending'), active), …
      const approved = await itemSummaries(db, viewer(scope), and(eq(items.status, 'approved'), isNull(items.receivedAt), active), …
```
(`itemSummaries`가 `events`를 inner join 한다.)

`registrations/service.ts`
- `view`: `stateOf(form, …, now())`를 부르는 곳에 넷째 인자 `event.completedAt !== null`
- `publicForm`: `state: stateOf(form, total, now(), event.completedAt !== null)`
- `myView`: `cancellable: event.completedAt === null && now() < form.closesAt && registration.paidAt === null && registration.checkedInAt === null`
  (주석 "마감 전이고 입금·참석을 확인하지 않았으면"에 "완료하지 않은 행사에서"를 더한다.)

- [ ] **Step 4: 통과 확인** — Step 2 명령 → PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src
git commit -m "완료한 행사를 내 업무·구매 검토·신청 상태에서 빼기"
```

---

### Task 5: 화면 — 단계 칩과 완료·완료 취소

**Files:**
- Create: `apps/web/src/events/event-phase.ts`, `apps/web/src/events/event-phase.test.ts`
- Create: `apps/web/src/events/completion.ts`, `apps/web/src/events/EventCompletionControl.tsx`, `apps/web/src/events/EventCompletionControl.test.tsx`
- Modify: `apps/web/src/workspace/WorkspaceHeader.tsx`, `apps/web/src/workspace/Workspace.tsx`

**Interfaces:**
- Produces:
  - `type EventPhase = 'planning' | 'ongoing' | 'wrapping' | 'completed'`, `phaseLabels`, `phaseTones`, `eventPhaseOf(event, now: string): EventPhase`, `completedEventMessage`
  - `loadCompletion(event): Promise<EventCompletionResponse | null>`, `changeCompletion(event, action: 'complete' | 'cancel')`
  - `<EventCompletionControl event onChanged onStale />`
  - `WorkspaceHeader`의 `badge?: ReactNode`, `actions?: ReactNode`

- [ ] **Step 1: 실패하는 테스트**

`event-phase.test.ts`
```ts
import { expect, test } from 'vitest'
import { eventPhaseOf } from './event-phase'

const event = (startsAt: string | null, endsAt: string | null = null, completedAt: string | null = null) => ({ startsAt, endsAt, completedAt })
test('날짜가 없거나 시작 전이면 기획 중이다', () => {
  expect(eventPhaseOf(event(null), '2026-10-12T09:00')).toBe('planning')
  expect(eventPhaseOf(event('2026-10-20T10:00', '2026-10-20T18:00'), '2026-10-20T09:59')).toBe('planning')
})
test('끝 일시가 있으면 시작 정각부터 끝 전까지 진행 중이고, 끝 정각부터 정리 중이다', () => {
  const sports = event('2026-10-20T10:00', '2026-10-21T18:00')
  expect(eventPhaseOf(sports, '2026-10-20T10:00')).toBe('ongoing')
  expect(eventPhaseOf(sports, '2026-10-21T17:59')).toBe('ongoing')
  expect(eventPhaseOf(sports, '2026-10-21T18:00')).toBe('wrapping')
})
test('끝 일시가 없으면 시작한 날(한국 날짜)이 끝날 때까지 진행 중이다', () => {
  const opening = event('2026-10-20T18:00')
  expect(eventPhaseOf(opening, '2026-10-20T23:59')).toBe('ongoing')
  expect(eventPhaseOf(opening, '2026-10-21T00:00')).toBe('wrapping')
})
test('완료한 행사는 날짜와 상관없이 완료다', () => {
  expect(eventPhaseOf(event('2999-01-01T10:00', null, '2026-10-12T00:00:00.000Z'), '2026-10-12T09:00')).toBe('completed')
  expect(eventPhaseOf(event(null, null, '2026-10-12T00:00:00.000Z'), '2026-10-12T09:00')).toBe('completed')
})
```

`EventCompletionControl.test.tsx`
```tsx
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { EventSummary } from '@vada/contracts'
import { json, mockApi } from '../test-support/mock-api'
import { event } from '../test-support/workflow-fixtures'
import EventCompletionControl from './EventCompletionControl'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const path = '/api/organizations/o/events/e/completion'
const ended = (): EventSummary => ({ ...event(), startsAt: '2026-09-20T10:00', endsAt: '2026-09-20T18:00' })
function setup(target: EventSummary) {
  const api = mockApi()
  const onChanged = vi.fn()
  const onStale = vi.fn()
  render(<EventCompletionControl event={target} onChanged={onChanged} onStale={onStale} />)
  return { api, onChanged, onStale }
}

test('정산 전이면 이유를 보이고 완료하기를 끈다. 남은 업무와 끝나지 않은 행사는 알리기만 한다', async () => {
  const { api } = setup(event())
  api.on('GET', path, () => json({ settled: false, openTasks: 2 }))
  fireEvent.click(screen.getByRole('button', { name: '완료하기' }))
  const dialog = await screen.findByRole('dialog', { name: '행사를 완료할까요?' })
  expect(await within(dialog).findByText('재정 탭에서 먼저 정산해 주세요.')).toBeTruthy()
  expect(within(dialog).getByText('끝나지 않은 업무 2개는 그대로 남아요.')).toBeTruthy()
  expect(within(dialog).getByText('아직 행사가 끝나지 않았어요.')).toBeTruthy()
  expect((within(dialog).getByRole('button', { name: '완료하기' }) as HTMLButtonElement).disabled).toBe(true)
  api.assertNoUnexpectedRequests()
})

test('정산한 행사를 완료하면 바뀐 행사를 넘긴다', async () => {
  const target = ended()
  const { api, onChanged } = setup(target)
  api.on('GET', path, () => json({ settled: true, openTasks: 0 }))
  api.on('POST', path, () => json({ event: { ...target, version: 2, completedAt: '2026-10-12T01:00:00.000Z' } }))
  fireEvent.click(screen.getByRole('button', { name: '완료하기' }))
  const dialog = await screen.findByRole('dialog', { name: '행사를 완료할까요?' })
  const confirm = within(dialog).getByRole('button', { name: '완료하기' }) as HTMLButtonElement
  await vi.waitFor(() => expect(confirm.disabled).toBe(false))
  expect(within(dialog).queryByText('아직 행사가 끝나지 않았어요.')).toBeNull()
  fireEvent.click(confirm)
  await vi.waitFor(() => expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ id: 'e', completedAt: '2026-10-12T01:00:00.000Z' })))
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({ version: 1 })
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('완료한 행사는 완료 취소를 묻고 되돌린다', async () => {
  const target = { ...ended(), version: 2, completedAt: '2026-10-12T01:00:00.000Z' }
  const { api, onChanged } = setup(target)
  api.on('POST', `${path}/cancel`, () => json({ event: { ...target, version: 3, completedAt: null } }))
  fireEvent.click(screen.getByRole('button', { name: '완료 취소' }))
  const dialog = await screen.findByRole('dialog', { name: '완료를 취소할까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '완료 취소' }))
  await vi.waitFor(() => expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ completedAt: null, version: 3 })))
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({ version: 2 })
})

test('남이 먼저 바꿨으면 이유를 보이고 행사 목록을 새로 받게 한다', async () => {
  const target = ended()
  const { api, onStale } = setup(target)
  api.on('GET', path, () => json({ settled: true, openTasks: 0 }))
  api.on('POST', path, () => json({ error: 'VERSION_CONFLICT' }, 409))
  fireEvent.click(screen.getByRole('button', { name: '완료하기' }))
  const dialog = await screen.findByRole('dialog', { name: '행사를 완료할까요?' })
  const confirm = within(dialog).getByRole('button', { name: '완료하기' }) as HTMLButtonElement
  await vi.waitFor(() => expect(confirm.disabled).toBe(false))
  fireEvent.click(confirm)
  expect(await within(dialog).findByText('다른 곳에서 행사가 먼저 바뀌었어요. 행사 목록을 새로 불러왔어요.')).toBeTruthy()
  expect(onStale).toHaveBeenCalled()
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test --workspace @vada/web -- src/events/event-phase.test.ts src/events/EventCompletionControl.test.tsx`
Expected: FAIL(모듈 없음)

- [ ] **Step 3: 단계 계산** — `apps/web/src/events/event-phase.ts`

```ts
import type { EventSummary } from '@vada/contracts'
import type { Tone } from '@/components/ui/badge'

export type EventPhase = 'planning' | 'ongoing' | 'wrapping' | 'completed'
export const phaseLabels: Record<EventPhase, string> = { planning: '기획 중', ongoing: '진행 중', wrapping: '정리 중', completed: '완료' }
export const phaseTones: Record<EventPhase, Tone> = { planning: 'info', ongoing: 'success', wrapping: 'warning', completed: 'neutral' }
// 모듈마다 오류 문구에 같은 말을 쓴다(서버 EVENT_COMPLETED).
export const completedEventMessage = '완료한 행사라 바꿀 수 없어요. 바꾸려면 회장단이 완료를 취소해야 해요.'

// 행사 단계(M5a). 저장하지 않고 날짜로 계산한다. now와 행사 일시는 한국 시각 "YYYY-MM-DDTHH:mm"이라 글자로 비교한다.
// 끝 일시가 없으면 시작한 날(한국 날짜)이 끝날 때까지 진행 중이다.
export function eventPhaseOf(event: Pick<EventSummary, 'startsAt' | 'endsAt' | 'completedAt'>, now: string): EventPhase {
  if (event.completedAt) return 'completed'
  if (!event.startsAt || now < event.startsAt) return 'planning'
  if (event.endsAt) return now < event.endsAt ? 'ongoing' : 'wrapping'
  return now.slice(0, 10) === event.startsAt.slice(0, 10) ? 'ongoing' : 'wrapping'
}
```

- [ ] **Step 4: API 호출** — `apps/web/src/events/completion.ts`

```ts
import type { EventCompletionResponse, EventResponse, EventSummary } from '@vada/contracts'

const pathOf = (event: EventSummary) =>
  `/api/organizations/${encodeURIComponent(event.organizationId)}/events/${encodeURIComponent(event.id)}/completion`
export const completionErrors: Record<string, string> = {
  EVENT_NOT_SETTLED: '정산하지 않은 행사예요. 재정 탭에서 먼저 정산해 주세요.',
  VERSION_CONFLICT: '다른 곳에서 행사가 먼저 바뀌었어요. 행사 목록을 새로 불러왔어요.',
  INVALID_STATE: '이미 바뀌었어요. 행사 목록을 새로 불러왔어요.',
  FORBIDDEN: '회장단만 할 수 있어요.',
  NOT_FOUND: '행사를 찾을 수 없어요.',
}
const failure = '처리하지 못했어요. 다시 시도해 주세요.'
// 행사 목록이 오래된 경우다. 목록을 새로 받는다.
export const staleCompletionCodes = new Set(['VERSION_CONFLICT', 'INVALID_STATE', 'NOT_FOUND'])

// 완료 확인 대화상자가 연다. 실패하면 null이다.
export async function loadCompletion(event: EventSummary): Promise<EventCompletionResponse | null> {
  try {
    const response = await fetch(pathOf(event), { credentials: 'same-origin', cache: 'no-store' })
    if (!response.ok) return null
    const body = await response.json() as EventCompletionResponse
    return typeof body.settled === 'boolean' && typeof body.openTasks === 'number' ? body : null
  } catch { return null }
}

export async function changeCompletion(event: EventSummary, action: 'complete' | 'cancel'):
  Promise<{ ok: true; event: EventSummary } | { ok: false; message: string; code: unknown }> {
  try {
    const response = await fetch(action === 'complete' ? pathOf(event) : `${pathOf(event)}/cancel`, { method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: event.version }) })
    const body = await response.json().catch(() => null) as (Partial<EventResponse> & { error?: unknown }) | null
    if (!response.ok) {
      const code = body?.error
      return { ok: false, code, message: typeof code === 'string' ? completionErrors[code] ?? failure : failure }
    }
    if (!body?.event?.id || body.event.id !== event.id) throw new Error('Invalid response')
    return { ok: true, event: body.event }
  } catch {
    // 응답을 못 받았어도 서버는 바꿨을 수 있다. 목록을 새로 받아 확인하게 한다.
    return { ok: false, code: 'UNKNOWN', message: '결과를 확인하지 못했어요. 행사 목록을 새로 불러왔어요.' }
  }
}
```

- [ ] **Step 5: 완료 단추와 대화상자** — `apps/web/src/events/EventCompletionControl.tsx`

```tsx
import { useEffect, useState } from 'react'
import { koreanOf, type EventCompletionResponse, type EventSummary } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { changeCompletion, loadCompletion, staleCompletionCodes } from './completion'
import { eventPhaseOf } from './event-phase'

type Props = { event: EventSummary; onChanged: (event: EventSummary) => void; onStale: () => void }

// 행사 화면 머리의 회장단 단추. 완료하지 않은 행사는 [완료하기], 완료한 행사는 [완료 취소]다(EVT-02E).
export default function EventCompletionControl({ event, onChanged, onStale }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const completed = Boolean(event.completedAt)
  return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)}>{completed ? '완료 취소' : '완료하기'}</Button>
    <Dialog open={open} onOpenChange={next => { if (!busy) setOpen(next) }}>
      <DialogContent>
        {/* 열 때마다 새로 그린다. 완료 여부와 정산·업무를 그때 다시 본다. */}
        {open && <Body key={`${event.id}:${event.version}`} event={event} busy={busy} onBusy={setBusy} onClose={() => setOpen(false)}
          onChanged={changed => { setOpen(false); onChanged(changed) }} onStale={onStale} />}
      </DialogContent>
    </Dialog>
  </>
}

type BodyProps = Omit<Props, 'onChanged'> & { busy: boolean; onBusy: (busy: boolean) => void; onClose: () => void; onChanged: (event: EventSummary) => void }
function Body({ event, busy, onBusy, onClose, onChanged, onStale }: BodyProps) {
  const completed = Boolean(event.completedAt)
  const [check, setCheck] = useState<EventCompletionResponse | 'loading' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (completed) return
    let cancelled = false
    setCheck('loading')
    void loadCompletion(event).then(result => { if (!cancelled) setCheck(result ?? 'error') })
    return () => { cancelled = true }
  }, [event, completed, attempt])
  async function submit() {
    onBusy(true)
    setMessage('')
    const result = await changeCompletion(event, completed ? 'cancel' : 'complete')
    onBusy(false)
    if (result.ok) { onChanged(result.event); return }
    setMessage(result.message)
    if (result.code === 'UNKNOWN' || (typeof result.code === 'string' && staleCompletionCodes.has(result.code))) onStale()
  }
  if (completed) return <>
    <DialogHeader><DialogTitle>완료를 취소할까요?</DialogTitle>
      <DialogDescription>다시 대화·업무·구매·참가자·재정을 바꿀 수 있고, 옆 메뉴 행사 목록으로 돌아가요. 정산은 그대로예요.</DialogDescription></DialogHeader>
    {message && <StateMessage kind="error">{message}</StateMessage>}
    <DialogFooter>
      <Button variant="outline" disabled={busy} onClick={onClose}>닫기</Button>
      <Button disabled={busy} onClick={() => void submit()}>완료 취소</Button>
    </DialogFooter>
  </>
  const ended = eventPhaseOf(event, koreanOf(new Date())) === 'wrapping'
  return <>
    <DialogHeader><DialogTitle>행사를 완료할까요?</DialogTitle>
      <DialogDescription>완료하면 대화·업무·구매·참가자·재정을 바꿀 수 없고, 행사가 "기록"으로 옮겨져요. 회장단은 완료를 취소할 수 있어요.</DialogDescription></DialogHeader>
    {check === 'loading' ? <StateMessage kind="loading">완료할 수 있는지 확인하는 중…</StateMessage>
      : check === 'error' ? <div className="flex flex-wrap items-center gap-2">
        <StateMessage kind="error">완료할 수 있는지 확인하지 못했어요.</StateMessage>
        <Button variant="outline" size="sm" onClick={() => setAttempt(value => value + 1)}>다시 확인</Button>
      </div>
      : <div className="flex flex-col gap-2">
        {!check.settled && <Alert tone="warning">재정 탭에서 먼저 정산해 주세요.</Alert>}
        {check.openTasks > 0 && <p className="text-sm text-gray-700">끝나지 않은 업무 {check.openTasks}개는 그대로 남아요.</p>}
        {!ended && <p className="text-sm text-gray-700">아직 행사가 끝나지 않았어요.</p>}
      </div>}
    {message && <StateMessage kind="error">{message}</StateMessage>}
    <DialogFooter>
      <Button variant="outline" disabled={busy} onClick={onClose}>닫기</Button>
      <Button disabled={busy || check === 'loading' || check === 'error' || !check.settled} onClick={() => void submit()}>완료하기</Button>
    </DialogFooter>
  </>
}
```

- [ ] **Step 6: 화면 머리** — `apps/web/src/workspace/WorkspaceHeader.tsx`

```tsx
import type { ReactNode } from 'react'
…
type Props = { councilName: string; section: string; title: string; onMenu: () => void
  // 제목 옆 칩(행사 단계)과 오른쪽 단추(완료하기)
  badge?: ReactNode; actions?: ReactNode }

export default function WorkspaceHeader({ councilName, section, title, onMenu, badge, actions }: Props) {
  return <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-white px-4 sm:px-6">
    <Button variant="ghost" size="icon" className="md:hidden" aria-label="메뉴 열기" onClick={onMenu}><Menu /></Button>
    <div className="min-w-0 flex-1">
      <p …(그대로)…</p>
      <div className="mt-0.5 flex min-w-0 items-center gap-2">
        <h1 className="truncate text-base font-semibold text-gray-900">{title}</h1>{badge}
      </div>
    </div>
    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </header>
}
```

- [ ] **Step 7: Workspace 연결** — `apps/web/src/workspace/Workspace.tsx`

import `koreanOf`(contracts), `Badge`, `EventCompletionControl`, `eventPhaseOf, phaseLabels, phaseTones`.
`WorkspaceHeader`에 넘긴다(행사 화면일 때만).
```tsx
  const phase = view === 'events' && current ? eventPhaseOf(current, koreanOf(new Date())) : null
  …
      <WorkspaceHeader … badge={phase && <Badge tone={phaseTones[phase]}>{phaseLabels[phase]}</Badge>}
        actions={phase && current && membership.permissions.manageOrganization
          ? <EventCompletionControl event={current} onChanged={event => { events.replace(event); myTasks.refresh() }} onStale={events.refresh} />
          : undefined} … />
```
경로(section)의 `'행사'`는 `current?.completedAt ? '기록' : '행사'`로 바꾼다.

- [ ] **Step 8: 통과 확인**

Run: `npm test --workspace @vada/web -- src/events src/workspace`
Expected: PASS

- [ ] **Step 9: 커밋**

```bash
git add apps/web/src/events apps/web/src/workspace
git commit -m "행사 단계 칩과 완료하기·완료 취소 화면"
```

---

### Task 6: 화면 — 볼 수만 있는 행사

**Files:**
- Modify: `apps/web/src/workspace/EventWorkspace.tsx`, `apps/web/src/chat/Chat.tsx`, `apps/web/src/chat/useChat.ts`, `apps/web/src/tasks/EventTasks.tsx`, `apps/web/src/purchases/EventPurchases.tsx`, `apps/web/src/purchases/PurchaseCandidates.tsx`, `apps/web/src/registrations/RegistrationPanel.tsx`, `apps/web/src/registrations/RegistrantList.tsx`, `apps/web/src/settlement/EventFinance.tsx`, `apps/web/src/workspace/Workspace.tsx`
- Modify(오류 문구): `tasks/task-view.ts`, `purchases/purchase-view.ts`, `public/registration-text.ts`, `settlement/settlement-view.ts`, `expenses/expense-view.ts`, `budget/budget-view.ts`
- Test: `chat/Chat.test.tsx`, `tasks/EventTasks.test.tsx`, `purchases/PurchaseCandidates.test.tsx`, `purchases/EventPurchases.test.tsx`, `registrations/RegistrationPanel.test.tsx`, `settlement/EventFinance.test.tsx`

**Interfaces:**
- Consumes: Task 5의 `completedEventMessage`
- Produces: `readOnly?: boolean`(기본 false) prop — Chat, EventTasks, EventPurchases, PurchaseCandidates, RegistrationPanel, RegistrantList, EventFinance, EventWorkspace

- [ ] **Step 1: 실패하는 테스트** (각 파일의 기존 헬퍼·고정값을 쓴다)

`Chat.test.tsx`
```tsx
test('완료한 행사는 대화 입력 대신 안내를 보인다', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok([msg('old')])))
  render(<Chat {...props} readOnly />)
  expect(await screen.findByText('old')).toBeTruthy()
  expect(screen.queryByLabelText('메시지')).toBeNull()
  expect(screen.getByText('완료한 행사라 대화를 보낼 수 없어요.')).toBeTruthy()
})

test('보내는 사이 행사가 완료되면 다시 보내라고 하지 않고 완료를 알린다', async () => {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => init?.method === 'POST'
    ? { ok: false, status: 409, json: async () => ({ error: 'EVENT_COMPLETED' }) } : ok([])))
  render(<Chat {...props} />)
  await screen.findByText('아직 대화가 없어요.')
  fireEvent.change(screen.getByLabelText('메시지'), { target: { value: '안녕' } })
  fireEvent.click(screen.getByRole('button', { name: '전송' }))
  expect(await screen.findByText('완료한 행사라 대화를 보낼 수 없어요.')).toBeTruthy()
})
```

`EventTasks.test.tsx` — 업무 하나가 있는 기존 설정으로 `readOnly`를 넘겨 그린 뒤
```tsx
  expect(screen.queryByRole('button', { name: '업무 추가' })).toBeNull()
  expect(screen.queryByRole('button', { name: '시작' })).toBeNull()
```
그리고 상태 바꾸기 응답이 `409 { error: 'EVENT_COMPLETED' }`이면 `'완료한 행사라 바꿀 수 없어요. 바꾸려면 회장단이 완료를 취소해야 해요.'`가 보이는 테스트(기존 상태 바꾸기 테스트의 응답만 바꾼다).

`PurchaseCandidates.test.tsx` — 후보 하나로 `readOnly` 그리기 → `checkbox`·`숨기기`·`담기` 단추 없음.
`EventPurchases.test.tsx` — 작성 중·대기 품목이 있는 기존 설정에 `readOnly` → `수정`·`지우기`·`요청 취소`·`모두 선택` 없음.
`RegistrationPanel.test.tsx` — 신청서·신청자가 있는 기존 설정에 `readOnly` → `행사 정보 수정`·`설정 바꾸기`·`신청 받기 멈추기`·`QR로 참석 확인`·`${이름} 참석 확인`·`${이름} 관리` 없음, `링크 복사`는 있음.
`EventFinance.test.tsx` — 정산한 재정(`financeResponse({ settled: … })` 고정값)으로 `readOnly` → `정산 다시 열기` 없음, `엑셀 내려받기` 있음.

- [ ] **Step 2: 실패 확인**

Run: `npm test --workspace @vada/web -- src/chat src/tasks/EventTasks.test.tsx src/purchases src/registrations/RegistrationPanel.test.tsx src/settlement/EventFinance.test.tsx`
Expected: 새 테스트 FAIL

- [ ] **Step 3: 오류 문구** — 여섯 표에 한 줄씩 더한다(import `completedEventMessage` from `../events/event-phase`).

```ts
  EVENT_COMPLETED: completedEventMessage,
```
대상: `taskErrors`(task-view.ts), `purchaseErrors`(purchase-view.ts), registration-text.ts의 오류 표, settlement-view.ts·expense-view.ts·budget-view.ts의 오류 표.

- [ ] **Step 4: 대화** — `useChat.ts`, `Chat.tsx`

`useChat.ts`: `RequestError`에 코드를 담는다.
```ts
class RequestError extends Error {
  constructor(readonly status: number, readonly code: unknown = null) { super('Chat request failed') }
}
```
보내기의 `if (!response.ok) throw new RequestError(response.status)`를
```ts
        if (!response.ok) throw new RequestError(response.status, (await response.json().catch(() => null) as { error?: unknown } | null)?.error)
```
catch의 401·403·404 줄 다음에
```ts
        // 행사가 완료됐다(M5a). 저장되지 않았으니 다시 보내라고 하지 않는다.
        if (error instanceof RequestError && error.code === 'EVENT_COMPLETED') { setSendError('완료한 행사라 대화를 보낼 수 없어요.'); return }
```
`Chat.tsx`: Props에 `// 완료한 행사(M5a)는 볼 수만 있다.\n  readOnly?: boolean`. `ChatPanel`에서 `readOnly`면 `<form>` 대신
```tsx
    <p className="shrink-0 border-t px-4 py-3 text-center text-sm text-gray-500 sm:px-6">완료한 행사라 대화를 보낼 수 없어요.</p>
```

- [ ] **Step 5: 업무** — `EventTasks.tsx`

Props에 `readOnly?: boolean`. 함수 첫 줄에 `const editable = manageEvents && !readOnly`를 두고, 화면의 `manageEvents`(업무 추가, `TaskCard`, `TaskDetailDialog`)를 `editable`로 바꾼다. 빈 상태 설명은 `readOnly ? '완료한 행사라 업무를 더할 수 없어요.' : manageEvents ? …(그대로) : …(그대로)`.

- [ ] **Step 6: 구매** — `EventPurchases.tsx`, `PurchaseCandidates.tsx`

`PurchaseCandidates`: Props에 `readOnly?: boolean`. `readOnly`면 `CandidateCard`에 `selection`과 자식 단추(숨기기·다시 보이기)를 주지 않고, `담기` 단추와 담는 중 안내를 그리지 않는다. 숨긴 후보 펼치기는 그대로 둔다.
`EventPurchases`: Props에 `readOnly?: boolean`을 받아 `PurchaseCandidates`에 넘긴다. `actionsOf`는 `readOnly`면 `null`, `card`의 `selection`은 `readOnly`면 `undefined`, `section('작성 중', drafts, false, readOnly ? undefined : draftTools)`.

- [ ] **Step 7: 참가자** — `RegistrationPanel.tsx`, `RegistrantList.tsx`

`RegistrationPanel`: Props에 `readOnly?: boolean`. `readOnly`면 `행사 정보 수정` 단추, `설정 바꾸기`·`멈추기/다시 받기` 묶음, `참가 신청 받기` 단추를 그리지 않는다(신청서가 없으면 안내 문구만). `RegistrantList`에 `readOnly`를 넘긴다.
`RegistrantList`: Props에 `readOnly?: boolean`. `readOnly`면 `QR로 참석 확인`, 줄의 `참석`·`입금 확인`·`관리` 단추를 그리지 않는다. 거르기·찾기는 그대로다.

- [ ] **Step 8: 재정** — `EventFinance.tsx`

Props에 `readOnly?: boolean`. `정산 다시 열기` 묶음의 조건 `finance && !summary.periodClosed`에 `&& !readOnly`를 더하고, 완료한 행사면 그 자리에 `<p className="text-xs text-gray-500">완료한 행사라 정산을 다시 열 수 없어요. 회장단이 완료를 먼저 취소해야 해요.</p>`(`finance && readOnly`일 때). 완료한 행사는 정산돼 있어 예산·지출 기록 단추는 이미 없다.

- [ ] **Step 9: 행사 화면** — `EventWorkspace.tsx`, `Workspace.tsx`

`EventWorkspace` Props에 `// 완료한 행사(M5a)는 볼 수만 있다.\n  readOnly?: boolean`. 탭 줄 아래(탭 패널 위)에
```tsx
    {readOnly && <p className="shrink-0 border-b bg-gray-50 px-4 py-2 text-xs text-gray-600 sm:px-6">완료한 행사라 볼 수만 있어요.</p>}
```
`Chat`, `EventTasks`, `EventPurchases`, `RegistrationPanel`, `EventFinance`에 `readOnly={readOnly}`를 넘긴다.
`Workspace.tsx`의 `<EventWorkspace … readOnly={Boolean(current.completedAt)} />`.

- [ ] **Step 10: 통과 확인** — Step 2 명령 → PASS. 이어서 `npm run typecheck`.

- [ ] **Step 11: 커밋**

```bash
git add apps/web/src
git commit -m "완료한 행사는 볼 수만 있게 그리기"
```

---

### Task 7: 화면 — 옆 메뉴 행사 목록과 기록

**Files:**
- Create: `apps/web/src/events/Records.tsx`
- Modify: `apps/web/src/workspace/Workspace.tsx`, `apps/web/src/workspace/WorkspaceSidebar.tsx`, `apps/web/src/expenses/ExpenseFormDialog.tsx`
- Test: `apps/web/src/workspace/Workspace.test.tsx`, `apps/web/src/expenses/ExpenseFormDialog.test.tsx`(없으면 `expenses/Expenses.test.tsx`의 기존 대화상자 테스트 옆)

**Interfaces:**
- Produces: `<Records events loading error onOpen onRefresh />`, `WorkspaceSidebar`의 `recordsActive: boolean`, `onRecords: () => void`

- [ ] **Step 1: 실패하는 테스트**

`Workspace.test.tsx` — `setup`의 행사 목록 응답을 바꿀 수 있게 넷째 인자 `eventList`를 더한다(기본값은 지금의 두 행사).
```ts
function setup(members: unknown = membersBody, review: unknown = …, myTasks: unknown = …, eventList: unknown[] = [event, { ...event, id: 'e2', name: '축제' }]) {
  … : url.endsWith('/events') ? { events: eventList } …
```
새 테스트
```tsx
const done = { ...event, id: 'e3', name: '새내기 배움터', version: 2, completedAt: '2026-10-01T06:00:00.000Z' }

test('완료한 행사는 옆 메뉴 행사 목록에 없고, 기록에서 열면 볼 수만 있고 경로가 기록이다', async () => {
  setup(membersBody, undefined, undefined, [event, done])
  render(<Workspace {...props} />)
  const list = await screen.findByRole('navigation', { name: '행사 목록' })
  await within(list).findByRole('button', { name: '체육대회' })
  expect(within(list).queryByRole('button', { name: '새내기 배움터' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '기록' }))
  const records = await screen.findByRole('list', { name: '완료한 행사' })
  expect(within(records).getByText('완료 2026. 10. 1.')).toBeTruthy()
  fireEvent.click(within(records).getByRole('button', { name: '새내기 배움터' }))
  expect(await screen.findByText('완료한 행사라 볼 수만 있어요.')).toBeTruthy()
  expect(screen.getByText('완료')).toBeTruthy()
  expect(screen.queryByLabelText('메시지')).toBeNull()
  expect(screen.getByRole('banner').textContent).toContain('기록')
})

test('회장단은 행사 화면 머리에서 완료하기를 보고, 다른 구성원은 단계 칩만 본다', async () => {
  setup(membersBody, undefined, undefined, [event])
  const { unmount } = render(<Workspace {...props} memberships={[leaderMembership]} />)
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  expect(await screen.findByRole('button', { name: '완료하기' })).toBeTruthy()
  expect(screen.getByText('기획 중')).toBeTruthy()
  unmount()
  setup(membersBody, undefined, undefined, [event])
  render(<Workspace {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  await screen.findByText('기획 중')
  expect(screen.queryByRole('button', { name: '완료하기' })).toBeNull()
})

test('예산에서 완료한 행사 이름을 누르면 볼 수만 있는 재정 탭이 열린다', async () => {
  // 기존 "예산은 … 행사 이름을 누르면 그 행사의 재정 탭이 열린다" 테스트와 같은 순서. 예산 줄의 행사를 완료한 행사(e1)로 둔다.
  setup(membersBody, undefined, undefined, [{ ...event, completedAt: '2026-10-01T06:00:00.000Z' }])
  render(<Workspace {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: '예산' }))
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  expect(await screen.findByText('완료한 행사라 볼 수만 있어요.')).toBeTruthy()
  expect(screen.getByRole('tab', { name: '재정', selected: true })).toBeTruthy()
})
```
(예산 화면의 행사 이름 단추 이름이 다르면 기존 예산 테스트의 쿼리를 그대로 쓴다.)

지출 기록 대화상자 테스트(기존 렌더 헬퍼를 쓴다)
```tsx
test('지출 기록의 행사 고르기는 완료한 행사를 빼고, 이미 그 행사에 기록한 지출을 고칠 때는 그 행사를 보인다', async () => {
  // events: [진행 중 e, 완료한 e3]. 새 지출: 고르기에 e3 없음. e3의 지출 수정: e3이 골라져 있음.
})
```
(이 테스트의 본문은 그 파일의 기존 새 지출·수정 테스트를 복사해 events와 기대값만 바꾼다.)

- [ ] **Step 2: 실패 확인**

Run: `npm test --workspace @vada/web -- src/workspace/Workspace.test.tsx src/expenses`
Expected: 새 테스트 FAIL

- [ ] **Step 3: 기록 화면** — `apps/web/src/events/Records.tsx`

```tsx
import { Archive } from 'lucide-react'
import type { EventSummary } from '@vada/contracts'
import { EmptyState } from '@/components/EmptyState'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card, cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatKoreanTime } from '../public/registration-text'

type Props = { events: EventSummary[] | null; loading: boolean; error: string; onOpen: (event: EventSummary) => void; onRefresh: () => void }
const day = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })

// 완료한 행사 목록(REC-01). 최근 완료 순이다. 누르면 볼 수만 있는 행사 화면이 열린다. 수치·결과보고서는 M5b에서 더한다.
export default function Records({ events, loading, error, onOpen, onRefresh }: Props) {
  return <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><div className="mx-auto flex max-w-3xl flex-col gap-3">
    {loading ? <StateMessage kind="loading">기록 불러오는 중…</StateMessage>
      : error ? <div className="flex flex-col items-start gap-2"><StateMessage kind="error">{error}</StateMessage>
        <Button variant="outline" size="sm" onClick={onRefresh}>다시 불러오기</Button></div>
      : events?.length ? <ul className="flex flex-col gap-2" aria-label="완료한 행사">{events.map(event => <li key={event.id}>
        <article className={cn(cardClass, 'flex flex-col gap-1 p-4')}>
          <h2 className="text-sm">
            <Button variant="link" className="h-auto justify-start p-0 text-left text-sm font-semibold whitespace-normal wrap-anywhere text-gray-900"
              onClick={() => onOpen(event)}>{event.name}</Button>
          </h2>
          <p className="text-xs text-gray-500">{event.startsAt ? formatKoreanTime(event.startsAt) : '날짜 미정'} · 완료 {day(event.completedAt!)}</p>
        </article>
      </li>)}</ul>
      : <Card><EmptyState icon={Archive} title="완료한 행사가 아직 없어요" description="정산한 행사를 회장단이 완료하면 여기에 모여요." /></Card>}
  </div></div>
}
```
(`formatKoreanTime`이 "YYYY-MM-DDTHH:mm"을 읽는 글자로 바꾸는 함수다. 다른 이름이면 참가자 탭이 행사 일시를 보이는 함수를 쓴다.)

- [ ] **Step 4: 옆 메뉴** — `WorkspaceSidebar.tsx`

Props에 `recordsActive: boolean; onRecords: () => void`. 참가비 설정 다음에 더한다(import `Archive`).
```tsx
      <NavItem active={recordsActive} className="flex items-center gap-2" onClick={onRecords}>
        <Archive aria-hidden className="size-4" />기록
      </NavItem>
```

- [ ] **Step 5: Workspace** — `Workspace.tsx`

- `type View`에 `'records'`.
- 목록을 나눈다.
```ts
  // 완료한 행사(M5a)는 옆 메뉴 행사 목록에서 빼고 "기록"에 최근 완료 순으로 둔다.
  const activeEvents = events.events?.filter(item => !item.completedAt) ?? null
  const completedEvents = events.events?.filter(item => item.completedAt)
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!)) ?? null
```
- `function openRecords() { if (view !== 'records' && canLeave()) setView('records'); setNavOpen(false) }`
- 옆 메뉴: `recordsActive={view === 'records' || (view === 'events' && Boolean(current?.completedAt))} onRecords={openRecords}`, `EventList events={activeEvents}`.
- 머리: `view === 'records'`이면 section `'기록'`, title `'기록'`.
- 본문: `: view === 'records' ? <Records events={completedEvents} loading={events.loading} error={events.loadError} onOpen={select} onRefresh={events.refresh} />`
- `select`의 주석에 "기록에서 고른 행사도 같다"를 더한다.

- [ ] **Step 6: 지출 행사 고르기** — `ExpenseFormDialog.tsx`

`Form` 안에서 고르기에 쓸 목록을 거른다.
```ts
  // 완료한 행사(M5a)에는 지출을 기록하지 않는다. 이미 그 행사에 기록한 지출을 고칠 때는 그 행사를 남긴다.
  const choices = events.filter(item => !item.completedAt || item.id === (expense?.eventId ?? initialEventId))
```
`events.map(…option…)`을 `choices.map(…)`으로 바꾼다. (`expense`의 행사 칸 이름이 `eventId`가 아니면 그 이름을 쓴다.)

- [ ] **Step 7: 통과 확인**

Run: `npm test --workspace @vada/web`
Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 8: 커밋**

```bash
git add apps/web/src
git commit -m "옆 메뉴 기록과 완료한 행사 목록"
```

---

### Task 8: 시연 데이터

**Files:**
- Modify: `apps/api/scripts/demo-data.ts`, `apps/api/scripts/demo-data.test.ts`

- [ ] **Step 1: 실패하는 테스트** — `demo-data.test.ts`
- 시각 칼럼 목록에 `'events.completed_at'`을 더한다.
- 정산 확인 다음에 더한다.
```ts
    // 새내기 배움터·개강총회는 완료해 기록에 있고, 체육대회는 정산만 해 회장단이 완료해 볼 수 있다.
    const completed = await pg.query<{ name: string }>(`SELECT name FROM events WHERE organization_id = $1 AND completed_at IS NOT NULL ORDER BY name`,
      [DEMO_ORGANIZATION_ID])
    assert.deepEqual(completed.rows.map(row => row.name), ['2026 새내기 배움터', '2학기 개강총회'])
```

- [ ] **Step 2: 실패 확인** — `cd apps/api; npx tsx --test scripts/demo-data.test.ts` → FAIL

- [ ] **Step 3: 구현** — `demo-data.ts`의 업무(13) 다음, `seedDemo`가 끝나기 전에 더한다.
```ts
  // 14. 행사 완료(M5a). 정산한 지난 행사 둘을 회장단(부회장)이 완료한다. 체육대회는 시연에서 완료해 보도록 남긴다.
  log('완료')
  for (const key of ['orientation', 'opening'] as const) {
    const { events: list } = await call<EventsResponse>('vice', 'GET', orgPath('/events'))
    const target = list.find(item => item.id === eventIds[key])!
    await call('vice', 'POST', eventPath(key, '/completion'), { version: target.version })
  }
  await shapeCompletion(db, calendar, eventIds)
```
`shapeClosing` 다음에 더한다.
```ts
// 완료 시각: 정산 다음 날 10시다(정산은 행사 사흘·나흘 뒤 15시).
async function shapeCompletion(db: Db, calendar: Calendar, eventIds: Record<string, string>) {
  const completedOn: Record<string, string> = { orientation: addDays(calendar.orientation, 5), opening: addDays(calendar.opening, 4) }
  for (const [key, day] of Object.entries(completedOn)) {
    await db.update(events).set({ completedAt: kst(day, '10:00') }).where(eq(events.id, eventIds[key]!))
  }
}
```
(`'vice'`가 회장단이 아니면 시연 구성원 가운데 회장단 키를 쓴다. `call`·`eventPath`·`orgPath`·`EventsResponse`·`events` import는 파일의 기존 것을 따른다.)

- [ ] **Step 4: 통과 확인** — Step 2 명령 → PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/api/scripts
git commit -m "시연 데이터에 완료한 행사 더하기"
```

---

### Task 9: 전체 검사·DB 적용·dev 확인·리뷰·배포

- [ ] **Step 1: 전체 검사**

Run: `npm run typecheck`
Run: `npm test --workspace @vada/contracts`
Run: `npm test --workspace @vada/web`
Run: `cd apps/api; npx tsx --test --test-concurrency=2 <package.json의 test 목록>`
Expected: 모두 PASS. 실패는 고친 뒤 다시 돌린다.

- [ ] **Step 2: 적용 스크립트** — `.superpowers/apply-0025.mts`

`.superpowers/apply-0024.mts`를 본떠 만든다. 다른 점:
- 최신 로컬 마이그레이션이 `0025_event_completion`인지 본다.
- 점검: `events`의 `completed_at`·`completed_by` 칸 수(0 또는 2), 제약 `events_completed_pair`·`events_completed_by_users_id_fk` 수(0 또는 2), 행사 수, 완료한 행사 수.
- `--apply` 조건: 적용 기록이 순서·해시까지 로컬과 같고 0025만 남았으며 두 칸·제약이 없을 때. 적용 뒤 칸 2·제약 2·행사 수 그대로·완료 0이면 `MIGRATION_0025_APPLIED`.
- 접속 주소·값·오류 원문은 출력하지 않는다.

- [ ] **Step 3: DB 적용 승인 요청**

사용자에게 한 줄을 입력해 달라고 한다(새 칸을 읽는 코드라 배포 전에 두 DB에 적용).
```
! cd C:/Users/82108/vada-m1/apps/api; npx tsx ../../.superpowers/apply-0025.mts dev; npx tsx ../../.superpowers/apply-0025.mts dev --apply; npx tsx ../../.superpowers/apply-0025.mts preview; npx tsx ../../.superpowers/apply-0025.mts preview --apply
```
두 DB 모두 `MIGRATION_0025_APPLIED`를 확인한다.

- [ ] **Step 4: dev 브라우저 확인**

`npm run dev`(api·web)로 띄우고 Chrome에서 "M1 검증 학생회"에 확인용 행사 "완료 확인 (확인용)"을 만든다.
- 정산 전 [완료하기] → 대화상자의 정산 안내와 꺼진 단추
- 재정 탭에서 정산(지출 없음) → [완료하기] → 옆 메뉴에서 빠지고 기록에 생김, 머리 칩 "완료", 탭마다 단추 없음, 경로 "기록"
- [완료 취소] → 옆 메뉴로 돌아옴
- 375px·800px에서 머리(칩·단추)와 기록 목록이 넘치지 않는지
- 와이어프레임 EVT-02D `20:5694`·REC-01 `30:3292`와 비교

- [ ] **Step 5: 새 컨텍스트 Opus 최종 리뷰**

superpowers:requesting-code-review로 브랜치 전체(main 대비)를 리뷰한다. spec·plan 경로를 넘긴다. Critical·Important는 고치고, Minor는 고칠지 판단해 known-issues 메모에 남긴다.

- [ ] **Step 6: 병합·배포**

```bash
git checkout main
git merge --ff-only m5a-event-completion
git push origin main
```
CI 결과와 `https://vada-m1.onrender.com/api/health`를 확인한다.

- [ ] **Step 7: 기록**

- 진행 위치 메모(project-m2-roadmap)에 M5a 배포와 다음(M5b)을 적는다.
- `project-event-completion-known-issues` 메모에 미룬 문제·dev 확인용 데이터를 적는다.
- 시연 데이터 다시 넣기(배포 DB 초기화)는 사용자 승인을 받아 `npx tsx scripts/manage-demo-data.ts preview` → `--apply`.
