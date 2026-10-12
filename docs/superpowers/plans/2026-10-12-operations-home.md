# M6 운영 홈 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회장단이 학생회를 열면 끝나지 않은 행사의 멈춘 일과 할 차례를 행사별·부서별로 보는 "운영 현황" 화면을 만든다.

**Architecture:** 서버는 읽기 전용 경로 `GET /api/organizations/:organizationId/home` 하나를 새 모듈 `apps/api/src/home/`에 둔다. 이미 있는 집계(`eventSummaries`, 업무 요약, `expenseSummaries`, `financeNumbersByEvent`, 참가비 낼 돈 식)를 다시 쓰고 DB는 바꾸지 않는다. 화면은 새 기능 폴더 `apps/web/src/home/`(순수 계산 `home-view.ts`, 데이터 훅, 화면)를 두고, `Workspace`가 옆 메뉴 "홈"과 회장단 첫 화면으로 잇는다.

**Tech Stack:** Hono, drizzle-orm 0.45(PGlite 테스트), zod 계약 패키지 `@vada/contracts`, React 19, Tailwind, vitest + testing-library, node:test(tsx).

**Spec:** `docs/superpowers/specs/2026-10-12-operations-home-design.md`

## Global Constraints

- 새 입력·DB 변경·마이그레이션 없음. 경로는 GET 하나이고 구성원 누구나 본다(미배정 포함). 신청자 이름은 주지 않는다.
- 대상은 완료하지 않은 행사(`completedAt` 없음)만이다.
- 수의 정의는 기존 화면과 같다: 지연 = 완료가 아니고 마감일 < 오늘(한국 날짜), 증빙 없음 = 취소하지 않았고 ready 증빙 없음, 입금 확인 전 = 정보를 지우지 않았고 입금 확인 없고 낼 돈 > 0, 정산을 막는 수 = `financeNumbersByEvent`.
- 필요한 날 지난 구매와 입금 확인 전은 정산 전 행사만 센다.
- 줄 목록 상한: 지연 업무 100(`HOME_TASKS_MAX`), 증빙 없는 지출 100(`HOME_EXPENSES_MAX`), 오래된 것부터. 수(`counts`)는 자르지 않는다.
- 줄 순서: `HOME_ITEM_KINDS` = completion_pending → settlement_pending → task_overdue → tasks_unassigned → purchases_pending → purchases_late → expense_no_evidence → fees_unconfirmed.
- 할 차례: 업무 = 업무의 담당 부서, 돈 관련 = `handlesFinance` 부서(없으면 회장단), 완료 = 회장단, 아무도 없으면 "담당 부서 없음".
- 화면 규칙(AGENTS.md): ui 부품만 쓰고 날것의 `<button>`에 모양을 주지 않는다. Tailwind 표준 스케일과 테마 토큰만 쓴다. 긴 글에는 `wrap-anywhere`.
- 첫 화면: 회장단(`manageOrganization`)은 운영 현황, 다른 구성원은 내 업무. 학생회를 만들면 구성원 화면, 초대로 들어오면 내 업무는 그대로다.
- 커밋에 AI 서명·Co-Authored-By를 붙이지 않는다. 제목은 50자 이내 명령형 한국어.
- 이 PC에서 API 테스트 여러 파일은 `--test-concurrency=2`로 돌린다.

## Review Focus

- 제출 시각이 한국 날짜로 어제 밤(UTC로는 같은 날)이면 "1일 전 제출"이어야 한다 → Task 4 `home-view.test.ts`에 고정한다.
- 미배정 구성원(`manageEvents` false)이 입금 확인 전 줄을 누르면 참가자 탭이 아니라 재정 탭으로 가야 하고, 업무 상세는 보기만 되어야 한다 → Task 5 `Home.test.tsx`에 고정한다.
- 행사가 하나도 없고 상시 운영 지출의 증빙만 없을 때 빈 화면이 아니라 "상시 운영 지출" 카드가 보여야 한다 → Task 5에 고정한다.
- 상세에서 기록을 바꾸면(업무 상태, 지출 증빙) 홈이 새로 불러와 줄이 사라져야 한다 → Task 5에서 업무 상세의 상태 바꾸기로 고정한다. 지출 상세도 같은 `refresh`를 `onChanged`로 받는다.
- 마감일이 오늘인 업무와 필요한 날이 오늘인 품목은 멈춘 일이 아니어야 한다 → Task 2·3 서버 테스트에 고정한다.

---

### Task 1: 계약 — 행사 단계 함수 옮기기와 운영 현황 타입

**Files:**
- Modify: `packages/contracts/src/events.ts` (끝에 `EventPhase`, `eventPhaseOf` 추가)
- Create: `packages/contracts/src/home.ts`
- Modify: `packages/contracts/src/index.ts:3-4` (events 내보내기에 추가), 끝에 home 내보내기 추가
- Modify: `apps/web/src/events/event-phase.ts` (함수를 contracts에서 다시 내보내기)
- Test: `apps/web/src/events/event-phase.test.ts`(그대로 통과해야 한다)

**Interfaces:**
- Produces: `eventPhaseOf(event: { startsAt: string | null; endsAt: string | null; completedAt: string | null }, now: string): EventPhase`, `type EventPhase = 'planning' | 'ongoing' | 'wrapping' | 'completed'`, `HOME_TASKS_MAX`, `HOME_EXPENSES_MAX`, `HOME_ITEM_KINDS`, `HomeItemKind`, `HomeTaskCounts`, `HomeEvent`, `HomeItem`, `HomeDepartment`, `HomeResponse` (모두 `@vada/contracts`에서)

- [ ] **Step 1: contracts/events.ts 끝에 단계 함수를 옮긴다**

```ts
// 행사 단계(M5a). 저장하지 않고 날짜로 계산한다. now와 행사 일시는 한국 시각 "YYYY-MM-DDTHH:mm"이라 글자로 비교한다.
// 끝 일시가 없으면 시작한 날(한국 날짜)이 끝날 때까지 진행 중이다. 화면의 단계 칩과 운영 현황(M6) 서버가 같이 쓴다.
export type EventPhase = 'planning' | 'ongoing' | 'wrapping' | 'completed'
export function eventPhaseOf(event: { startsAt: string | null; endsAt: string | null; completedAt: string | null }, now: string): EventPhase {
  if (event.completedAt) return 'completed'
  if (!event.startsAt || now < event.startsAt) return 'planning'
  if (event.endsAt) return now < event.endsAt ? 'ongoing' : 'wrapping'
  return now.slice(0, 10) === event.startsAt.slice(0, 10) ? 'ongoing' : 'wrapping'
}
```

- [ ] **Step 2: contracts/home.ts를 만든다**

```ts
import type { EventPhase } from './events.js'
import type { ExpenseSummary } from './expenses.js'
import type { EventSummary } from './index.js'
import type { TaskSummary } from './tasks.js'

// 운영 현황(M6). 완료하지 않은 행사에서 멈춘 일을 모은다. 줄 목록은 종류마다 이만큼까지 오래된 것부터 주고, 수(counts)는 자르지 않는다.
export const HOME_TASKS_MAX = 100
export const HOME_EXPENSES_MAX = 100
// 멈춘 일의 종류. 이 순서가 줄 순서다(행사 마무리 → 업무 → 돈).
export const HOME_ITEM_KINDS = ['completion_pending', 'settlement_pending', 'task_overdue', 'tasks_unassigned', 'purchases_pending',
  'purchases_late', 'expense_no_evidence', 'fees_unconfirmed'] as const
export type HomeItemKind = typeof HOME_ITEM_KINDS[number]
export interface HomeTaskCounts { open: number; overdue: number; done: number }
export interface HomeEvent {
  event: EventSummary
  // 완료한 행사는 오지 않는다.
  phase: Exclude<EventPhase, 'completed'>
  tasks: { total: number; done: number; overdue: number; unassigned: number }
  // 참가 신청이 없으면 null이다. registered는 취소하지 않은 신청 수(결과보고서와 같다)이고 closesAt은 한국 시각이다.
  registration: { registered: number; capacity: number | null; closesAt: string; accepting: boolean } | null
  settled: boolean
}
type Named = { id: string; name: string }
export type HomeItem =
  | { kind: 'task_overdue'; eventId: string; task: TaskSummary }
  | { kind: 'tasks_unassigned'; eventId: string; department: Named | null; count: number }
  // since는 가장 오래된 제출 시각(ISO)이다.
  | { kind: 'purchases_pending'; eventId: string; count: number; since: string }
  // neededBy는 가장 이른 필요한 날이다.
  | { kind: 'purchases_late'; eventId: string; count: number; neededBy: string }
  // 상시 운영 지출이면 eventId가 null이다.
  | { kind: 'expense_no_evidence'; eventId: string | null; expense: ExpenseSummary }
  | { kind: 'fees_unconfirmed'; eventId: string; count: number }
  // endedOn은 행사가 끝난 한국 날짜다. blockers는 정산을 막는 수(정산 조건과 같다)다.
  | { kind: 'settlement_pending'; eventId: string; endedOn: string
      blockers: { missingEvidence: number; pendingRequests: number; unrecordedItems: number } }
  | { kind: 'completion_pending'; eventId: string; endedOn: string }
export interface HomeDepartment { id: string; name: string; isLeadership: boolean; handlesFinance: boolean; tasks: HomeTaskCounts }
export interface HomeResponse {
  // 서버의 한국 날짜(YYYY-MM-DD). 화면은 며칠 지났는지를 이 날로 센다.
  today: string
  events: HomeEvent[]
  departments: HomeDepartment[]
  // 담당 부서가 없는 업무
  unownedTasks: HomeTaskCounts
  items: HomeItem[]
  counts: Record<HomeItemKind, number>
  // 지연 업무나 증빙 없는 지출이 상한을 넘어 줄 일부만 왔다.
  truncated: boolean
}
```

- [ ] **Step 3: index.ts에서 내보낸다**

`./events.js` 내보내기 줄에 `eventPhaseOf, type EventPhase`를 더하고, 파일 끝에 다음을 더한다.

```ts
export { HOME_TASKS_MAX, HOME_EXPENSES_MAX, HOME_ITEM_KINDS } from './home.js'
export type { HomeItemKind, HomeTaskCounts, HomeEvent, HomeItem, HomeDepartment, HomeResponse } from './home.js'
```

- [ ] **Step 4: 웹 event-phase.ts가 contracts의 함수를 쓴다**

`apps/web/src/events/event-phase.ts`의 `EventPhase` 타입과 `eventPhaseOf` 함수 본문을 지우고 다음으로 바꾼다. 라벨·색·문구는 그대로 둔다.

```ts
import { eventPhaseOf, type EventPhase } from '@vada/contracts'
import type { Tone } from '@/components/ui/badge'

// 단계 계산은 운영 현황 서버(M6)와 같이 쓰도록 contracts에 있다.
export { eventPhaseOf, type EventPhase }
```

- [ ] **Step 5: 검사**

Run: `npm run typecheck` (저장소 루트) → 오류 없음
Run: `npx vitest run src/events/event-phase.test.ts` (`apps/web`) → 4 passed

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src apps/web/src/events/event-phase.ts
git commit -m "행사 단계 계산을 contracts로 옮기고 운영 현황 타입 더하기"
```

---

### Task 2: 서버 — 운영 현황 경로와 업무 집계

**Files:**
- Create: `apps/api/src/home/service.ts`, `apps/api/src/home/routes.ts`, `apps/api/src/home/home.test.ts`
- Modify: `apps/api/src/tasks/service.ts` (요약 함수와 정렬 내보내기)
- Modify: `apps/api/src/app.ts` (`AppOptions.home`), `apps/api/src/serve.ts`, `apps/api/src/http/boundary.test.ts`, `apps/api/src/events/completion-lock.test.ts` (모듈 목록), `apps/api/package.json` (`test` 목록에 `src/home/home.test.ts`)

**Interfaces:**
- Consumes: Task 1의 `eventPhaseOf`, `HOME_TASKS_MAX`, `HomeResponse` 등
- Produces: `homeOf(db: HomeDatabase, organizationId: string, now: Date): Promise<HomeResponse>`, `createHomeRoutes(db, session, { now }?)`, `taskSummaries`, `tasksByDue`(tasks/service.ts에서)

- [ ] **Step 1: 실패하는 테스트를 쓴다** (`apps/api/src/home/home.test.ts`)

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { HomeResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { origin, setupPurchases } from '../purchases/test-setup.js'
import { refused } from '../registrations/test-setup.js'
import { createHomeRoutes } from './routes.js'

// 학생회 a: 기획부(dp) p·q, 총무부(df, 재정) f, 회장단(dl) l, 미배정 n. 학생회 b: x. 행사 e(체육대회)·e2(축제), ex(b).
// 지금은 한국 2026-10-12 12:00이다.
type Env = Awaited<ReturnType<typeof setupPurchases>>
const NOW = new Date('2026-10-12T03:00:00Z')
function homeApp(env: Env, now = NOW) {
  const session = async () => env.state.userId ? { user: { id: env.state.userId } } : null
  const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, home: createHomeRoutes(env.db, session, { now: () => now }) })
  return (organizationId = 'a') => app.request(`/api/organizations/${organizationId}/home`)
}
const kinds = (home: HomeResponse, kind: string) => home.items.filter(item => item.kind === kind)

test('운영 현황은 구성원 누구나 보고(미배정 포함), 다른 학생회·미인증은 막는다', async () => {
  const env = await setupPurchases()
  try {
    const get = homeApp(env)
    env.as('n')
    const home = await env.ok<HomeResponse>(get())
    assert.equal(home.today, '2026-10-12')
    assert.deepEqual(home.events.map(entry => entry.event.id).sort(), ['e', 'e2'])
    env.as('x')
    await refused(get(), 403, 'FORBIDDEN')
    env.as(null)
    assert.equal((await get()).status, 401)
  } finally { await env.pg.close() }
})

test('완료하지 않은 행사만 시작일 순(미정은 뒤)으로, 단계와 업무 수를 준다', async () => {
  const env = await setupPurchases()
  try {
    await env.pg.exec(`
      UPDATE events SET starts_at = '2026-10-01T10:00+09', ends_at = '2026-10-01T18:00+09' WHERE id = 'e';
      UPDATE events SET starts_at = '2026-10-12T10:00+09' WHERE id = 'e2';
      INSERT INTO events(id, organization_id, name, created_by) VALUES ('e3','a','학술제','p');
      INSERT INTO events(id, organization_id, name, created_by, completed_at, completed_by) VALUES ('e4','a','지난 행사','p', now(), 'l');
      INSERT INTO tasks(id, organization_id, event_id, title, status, department_id, assignee_id, due_on, completed_at, created_by) VALUES
        ('t1','a','e','끝낸 일','done','dp','p','2026-09-30','2026-09-30T10:00+09','p'),
        ('t2','a','e','늦은 일','todo','dp',NULL,'2026-10-11',NULL,'p'),
        ('t3','a','e','오늘 마감','doing','dp','p','2026-10-12',NULL,'p'),
        ('t9','a','e4','완료한 행사 업무','todo','dp',NULL,'2026-10-01',NULL,'p');
    `)
    const home = await env.ok<HomeResponse>(homeApp(env)())
    assert.deepEqual(home.events.map(entry => [entry.event.id, entry.phase]), [['e', 'wrapping'], ['e2', 'ongoing'], ['e3', 'planning']])
    assert.deepEqual(home.events[0]!.tasks, { total: 3, done: 1, overdue: 1, unassigned: 1 })
    assert.deepEqual(home.events[2]!.tasks, { total: 0, done: 0, overdue: 0, unassigned: 0 })
    assert.equal(home.events[0]!.registration, null)
    assert.equal(home.events[0]!.settled, false)
  } finally { await env.pg.close() }
})

test('지연 업무는 마감일 순 줄로, 담당자 없는 업무는 행사 × 담당 부서로 묶고, 부서별 수를 센다', async () => {
  const env = await setupPurchases()
  try {
    await env.pg.exec(`
      UPDATE events SET starts_at = '2026-10-01T10:00+09' WHERE id = 'e';
      INSERT INTO tasks(id, organization_id, event_id, title, status, department_id, assignee_id, due_on, completed_at, created_by) VALUES
        ('t1','a','e','끝낸 일','done','dp','p','2026-09-30','2026-10-01T10:00+09','p'),
        ('t2','a','e','현수막','todo','dp',NULL,'2026-10-11',NULL,'p'),
        ('t3','a','e','오늘 마감','doing','dp','p','2026-10-12',NULL,'p'),
        ('t4','a','e2','장소 섭외','todo',NULL,'q','2026-10-05',NULL,'p'),
        ('t5','a','e2','물품 목록','todo',NULL,NULL,NULL,NULL,'p');
    `)
    const home = await env.ok<HomeResponse>(homeApp(env)())
    assert.deepEqual(kinds(home, 'task_overdue').map(item => item.kind === 'task_overdue' && [item.eventId, item.task.id, item.task.assignee]),
      [['e2', 't4', { membershipId: 'mq', name: '기획2' }], ['e', 't2', null]])
    assert.deepEqual(kinds(home, 'tasks_unassigned'), [
      { kind: 'tasks_unassigned', eventId: 'e', department: { id: 'dp', name: '기획부' }, count: 1 },
      { kind: 'tasks_unassigned', eventId: 'e2', department: null, count: 1 }])
    assert.deepEqual(home.departments.map(department => [department.id, department.tasks]), [
      ['dl', { open: 0, overdue: 0, done: 0 }], ['dp', { open: 2, overdue: 1, done: 1 }], ['df', { open: 0, overdue: 0, done: 0 }]])
    assert.deepEqual(home.unownedTasks, { open: 2, overdue: 1, done: 0 })
    assert.equal(home.counts.task_overdue, 2)
    assert.equal(home.counts.tasks_unassigned, 2)
    assert.equal(home.truncated, false)
  } finally { await env.pg.close() }
})

test('지연 업무 줄은 100개까지 오래된 것부터 주고 잘렸다고 알린다. 수는 전체다', async () => {
  const env = await setupPurchases()
  try {
    await env.pg.exec(`INSERT INTO tasks(id, organization_id, event_id, title, status, due_on, created_by)
      SELECT 'bulk' || g, 'a', 'e', '업무 ' || g, 'todo', DATE '2026-06-01' + g, 'p' FROM generate_series(1, 101) g`)
    const home = await env.ok<HomeResponse>(homeApp(env)())
    const overdue = kinds(home, 'task_overdue')
    assert.equal(overdue.length, 100)
    assert.equal(overdue[0]!.kind === 'task_overdue' && overdue[0]!.task.id, 'bulk1')
    assert.equal(home.counts.task_overdue, 101)
    assert.equal(home.truncated, true)
  } finally { await env.pg.close() }
})
```

마감일은 6/2~9/10이라 101개 모두 지연이다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx tsx --test src/home/home.test.ts` (`apps/api`)
Expected: FAIL — `Cannot find module './routes.js'`

- [ ] **Step 3: tasks/service.ts에서 요약 함수와 정렬을 내보낸다**

`summaries` 함수 선언 아래(`const inOrganization = …` 앞)에 한 줄을 더한다.

```ts
// 운영 현황(M6)의 지연 업무 줄이 같은 꼴과 순서를 쓴다.
export { summaries as taskSummaries, byDue as tasksByDue }
```

- [ ] **Step 4: home/service.ts의 업무 부분을 쓴다**

```ts
import { and, asc, desc, eq, inArray, isNull, lt, ne, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { eventPhaseOf, HOME_TASKS_MAX, koreanOf, type HomeEvent, type HomeItem, type HomeResponse, type HomeTaskCounts } from '@vada/contracts'
import { departments, tasks } from '../db/schema.js'
import { eventSummaries } from '../events/events.js'
import { taskSummaries, tasksByDue } from '../tasks/service.js'

export type HomeDatabase = Pick<PgDatabase<PgQueryResultHKT>, 'select'>

// 운영 현황(M6). 완료하지 않은 행사에서 멈춘 일과 할 차례를 센다. 수마다 줄을 눌러 가는 화면과 같은 정의를 쓴다.
// 읽기만 하고 잠그지 않는다. 읽는 사이에 다른 사람이 바꾸면 숫자가 잠깐 어긋날 수 있고, 다시 불러오면 맞는다.
export async function homeOf(db: HomeDatabase, organizationId: string, now: Date): Promise<HomeResponse> {
  const moment = koreanOf(now)
  const today = moment.slice(0, 10)
  // 시작일 이른 순, 날짜 미정은 뒤. 같으면 행사 목록 순서(만든 순 역순) 그대로다(정렬은 안정적이다).
  const active = (await eventSummaries(db, organizationId)).filter(event => !event.completedAt)
    .sort((a, b) => (a.startsAt ?? '9999').localeCompare(b.startsAt ?? '9999'))
  const ids = active.map(event => event.id)
  const position = new Map(ids.map((id, index) => [id, index]))
  const departmentRows = await db.select({ id: departments.id, name: departments.name, isLeadership: departments.isLeadership,
    handlesFinance: departments.handlesFinance }).from(departments).where(eq(departments.organizationId, organizationId))
    .orderBy(desc(departments.isLeadership), asc(departments.name), asc(departments.id))

  // 업무(M4). 지연은 완료가 아니고 마감일이 오늘보다 앞이다(마감일 당일은 아니다).
  const ofActive = and(eq(tasks.organizationId, organizationId), inArray(tasks.eventId, ids))
  const open = sql`${tasks.status} <> 'done'`
  const counted = {
    open: sql<number>`(count(*) filter (where ${open}))::int`,
    overdue: sql<number>`(count(*) filter (where ${open} and ${tasks.dueOn} < ${today}::date))::int`,
    done: sql<number>`(count(*) filter (where ${tasks.status} = 'done'))::int`,
  }
  const perEvent = await db.select({ eventId: tasks.eventId, total: sql<number>`count(*)::int`, ...counted,
    unassigned: sql<number>`(count(*) filter (where ${open} and ${tasks.assigneeId} is null))::int` })
    .from(tasks).where(ofActive).groupBy(tasks.eventId)
  const perDepartment = await db.select({ departmentId: tasks.departmentId, ...counted }).from(tasks).where(ofActive).groupBy(tasks.departmentId)
  const overdue = await taskSummaries(db, and(ofActive, ne(tasks.status, 'done'), lt(tasks.dueOn, today)), tasksByDue, HOME_TASKS_MAX + 1)
  const unassigned = await db.select({ eventId: tasks.eventId, departmentId: tasks.departmentId, departmentName: departments.name,
    count: sql<number>`count(*)::int` }).from(tasks)
    .leftJoin(departments, and(eq(departments.organizationId, tasks.organizationId), eq(departments.id, tasks.departmentId)))
    .where(and(ofActive, ne(tasks.status, 'done'), isNull(tasks.assigneeId)))
    .groupBy(tasks.eventId, tasks.departmentId, departments.name)
  const countsOf = (departmentId: string | null): HomeTaskCounts => {
    const row = perDepartment.find(entry => entry.departmentId === departmentId)
    return { open: row?.open ?? 0, overdue: row?.overdue ?? 0, done: row?.done ?? 0 }
  }

  const work = new Map(perEvent.map(row => [row.eventId, row]))
  const events: HomeEvent[] = active.map(event => {
    const row = work.get(event.id)
    return { event, phase: eventPhaseOf(event, moment) as HomeEvent['phase'],
      tasks: { total: row?.total ?? 0, done: row?.done ?? 0, overdue: row?.overdue ?? 0, unassigned: row?.unassigned ?? 0 },
      registration: null, settled: false }
  })
  const items: HomeItem[] = []
  for (const task of overdue.slice(0, HOME_TASKS_MAX)) items.push({ kind: 'task_overdue', eventId: task.event.id, task })
  // 행사 순서, 같은 행사에서는 부서 이름 순(담당 부서 없음은 뒤)
  unassigned.sort((a, b) => position.get(a.eventId)! - position.get(b.eventId)!
    || (a.departmentName ?? '￿').localeCompare(b.departmentName ?? '￿'))
  for (const row of unassigned) items.push({ kind: 'tasks_unassigned', eventId: row.eventId, count: row.count,
    department: row.departmentId !== null && row.departmentName !== null ? { id: row.departmentId, name: row.departmentName } : null })
  return {
    today, events, items,
    departments: departmentRows.map(row => ({ ...row, tasks: countsOf(row.id) })),
    unownedTasks: countsOf(null),
    counts: { completion_pending: 0, settlement_pending: 0, purchases_pending: 0, purchases_late: 0, expense_no_evidence: 0, fees_unconfirmed: 0,
      task_overdue: perEvent.reduce((total, row) => total + row.overdue, 0),
      tasks_unassigned: perEvent.reduce((total, row) => total + row.unassigned, 0) },
    truncated: overdue.length > HOME_TASKS_MAX,
  }
}
```

- [ ] **Step 5: home/routes.ts를 쓴다**

```ts
import { Hono } from 'hono'
import type { HomeResponse } from '@vada/contracts'
import { requireMembership, type MembershipEnv } from '../access/membership.js'
import { requireSession, type SessionReader } from '../auth/require-session.js'
import { homeOf, type HomeDatabase } from './service.js'

// 운영 현황(M6). 구성원 누구나 본다(미배정 포함). 읽기만 한다.
export function createHomeRoutes(db: HomeDatabase, session: SessionReader, { now = () => new Date() }: { now?: () => Date } = {}) {
  const routes = new Hono<MembershipEnv>()
  routes.get('/organizations/:organizationId/home', requireSession(session), requireMembership(db), async c =>
    c.json(await homeOf(db, c.get('membership').organization.id, now()) satisfies HomeResponse))
  return routes
}
```

- [ ] **Step 6: 앱·서버·모듈 목록에 잇는다**

`app.ts`: `import type { createHomeRoutes } from './home/routes.js'`, `AppOptions`에 `// 운영 현황(M6)\n  home?: ReturnType<typeof createHomeRoutes>`, `createApp` 인자에 `home`, `if (reports) …` 다음 줄에 `if (home) app.route('/api', home)`.

`serve.ts`: `import { createHomeRoutes } from './home/routes.js'`, `const reports = …` 다음에 `const home = createHomeRoutes(db, (headers) => auth.api.getSession({ headers }))`, `createApp({ …, reports, home, organization, webhook })`.

`http/boundary.test.ts`와 `events/completion-lock.test.ts`: `import { createHomeRoutes } from '../home/routes.js'`, `modules`에 `home: createHomeRoutes(db, session),`(`reports` 다음). `satisfies Required<…>` 때문에 빠지면 타입 오류가 난다.

`apps/api/package.json`의 `test` 목록에서 `src/tasks/tasks.test.ts` 다음에 `src/home/home.test.ts`를 더한다.

- [ ] **Step 7: 통과를 확인한다**

Run: `npx tsx --test src/home/home.test.ts` (`apps/api`) → 4 passed
Run: `npx tsx --test --test-concurrency=2 src/http/boundary.test.ts src/events/completion-lock.test.ts src/tasks/tasks.test.ts src/app.test.ts` → all passed
Run: `npm run typecheck` → 오류 없음

- [ ] **Step 8: Commit**

```bash
git add apps/api
git commit -m "운영 현황 경로와 업무 집계 더하기"
```

---

### Task 3: 서버 — 구매·지출·신청·정산 집계

**Files:**
- Modify: `apps/api/src/home/service.ts`, `apps/api/src/home/home.test.ts`
- Modify: `apps/api/src/expenses/summaries.ts` (순서 인자), `apps/api/src/registrations/fee.ts` (낼 돈 식 꺼내기)

**Interfaces:**
- Consumes: Task 2의 `homeOf` 뼈대, `financeNumbersByEvent(db, { organizationId }, eventIds)`(`settlement/service.ts`), `expenseSummaries`
- Produces: `expenseSummaries(db, organizationId, where, limit, order: 'newest' | 'oldest' = 'newest')`, `owedSql`(`registrations/fee.ts`), 응답의 나머지 여섯 종류와 `registration`·`settled`

- [ ] **Step 1: 실패하는 테스트를 더한다** (`home.test.ts` 끝)

```ts
test('구매: 승인 대기는 행사마다 수와 가장 오래된 제출, 필요한 날 지남은 받지 않은 승인 품목만 센다', async () => {
  const env = await setupPurchases()
  try {
    await env.pg.exec(`
      INSERT INTO purchase_submissions(id, organization_id, event_id, requester_id, submitted_at) VALUES
        ('s1','a','e','p','2026-10-10T09:00+09'), ('s2','a','e','p','2026-10-11T23:30+09'), ('s3','a','e2','p','2026-10-01T09:00+09');
      INSERT INTO purchase_items(id, organization_id, event_id, requester_id, submission_id, status, product_url) VALUES
        ('i1','a','e','p','s1','pending','u1'), ('i2','a','e','p','s2','pending','u2'), ('i3','a','e','p',NULL,'draft','u3');
      INSERT INTO purchase_items(id, organization_id, event_id, requester_id, submission_id, status, product_url, decided_by, decided_at, needed_by,
        purchased_by, purchased_at, received_by, received_at) VALUES
        ('i4','a','e2','p','s3','approved','u4','f',now(),'2026-10-10',NULL,NULL,NULL,NULL),
        ('i5','a','e2','p','s3','approved','u5','f',now(),'2026-10-08','f',now(),NULL,NULL),
        ('i6','a','e2','p','s3','approved','u6','f',now(),'2026-10-12',NULL,NULL,NULL,NULL),
        ('i7','a','e2','p','s3','approved','u7','f',now(),NULL,NULL,NULL,NULL,NULL),
        ('i8','a','e2','p','s3','approved','u8','f',now(),'2026-10-01','f',now(),'f',now());
    `)
    const home = await env.ok<HomeResponse>(homeApp(env)())
    assert.deepEqual(kinds(home, 'purchases_pending'), [{ kind: 'purchases_pending', eventId: 'e', count: 2, since: '2026-10-10T00:00:00.000Z' }])
    assert.deepEqual(kinds(home, 'purchases_late'), [{ kind: 'purchases_late', eventId: 'e2', count: 2, neededBy: '2026-10-08' }])
    assert.deepEqual([home.counts.purchases_pending, home.counts.purchases_late], [2, 2])
    // 정산한 행사의 필요한 날 지남은 세지 않는다.
    await env.pg.exec(`INSERT INTO event_finances(event_id, organization_id, settled_at, settled_by) VALUES ('e2','a', now(), 'f')`)
    assert.deepEqual(kinds(await env.ok<HomeResponse>(homeApp(env)()), 'purchases_late'), [])
  } finally { await env.pg.close() }
})

test('증빙 없는 지출은 재정 탭과 같은 정의로 오래된 결제부터 주고, 상시 운영 지출도 센다', async () => {
  const env = await setupPurchases()
  try {
    await env.pg.exec(`
      INSERT INTO events(id, organization_id, name, created_by, completed_at, completed_by) VALUES ('e4','a','지난 행사','p', now(), 'l');
      INSERT INTO expenses(id, organization_id, event_id, vendor, description, amount, paid_on, method, payer_id, recorded_by) VALUES
        ('x1','a','e','인쇄소','현수막 인쇄',45000,'2026-10-03','council_card','f','f'),
        ('x2','a',NULL,'문구점','사무용품',8000,'2026-10-01','council_card','f','f'),
        ('x3','a','e','마트','간식',20000,'2026-10-02','council_card','f','f'),
        ('x4','a','e','마트','음료',5000,'2026-10-04','council_card','f','f'),
        ('x5','a','e','취소','취소한 지출',1000,'2026-09-30','council_card','f','f'),
        ('x6','a','e4','지난','완료한 행사 지출',1000,'2026-09-01','council_card','f','f');
      UPDATE expenses SET voided_at = now(), voided_by = 'f', void_reason = '잘못 기록' WHERE id = 'x5';
      INSERT INTO expense_receipts(id, organization_id, expense_id, object_key, file_name, content_type, size_bytes, kind, status, uploaded_by, confirmed_at) VALUES
        ('r1','a','x3','k1','a.pdf','application/pdf',10,'receipt','ready','f',now()),
        ('r2','a','x4','k2','b.pdf','application/pdf',10,'receipt','pending','f',NULL);
    `)
    const home = await env.ok<HomeResponse>(homeApp(env)())
    assert.deepEqual(kinds(home, 'expense_no_evidence').map(item => item.kind === 'expense_no_evidence' && [item.eventId, item.expense.id]),
      [[null, 'x2'], ['e', 'x1'], ['e', 'x4']])
    assert.equal(home.counts.expense_no_evidence, 3)
    env.as('f')
    const finance = await env.ok<{ finance: { missingEvidence: number } }>(env.request('GET', '/events/e/finance'))
    assert.equal(finance.finance.missingEvidence, kinds(home, 'expense_no_evidence').filter(item => item.eventId === 'e').length)
  } finally { await env.pg.close() }
})

test('신청: 신청 수·정원·마감·받는 중을 주고, 입금 확인 전은 낼 돈이 있는 미확인 신청만 정산 전 행사에서 센다', async () => {
  const env = await setupPurchases()
  try {
    const hash = (n: number) => String(n).repeat(64).slice(0, 64)
    await env.pg.exec(`
      INSERT INTO registration_forms(id, organization_id, event_id, closes_at, capacity, fee, member_fee, created_by) VALUES
        ('form','a','e2','2026-10-20T23:59+09',60,10000,0,'p');
      INSERT INTO registrations(id, organization_id, form_id, token_hash, name, student_id, dues_member) VALUES
        ('g1','a','form','${hash(1)}','가학생','20260001',false),
        ('g2','a','form','${hash(2)}','나학생','20260002',true),
        ('g5','a','form','${hash(5)}','마학생','20260005',false);
      INSERT INTO registrations(id, organization_id, form_id, token_hash, name, student_id, dues_member, paid_amount, paid_at, paid_by) VALUES
        ('g3','a','form','${hash(3)}','다학생','20260003',false,10000,now(),'f');
      INSERT INTO registrations(id, organization_id, form_id, created_at, cancelled_at, purged_at, dues_member) VALUES
        ('g4','a','form', now(), now(), now(), false);
    `)
    const home = await env.ok<HomeResponse>(homeApp(env)())
    const festival = home.events.find(entry => entry.event.id === 'e2')!
    assert.deepEqual(festival.registration, { registered: 4, capacity: 60, closesAt: '2026-10-20T23:59', accepting: true })
    assert.deepEqual(kinds(home, 'fees_unconfirmed'), [{ kind: 'fees_unconfirmed', eventId: 'e2', count: 2 }])
    assert.equal(home.counts.fees_unconfirmed, 2)
    await env.pg.exec(`INSERT INTO event_finances(event_id, organization_id, settled_at, settled_by) VALUES ('e2','a', now(), 'f')`)
    const settled = await env.ok<HomeResponse>(homeApp(env)())
    assert.deepEqual([kinds(settled, 'fees_unconfirmed'), settled.counts.fees_unconfirmed], [[], 0])
    assert.equal(settled.events.find(entry => entry.event.id === 'e2')!.settled, true)
  } finally { await env.pg.close() }
})

test('끝난 행사: 정산 전이면 막는 수와 함께, 정산했으면 완료 전으로 준다', async () => {
  const env = await setupPurchases()
  try {
    await env.pg.exec(`
      UPDATE events SET starts_at = '2026-10-01T10:00+09', ends_at = '2026-10-01T18:00+09' WHERE id = 'e';
      UPDATE events SET starts_at = '2026-10-11T18:00+09' WHERE id = 'e2';
      INSERT INTO events(id, organization_id, name, created_by, starts_at) VALUES ('e3','a','학술제','p','2026-11-01T10:00+09');
      INSERT INTO purchase_submissions(id, organization_id, event_id, requester_id) VALUES ('s1','a','e','p');
      INSERT INTO purchase_items(id, organization_id, event_id, requester_id, submission_id, status, product_url) VALUES ('i1','a','e','p','s1','pending','u1');
      INSERT INTO expenses(id, organization_id, event_id, vendor, description, amount, paid_on, method, payer_id, recorded_by) VALUES
        ('x1','a','e','인쇄소','현수막 인쇄',45000,'2026-10-03','council_card','f','f');
      INSERT INTO event_finances(event_id, organization_id, settled_at, settled_by) VALUES ('e2','a', now(), 'f');
    `)
    const home = await env.ok<HomeResponse>(homeApp(env)())
    assert.deepEqual(kinds(home, 'settlement_pending'), [{ kind: 'settlement_pending', eventId: 'e', endedOn: '2026-10-01',
      blockers: { missingEvidence: 1, pendingRequests: 1, unrecordedItems: 0 } }])
    assert.deepEqual(kinds(home, 'completion_pending'), [{ kind: 'completion_pending', eventId: 'e2', endedOn: '2026-10-11' }])
    assert.deepEqual([home.counts.settlement_pending, home.counts.completion_pending], [1, 1])
    assert.deepEqual(home.items.slice(0, 2).map(item => item.kind), ['completion_pending', 'settlement_pending'])
  } finally { await env.pg.close() }
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx tsx --test src/home/home.test.ts` (`apps/api`)
Expected: 새 테스트 4개 FAIL(빈 목록·`registration` null)

- [ ] **Step 3: expenseSummaries에 순서 인자를 더한다** (`expenses/summaries.ts`)

```ts
// 목록·상세·변경 응답이 같은 칸을 쓴다. 증빙은 확인된(ready) 파일만 센다. 운영 현황(M6)은 오래된 결제부터 자른다.
export async function expenseSummaries(db: Reader, organizationId: string, where: SQL | undefined, limit: number,
  order: 'newest' | 'oldest' = 'newest'): Promise<ExpenseSummary[]> {
```

`.orderBy(desc(expenses.paidOn), desc(expenses.createdAt), desc(expenses.id))`를 다음으로 바꾼다.

```ts
    .orderBy(...(order === 'newest' ? [desc(expenses.paidOn), desc(expenses.createdAt), desc(expenses.id)]
      : [asc(expenses.paidOn), asc(expenses.createdAt), asc(expenses.id)])).limit(limit)
```

- [ ] **Step 4: 낼 돈 식을 꺼낸다** (`registrations/fee.ts`)

`eventFeesOf` 위에 두고, 함수 안의 `const owed = sql\`…\``를 `const owed = owedSql`로 바꾼다.

```ts
// 낼 돈 식: 납부자 참가비가 있고 납부자면 납부자 참가비, 아니면 참가비(owedOf와 같다). 운영 현황(M6)의 입금 확인 전도 쓴다.
export const owedSql = sql`CASE WHEN ${registrationForms.memberFee} IS NOT NULL AND ${registrations.duesMember}
  THEN ${registrationForms.memberFee} ELSE ${registrationForms.fee} END`
```

- [ ] **Step 5: home/service.ts에 돈 집계를 더한다**

import에 `notExists, or`, `HOME_EXPENSES_MAX`, `eventFinances, expenseReceipts, expenses, purchaseItems, purchaseSubmissions, registrationForms, registrations`, `expenseSummaries`, `owedSql`, `financeNumbersByEvent`를 더한다. `const work = …` 앞에 다음을 넣는다.

```ts
  // 정산(M2-2). 정리 중(끝남)인 행사만 정산·완료를 기다린다. 필요한 날 지남·입금 확인 전은 정산 전 행사만 센다.
  const finances = await db.select({ eventId: eventFinances.eventId, settledAt: eventFinances.settledAt }).from(eventFinances)
    .where(and(eq(eventFinances.organizationId, organizationId), inArray(eventFinances.eventId, ids)))
  const settled = new Set(finances.filter(row => row.settledAt !== null).map(row => row.eventId))
  const unsettled = ids.filter(id => !settled.has(id))
  const phases = new Map(active.map(event => [event.id, eventPhaseOf(event, moment) as HomeEvent['phase']]))
  const ended = active.filter(event => phases.get(event.id) === 'wrapping')
  const blockers = await financeNumbersByEvent(db, { organizationId }, ended.filter(event => !settled.has(event.id)).map(event => event.id))
  // 끝난 한국 날짜: 끝 일시가 있으면 그 날, 없으면 시작한 날(정리 중이면 시작이 있다)
  const endedOn = (event: (typeof active)[number]) => (event.endsAt ?? event.startsAt!).slice(0, 10)

  // 구매(M1). 승인 대기는 가장 오래된 제출부터, 필요한 날 지남은 승인했고 받지 않았고 필요한 날이 오늘보다 앞인 품목이다.
  const pending = await db.select({ eventId: purchaseItems.eventId, count: sql<number>`count(*)::int`,
    since: sql<Date>`min(${purchaseSubmissions.submittedAt})`.mapWith(purchaseSubmissions.submittedAt) }).from(purchaseItems)
    .innerJoin(purchaseSubmissions, and(eq(purchaseSubmissions.organizationId, purchaseItems.organizationId),
      eq(purchaseSubmissions.id, purchaseItems.submissionId)))
    .where(and(eq(purchaseItems.organizationId, organizationId), inArray(purchaseItems.eventId, ids), eq(purchaseItems.status, 'pending')))
    .groupBy(purchaseItems.eventId)
  const late = await db.select({ eventId: purchaseItems.eventId, count: sql<number>`count(*)::int`,
    neededBy: sql<string>`min(${purchaseItems.neededBy})::text` }).from(purchaseItems)
    .where(and(eq(purchaseItems.organizationId, organizationId), inArray(purchaseItems.eventId, unsettled), eq(purchaseItems.status, 'approved'),
      isNull(purchaseItems.receivedAt), lt(purchaseItems.neededBy, today)))
    .groupBy(purchaseItems.eventId)

  // 증빙 없는 지출(M2-1, 재정 탭·사용 내역과 같은 정의). 상시 운영 지출도 센다. 오래된 결제부터 준다.
  const missing = and(isNull(expenses.voidedAt), or(isNull(expenses.eventId), inArray(expenses.eventId, ids)),
    notExists(db.select({ one: sql`1` }).from(expenseReceipts)
      .where(and(eq(expenseReceipts.expenseId, expenses.id), eq(expenseReceipts.status, 'ready')))))
  const noEvidence = await expenseSummaries(db, organizationId, missing, HOME_EXPENSES_MAX + 1, 'oldest')
  const [missingTotal] = await db.select({ count: sql<number>`count(*)::int` }).from(expenses)
    .where(and(eq(expenses.organizationId, organizationId), missing))

  // 참가 신청(M3)과 입금 확인 전(참가자 탭의 "입금 전"과 같다). 신청자가 없으면 LEFT JOIN의 빈 줄은 신청 ID가 없어 세지 않는다.
  const forms = await db.select({ eventId: registrationForms.eventId, capacity: registrationForms.capacity, closesAt: registrationForms.closesAt,
    accepting: registrationForms.accepting,
    registered: sql<number>`(count(${registrations.id}) filter (where ${registrations.cancelledAt} is null))::int`,
    unconfirmed: sql<number>`(count(*) filter (where ${registrations.id} is not null and ${registrations.purgedAt} is null
      and ${registrations.paidAt} is null and ${owedSql} > 0))::int` }).from(registrationForms)
    .leftJoin(registrations, eq(registrations.formId, registrationForms.id))
    .where(and(eq(registrationForms.organizationId, organizationId), inArray(registrationForms.eventId, ids)))
    .groupBy(registrationForms.id)
  const formOf = new Map(forms.map(row => [row.eventId, row]))
  const fees = forms.filter(row => !settled.has(row.eventId) && row.unconfirmed > 0)
    .sort((a, b) => position.get(a.eventId)! - position.get(b.eventId)!)
```

`events` 만들기의 `phase`·`registration`·`settled`를 다음으로 바꾼다.

```ts
    const form = formOf.get(event.id)
    return { event, phase: phases.get(event.id)!,
      tasks: { total: row?.total ?? 0, done: row?.done ?? 0, overdue: row?.overdue ?? 0, unassigned: row?.unassigned ?? 0 },
      registration: form ? { registered: form.registered, capacity: form.capacity, closesAt: koreanOf(form.closesAt), accepting: form.accepting } : null,
      settled: settled.has(event.id) }
```

`items` 채우기를 `HOME_ITEM_KINDS` 순서로 바꾼다(지연 업무 앞에 행사 마무리, 담당자 없음 뒤에 돈).

```ts
  const items: HomeItem[] = []
  for (const event of ended.filter(entry => settled.has(entry.id))) {
    items.push({ kind: 'completion_pending', eventId: event.id, endedOn: endedOn(event) })
  }
  for (const event of ended.filter(entry => !settled.has(entry.id))) {
    const numbers = blockers.get(event.id)!
    items.push({ kind: 'settlement_pending', eventId: event.id, endedOn: endedOn(event),
      blockers: { missingEvidence: numbers.missingEvidence, pendingRequests: numbers.pendingRequests, unrecordedItems: numbers.unrecordedItems } })
  }
  for (const task of overdue.slice(0, HOME_TASKS_MAX)) items.push({ kind: 'task_overdue', eventId: task.event.id, task })
  // (담당자 없는 업무 정렬과 push는 Task 2 그대로)
  for (const row of pending.sort((a, b) => a.since.getTime() - b.since.getTime())) {
    items.push({ kind: 'purchases_pending', eventId: row.eventId, count: row.count, since: row.since.toISOString() })
  }
  for (const row of late.sort((a, b) => a.neededBy.localeCompare(b.neededBy))) {
    items.push({ kind: 'purchases_late', eventId: row.eventId, count: row.count, neededBy: row.neededBy })
  }
  for (const expense of noEvidence.slice(0, HOME_EXPENSES_MAX)) items.push({ kind: 'expense_no_evidence', eventId: expense.event?.id ?? null, expense })
  for (const row of fees) items.push({ kind: 'fees_unconfirmed', eventId: row.eventId, count: row.unconfirmed })
```

`return` 앞에 `const total = (list: { count: number }[]) => list.reduce((sum, row) => sum + row.count, 0)`을 두고, `counts`와 `truncated`를 다음으로 바꾼다.

```ts
    counts: {
      completion_pending: items.filter(item => item.kind === 'completion_pending').length,
      settlement_pending: items.filter(item => item.kind === 'settlement_pending').length,
      task_overdue: perEvent.reduce((sum, row) => sum + row.overdue, 0),
      tasks_unassigned: perEvent.reduce((sum, row) => sum + row.unassigned, 0),
      purchases_pending: total(pending), purchases_late: total(late),
      expense_no_evidence: missingTotal?.count ?? 0,
      fees_unconfirmed: fees.reduce((sum, row) => sum + row.unconfirmed, 0),
    },
    truncated: overdue.length > HOME_TASKS_MAX || noEvidence.length > HOME_EXPENSES_MAX,
```

- [ ] **Step 6: 통과를 확인한다**

Run: `npx tsx --test src/home/home.test.ts` → 8 passed
Run: `npx tsx --test --test-concurrency=2 src/expenses/expenses.test.ts src/registrations/payments.test.ts src/settlement/fee-income.test.ts src/fees/fees.test.ts` → all passed
Run: `npm run typecheck` → 오류 없음

- [ ] **Step 7: Commit**

```bash
git add apps/api
git commit -m "운영 현황에 구매·지출·신청·정산 집계 더하기"
```

---

### Task 4: 화면 — 운영 현황 계산(home-view)

**Files:**
- Create: `apps/web/src/home/home-view.ts`, `apps/web/src/home/home-view.test.ts`, `apps/web/src/home/home-fixtures.ts`

**Interfaces:**
- Consumes: Task 1 타입, `dueText`·`dDayText`(`tasks/task-view.ts`), `todayInSeoul`(`purchases/purchase-view.ts`)
- Produces:
  - `type HomeView = 'events' | 'departments'`, `type HomeTab = 'tasks' | 'purchases' | 'registrations' | 'finance'`
  - `type HomeTarget = { type: 'task'; eventId: string; taskId: string } | { type: 'expense'; expenseId: string } | { type: 'review' } | { type: 'event'; eventId: string; tab: HomeTab }`
  - `daysSince(day, today): number`, `summaryChips(counts): string[]`, `ownerIdsOf(item, departments): string[]`, `itemKey(item): string`
  - `rowOf(item, view, data: Pick<HomeResponse, 'today' | 'events' | 'departments'>): { title: string; detail: string }`
  - `targetOf(item, permissions: Pick<MembershipPermissions, 'approvePurchases' | 'manageEvents'>): HomeTarget`
  - `eventGroupsOf(data): { key: string; home: HomeEvent | null; items: HomeItem[] }[]`
  - `departmentGroupsOf(data): { key: string; name: string; tasks: HomeTaskCounts; items: HomeItem[] }[]`
  - `taskCountsText(tasks): string`, `eventLineOf(home, today): string`, `statusChipsOf(home, now): string[]`
  - fixtures: `homeResponse(overrides)`, `homeEvent(overrides)`, `homeDepartment(overrides)`, `noCounts()`

- [ ] **Step 1: fixtures를 쓴다** (`home-fixtures.ts`)

```ts
import { HOME_ITEM_KINDS, type HomeDepartment, type HomeEvent, type HomeResponse } from '@vada/contracts'
import { event } from '../test-support/workflow-fixtures'

// 운영 현황 화면 테스트용 고정값. 오늘은 2026-10-12, 행사는 10월 20일 체육대회(기획 중)다.
export const noCounts = () => Object.fromEntries(HOME_ITEM_KINDS.map(kind => [kind, 0])) as HomeResponse['counts']
export const homeEvent = (overrides: Partial<HomeEvent> = {}): HomeEvent => ({
  event: { ...event(), startsAt: '2026-10-20T10:00', endsAt: '2026-10-20T18:00' }, phase: 'planning',
  tasks: { total: 0, done: 0, overdue: 0, unassigned: 0 }, registration: null, settled: false, ...overrides })
export const homeDepartment = (overrides: Partial<HomeDepartment> = {}): HomeDepartment => ({ id: 'dp', name: '기획부', isLeadership: false,
  handlesFinance: false, tasks: { open: 0, overdue: 0, done: 0 }, ...overrides })
export const departments = () => [homeDepartment({ id: 'dl', name: '회장단', isLeadership: true }), homeDepartment(),
  homeDepartment({ id: 'df', name: '총무부', handlesFinance: true })]
export const homeResponse = (overrides: Partial<HomeResponse> = {}): HomeResponse => ({ today: '2026-10-12', events: [], departments: departments(),
  unownedTasks: { open: 0, overdue: 0, done: 0 }, items: [], counts: noCounts(), truncated: false, ...overrides })
```

- [ ] **Step 2: 실패하는 테스트를 쓴다** (`home-view.test.ts`)

```ts
import { expect, test } from 'vitest'
import type { HomeItem } from '@vada/contracts'
import { expense } from '../expenses/expense-fixtures'
import { taskSummary } from '../tasks/task-fixtures'
import { departments, homeDepartment, homeEvent, homeResponse, noCounts } from './home-fixtures'
import { daysSince, departmentGroupsOf, eventGroupsOf, eventLineOf, ownerIdsOf, rowOf, statusChipsOf, summaryChips, targetOf,
  taskCountsText } from './home-view'

const overdue: HomeItem = { kind: 'task_overdue', eventId: 'e', task: taskSummary({ id: 't1', event: { id: 'e', name: '체육대회' }, dueOn: '2026-10-09',
  department: { id: 'dp', name: '기획부' } }) }
const pending: HomeItem = { kind: 'purchases_pending', eventId: 'e', count: 3, since: '2026-10-11T14:30:00.000Z' }
const noEvidence: HomeItem = { kind: 'expense_no_evidence', eventId: null, expense: expense({ id: 'x1', event: null, description: '사무용품',
  amount: 8000, paidOn: '2026-10-03', payer: { id: 'f', name: '박재정' } }) }
const data = homeResponse({ events: [homeEvent()] })

test('날수는 한국 날짜끼리 센다', () => {
  expect(daysSince('2026-10-09', '2026-10-12')).toBe(3)
  expect(daysSince('2026-10-12', '2026-10-12')).toBe(0)
  expect(daysSince('2026-09-30', '2026-10-01')).toBe(1)
})

test('종류별 수는 업무 → 돈 → 행사 마무리 순이고 0은 감춘다', () => {
  expect(summaryChips({ ...noCounts(), completion_pending: 1, task_overdue: 3, fees_unconfirmed: 5 }))
    .toEqual(['지연 업무 3', '입금 확인 전 5명', '완료 전 행사 1'])
  expect(summaryChips(noCounts())).toEqual([])
})

test('할 차례: 업무는 그 업무의 부서, 돈은 재정 부서(없으면 회장단), 완료는 회장단이다', () => {
  expect(ownerIdsOf(overdue, departments())).toEqual(['dp'])
  expect(ownerIdsOf({ ...overdue, task: taskSummary({ department: null }) }, departments())).toEqual([])
  expect(ownerIdsOf(pending, departments())).toEqual(['df'])
  expect(ownerIdsOf(pending, [...departments(), homeDepartment({ id: 'dg', name: '재무부', handlesFinance: true })])).toEqual(['df', 'dg'])
  expect(ownerIdsOf(pending, departments().filter(department => !department.handlesFinance))).toEqual(['dl'])
  expect(ownerIdsOf(pending, [homeDepartment()])).toEqual([])
  expect(ownerIdsOf({ kind: 'completion_pending', eventId: 'e', endedOn: '2026-10-01' }, departments())).toEqual(['dl'])
  // 목록에 없는 부서는 버린다.
  expect(ownerIdsOf({ kind: 'tasks_unassigned', eventId: 'e', department: { id: 'gone', name: '없는 부서' }, count: 1 }, departments())).toEqual([])
  expect(ownerIdsOf({ ...overdue, task: taskSummary({ department: { id: 'gone', name: '없는 부서' } }) }, departments())).toEqual([])
})

test('줄 글: 행사별은 할 차례, 부서별은 행사 이름을 앞에 둔다', () => {
  expect(rowOf(overdue, 'events', data)).toEqual({ title: '현수막 디자인', detail: '기획부 · 윤태민 · 3일 지남' })
  expect(rowOf(overdue, 'departments', data)).toEqual({ title: '현수막 디자인', detail: '체육대회 · 윤태민 · 3일 지남' })
  expect(rowOf({ ...overdue, task: taskSummary({ dueOn: '2026-10-11', assignee: null, department: null }) }, 'events', data).detail)
    .toBe('담당 부서 없음 · 담당자 없음 · 1일 지남')
  expect(rowOf({ kind: 'tasks_unassigned', eventId: 'e', department: null, count: 2 }, 'events', data))
    .toEqual({ title: '담당자 없는 업무 2건', detail: '담당 부서 없음' })
  // 한국 시각 10월 11일 23:30에 낸 것은 다음 날 "1일 전 제출"이다(UTC로는 같은 날 14:30).
  expect(rowOf(pending, 'events', data)).toEqual({ title: '구매 승인 대기 3건', detail: '총무부 · 1일 전 제출' })
  expect(rowOf({ ...pending, since: '2026-10-12T00:10:00.000Z' }, 'events', data).detail).toBe('총무부 · 오늘 제출')
  expect(rowOf({ kind: 'purchases_late', eventId: 'e', count: 2, neededBy: '2026-10-10' }, 'events', data))
    .toEqual({ title: '필요한 날 지난 구매 2건', detail: '총무부 · 필요한 날 10.10' })
  expect(rowOf(noEvidence, 'events', data)).toEqual({ title: '증빙 없음 · 사무용품', detail: '총무부 · 8,000원 · 박재정 결제 · 10.3' })
  expect(rowOf(noEvidence, 'departments', data).detail).toBe('상시 운영 지출 · 8,000원 · 박재정 결제 · 10.3')
  expect(rowOf({ kind: 'fees_unconfirmed', eventId: 'e', count: 5 }, 'events', data)).toEqual({ title: '입금 확인 전 5명', detail: '총무부' })
  expect(rowOf({ kind: 'settlement_pending', eventId: 'e', endedOn: '2026-09-27', blockers: { missingEvidence: 1, pendingRequests: 0, unrecordedItems: 2 } },
    'events', data)).toEqual({ title: '정산 전 · 끝난 지 15일', detail: '총무부 · 증빙 없는 지출 1 · 지출 기록 전 품목 2' })
  expect(rowOf({ kind: 'settlement_pending', eventId: 'e', endedOn: '2026-10-12', blockers: { missingEvidence: 0, pendingRequests: 0, unrecordedItems: 0 } },
    'events', data)).toEqual({ title: '정산 전 · 오늘 끝남', detail: '총무부 · 정산할 수 있어요' })
  expect(rowOf({ kind: 'completion_pending', eventId: 'e', endedOn: '2026-09-27' }, 'events', data))
    .toEqual({ title: '정산 끝, 완료 전', detail: '회장단 · 끝난 지 15일' })
})

test('누르면: 업무·지출은 상세, 구매는 권한에 따라 구매 검토나 행사 구매 탭, 입금 확인 전은 부서가 있으면 참가자 탭', () => {
  const finance = { approvePurchases: true, manageEvents: true }
  const member = { approvePurchases: false, manageEvents: true }
  const unassigned = { approvePurchases: false, manageEvents: false }
  expect(targetOf(overdue, member)).toEqual({ type: 'task', eventId: 'e', taskId: 't1' })
  expect(targetOf(noEvidence, member)).toEqual({ type: 'expense', expenseId: 'x1' })
  expect(targetOf(pending, finance)).toEqual({ type: 'review' })
  expect(targetOf(pending, member)).toEqual({ type: 'event', eventId: 'e', tab: 'purchases' })
  const fees: HomeItem = { kind: 'fees_unconfirmed', eventId: 'e', count: 5 }
  expect(targetOf(fees, member)).toEqual({ type: 'event', eventId: 'e', tab: 'registrations' })
  expect(targetOf(fees, unassigned)).toEqual({ type: 'event', eventId: 'e', tab: 'finance' })
  expect(targetOf({ kind: 'tasks_unassigned', eventId: 'e', department: null, count: 1 }, member)).toEqual({ type: 'event', eventId: 'e', tab: 'tasks' })
  expect(targetOf({ kind: 'completion_pending', eventId: 'e', endedOn: '2026-10-01' }, finance)).toEqual({ type: 'event', eventId: 'e', tab: 'finance' })
})

test('행사별은 행사 순서대로 묶고 상시 운영 지출은 맨 뒤, 부서별은 할 차례로 묶고 담당 부서 없음은 맨 뒤다', () => {
  const second = homeEvent({ event: { ...homeEvent().event, id: 'e2', name: '축제' } })
  const unowned: HomeItem = { ...overdue, task: taskSummary({ id: 't9', department: null }) }
  const both = homeResponse({ events: [homeEvent(), second], items: [overdue, pending, unowned, noEvidence] })
  expect(eventGroupsOf(both).map(group => [group.key, group.items.length])).toEqual([['e', 3], ['e2', 0], ['operating', 1]])
  expect(departmentGroupsOf(both).map(group => [group.name, group.items.length])).toEqual([['회장단', 0], ['기획부', 1], ['총무부', 2], ['담당 부서 없음', 1]])
  expect(departmentGroupsOf(homeResponse()).map(group => group.name)).toEqual(['회장단', '기획부', '총무부'])
  expect(departmentGroupsOf(homeResponse({ unownedTasks: { open: 1, overdue: 0, done: 0 } })).at(-1)!.name).toBe('담당 부서 없음')
  expect(taskCountsText({ open: 5, overdue: 1, done: 12 })).toBe('할 일 5 · 지연 1 · 완료 12')
})

test('행사 카드: 날짜(D-n)와 담당, 상태 칩', () => {
  const home = homeEvent({ event: { ...homeEvent().event, ownerDepartment: { id: 'dp', name: '기획부' }, owner: { membershipId: 'm', name: '정민재' } },
    tasks: { total: 10, done: 6, overdue: 1, unassigned: 0 },
    registration: { registered: 47, capacity: 60, closesAt: '2026-10-15T23:59', accepting: true }, settled: false })
  expect(eventLineOf(home, '2026-10-12')).toBe('10.20 (D-8) · 기획부 · 정민재')
  expect(eventLineOf(homeEvent({ event: { ...homeEvent().event, startsAt: null, endsAt: null } }), '2026-10-12')).toBe('날짜 미정')
  expect(statusChipsOf(home, '2026-10-12T12:00')).toEqual(['업무 6/10', '신청 47/60명', '신청 마감 10.15'])
  expect(statusChipsOf({ ...home, registration: { ...home.registration!, capacity: null, accepting: false }, settled: true }, '2026-10-12T12:00'))
    .toEqual(['업무 6/10', '신청 47명', '정산함'])
  expect(statusChipsOf({ ...home, registration: home.registration }, '2026-10-16T00:00')).toEqual(['업무 6/10', '신청 47/60명'])
})
```

- [ ] **Step 3: 실패를 확인한다**

Run: `npx vitest run src/home/home-view.test.ts` (`apps/web`)
Expected: FAIL — `Failed to resolve import "./home-view"`

- [ ] **Step 4: home-view.ts를 쓴다**

```ts
import type { HomeDepartment, HomeEvent, HomeItem, HomeItemKind, HomeResponse, HomeTaskCounts, MembershipPermissions } from '@vada/contracts'
import { todayInSeoul } from '../purchases/purchase-view'
import { dDayText, dueText } from '../tasks/task-view'

export type HomeView = 'events' | 'departments'
// 행사 화면에서 열 탭. EventWorkspace의 탭 이름과 같다.
export type HomeTab = 'tasks' | 'purchases' | 'registrations' | 'finance'
export type HomeTarget = { type: 'task'; eventId: string; taskId: string } | { type: 'expense'; expenseId: string } | { type: 'review' }
  | { type: 'event'; eventId: string; tab: HomeTab }
type Data = Pick<HomeResponse, 'today' | 'events' | 'departments'>

const dayNumber = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 86_400_000
// 그날(한국 날짜 YYYY-MM-DD)부터 today까지 지난 날수
export const daysSince = (day: string, today: string) => dayNumber(today) - dayNumber(day)
const won = (amount: number) => `${amount.toLocaleString('ko-KR')}원`

// 위쪽 종류별 수. 업무 → 돈 → 행사 마무리 순이다. 0은 감춘다.
const summaryOrder: HomeItemKind[] = ['task_overdue', 'tasks_unassigned', 'purchases_pending', 'purchases_late', 'expense_no_evidence',
  'fees_unconfirmed', 'settlement_pending', 'completion_pending']
const summaryLabels: Record<HomeItemKind, string> = { task_overdue: '지연 업무', tasks_unassigned: '담당자 없는 업무',
  purchases_pending: '구매 승인 대기', purchases_late: '필요한 날 지난 구매', expense_no_evidence: '증빙 없는 지출', fees_unconfirmed: '입금 확인 전',
  settlement_pending: '정산 전 행사', completion_pending: '완료 전 행사' }
export const summaryChips = (counts: Record<HomeItemKind, number>) => summaryOrder.filter(kind => counts[kind] > 0)
  .map(kind => `${summaryLabels[kind]} ${counts[kind]}${kind === 'fees_unconfirmed' ? '명' : ''}`)

// 할 차례(spec 정책 3). 업무는 그 업무의 담당 부서, 돈 관련 일은 재정 부서(없으면 회장단), 행사 완료는 회장단이다.
// 빈 배열은 "담당 부서 없음"이다. 목록에 없는 부서는 버린다.
export function ownerIdsOf(item: HomeItem, departments: HomeDepartment[]): string[] {
  const known = (id: string | undefined) => id !== undefined && departments.some(department => department.id === id) ? [id] : []
  const leadership = departments.filter(department => department.isLeadership).map(department => department.id)
  if (item.kind === 'task_overdue') return known(item.task.department?.id)
  if (item.kind === 'tasks_unassigned') return known(item.department?.id)
  if (item.kind === 'completion_pending') return leadership
  const finance = departments.filter(department => department.handlesFinance).map(department => department.id)
  return finance.length ? finance : leadership
}
function ownerNames(item: HomeItem, departments: HomeDepartment[]) {
  const names = ownerIdsOf(item, departments).map(id => departments.find(department => department.id === id)!.name)
  return names.length ? names.join('·') : '담당 부서 없음'
}
// 목록의 key. 같은 종류 안에서 겹치지 않는다.
export function itemKey(item: HomeItem) {
  if (item.kind === 'task_overdue') return `${item.kind}:${item.task.id}`
  if (item.kind === 'expense_no_evidence') return `${item.kind}:${item.expense.id}`
  if (item.kind === 'tasks_unassigned') return `${item.kind}:${item.eventId}:${item.department?.id ?? ''}`
  return `${item.kind}:${item.eventId}`
}

// 줄 하나의 글. 행사별은 할 차례(부서, 업무는 담당자까지)를, 부서별은 행사 이름을 앞에 둔다.
export function rowOf(item: HomeItem, view: HomeView, data: Data): { title: string; detail: string } {
  const eventName = item.eventId === null ? '상시 운영 지출' : data.events.find(home => home.event.id === item.eventId)?.event.name ?? ''
  const who = item.kind === 'task_overdue' ? [item.task.assignee?.name ?? '담당자 없음'] : []
  // 업무는 그 업무에 적힌 부서 이름을 쓴다. 돈·완료는 할 차례인 부서 이름이다.
  const owner = item.kind === 'task_overdue' ? item.task.department?.name ?? '담당 부서 없음'
    : item.kind === 'tasks_unassigned' ? item.department?.name ?? '담당 부서 없음' : ownerNames(item, data.departments)
  const context = [view === 'events' ? owner : eventName, ...who]
  const line = (...parts: string[]) => [...context, ...parts].join(' · ')
  const ago = (day: string, today: string, many: (days: number) => string) => {
    const days = daysSince(day, data.today)
    return days <= 0 ? today : many(days)
  }
  switch (item.kind) {
    case 'task_overdue': return { title: item.task.title, detail: line(`${daysSince(item.task.dueOn!, data.today)}일 지남`) }
    case 'tasks_unassigned': return { title: `담당자 없는 업무 ${item.count}건`, detail: line() }
    case 'purchases_pending': return { title: `구매 승인 대기 ${item.count}건`,
      detail: line(ago(todayInSeoul(new Date(item.since)), '오늘 제출', days => `${days}일 전 제출`)) }
    case 'purchases_late': return { title: `필요한 날 지난 구매 ${item.count}건`, detail: line(`필요한 날 ${dueText(item.neededBy)}`) }
    case 'expense_no_evidence': return { title: `증빙 없음 · ${item.expense.description}`,
      detail: line(won(item.expense.amount), `${item.expense.payer.name} 결제`, dueText(item.expense.paidOn)) }
    case 'fees_unconfirmed': return { title: `입금 확인 전 ${item.count}명`, detail: line() }
    case 'settlement_pending': {
      const { missingEvidence, pendingRequests, unrecordedItems } = item.blockers
      const blocking = [missingEvidence ? `증빙 없는 지출 ${missingEvidence}` : '', pendingRequests ? `승인 대기 ${pendingRequests}` : '',
        unrecordedItems ? `지출 기록 전 품목 ${unrecordedItems}` : ''].filter(Boolean)
      return { title: ago(item.endedOn, '정산 전 · 오늘 끝남', days => `정산 전 · 끝난 지 ${days}일`),
        detail: line(...(blocking.length ? blocking : ['정산할 수 있어요'])) }
    }
    case 'completion_pending': return { title: '정산 끝, 완료 전', detail: line(ago(item.endedOn, '오늘 끝남', days => `끝난 지 ${days}일`)) }
  }
}

// 줄을 누르면 갈 곳(spec 화면 표). 업무·지출은 홈에서 상세를 연다.
export function targetOf(item: HomeItem, permissions: Pick<MembershipPermissions, 'approvePurchases' | 'manageEvents'>): HomeTarget {
  switch (item.kind) {
    case 'task_overdue': return { type: 'task', eventId: item.eventId, taskId: item.task.id }
    case 'expense_no_evidence': return { type: 'expense', expenseId: item.expense.id }
    case 'tasks_unassigned': return { type: 'event', eventId: item.eventId, tab: 'tasks' }
    case 'purchases_pending':
    case 'purchases_late': return permissions.approvePurchases ? { type: 'review' } : { type: 'event', eventId: item.eventId, tab: 'purchases' }
    case 'fees_unconfirmed': return { type: 'event', eventId: item.eventId, tab: permissions.manageEvents ? 'registrations' : 'finance' }
    case 'settlement_pending':
    case 'completion_pending': return { type: 'event', eventId: item.eventId, tab: 'finance' }
  }
}

// 행사별: 행사 순서대로, 상시 운영 지출의 증빙 없음은 맨 뒤 카드
export function eventGroupsOf(data: HomeResponse): { key: string; home: HomeEvent | null; items: HomeItem[] }[] {
  const groups = data.events.map(home => ({ key: home.event.id, home, items: data.items.filter(item => item.eventId === home.event.id) }))
  const operating = data.items.filter(item => item.eventId === null)
  return operating.length ? [...groups, { key: 'operating', home: null, items: operating }] : groups
}
// 부서별: 부서 순서대로 할 차례인 줄을 모은다. 담당 부서 없음은 줄이나 업무가 있을 때만 맨 뒤에 둔다.
export function departmentGroupsOf(data: HomeResponse): { key: string; name: string; tasks: HomeTaskCounts; items: HomeItem[] }[] {
  const groups = data.departments.map(department => ({ key: department.id, name: department.name, tasks: department.tasks,
    items: data.items.filter(item => ownerIdsOf(item, data.departments).includes(department.id)) }))
  const unowned = data.items.filter(item => ownerIdsOf(item, data.departments).length === 0)
  const { open, done } = data.unownedTasks
  return unowned.length || open || done ? [...groups, { key: 'none', name: '담당 부서 없음', tasks: data.unownedTasks, items: unowned }] : groups
}
export const taskCountsText = ({ open, overdue, done }: HomeTaskCounts) => `할 일 ${open} · 지연 ${overdue} · 완료 ${done}`

// 행사 카드 둘째 줄: 날짜(D-n)와 담당 부서·책임자
export function eventLineOf(home: HomeEvent, today: string) {
  const { startsAt, ownerDepartment, owner } = home.event
  const day = startsAt ? `${dueText(startsAt.slice(0, 10))} (${dDayText(startsAt, today)})` : '날짜 미정'
  return [day, ownerDepartment?.name, owner?.name].filter(Boolean).join(' · ')
}
// 상태 칩: 업무 완료 수, 신청 수(정원), 받는 중이고 마감 전이면 신청 마감, 정산함. now는 한국 시각 YYYY-MM-DDTHH:mm이다.
export function statusChipsOf(home: HomeEvent, now: string) {
  const chips: string[] = []
  if (home.tasks.total) chips.push(`업무 ${home.tasks.done}/${home.tasks.total}`)
  const form = home.registration
  if (form) {
    chips.push(form.capacity === null ? `신청 ${form.registered}명` : `신청 ${form.registered}/${form.capacity}명`)
    if (form.accepting && now < form.closesAt) chips.push(`신청 마감 ${dueText(form.closesAt.slice(0, 10))}`)
  }
  if (home.settled) chips.push('정산함')
  return chips
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run src/home/home-view.test.ts` → 8 passed

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/home
git commit -m "운영 현황의 줄 글·할 차례·묶기 계산 더하기"
```

---

### Task 5: 화면 — 운영 현황 화면과 업무 상세 묶음

**Files:**
- Create: `apps/web/src/home/useHome.ts`, `apps/web/src/home/Home.tsx`, `apps/web/src/home/Home.test.tsx`, `apps/web/src/tasks/TaskDialogs.tsx`
- Modify: `apps/web/src/tasks/MyTasks.tsx` (상세·수정 대화상자를 `TaskDialogs`로)

**Interfaces:**
- Consumes: Task 4의 home-view 함수, `TaskDetailDialog`·`TaskFormDialog`, `ExpenseDetailDialog`, `useOrganizationMembers`
- Produces: `Home` props `{ organizationId: string; permissions: MembershipPermissions; onOpenEvent: (eventId: string, tab?: HomeTab) => void; onOpenReview: () => void; onCreateEvent: () => void; onTasksChanged: () => void }`, `TaskDialogs` props `{ organizationId; manageEvents; target: { eventId: string; taskId: string } | null; onClose; onChanged: () => void; onOpenEvent: (eventId: string) => void }`, `useHome(organizationId)` → `{ data: HomeResponse | null; loadError: boolean; refresh: () => void }`

- [ ] **Step 1: TaskDialogs로 꺼낸다** (`tasks/TaskDialogs.tsx`)

```tsx
import { useState } from 'react'
import type { TaskDetail } from '@vada/contracts'
import { useOrganizationMembers } from '../organization/useOrganizationMembers'
import TaskDetailDialog from './TaskDetailDialog'
import TaskFormDialog from './TaskFormDialog'

type Props = {
  organizationId: string
  // 부서가 있는 구성원. 아니면 보기만 한다.
  manageEvents: boolean
  target: { eventId: string; taskId: string } | null
  onClose: () => void
  // 상태를 바꾸거나 고치거나 지우면 부른다.
  onChanged: () => void
  // 상세의 [행사로 가기]
  onOpenEvent: (eventId: string) => void
}

// 업무 상세와 그 자리 수정(내 업무 M4, 운영 현황 M6). 상세에서 [수정]을 누르면 같은 자리에서 수정 대화상자를 연다.
export default function TaskDialogs({ organizationId, manageEvents, target, onClose, onChanged, onOpenEvent }: Props) {
  const [editing, setEditing] = useState<TaskDetail | null>(null)
  // 수정을 열 때 구성원 목록을 불러온다(부서·담당자 고르기).
  const directory = useOrganizationMembers(organizationId, editing !== null)
  return <>
    <TaskDetailDialog organizationId={organizationId} target={target} manageEvents={manageEvents} onClose={onClose} onChanged={onChanged}
      onDeleted={() => { onClose(); onChanged() }} onEdit={task => { onClose(); setEditing(task); directory.refresh() }}
      onOpenEvent={eventId => { onClose(); onOpenEvent(eventId) }} />
    <TaskFormDialog open={editing !== null} organizationId={organizationId} eventId={editing?.event.id ?? ''} task={editing} directory={directory.data}
      directoryError={directory.loadError} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged() }} />
  </>
}
```

`MyTasks.tsx`에서 `editing` 상태, `directory`, `TaskDetailDialog`·`TaskFormDialog`·`useOrganizationMembers` import, `goToEvent`를 지우고 끝의 두 대화상자를 다음 하나로 바꾼다.

```tsx
    <TaskDialogs organizationId={organizationId} manageEvents={manageEvents} target={opened ? { eventId: opened.event.id, taskId: opened.id } : null}
      onClose={() => setOpened(null)} onChanged={state.refresh} onOpenEvent={onOpenEvent} />
```

Run: `npx vitest run src/tasks` (`apps/web`) → 기존 테스트 all passed (동작이 같다)

- [ ] **Step 2: 실패하는 화면 테스트를 쓴다** (`home/Home.test.tsx`)

```tsx
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { HomeItem, HomeResponse, MembershipPermissions } from '@vada/contracts'
import { expense } from '../expenses/expense-fixtures'
import { taskDetail, taskSummary } from '../tasks/task-fixtures'
import Home from './Home'
import { homeEvent, homeResponse, noCounts } from './home-fixtures'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const leader: MembershipPermissions = { manageOrganization: true, approvePurchases: true, manageEvents: true }
const unassigned: MembershipPermissions = { manageOrganization: false, approvePurchases: false, manageEvents: false }
const overdue: HomeItem = { kind: 'task_overdue', eventId: 'e', task: taskSummary({ id: 't1', event: { id: 'e', name: '체육대회' }, dueOn: '2026-10-09',
  department: { id: 'dp', name: '기획부' } }) }
const pending: HomeItem = { kind: 'purchases_pending', eventId: 'e', count: 3, since: '2026-10-10T00:00:00.000Z' }
const fees: HomeItem = { kind: 'fees_unconfirmed', eventId: 'e', count: 5 }
const noEvidence: HomeItem = { kind: 'expense_no_evidence', eventId: 'e', expense: expense({ id: 'x1', description: '현수막 인쇄' }) }
const busy = homeResponse({ events: [homeEvent({ tasks: { total: 10, done: 6, overdue: 1, unassigned: 0 } })], items: [overdue, pending, noEvidence, fees],
  counts: { ...noCounts(), task_overdue: 1, purchases_pending: 3, expense_no_evidence: 1, fees_unconfirmed: 5 } })

// home 응답을 차례로 돌려준다. 업무·지출 상세도 같이 흉내 낸다.
function serve(...bodies: HomeResponse[]) {
  let call = 0
  const fetcher = vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => url.endsWith('/home') ? bodies[Math.min(call++, bodies.length - 1)]
    : url.endsWith('/tasks/t1') ? { task: taskDetail({ id: 't1', event: { id: 'e', name: '체육대회' } }) }
    : url.endsWith('/tasks/t1/status') ? { task: taskDetail({ id: 't1', event: { id: 'e', name: '체육대회' }, status: 'done', completedAt: '2026-10-12T03:00:00Z' }) }
    : url.endsWith('/expenses/x1') ? { expense: expense({ id: 'x1', description: '현수막 인쇄' }) } : {} }))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
function show(permissions = leader) {
  const callbacks = { onOpenEvent: vi.fn(), onOpenReview: vi.fn(), onCreateEvent: vi.fn(), onTasksChanged: vi.fn() }
  render(<Home organizationId="o1" permissions={permissions} {...callbacks} />)
  return callbacks
}

test('행사 카드에 상태 칩과 멈춘 일 줄을 보이고, 위에 종류별 수를 보인다', async () => {
  serve(busy)
  show()
  const card = await screen.findByRole('article', { name: '체육대회' })
  expect(within(card).getByText('기획 중')).toBeTruthy()
  expect(within(card).getByText('10.20 (D-8)')).toBeTruthy()
  expect(within(card).getByText('업무 6/10')).toBeTruthy()
  expect(within(card).getByRole('button', { name: /현수막 디자인.*기획부 · 윤태민 · 3일 지남/ })).toBeTruthy()
  expect(within(screen.getByRole('list', { name: '멈춘 일 수' })).getAllByRole('listitem').map(item => item.textContent))
    .toEqual(['지연 업무 1', '구매 승인 대기 3', '증빙 없는 지출 1', '입금 확인 전 5명'])
})

test('줄을 누르면: 업무는 상세를 열고, 구매는 구매 검토로, 입금 확인 전은 참가자 탭으로, 행사 이름은 행사로 간다', async () => {
  serve(busy)
  const callbacks = show()
  fireEvent.click(await screen.findByRole('button', { name: /현수막 디자인/ }))
  expect(await screen.findByRole('dialog')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '닫기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  fireEvent.click(screen.getByRole('button', { name: /구매 승인 대기 3건/ }))
  expect(callbacks.onOpenReview).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: /입금 확인 전 5명/ }))
  expect(callbacks.onOpenEvent).toHaveBeenLastCalledWith('e', 'registrations')
  fireEvent.click(screen.getByRole('button', { name: '체육대회' }))
  expect(callbacks.onOpenEvent).toHaveBeenLastCalledWith('e')
})

test('미배정은 입금 확인 전을 누르면 재정 탭으로, 구매는 행사 구매 탭으로 간다', async () => {
  serve(busy)
  const callbacks = show(unassigned)
  fireEvent.click(await screen.findByRole('button', { name: /입금 확인 전 5명/ }))
  expect(callbacks.onOpenEvent).toHaveBeenLastCalledWith('e', 'finance')
  fireEvent.click(screen.getByRole('button', { name: /구매 승인 대기 3건/ }))
  expect(callbacks.onOpenEvent).toHaveBeenLastCalledWith('e', 'purchases')
  expect(callbacks.onOpenReview).not.toHaveBeenCalled()
})

test('업무 상세에서 상태를 바꾸면 운영 현황과 옆 메뉴 수를 새로 불러와 줄이 사라지고, 지출 줄은 지출 상세를 연다', async () => {
  const cleared = homeResponse({ events: busy.events, items: [pending, noEvidence, fees], counts: { ...busy.counts, task_overdue: 0 } })
  const fetcher = serve(busy, cleared)
  const callbacks = show()
  fireEvent.click(await screen.findByRole('button', { name: /현수막 디자인/ }))
  fireEvent.click(await within(await screen.findByRole('dialog')).findByRole('button', { name: '완료' }))
  await waitFor(() => expect(callbacks.onTasksChanged).toHaveBeenCalled())
  expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/home'))).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: '닫기' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: /현수막 디자인/ })).toBeNull())
  fireEvent.click(screen.getByRole('button', { name: /증빙 없음 · 현수막 인쇄/ }))
  expect(await within(await screen.findByRole('dialog')).findByText('현수막 인쇄')).toBeTruthy()
})

test('부서별로 바꾸면 할 차례로 묶고, 멈춘 일이 없는 부서는 그렇게 적는다', async () => {
  serve(busy)
  show()
  fireEvent.click(await screen.findByRole('button', { name: '부서별' }))
  const finance = screen.getByRole('article', { name: '총무부' })
  expect(within(finance).getByRole('button', { name: /구매 승인 대기 3건.*체육대회/ })).toBeTruthy()
  expect(within(screen.getByRole('article', { name: '회장단' })).getByText('멈춘 일이 없어요.')).toBeTruthy()
  expect(within(screen.getByRole('article', { name: '기획부' })).getByText('할 일 0 · 지연 0 · 완료 0')).toBeTruthy()
})

test('행사가 없으면 새 행사를 권하고, 상시 운영 지출만 있으면 그 카드를 보인다', async () => {
  serve(homeResponse())
  const callbacks = show()
  fireEvent.click(await screen.findByRole('button', { name: '새 행사' }))
  expect(callbacks.onCreateEvent).toHaveBeenCalledOnce()
  cleanup()
  serve(homeResponse({ items: [{ ...noEvidence, eventId: null, expense: expense({ id: 'x2', event: null, description: '사무용품' }) }],
    counts: { ...noCounts(), expense_no_evidence: 1 } }))
  show()
  expect(await screen.findByRole('article', { name: '상시 운영 지출' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '새 행사' })).toBeNull()
})

test('멈춘 일이 없으면 그렇게 적고, 잘렸으면 알린다', async () => {
  serve(homeResponse({ events: [homeEvent()] }))
  show()
  expect(await screen.findByText('멈춘 일이 없어요.')).toBeTruthy()
  cleanup()
  serve({ ...busy, truncated: true })
  show()
  expect(await screen.findByText('멈춘 일이 많아 오래된 것부터 일부만 보여요.')).toBeTruthy()
})

test('불러오지 못하면 다시 불러온다', async () => {
  let fail = true
  vi.stubGlobal('fetch', vi.fn(async () => fail ? { ok: false, status: 500, json: async () => ({}) } : { ok: true, status: 200, json: async () => busy }))
  show()
  fireEvent.click(await screen.findByRole('button', { name: '다시 불러오기' }))
  fail = false
  fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }))
  expect(await screen.findByRole('article', { name: '체육대회' })).toBeTruthy()
})
```

- [ ] **Step 3: 실패를 확인한다**

Run: `npx vitest run src/home/Home.test.tsx` (`apps/web`) → FAIL(`./Home` 없음)

- [ ] **Step 4: useHome.ts를 쓴다**

```ts
import { useEffect, useState } from 'react'
import type { HomeResponse } from '@vada/contracts'

const isHome = (body: unknown): body is HomeResponse => typeof body === 'object' && body !== null
  && Array.isArray((body as HomeResponse).events) && Array.isArray((body as HomeResponse).items)

// 운영 현황(M6). 화면을 열 때마다 불러온다(다른 사람이 바꿨을 수 있다). 다시 불러오는 동안 지난 값을 그대로 보인다.
export function useHome(organizationId: string) {
  const url = `/api/organizations/${encodeURIComponent(organizationId)}/home`
  const [data, setData] = useState<HomeResponse | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoadError(false)
    void (async () => {
      try {
        const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        const body: unknown = await response.json()
        if (!response.ok || !isHome(body)) throw new Error('Home lookup failed')
        if (!controller.signal.aborted) setData(body)
      } catch {
        if (!controller.signal.aborted) setLoadError(true)
      }
    })()
    return () => controller.abort()
  }, [url, attempt])
  return { data, loadError, refresh: () => setAttempt(value => value + 1) }
}
```

- [ ] **Step 5: Home.tsx를 쓴다**

```tsx
import { useState, type ReactNode } from 'react'
import { CalendarDays, ChevronRight } from 'lucide-react'
import { koreanOf, type HomeItem, type MembershipPermissions } from '@vada/contracts'
import { EmptyState } from '@/components/EmptyState'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { phaseLabels, phaseTones } from '../events/event-phase'
import ExpenseDetailDialog from '../expenses/ExpenseDetailDialog'
import { pressed } from '../purchases/purchase-view'
import TaskDialogs from '../tasks/TaskDialogs'
import { departmentGroupsOf, eventGroupsOf, eventLineOf, itemKey, rowOf, statusChipsOf, summaryChips, targetOf, taskCountsText,
  type HomeTab, type HomeView } from './home-view'
import { useHome } from './useHome'

type Props = {
  organizationId: string
  permissions: MembershipPermissions
  // 탭이 없으면 행사의 첫 탭(대화)으로 연다.
  onOpenEvent: (eventId: string, tab?: HomeTab) => void
  onOpenReview: () => void
  onCreateEvent: () => void
  // 업무가 바뀌면 옆 메뉴 내 업무 수를 새로 불러오게 알린다.
  onTasksChanged: () => void
}
const frame = (children: ReactNode) => <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
  <div className="mx-auto flex max-w-3xl flex-col gap-4">{children}</div></div>

// 운영 현황(M6). 끝나지 않은 행사의 멈춘 일과 할 차례를 행사별·부서별로 본다. 회장단이 학생회를 열면 첫 화면이다.
export default function Home({ organizationId, permissions, onOpenEvent, onOpenReview, onCreateEvent, onTasksChanged }: Props) {
  const { data, loadError, refresh } = useHome(organizationId)
  const [view, setView] = useState<HomeView>('events')
  const [task, setTask] = useState<{ eventId: string; taskId: string } | null>(null)
  const [expenseId, setExpenseId] = useState<string | null>(null)
  if (!data) return frame(loadError ? <div className="flex flex-col items-start gap-2">
    <StateMessage kind="error">운영 현황을 불러오지 못했어요.</StateMessage>
    <Button variant="outline" size="sm" onClick={refresh}>다시 불러오기</Button>
  </div> : <StateMessage kind="loading">운영 현황을 불러오는 중…</StateMessage>)
  const dialogs = <>
    <TaskDialogs organizationId={organizationId} manageEvents={permissions.manageEvents} target={task} onClose={() => setTask(null)}
      onChanged={() => { refresh(); onTasksChanged() }} onOpenEvent={eventId => onOpenEvent(eventId, 'tasks')} />
    <ExpenseDetailDialog organizationId={organizationId} expenseId={expenseId} finance={permissions.approvePurchases}
      onClose={() => setExpenseId(null)} onChanged={refresh} />
  </>
  if (!data.events.length && !data.items.length) return frame(<Card>
    <EmptyState icon={CalendarDays} title="진행 중인 행사가 없어요" description="행사를 만들면 여기에 진행 상황이 모여요." />
    <div className="flex justify-center pb-10"><Button onClick={onCreateEvent}>새 행사</Button></div>
  </Card>)
  const counts = summaryChips(data.counts)
  const now = koreanOf(new Date())
  function open(item: HomeItem) {
    const target = targetOf(item, permissions)
    if (target.type === 'task') setTask({ eventId: target.eventId, taskId: target.taskId })
    else if (target.type === 'expense') setExpenseId(target.expenseId)
    else if (target.type === 'review') onOpenReview()
    else onOpenEvent(target.eventId, target.tab)
  }
  const rows = (items: HomeItem[]) => <ul className="flex flex-col border-t border-gray-100" aria-label="멈춘 일">{items.map(item => {
    const row = rowOf(item, view, data)
    return <li key={itemKey(item)} className="border-b border-gray-100 last:border-b-0">
      <Button variant="ghost" className="h-auto w-full justify-between gap-3 rounded-none px-4 py-2.5 text-left whitespace-normal"
        onClick={() => open(item)}>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium wrap-anywhere text-gray-900">{row.title}</span>
          <span className="text-xs wrap-anywhere text-gray-500">{row.detail}</span>
        </span>
        <ChevronRight aria-hidden className="text-gray-400" />
      </Button>
    </li>
  })}</ul>
  return frame(<>
    <p className="text-sm text-gray-500">끝나지 않은 행사에서 멈춘 일과 할 차례를 모았어요.</p>
    {counts.length ? <ul className="flex flex-wrap gap-1.5" aria-label="멈춘 일 수">
      {counts.map(text => <li key={text}><Badge tone="warning">{text}</Badge></li>)}</ul>
      : <StateMessage kind="empty">멈춘 일이 없어요.</StateMessage>}
    <div role="group" aria-label="운영 현황 보기" className="flex gap-2">
      <Button variant="outline" size="sm" className={pressed} aria-pressed={view === 'events'} onClick={() => setView('events')}>행사별</Button>
      <Button variant="outline" size="sm" className={pressed} aria-pressed={view === 'departments'} onClick={() => setView('departments')}>부서별</Button>
    </div>
    {data.truncated && <StateMessage kind="notice">멈춘 일이 많아 오래된 것부터 일부만 보여요.</StateMessage>}
    {view === 'events' ? <section aria-label="행사별" className="flex flex-col gap-3">{eventGroupsOf(data).map(group => {
      const name = group.home?.event.name ?? '상시 운영 지출'
      const chips = group.home ? statusChipsOf(group.home, now) : []
      return <article key={group.key} aria-label={name} className={cn(cardClass, 'flex flex-col')}>
        <div className="flex flex-col gap-1.5 p-4">
          {group.home ? <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={phaseTones[group.home.phase]}>{phaseLabels[group.home.phase]}</Badge>
              <h2 className="min-w-0 text-sm">
                <Button variant="link" className="h-auto justify-start p-0 text-left text-sm font-semibold whitespace-normal wrap-anywhere text-gray-900"
                  onClick={() => onOpenEvent(group.home!.event.id)}>{name}</Button>
              </h2>
            </div>
            <p className="text-xs wrap-anywhere text-gray-500">{eventLineOf(group.home, data.today)}</p>
            {chips.length > 0 && <ul className="flex flex-wrap gap-1.5" aria-label="상태">
              {chips.map(chip => <li key={chip}><Badge>{chip}</Badge></li>)}</ul>}
          </> : <h2 className="text-sm font-semibold text-gray-900">{name}</h2>}
        </div>
        {group.items.length > 0 && rows(group.items)}
      </article>
    })}</section>
      : <section aria-label="부서별" className="flex flex-col gap-3">{departmentGroupsOf(data).map(group =>
        <article key={group.key} aria-label={group.name} className={cn(cardClass, 'flex flex-col')}>
          <div className="flex flex-wrap items-baseline justify-between gap-2 p-4">
            <h2 className="text-sm font-semibold wrap-anywhere text-gray-900">{group.name}</h2>
            <p className="text-xs text-gray-500">{taskCountsText(group.tasks)}</p>
          </div>
          {group.items.length ? rows(group.items) : <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">멈춘 일이 없어요.</p>}
        </article>)}</section>}
    {dialogs}
  </>)
}
```

- [ ] **Step 6: 통과를 확인한다**

Run: `npx vitest run src/home src/tasks` (`apps/web`) → all passed

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/home apps/web/src/tasks
git commit -m "운영 현황 화면 더하기"
```

---

### Task 6: 화면 — 작업 공간에 잇기(옆 메뉴 "홈", 회장단 첫 화면)

**Files:**
- Modify: `apps/web/src/workspace/Workspace.tsx`, `apps/web/src/workspace/WorkspaceSidebar.tsx`, `apps/web/src/workspace/Workspace.test.tsx`
- Modify(필요하면): `apps/web/src/App.integration.test.tsx` (회장단 흐름이 `/home`을 부르면 응답 흉내)

**Interfaces:**
- Consumes: Task 5의 `Home`, `HomeTab`
- Produces: `View`에 `'home'`, 사이드바 props `homeActive: boolean; onHome: () => void`

- [ ] **Step 1: 실패하는 테스트를 더한다** (`Workspace.test.tsx`)

`setup()`의 fetch 흉내에 `url.endsWith('/home') ? homeBody` 갈래를 맨 앞에 더한다(`homeBody`는 인자, 기본값 `homeResponse()`). 그리고 다음 테스트를 더한다.

```tsx
test('회장단은 학생회를 열면 운영 현황이 먼저 보이고, 줄을 누르면 그 행사의 탭이 열린다', async () => {
  const body = homeResponse({ events: [homeEvent({ event: event })], counts: { ...noCounts(), tasks_unassigned: 2 },
    items: [{ kind: 'tasks_unassigned', eventId: 'e1', department: null, count: 2 }] })
  setup(membersBody, undefined, undefined, [event], [], null, body)
  render(<Workspace {...props} memberships={[leaderMembership]} />)
  expect(screen.getByRole('heading', { level: 1, name: '운영 현황' })).toBeTruthy()
  const nav = screen.getByRole('navigation', { name: '학생회 메뉴' })
  expect(within(nav).getByRole('button', { name: '홈' }).getAttribute('aria-current')).toBe('page')
  // 행사 목록을 받아야 줄을 눌러 행사를 열 수 있다.
  await within(screen.getByRole('complementary', { name: '학생회 작업 공간' })).findByRole('button', { name: '체육대회' })
  fireEvent.click(await screen.findByRole('button', { name: /담당자 없는 업무 2건/ }))
  expect(screen.getByRole('heading', { level: 1, name: '체육대회' })).toBeTruthy()
  expect(screen.getByRole('tab', { name: '업무' }).getAttribute('aria-selected')).toBe('true')
  fireEvent.click(within(nav).getByRole('button', { name: '홈' }))
  expect(await screen.findByRole('heading', { level: 1, name: '운영 현황' })).toBeTruthy()
})

test('부원은 내 업무가 먼저 보이고 옆 메뉴 홈으로 운영 현황을 본다', async () => {
  setup()
  render(<Workspace {...props} />)
  expect(screen.getByRole('heading', { level: 1, name: '내 업무' })).toBeTruthy()
  fireEvent.click(within(screen.getByRole('navigation', { name: '학생회 메뉴' })).getByRole('button', { name: '홈' }))
  expect(await screen.findByRole('heading', { level: 1, name: '운영 현황' })).toBeTruthy()
  expect(await screen.findByText('진행 중인 행사가 없어요')).toBeTruthy()
})
```

`setup` 시그니처는 `(members, review, myTasks, eventList, recordList, reportBody, homeBody: unknown = homeResponse())`로 늘린다. import에 `homeEvent, homeResponse, noCounts`(`../home/home-fixtures`)를 더한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/workspace/Workspace.test.tsx` → 새 테스트 2개 FAIL

- [ ] **Step 3: 사이드바에 "홈"을 더한다** (`WorkspaceSidebar.tsx`)

import에 `House`를 더하고, Props 맨 앞에 다음을 더한다.

```ts
  // 운영 현황(M6). 회장단이 학생회를 열면 첫 화면이다. 수는 달지 않는다.
  homeActive: boolean; onHome: () => void
```

`nav`의 첫 항목으로 다음을 넣는다.

```tsx
      <NavItem active={homeActive} className="flex items-center gap-2" onClick={onHome}>
        <House aria-hidden className="size-4" />홈
      </NavItem>
```

- [ ] **Step 4: Workspace를 잇는다** (`Workspace.tsx`)

1. `type View`에 `'home'`을 더하고 `import Home from '../home/Home'`.
2. 첫 화면: 주석과 함께

```ts
  // 회장단은 학생회를 열면 운영 현황(M6)이, 다른 구성원은 내 업무가 먼저 보인다. 알림 대신 할 일이 눈에 띄게 한다.
  const [view, setView] = useState<View>(initialView ?? (membership.permissions.manageOrganization ? 'home' : 'tasks'))
```

3. 행사를 탭과 함께 여는 함수를 하나로 모은다. `openEventTasks`와 `openEventFinance`를 다음으로 바꾸고, 부르는 곳(`MyTasks onOpenEvent`, `Budget onOpenEvent`)은 `eventId => openEventAt(eventId, 'tasks')`, `eventId => openEventAt(eventId, 'finance')`로 바꾼다.

```ts
  // 내 업무·예산·운영 현황에서 행사를 그 탭으로 연다. 세 화면에는 입력 중인 것이 없으므로 묻지 않는다.
  function openEventAt(eventId: string, tab: EventTab = 'chat') {
    const target = events.events?.find(item => item.id === eventId)
    if (!target) return
    setEventTab(tab)
    setEventMessage(null)
    setSelected(target)
    setView('events')
  }
  function openHome() {
    if (view !== 'home' && canLeave()) setView('home')
    setNavOpen(false)
  }
```

4. 사이드바에 `homeActive={view === 'home'} onHome={openHome}`를 넘긴다.
5. 머리: `section`에 `view === 'home' ? '홈' :`를, `title`에 `view === 'home' ? '운영 현황' :`를 맨 앞 갈래로 더한다.
6. 본문 첫 갈래:

```tsx
        {view === 'home' ? <Home organizationId={membership.organization.id} permissions={membership.permissions} onOpenEvent={openEventAt}
          onOpenReview={openReview} onCreateEvent={() => setCreateOpen(true)} onTasksChanged={myTasks.refresh} />
          : view === 'tasks' ? …(그대로)
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run src/workspace src/App.integration.test.tsx src/App.test.tsx` (`apps/web`) → all passed. 회장단 흐름 테스트가 `/home` 응답이 없어 실패하면 그 테스트의 api 흉내에 `api.on('GET', '/api/organizations/o/home', () => json(homeResponse()))`를 더한다(`homeResponse`는 `./home/home-fixtures`).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "옆 메뉴 홈과 회장단 첫 화면을 운영 현황으로 잇기"
```

---

### Task 7: 검사·리뷰·배포

**Files:** 없음(검사와 배포). 리뷰 반영이 있으면 해당 파일.

- [ ] **Step 1: 전체 검사**

Run (루트): `npm run typecheck` → 오류 없음
Run: `npm test --workspace @vada/contracts` → all passed
Run: `npm test --workspace @vada/web` → all passed
Run (`apps/api`, 백그라운드 약 10분): `FILES=$(node -e "console.log(require('./package.json').scripts.test.replace(/^tsx --test /,''))"); npx tsx --test --test-concurrency=2 $FILES` → all passed

- [ ] **Step 2: dev 화면 확인**

`npm run dev`(api·web) 뒤 Chrome에서 dev 학생회에 회장단으로 들어가 운영 현황이 첫 화면인지, 행사별·부서별, 줄 누르기(업무 상세·지출 상세·행사 탭·구매 검토), 390px 폭(같은 출처 iframe)에서 가로 넘침이 없는지 본다. 와이어프레임 `4:2`와 비교한다. 끝나면 dev 서버를 `taskkill /T`로 끈다.

- [ ] **Step 3: 새 컨텍스트 Opus 최종 리뷰**

superpowers:requesting-code-review로 브랜치 전체(main 대비)를 리뷰받는다. 리뷰 에이전트에게는 테스트를 돌리지 말라고 적는다(메모리 부족). Critical·Important는 고치고 다시 검사한다. Minor는 known-issues 메모에 남긴다.

- [ ] **Step 4: 배포**

main을 fast-forward로 병합하고 푸시한다(마이그레이션 없음). CI 통과를 확인하고, 운영(`https://vada-m1.onrender.com`)이 새 빌드인지 `GET /api/organizations/x/home`이 401(404가 아님)인지로 확인한다.

- [ ] **Step 5: 진행 위치와 미룬 문제 메모**

`project-m2-roadmap.md`에 M6 배포를 적고, 미룬 Minor·판단은 새 메모 `project-home-known-issues.md`와 MEMORY.md 한 줄로 남긴다.
