import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PGlite } from '@electric-sql/pglite'
import type {
  EventResponse,
  EventsResponse,
  ExpensesResponse,
  HomeResponse,
  MyCouncilsResponse,
  PurchaseRequestsResponse,
  RegistrationFormsResponse,
  SettlementResponse,
  TasksResponse,
} from '@vada/contracts'
import { createTestDb } from '../src/db/test-db.js'
import { startFlow } from '../src/flows/server.js'
import { EVENT_A, EVENT_B, EVENT_C } from '../src/flows/rehearsal.js'
import { FEE } from '../src/flows/rehearsal-event.js'
import { BANNER_WON, DIRECT_WON } from '../src/flows/rehearsal-money.js'
import { fakeStorage } from '../src/test-support/storage.js'
import { DEMO_SCHOOL_NAME, seedDemoCouncil } from './demo-data.js'
import { seedTestCouncil } from './test-data.js'

// 시연 시험은 행 수를 세지 않는다. 시연을 PGlite에 넣고, 회장 계정으로 화면이 부르는 GET 응답만 읽어 '리허설 화면 기준'(명세 017)을 본다.
// 읽을 수 없는 것(근거 연결, Google 연결)과 실패 뒤 남은 것만 SQL로 본다.
// 시연은 돌리는 때를 마지막 단계로 두므로 now는 실제 시각을 넘지 않는다(거래 범위 시계가 던진다).
const now = new Date(Date.now() - 60_000)
const EXPENSE_TOTAL = BANNER_WON + DIRECT_WON
const UP_PREFIX = 'https://r2.test/up/'

async function googleUser(pg: PGlite, id: string) {
  await pg.query('INSERT INTO users (id, name, email) VALUES ($1, $1, $2)', [
    id,
    `${id}@example.test`,
  ])
  await pg.query(
    "INSERT INTO accounts (id, user_id, provider_id, account_id) VALUES ($1, $2, 'google', $3)",
    [`a-${id}`, id, `sub-${id}`],
  )
}

const count = async (pg: PGlite, table: string, where = 'true') =>
  Number(
    ((await pg.query(`SELECT count(*) AS n FROM ${table} WHERE ${where}`)).rows[0] as { n: string })
      .n,
  )

// 가짜 저장소에 두고, 올리기 요청(PUT)은 가짜 fetch가 받아 객체를 둔다.
function demoStorage() {
  const fake = fakeStorage()
  const puts: { headers: Headers; bytes: number }[] = []
  const fetcher = ((url: string, init?: RequestInit) => {
    puts.push({ headers: new Headers(init?.headers), bytes: (init!.body as Uint8Array).length })
    fake.put(url.slice(UP_PREFIX.length))
    return Promise.resolve(new Response(null, { status: 200 }))
  }) as typeof fetch
  return { puts, deps: { storage: fake.storage, fetcher } }
}

// 넣은 뒤 회장의 눈으로 읽는다. 같은 DB에 새 흐름 서버를 붙이고 회장 계정만 들인다.
async function readAsChief(db: Awaited<ReturnType<typeof createTestDb>>['db'], userId: string) {
  const flow = await startFlow(db, { start: now, scope: 'connection' })
  flow.flowSession.admit(userId)
  const chief = flow.driver.as(userId)
  const get = async <T>(path: string) => {
    const response = await chief.get(path)
    assert.equal(response.status, 200, path)
    return (await response.json()) as T
  }
  const councils = await get<MyCouncilsResponse>('/api/me/councils')
  assert.equal(councils.councils.length, 1)
  return { get, org: `/api/organizations/${councils.councils[0]!.id}` }
}

test('리허설 화면 기준 - 행사 목록과 행사 A', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    await googleUser(pg, 'u1')
    const storage = demoStorage()
    assert.equal(await seedDemoCouncil(db, 'u1', now, storage.deps), 'created')
    const { get, org } = await readAsChief(db, 'u1')
    const { events } = await get<EventsResponse>(`${org}/events`)
    assert.deepEqual(events.map(item => item.status).sort(), ['completed', 'tbd', 'upcoming'])
    const a = events.find(item => item.name === EVENT_A.name)!
    // 행사 A: 완료 사유, 신청·입금·환불 숫자, 참가비와 지출 합계, 정산 남은 것 0
    const detail = await get<EventResponse>(`${org}/events/${a.id}`)
    assert.equal(detail.event.approvals[0]!.outcome, 'completed')
    assert.ok(detail.event.approvals[0]!.reason)
    const { settlement } = await get<SettlementResponse>(`${org}/events/${a.id}/settlement`)
    assert.equal(settlement.settled, true)
    assert.ok(settlement.remaining.every(item => item.count === 0))
    assert.equal(settlement.actual.fee, FEE)
    assert.equal(settlement.actual.depositCount, 2)
    assert.equal(settlement.actual.refundPendingCount, 0)
    assert.equal(settlement.actual.expense, EXPENSE_TOTAL)
    const spent = await get<ExpensesResponse>(`${org}/expenses?event=${a.id}`)
    assert.equal(spent.expenses.length, 2)
    assert.ok(spent.expenses.every(item => item.evidenceCount === 1))
    const forms = await get<RegistrationFormsResponse>(`${org}/events/${a.id}/registration-forms`)
    assert.equal(forms.forms[0]!.applicantCount, 2)
    // 증빙은 작은 고정 이미지를 저장소에 올린 것이다
    assert.equal(storage.puts.length, 2)
    assert.ok(storage.puts.every(put => put.headers.get('Content-Type') === 'image/jpeg'))
    assert.ok(storage.puts.every(put => put.bytes > 0))
    // 가상 운영진은 로그인 못 하는 계정이다: Google 연결이 없다(실제 사용자의 것 하나만 있다)
    assert.equal(
      await count(
        pg,
        'accounts',
        "user_id IN (SELECT id FROM users WHERE email LIKE '%@demo.vada.invalid')",
      ),
      0,
    )
    assert.equal(await count(pg, 'accounts', "provider_id = 'google'"), 1)
  } finally {
    await close()
  }
})

test('리허설 화면 기준 - 행사 B와 C, 부탁 메시지, 회장의 홈', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    await googleUser(pg, 'u1')
    await seedDemoCouncil(db, 'u1', now, demoStorage().deps)
    const { get, org } = await readAsChief(db, 'u1')
    const { events } = await get<EventsResponse>(`${org}/events`)
    const b = events.find(item => item.name === EVENT_B.name)!
    const c = events.find(item => item.name === EVENT_C.name)!
    assert.equal(c.startsAt, null)
    // 회장은 완료 전 행사를 모두 고칠 수 있다
    for (const id of [b.id, c.id]) {
      const { event } = await get<EventResponse>(`${org}/events/${id}`)
      assert.ok(event.actions.includes('event.update'))
    }
    // 행사 B: 받는 중인 양식, 입금을 기다리는 신청자, 결재를 기다리는 요청 하나, 진행 중 업무
    const forms = await get<RegistrationFormsResponse>(`${org}/events/${b.id}/registration-forms`)
    assert.equal(forms.forms[0]!.status, 'open')
    assert.equal(forms.forms[0]!.applicantCount, 3)
    const { settlement } = await get<SettlementResponse>(`${org}/events/${b.id}/settlement`)
    assert.equal(settlement.actual.depositCount, 0)
    const pending = await get<PurchaseRequestsResponse>(
      `${org}/purchase-requests?view=pending&event=${b.id}`,
    )
    assert.equal(pending.requests.length, 1)
    const tasks = await get<TasksResponse>(`${org}/tasks?view=all&event=${b.id}`)
    assert.ok(tasks.tasks.some(item => item.event?.id === b.id && item.status === 'in_progress'))
    // 행사방을 만드는 경로가 없어 부탁 메시지는 기획부 부서방에 있다. 회장은 그 방에 들지 않아 GET으로 볼 수 없어 SQL로 본다.
    // 그 메시지가 두 행사의 요청의 근거로 이어진다.
    assert.equal(
      await count(
        pg,
        'evidence_link l JOIN message m ON m.id = l.message_id JOIN request r ON r.id = l.record_id JOIN chat_room cr ON cr.id = m.room_id',
        "cr.type = 'department' AND m.body LIKE '%구매 요청%'",
      ),
      2,
    )
    // 회장 홈(회장단 홈 HOME-01C)의 행사 현황에 행사 B와 C가 있고 할 일이 비지 않는다
    const home = await get<HomeResponse>(`${org}/home`)
    const cards = home.councilBoard!.events.cards
    assert.deepEqual(
      [b.id, c.id].filter(id => cards.some(card => card.event.id === id)),
      [b.id, c.id],
    )
    assert.ok(cards.some(card => card.event.id === b.id && card.tasks.total > 0))
  } finally {
    await close()
  }
})

test('중간 단계가 실패하면 학생회도 계정도 남지 않는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    await googleUser(pg, 'u1')
    const storage = demoStorage()
    // 학생회 만들기부터 결재까지는 저장점이 이미 끝난 뒤, 증빙 올리기 단계에서 저장소가 실패한다.
    const failing = {
      ...storage.deps,
      fetcher: (() => Promise.resolve(new Response(null, { status: 500 }))) as typeof fetch,
    }
    await assert.rejects(seedDemoCouncil(db, 'u1', now, failing), /리허설 단계 'spend'/)
    assert.equal(await count(pg, 'council'), 0)
    assert.equal(await count(pg, 'record'), 0)
    assert.equal(await count(pg, 'users'), 1)
    assert.equal(await count(pg, 'accounts'), 1)
    // 실패한 시도가 흔적을 남기지 않아 같은 DB에 다시 넣을 수 있다
    assert.equal(await seedDemoCouncil(db, 'u1', now, storage.deps), 'created')
    assert.equal(await count(pg, 'council', `school_name = '${DEMO_SCHOOL_NAME}'`), 1)
  } finally {
    await close()
  }
})

test('같은 학교 이름이 있으면 아무것도 바꾸지 않고 이미 있다로 멈춘다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    await googleUser(pg, 'u1')
    const storage = demoStorage()
    await seedDemoCouncil(db, 'u1', now, storage.deps)
    const before = [
      await count(pg, 'record'),
      await count(pg, 'record_version'),
      await count(pg, 'users'),
    ]
    const putsBefore = storage.puts.length
    assert.equal(await seedDemoCouncil(db, 'u1', now, storage.deps), 'exists')
    assert.deepEqual(
      [await count(pg, 'record'), await count(pg, 'record_version'), await count(pg, 'users')],
      before,
    )
    assert.equal(storage.puts.length, putsBefore)
  } finally {
    await close()
  }
})

test('Google 계정이 없으면 아무것도 남지 않는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    await pg.query("INSERT INTO users (id, name, email) VALUES ('x', 'x', 'x@example.test')")
    await assert.rejects(
      seedDemoCouncil(db, 'x', now, demoStorage().deps),
      /An existing Google user is required/,
    )
    assert.equal(await count(pg, 'council'), 0)
    assert.equal(await count(pg, 'users'), 1)
  } finally {
    await close()
  }
})

test('시험 학생회와 섞이지 않는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    await googleUser(pg, 'u1')
    const testCouncil = await seedTestCouncil(db, 'u1', now)
    await seedDemoCouncil(db, 'u1', now, demoStorage().deps)
    assert.equal(await count(pg, 'council'), 2)
    // 시험 학생회에는 시연 내용이 들어가지 않고, 시험 명령은 시연 학생회를 건드리지 않는다.
    assert.equal(
      await count(pg, 'event', `id IN (SELECT id FROM record WHERE council_id = '${testCouncil}')`),
      0,
    )
    assert.equal(await seedTestCouncil(db, 'u1', now), testCouncil)
    assert.equal(await count(pg, 'council'), 2)
  } finally {
    await close()
  }
})
