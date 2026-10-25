import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sql } from 'drizzle-orm'
import type { CreateCouncilRequest } from '@vada/contracts'
import { createTestDb } from '../db/test-db.js'
import { createPerson, enterCouncil } from './people.js'
import { startFlow } from './server.js'

const DAY_MS = 24 * 60 * 60 * 1000
const WITHIN = 1000
const START = new Date('2026-11-01T03:00:00Z')
const COUNCIL: CreateCouncilRequest = {
  name: '흐름 학생회',
  unit: 'department',
  schoolName: '한양대학교 ERICA',
  cohortName: '2026',
  startsOn: '2026-01-01',
  endsOn: '2026-12-31',
}

type Db = Awaited<ReturnType<typeof createTestDb>>['db']
async function rows<T>(db: Db, query: ReturnType<typeof sql>) {
  const result = await db.execute(query)
  return (Array.isArray(result) ? result : result.rows) as T[]
}
const count = async (db: Db, query: ReturnType<typeof sql>) =>
  Number((await rows<{ n: string }>(db, query))[0]!.n)

async function president(flow: Awaited<ReturnType<typeof startFlow>>) {
  const chief = await createPerson(flow, 'chief', '회장', { googleLinked: true })
  const created = await chief.api.post('/api/organizations/create', COUNCIL)
  assert.equal(created.status, 201)
  const { council } = (await created.json()) as { council: { id: string } }
  const invite = await chief.api.get(`/api/organizations/${council.id}/invite`)
  const { code } = (await invite.json()) as { code: string }
  return { chief, councilId: council.id, code }
}

test('인물은 로그인 수단 없는 계정으로 초대 경로와 동의 경로를 지나 들어온다', async () => {
  const { db, close } = await createTestDb()
  try {
    const flow = await startFlow(db, { start: START, scope: 'connection' })
    const { councilId, code } = await president(flow)
    const vice = await createPerson(flow, 'vice', '부회장')
    await enterCouncil(vice, code)
    assert.equal(
      await count(db, sql`select count(*) n from accounts where user_id = ${vice.userId}`),
      0,
    )
    assert.equal(
      await count(db, sql`select count(*) n from sessions where user_id = ${vice.userId}`),
      0,
    )
    const [user] = await rows<{ email: string }>(
      db,
      sql`select email from users where id = ${vice.userId}`,
    )
    assert.ok(user!.email.endsWith('@demo.vada.invalid'))
    const joined = await count(
      db,
      sql`select count(*) n from council_membership m join member_login l on l.member_id = m.member_id
        join record r on r.id = m.id where l.user_id = ${vice.userId} and r.council_id = ${councilId}`,
    )
    assert.equal(joined, 1)
    const paths = flow.driver.log.map(line => line.replace(/ \d+$/, ''))
    assert.ok(paths.includes('POST /api/organizations/join'))
    assert.ok(paths.includes('GET /api/me/agreement'))
    assert.ok(paths.includes('POST /api/me/agreement'))
    // 같은 흐름의 인물만 머리로 고를 수 있다. 모르는 계정은 401이다.
    const stranger = await flow.app.request('/api/me/councils', {
      headers: { 'x-flow-user': 'nobody' },
    })
    assert.equal(stranger.status, 401)
  } finally {
    await close()
  }
})

test('흐름 전용 계정이 아닌 시험 계정은 Google 연결을 하나 더 가진다', async () => {
  const { db, close } = await createTestDb()
  try {
    const flow = await startFlow(db, { start: START, scope: 'connection' })
    const chief = await createPerson(flow, 'chief', '회장', { googleLinked: true })
    assert.equal(
      await count(db, sql`select count(*) n from accounts where user_id = ${chief.userId}`),
      1,
    )
  } finally {
    await close()
  }
})

test('시각을 사흘 미루면 그 뒤 만든 기록과 판과 대화가 사흘 뒤이고 앱 시계와 1초 안에서 맞는다', async () => {
  const { db, close } = await createTestDb()
  try {
    const flow = await startFlow(db, { start: START, scope: 'connection' })
    const { chief, councilId, code } = await president(flow)
    const finance = await createPerson(flow, 'finance', '재정부원')
    await enterCouncil(finance, code)
    const team = (await (
      await chief.api.get(`/api/organizations/${councilId}/members`)
    ).json()) as {
      members: { id: string; name: string }[]
      departments: { id: string; role: string | null }[]
    }
    const assigned = await chief.api.post(
      `/api/organizations/${councilId}/members/${team.members.find(m => m.name === '재정부원')!.id}/departments`,
      { departmentId: team.departments.find(d => d.role === 'finance')!.id, rank: null },
    )
    assert.equal(assigned.status, 200)
    await flow.driver.advanceBy(3 * DAY_MS)
    const expected = START.getTime() + 3 * DAY_MS
    assert.equal(flow.driver.now().getTime(), expected)
    const rooms = await chief.api.get(`/api/organizations/${councilId}/rooms`)
    const { rooms: list } = (await rooms.json()) as { rooms: { id: string }[] }
    const sent = await chief.api.post(
      `/api/organizations/${councilId}/rooms/${list[0]!.id}/messages`,
      { body: '사흘 뒤' },
    )
    assert.equal(sent.status, 201)
    const [made] = await rows<{ created: string; started: string; sent: string }>(
      db,
      sql`select r.created_at::text created, lower(v.valid)::text started, m.sent_at::text sent
        from message m join record r on r.id = m.id join record_version v on v.record_id = r.id
        where m.body = '사흘 뒤'`,
    )
    for (const value of [made!.created, made!.started, made!.sent])
      assert.ok(Math.abs(new Date(value).getTime() - expected) < WITHIN, value)
    const paid = await finance.api.post(`/api/organizations/${councilId}/fee-payments`, {
      paidFrom: '2026-11-01',
      paidUntil: '2026-12-31',
      students: '20260001',
    })
    assert.equal(paid.status, 200)
    const [fee] = await rows<{ created: string; started: string }>(
      db,
      sql`select r.created_at::text created, lower(v.valid)::text started
        from fee_payment f join record r on r.id = f.id join record_version v on v.record_id = r.id`,
    )
    for (const value of [fee!.created, fee!.started])
      assert.ok(Math.abs(new Date(value).getTime() - expected) < WITHIN, value)
    // 앞서 만든 학생회(미루기 전)는 처음 시각에 있다.
    const [council] = await rows<{ created: string }>(
      db,
      sql`select created_at::text created from record where id = ${councilId}`,
    )
    assert.ok(Math.abs(new Date(council!.created).getTime() - START.getTime()) < WITHIN)
  } finally {
    await close()
  }
})

test('시각을 뒤로 돌리면 드라이버가 던지고 시계는 그대로다', async () => {
  const { db, close } = await createTestDb()
  try {
    const flow = await startFlow(db, { start: START, scope: 'connection' })
    await flow.driver.advanceBy(DAY_MS)
    await assert.rejects(() => flow.driver.travelTo(START))
    await assert.rejects(() => flow.driver.advanceBy(-1))
    assert.equal(flow.driver.now().getTime(), START.getTime() + DAY_MS)
    await flow.driver.travelTo(flow.driver.now())
  } finally {
    await close()
  }
})

test('거래 범위로 건 시계는 바깥 거래의 기록에만 닿고 끝나면 사라진다', async () => {
  const { db, close } = await createTestDb()
  try {
    const councilId = await db.transaction(async tx => {
      const inner = tx as unknown as Db
      const flow = await startFlow(inner, { start: START, scope: 'transaction' })
      const made = await president(flow)
      const [record] = await rows<{ created: string }>(
        inner,
        sql`select created_at::text created from record where id = ${made.councilId}`,
      )
      assert.ok(Math.abs(new Date(record!.created).getTime() - START.getTime()) < WITHIN)
      return made.councilId
    })
    const [after] = await rows<{ v: string | null }>(
      db,
      sql`select current_setting('vada.clock_offset', true) v`,
    )
    assert.ok(!after!.v)
    assert.equal(await count(db, sql`select count(*) n from record where id = ${councilId}`), 1)
  } finally {
    await close()
  }
})
