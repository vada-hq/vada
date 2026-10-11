import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import type { BudgetPlanResponse, EventFinanceResponse, EventsResponse, MyTasksResponse, RegistrationResponse } from '@vada/contracts'
import { createApp } from '../src/app.js'
import { createBudgetRoutes } from '../src/budget/routes.js'
import { createEventRoutes } from '../src/events/events.js'
import { createRegistrationRoutes } from '../src/registrations/routes.js'
import { createSettlementRoutes } from '../src/settlement/routes.js'
import { createTaskRoutes } from '../src/tasks/routes.js'
import { fakeStorage } from '../src/purchases/test-setup.js'
import { DEMO_ORGANIZATION_ID, DEMO_ORGANIZATION_NAME, demoCalendar, receiptPdf, resetDemo, seedDemo } from './demo-data.js'

const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url))
const today = '2026-10-11'
// 배포 DB의 지금 모양: 검증 학생회, 부서 셋, 로그인 계정 셋(회장단 둘, 재정부 하나), 시험 삼아 만든 행사 하나.
async function deployedLike() {
  const pg = new PGlite()
  const db = drizzle(pg)
  await migrate(db, { migrationsFolder })
  await pg.exec(`
    INSERT INTO users(id,name,email) VALUES ('u1','회장','u1@test.local'),('u2','부회장','u2@test.local'),('u3','재정','u3@test.local');
    INSERT INTO organizations(id,name) VALUES ('m1-test-council','M1 검증 학생회');
    INSERT INTO departments(id,organization_id,name,handles_finance,is_leadership) VALUES ('m1-test-planning','m1-test-council','기획부',false,false),
      ('m1-test-finance','m1-test-council','재정부',true,false),('m1-test-leadership','m1-test-council','회장단',false,true);
    INSERT INTO memberships(id,user_id,organization_id,department_id) VALUES ('m1','u1','m1-test-council','m1-test-leadership'),
      ('m2','u2','m1-test-council','m1-test-leadership'),('m3','u3','m1-test-council','m1-test-finance');
    INSERT INTO events(id,organization_id,name,created_by) VALUES ('old','m1-test-council','체육대ㅗ히','u1');
    INSERT INTO chat_rooms(id,organization_id,event_id) VALUES ('old-room','m1-test-council','old');
    INSERT INTO messages(id,chat_room_id,author_id,content) VALUES ('old-message','old-room','u1','테스트');
  `)
  return { pg, db }
}
// 로그인 계정(u1, 회장단)이 보는 화면 API
type TestDb = Awaited<ReturnType<typeof deployedLike>>['db']
function viewer(db: TestDb) {
  const session = async () => ({ user: { id: 'u1' } })
  const origin = 'http://127.0.0.1:5180'
  const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, events: createEventRoutes(db, session),
    budget: createBudgetRoutes(db, session, origin), settlement: createSettlementRoutes(db, session, origin),
    registrations: createRegistrationRoutes(db, session), tasks: createTaskRoutes(db, session) })
  return async <T>(path: string): Promise<T> => {
    const response = await app.request(`/api/organizations/${DEMO_ORGANIZATION_ID}${path}`)
    assert.equal(response.status, 200, path)
    return await response.json() as T
  }
}
async function seed(db: TestDb, storage: ReturnType<typeof fakeStorage>) {
  const removed = await resetDemo(db)
  for (const key of removed) await storage.storage.remove(key)
  return seedDemo({ db, storage: storage.storage, today,
    upload: async (url, headers, body) => storage.put(url.replace('https://r2.test/', ''), body.byteLength, headers['Content-Type']!) })
}
const count = async (pg: PGlite, query: string) => Number((await pg.query<{ n: number }>(query)).rows[0]!.n)

test('시연 날짜: 2학기 가운데 지난 행사와 다가올 행사가 학기 안에 들 때만 만든다', () => {
  const calendar = demoCalendar(today)
  assert.deepEqual([calendar.previous, calendar.current], [{ name: '2026년 1학기', startsOn: '2026-03-01', endsOn: '2026-08-31' },
    { name: '2026년 2학기', startsOn: '2026-09-01', endsOn: '2027-02-28' }])
  assert.deepEqual([calendar.orientation, calendar.opening, calendar.sports, calendar.snack, calendar.festival],
    ['2026-03-06', '2026-09-04', '2026-09-26', '2026-10-21', '2026-11-14'])
  for (const day of ['2026-06-01', '2026-09-20', '2027-02-10']) assert.throws(() => demoCalendar(day), /DEMO_WINDOW/, day)
  assert.equal(new TextDecoder().decode(receiptPdf(['TOTAL 1,000']).slice(0, 8)), '%PDF-1.4')
})

test('시연 데이터: 테스트 데이터를 지우고 한 학기 반의 활동을 넣으며, 다시 돌려도 같은 상태가 된다', async () => {
  const { pg, db } = await deployedLike()
  const storage = fakeStorage()
  try {
    const first = await seed(db, storage)
    const view = viewer(db)
    // 학생회 이름이 바뀌고, 로그인 계정 셋의 소속은 그대로다. 시험 삼아 만든 행사와 대화는 없다.
    assert.equal((await pg.query<{ name: string }>(`SELECT name FROM organizations WHERE id = '${DEMO_ORGANIZATION_ID}'`)).rows[0]!.name, DEMO_ORGANIZATION_NAME)
    assert.deepEqual((await pg.query<{ id: string; department_id: string }>(`SELECT id, department_id FROM memberships WHERE id IN ('m1','m2','m3') ORDER BY id`)).rows
      .map(row => row.department_id), ['m1-test-leadership', 'm1-test-leadership', 'm1-test-finance'])
    assert.equal(await count(pg, `SELECT count(*)::int AS n FROM events WHERE id = 'old'`), 0)
    assert.equal(await count(pg, `SELECT count(*)::int AS n FROM memberships WHERE organization_id = '${DEMO_ORGANIZATION_ID}'`), 11)
    const { events } = await view<EventsResponse>('/events')
    assert.deepEqual(events.map(event => event.name).sort(), ['2026 새내기 배움터', '2학기 개강총회', '소프트웨어학부 체육대회', '소프트웨어학부 학술제',
      '중간고사 간식 나눔'].sort())
    const sports = events.find(event => event.name === '소프트웨어학부 체육대회')!
    assert.deepEqual([sports.startsAt, sports.endsAt, sports.place], ['2026-09-26T10:00', '2026-09-26T17:00', '대운동장'])

    // 참가 신청: 신청 수·입금·참석 수(보관 기간 파기 뒤에도 남는 숫자)
    const registrationOf = (id: string) => view<RegistrationResponse>(`/events/${id}/registration`)
    const forms = Object.fromEntries(await Promise.all(events.map(async event => [event.name, (await registrationOf(event.id)).form])))
    assert.deepEqual([forms['2026 새내기 배움터']?.count, forms['2026 새내기 배움터']?.payments, forms['2026 새내기 배움터']?.checkedIn], [42, { count: 40, total: 1_200_000 }, 39])
    assert.deepEqual([forms['소프트웨어학부 체육대회']?.count, forms['소프트웨어학부 체육대회']?.payments, forms['소프트웨어학부 체육대회']?.checkedIn],
      [26, { count: 14, total: 70_000 }, 22])
    assert.deepEqual([forms['중간고사 간식 나눔']?.count, forms['중간고사 간식 나눔']?.checkedIn, forms['소프트웨어학부 학술제']], [47, 0, null])
    // 신청·입금·참석 시각은 행사 전·당일이다.
    const sportsRows = await pg.query<{ created_at: Date; paid_at: Date | null; checked_in_at: Date | null }>(`SELECT r.created_at, r.paid_at, r.checked_in_at
      FROM registrations r JOIN registration_forms f ON f.id = r.form_id WHERE f.event_id = '${sports.id}'`)
    const start = new Date('2026-09-26T10:00:00+09:00').getTime()
    for (const entry of sportsRows.rows) {
      assert.ok(entry.created_at.getTime() < start && (!entry.paid_at || entry.paid_at.getTime() < start))
      assert.ok(!entry.checked_in_at || Math.abs(entry.checked_in_at.getTime() - start) < 3_600_000)
    }

    // 화면에 보이는 시각은 모두 시연 기준 날짜 정오 이전이다(넣은 때의 실제 시각이 남지 않는다).
    const noon = new Date(`${today}T12:00:00+09:00`)
    const columns = ['events.created_at', 'messages.created_at', 'purchase_items.created_at', 'purchase_items.decided_at', 'purchase_items.purchased_at',
      'purchase_items.received_at', 'purchase_item_events.created_at', 'registrations.created_at', 'registrations.paid_at', 'registrations.checked_in_at',
      'registration_forms.updated_at', 'expenses.created_at', 'expense_events.created_at', 'expense_receipts.confirmed_at', 'incomes.created_at',
      'income_events.created_at', 'event_finances.updated_at', 'event_finances.settled_at', 'event_finance_events.created_at', 'budget_periods.updated_at',
      'budget_periods.closed_at', 'budget_period_events.created_at', 'fee_accounts.updated_at', 'fee_account_events.created_at', 'dues_rosters.uploaded_at',
      'purchase_candidate_shares.created_at', 'purchase_candidates.created_at', 'coupang_products.fetched_at', 'purchase_items.product_fetched_at',
      'purchase_generations.created_at', 'purchase_submissions.submitted_at', 'tasks.created_at', 'tasks.completed_at', 'task_events.created_at',
      'events.completed_at', 'event_reports.created_at', 'event_reports.updated_at', 'event_reports.published_at']
    for (const column of columns) {
      const [table, field] = column.split('.')
      const latest = (await pg.query<{ latest: Date | null }>(`SELECT max(${field}) AS latest FROM ${table}`)).rows[0]!.latest
      assert.ok(!latest || latest.getTime() <= noon.getTime(), `${column} ${latest?.toISOString()}`)
    }

    // 업무: 정산한 체육대회는 모두 완료했고, 학술제에는 지연과 담당자 없음이 섞여 있다. 처리 기록은 업무보다 늦지 않다.
    const taskRows = await pg.query<{ event: string; status: string; overdue: boolean; unassigned: boolean }>(`SELECT e.name AS event, t.status,
      (t.status <> 'done' AND t.due_on < $1::date) AS overdue, t.assignee_id IS NULL AS unassigned FROM tasks t JOIN events e ON e.id = t.event_id
      WHERE t.organization_id = $2`, [today, DEMO_ORGANIZATION_ID])
    const tasksOf = (name: string) => taskRows.rows.filter(row => row.event === name)
    assert.ok(tasksOf('소프트웨어학부 학술제').length >= 7)
    assert.ok(tasksOf('소프트웨어학부 학술제').some(row => row.overdue))
    assert.ok(tasksOf('소프트웨어학부 학술제').some(row => row.unassigned))
    assert.ok(tasksOf('소프트웨어학부 체육대회').length > 0 && tasksOf('소프트웨어학부 체육대회').every(row => row.status === 'done'))
    assert.ok(tasksOf('중간고사 간식 나눔').length > 0)
    assert.equal(await count(pg, `SELECT count(*)::int AS n FROM task_events ev JOIN tasks t ON t.id = ev.task_id WHERE ev.created_at < t.created_at
      OR (t.completed_at IS NOT NULL AND t.completed_at < t.created_at)`), 0)
    // 로그인 회장단 계정 둘(u1, u2) 모두 내 업무가 비어 있지 않다. u1에게는 지연이 하나 있다.
    const mine = await view<MyTasksResponse>('/my-tasks')
    assert.ok(mine.open.length >= 1)
    assert.equal(mine.open.filter(task => task.dueOn !== null && task.dueOn < today).length, 1)
    assert.ok(await count(pg, `SELECT count(*)::int AS n FROM tasks WHERE assignee_id = 'u2' AND status <> 'done'`) >= 1)

    // 정산 셋, 정산하지 않은 행사 둘. 학술제 예산은 미정이다.
    const finances: Record<string, EventFinanceResponse['finance']> = Object.fromEntries(await Promise.all(events.map(async event =>
      [event.name, (await view<EventFinanceResponse>(`/events/${event.id}/finance`)).finance] as const)))
    assert.deepEqual(Object.entries(finances).filter(([, finance]) => finance.settled).map(([name]) => name).sort(),
      ['2026 새내기 배움터', '2학기 개강총회', '소프트웨어학부 체육대회'].sort())
    assert.deepEqual([finances['중간고사 간식 나눔']!.pendingRequests, finances['중간고사 간식 나눔']!.unrecordedItems, finances['소프트웨어학부 학술제']!.budget],
      [1, 2, null])
    // 새내기 배움터·개강총회는 완료해 기록에 있고, 체육대회는 정산만 해 회장단이 완료해 볼 수 있다(M5a).
    const completed = await pg.query<{ name: string }>(`SELECT name FROM events WHERE organization_id = $1 AND completed_at IS NOT NULL ORDER BY name`,
      [DEMO_ORGANIZATION_ID])
    assert.deepEqual(completed.rows.map(row => row.name), ['2026 새내기 배움터', '2학기 개강총회'])
    // 다섯 행사 모두 담당 부서와 책임자가 있다(M5b).
    assert.equal(await count(pg, `SELECT count(*)::int AS n FROM events WHERE organization_id = '${DEMO_ORGANIZATION_ID}'
      AND owner_department_id IS NOT NULL AND owner_id IS NOT NULL`), 5)
    // 결과보고서: 새내기 배움터는 발행, 개강총회는 세 칸만 쓴 작성 중이다. 발행한 보고서는 신청·참석과 업무 지연을 고정했다.
    const reports = await pg.query<{ name: string; status: string; facts: { registrations: unknown; tasks: { total: number; late: number } } | null;
      written: number }>(`SELECT e.name, r.status, r.facts, ((r.operations IS NOT NULL)::int + (r.went_well IS NOT NULL)::int
        + (r.shortfalls IS NOT NULL)::int + (r.improvements IS NOT NULL)::int + (r.handover IS NOT NULL)::int) AS written
      FROM event_reports r JOIN events e ON e.id = r.event_id ORDER BY e.name`)
    assert.deepEqual(reports.rows.map(row => [row.name, row.status, row.written]), [['2026 새내기 배움터', 'published', 5], ['2학기 개강총회', 'draft', 3]])
    assert.deepEqual(reports.rows[0]!.facts?.registrations, { registered: 42, attended: 39 })
    assert.deepEqual([reports.rows[0]!.facts?.tasks.total, reports.rows[0]!.facts?.tasks.late], [4, 1])
    // 발행은 완료 뒤, 쓴 때는 발행 전이다.
    const order = await pg.query<{ ok: boolean }>(`SELECT bool_and(r.created_at > e.completed_at AND (r.published_at IS NULL OR r.published_at > r.updated_at)) AS ok
      FROM event_reports r JOIN events e ON e.id = r.event_id`)
    assert.equal(order.rows[0]!.ok, true)

    // 1학기는 마감했고 남은 돈은 2학기 이월금이다. 참가비 수입은 각 학기에 들어간다.
    const periods = await pg.query<{ id: string; name: string; closed_at: Date | null }>(`SELECT id, name, closed_at FROM budget_periods ORDER BY starts_on`)
    assert.deepEqual(periods.rows.map(period => [period.name, period.closed_at !== null]), [['2026년 1학기', true], ['2026년 2학기', false]])
    const current = await view<BudgetPlanResponse>(`/budget/periods/${periods.rows[1]!.id}`)
    const previous = await view<BudgetPlanResponse>(`/budget/periods/${periods.rows[0]!.id}`)
    // 남은 돈(실제 수입 − 실제 지출)은 그대로 보이고, 넘긴 이월금은 따로 보인다.
    assert.equal(previous.totals.balance, 495_600)
    assert.equal(previous.closing.carriedOver?.amount, 495_600)
    assert.deepEqual(current.incomes.map(line => [line.name, line.received]), [['이월금', 495_600], ['학생회비', 1_540_000], ['학교 지원금', 600_000],
      ['참가비 수입', 70_000]])
    assert.equal(current.closing.missingEvidence, 1)
    // 영수증 9장을 올렸다(현수막 하나는 증빙 누락으로 둔다).
    assert.equal(await count(pg, `SELECT count(*)::int AS n FROM expense_receipts WHERE status = 'ready'`), 9)

    // 다시 돌리면 지운 영수증 파일을 저장소에서도 지우고, 같은 상태가 된다.
    const again = await seed(db, storage)
    assert.notDeepEqual(again.eventIds, first.eventIds)
    assert.equal(storage.removed.length, 9)
    assert.equal(await count(pg, `SELECT count(*)::int AS n FROM events WHERE organization_id = '${DEMO_ORGANIZATION_ID}'`), 5)
    assert.equal(await count(pg, `SELECT count(*)::int AS n FROM users WHERE id LIKE 'demo-member-%'`), 8)
    assert.equal(await count(pg, `SELECT count(*)::int AS n FROM expense_receipts`), 9)
    assert.equal(await count(pg, `SELECT count(*)::int AS n FROM memberships WHERE id IN ('m1','m2','m3')`), 3)
    assert.equal(await count(pg, `SELECT count(*)::int AS n FROM tasks`), taskRows.rows.length)
  } finally { await pg.close() }
})
