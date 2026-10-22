import assert from 'node:assert/strict'
import { test } from 'node:test'
import { HOME_LIST_LIMIT, type HomeResponse, type TasksResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createTaskRoutes } from '../tasks/routes.js'
import { createHomeRoutes } from './routes.js'

// 한국 시각 2026-10-25 12:00
const noon = new Date('2026-10-25T03:00:00Z')
const due = (date: string) => new Date(`${date}T23:59:59+09:00`)

type Council = Awaited<ReturnType<typeof seedCouncil>>
type Values = Record<string, unknown>

async function start(clock = () => noon) {
  const { pg, db, close } = await createTestDb()
  const council = await seedCouncil(db, pg)
  const other = await seedCouncil(db, pg, 'o')
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      tasks: createTaskRoutes(db, testSession, { clock: () => clock() }),
      home: createHomeRoutes(db, testSession, { clock: () => clock() }),
    }),
  )
  const base = `/api/organizations/${council.councilId}`
  const mine = council.people.planningMember
  const make = (values: Values, owner: Council = council) =>
    db.transaction(tx =>
      createRecord(tx, {
        kind: 'task',
        councilId: owner.councilId,
        actor: owner.people.president.memberId,
        values: { title: '현수막 주문', assigneeId: mine.memberId, ...values },
      }),
    )
  const change = (id: string, changes: Values) =>
    db.transaction(tx =>
      updateRecord(tx, {
        kind: 'task',
        id,
        actor: council.people.planningHead.memberId,
        reason: null,
        changes,
      }),
    )
  const home = async (user = mine.userId) => {
    const response = await api.get(`${base}/home`, user)
    assert.equal(response.status, 200)
    return (await response.json()) as HomeResponse
  }
  const listed = async () =>
    (await (await api.get(`${base}/tasks?view=mine`, mine.userId)).json()) as TasksResponse
  return { council, other, api, base, make, change, home, listed, close }
}

test('내 업무는 나에게 맡긴 끝나지 않은 업무를 지남·오늘·7일 안 차례로 마감 순으로 주고 수를 센다', async () => {
  const t = await start()
  try {
    await t.make({ title: '이번 주', dueAt: due('2026-10-31') })
    await t.make({ title: '오늘', dueAt: due('2026-10-25') })
    await t.make({ title: '어제', dueAt: due('2026-10-24') })
    await t.make({ title: '일곱째 날', dueAt: due('2026-11-01') })
    await t.make({ title: '여덟째 날', dueAt: due('2026-11-02') })
    await t.make({ title: '마감 없음' })
    const { today, mine } = await t.home()
    assert.equal(today, '2026-10-25')
    assert.deepEqual(
      mine.tasks.map(row => [row.title, row.group]),
      [
        ['어제', 'overdue'],
        ['오늘', 'today'],
        ['이번 주', 'soon'],
        ['일곱째 날', 'soon'],
      ],
    )
    assert.deepEqual(mine.counts, { overdue: 1, today: 1, soon: 2, later: 1, noDue: 1 })
  } finally {
    await t.close()
  }
})

test('끝난 업무, 지운 업무, 남의 업무, 다른 학생회 업무는 없다', async () => {
  const t = await start()
  try {
    const { planningHead } = t.council.people
    await t.make({ title: '내 것', dueAt: due('2026-10-25') })
    await t.make({ title: '끝남', dueAt: due('2026-10-24'), status: 'done' })
    const gone = await t.make({ title: '지움', dueAt: due('2026-10-24') })
    await t.change(gone, { cancelledAt: clockNow })
    await t.make({ title: '남의 것', dueAt: due('2026-10-24'), assigneeId: planningHead.memberId })
    await t.make({ title: '담당자 없음', dueAt: due('2026-10-24'), assigneeId: null })
    await t.make(
      {
        title: '다른 학생회 것',
        dueAt: due('2026-10-24'),
        assigneeId: t.other.people.president.memberId,
      },
      t.other,
    )
    const { mine } = await t.home()
    assert.deepEqual(
      mine.tasks.map(row => row.title),
      ['내 것'],
    )
    assert.deepEqual(mine.counts, { overdue: 0, today: 1, soon: 0, later: 0, noDue: 0 })
    assert.equal((await t.home(planningHead.userId)).mine.tasks[0]?.title, '남의 것')
  } finally {
    await t.close()
  }
})

test('한국 날짜 경계: 23:59:59는 오늘이고 다음 날 00:00:00부터 지남이며 업무 화면의 overdue와 같다', async () => {
  let now = new Date('2026-10-25T14:59:59Z')
  const t = await start(() => now)
  try {
    await t.make({ title: '마감', dueAt: due('2026-10-25') })
    const before = (await t.home()).mine
    assert.deepEqual(before.counts.overdue, 0)
    assert.deepEqual(before.counts.today, 1)
    assert.equal((await t.listed()).tasks[0]?.overdue, false)
    now = new Date('2026-10-25T15:00:00Z')
    const after = await t.home()
    assert.equal(after.today, '2026-10-26')
    assert.deepEqual(after.mine.counts.overdue, 1)
    assert.equal(after.mine.tasks[0]?.group, 'overdue')
    assert.equal(after.mine.tasks[0]?.overdue, true)
    assert.equal((await t.listed()).tasks[0]?.overdue, true)
    // 7일 안의 끝은 오늘 + 7일 한국 날짜다.
    await t.make({ title: '끝날', dueAt: due('2026-11-02') })
    await t.make({ title: '넘음', dueAt: due('2026-11-03') })
    const { counts } = (await t.home()).mine
    assert.deepEqual([counts.soon, counts.later], [1, 1])
  } finally {
    await t.close()
  }
})

test('줄은 10개까지고 수는 전체를 센다', async () => {
  const t = await start()
  try {
    for (let day = 1; day <= HOME_LIST_LIMIT + 2; day++)
      await t.make({ title: `업무 ${day}`, dueAt: due('2026-10-24') })
    const { mine } = await t.home()
    assert.equal(mine.tasks.length, HOME_LIST_LIMIT)
    assert.equal(mine.counts.overdue, HOME_LIST_LIMIT + 2)
  } finally {
    await t.close()
  }
})

test('운영진이 아니면 403, 다른 학생회 사람도 403, 형식이 틀린 번호는 403, 로그인하지 않으면 401이다', async () => {
  const t = await start()
  try {
    for (const user of ['s-ended', 'o-president', 'stranger'])
      assert.equal((await t.api.get(`${t.base}/home`, user)).status, 403, user)
    assert.equal((await t.api.get(`${t.base}/home`)).status, 401)
    assert.equal(
      (await t.api.get(`${t.base.replace(t.council.councilId, 'bad')}/home`, 's-president')).status,
      403,
    )
  } finally {
    await t.close()
  }
})

test('JSON 응답은 no-store이고 부서·학생회 직급과 재정 역할이 없으면 다른 부분이 없다', async () => {
  const t = await start()
  try {
    const response = await t.api.get(`${t.base}/home`, 's-planningMember')
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(Object.keys((await response.json()) as object).sort(), ['mine', 'today'])
  } finally {
    await t.close()
  }
})
