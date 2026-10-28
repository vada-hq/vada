import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CALENDAR_ITEM_LIMIT, type CalendarResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import {
  caller,
  ORIGIN,
  testSession,
  withoutReadsOutsideTransaction,
} from '../test-support/http.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'
import { createCalendarRoutes } from './routes.js'
import { calendarRangeOf } from './range.js'

// UTC로는 전날이다. 지남 판정이 한국 날짜를 쓰는지 확인한다.
const now = new Date('2026-10-27T15:30:00Z')
const at = (value: string) => new Date(`${value}:00+09:00`)
const query = 'from=2026-10-27&to=2026-10-29'

test(
  '일정은 종일·시각 겹침과 부서 공개 범위를 지키고 취소·다른 학생회는 빠진다',
  withSettlement(async t => {
    const h = open(t)
    const make = (values: Record<string, unknown>, owner = t.council) =>
      t.make(owner, 'schedule_item', {
        type: 'academic',
        title: '일정',
        startsOn: '2026-10-26',
        endsOn: '2026-10-27',
        ...values,
      })
    const shared = await make({})
    const privateId = await make({
      visibility: 'department',
      departmentId: t.council.departments.planning,
    })
    const timed = await make({
      startsOn: null,
      endsOn: null,
      startsAt: at('2026-10-26T23:00'),
      endsAt: at('2026-10-27T00:00'),
    })
    const mine = await t.make(
      t.council,
      'schedule_item',
      { type: 'other', title: '내 일정', startsOn: '2026-10-29' },
      t.council.people.planningMember.memberId,
    )
    await make({ startsOn: '2026-10-30', endsOn: null })
    await make({ startsOn: '2026-10-25', endsOn: '2026-10-26' })
    await make({ startsOn: null, endsOn: null, startsAt: at('2026-10-26T23:59'), endsAt: null })
    await make({ cancelledAt: now })
    await make({}, t.other)
    for (const user of ['s-president', 's-vicePresident', 's-planningMember']) {
      const response = await h.read(query, user)
      assert.deepEqual(
        new Set(response.items.map(item => item.key)),
        new Set([shared, privateId, timed, mine].map(id => `schedule_item:${id}`)),
      )
    }
    for (const user of ['s-financeMember', 's-plain']) {
      const response = await h.read(query, user)
      assert.deepEqual(
        new Set(response.items.map(item => item.key)),
        new Set([shared, timed, mine].map(id => `schedule_item:${id}`)),
      )
    }
    const response = await h.read(query, 's-planningMember')
    assert.equal(response.items.find(item => item.key === `schedule_item:${mine}`)?.mine, true)
    assert.deepEqual(
      response.items.find(item => item.key === `schedule_item:${shared}`),
      {
        key: `schedule_item:${shared}`,
        source: 'schedule_item',
        kind: 'academic',
        title: '일정',
        allDay: true,
        start: '2026-10-26',
        end: '2026-10-27',
        place: null,
        event: null,
        department: null,
        mine: false,
        overdue: false,
        target: { record: 'schedule', id: shared },
      },
    )
  }),
)

function open(t: SettlementKit) {
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      calendar: createCalendarRoutes(withoutReadsOutsideTransaction(t.db), testSession, {
        clock: () => now,
      }),
    }),
  )
  const path = `/api/organizations/${t.council.councilId}/calendar`
  const get = (q = query, user: string | undefined = 's-president') => api.get(`${path}?${q}`, user)
  const read = async (q = query, user = 's-president') => {
    const response = await get(q, user)
    assert.equal(response.status, 200)
    return (await response.json()) as CalendarResponse
  }
  const task = (values: Record<string, unknown>, owner = t.council) =>
    t.make(owner, 'task', { title: '업무', ...values })
  return { api, path, get, read, task }
}

test('범위는 한국 0시부터 끝 날 다음 0시 전까지이고 연말도 넘긴다', () => {
  assert.deepEqual(calendarRangeOf({ from: '2999-12-31', to: '2999-12-31' }), {
    from: new Date('2999-12-30T15:00:00Z'),
    until: new Date('2999-12-31T15:00:00Z'),
  })
})

test(
  '권한과 네 원본은 읽기 전용 REPEATABLE READ 거래 하나에서 읽는다',
  withSettlement(async t => {
    const queries: string[] = []
    const db = t.drizzle({
      logger: {
        logQuery: query => {
          queries.push(query)
        },
      },
    })
    const api = caller(
      createApp({
        auth: { handler: async () => new Response() },
        trustedOrigin: ORIGIN,
        calendar: createCalendarRoutes(db, testSession, { clock: () => now }),
      }),
    )
    const response = await api.get(
      `/api/organizations/${t.council.councilId}/calendar?${query}`,
      's-president',
    )
    assert.equal(response.status, 200)
    assert.equal(queries[0], 'set transaction isolation level repeatable read read only')
    assert.ok(queries.slice(1).every(query => query.startsWith('select ')))
    for (const source of ['event', 'task', 'registration_form', 'request']) {
      const read = queries.find(query => query.includes(`from "${source}"`))
      assert.ok(read?.includes('"record"."council_id"'), source)
    }
  }),
)

test(
  '원본 넷의 범위·겹침과 응답: 앞에서 시작한 행사, 경계 시각, 완료 행사도 읽는다',
  withSettlement(async t => {
    const h = open(t)
    const ownerId = t.council.people.president.memberId
    const spanning = await t.event({
      name: '걸친 행사',
      startsAt: at('2026-10-26T10:00'),
      endsAt: at('2026-10-28T18:00'),
      place: '학생회관',
      ownerId,
    })
    const edge = await t.event({
      name: '끝이 경계',
      startsAt: at('2026-10-26T10:00'),
      endsAt: at('2026-10-27T00:00'),
    })
    const done = await t.event({ name: '완료 행사', startsAt: at('2026-10-29T23:59') })
    await t.completion(done, 'completed', now)
    await t.event({
      name: '범위 앞',
      startsAt: at('2026-10-26T10:00'),
      endsAt: at('2026-10-26T23:59'),
    })
    await t.event({ name: '다음 날', startsAt: at('2026-10-30T00:00') })
    await t.event({ name: '일시 없음', startsAt: null })
    const form = await t.form(spanning, t.council, {
      name: '신청 양식',
      closesAt: at('2026-10-27T00:00'),
    })
    await t.form(spanning, t.council, { name: '밖 양식', closesAt: at('2026-10-30T00:00') })
    await t.form(spanning, t.council, { name: '앞 양식', closesAt: at('2026-10-26T23:59') })
    const task = await h.task({
      title: '마감',
      dueAt: at('2026-10-29T23:59'),
      eventId: spanning,
      departmentId: t.council.departments.planning,
    })
    await h.task({ title: '밖 업무', dueAt: at('2026-10-30T00:00') })
    await h.task({ title: '앞 업무', dueAt: at('2026-10-26T23:59') })
    await h.task({ title: '마감 없음' })
    const purchase = await t.requestWithItem(spanning, { neededBy: '2026-10-29' })
    await t.requestWithItem(spanning, { title: '밖 구매', neededBy: '2026-10-30' })
    await t.requestWithItem(spanning, { title: '앞 구매', neededBy: '2026-10-26' })
    await t.requestWithItem(spanning)
    const response = await h.read()
    assert.equal(response.truncated, false)
    assert.deepEqual(
      new Set(response.items.map(item => item.key)),
      new Set([
        `event:${spanning}`,
        `event:${edge}`,
        `event:${done}`,
        `registration_close:${form}`,
        `task_due:${task}`,
        `purchase_needed_by:${purchase.request}`,
      ]),
    )
    assert.deepEqual(
      response.items.find(item => item.key === `event:${spanning}`),
      {
        key: `event:${spanning}`,
        source: 'event',
        kind: 'event',
        title: '걸친 행사',
        allDay: false,
        start: '2026-10-26T10:00',
        end: '2026-10-28T18:00',
        place: '학생회관',
        event: null,
        department: null,
        mine: true,
        overdue: false,
        target: { record: 'events', id: spanning, tab: 'overview' },
      },
    )
    const formItem = response.items.find(item => item.source === 'registration_close')!
    assert.equal(formItem.title, '신청 양식')
    assert.deepEqual(formItem.event, { id: spanning, name: '걸친 행사' })
    assert.deepEqual(formItem.target, { record: 'events', id: spanning, tab: 'registrations' })
    assert.equal(formItem.mine, true)
    assert.equal(formItem.overdue, false)
    const taskItem = response.items.find(item => item.source === 'task_due')!
    assert.deepEqual(taskItem.department, { id: t.council.departments.planning, name: '기획부' })
    assert.deepEqual(taskItem.event, { id: spanning, name: '걸친 행사' })
    assert.deepEqual(taskItem.target, { record: 'tasks', id: task })
    assert.deepEqual(response.items.find(item => item.source === 'purchase_needed_by')?.target, {
      record: 'purchases',
      id: purchase.request,
    })
  }),
)

test(
  '취소·끝난 업무와 구매는 빼고 승인만 된 구매·빈 요청은 남긴다',
  withSettlement(async t => {
    const h = open(t)
    await h.task({ dueAt: at('2026-10-28T23:59'), status: 'done' })
    await h.task({ dueAt: at('2026-10-28T23:59'), cancelledAt: now })
    await t.requestWithItem(null, { neededBy: '2026-10-28', cancelledAt: now })
    for (const outcome of ['rejected', 'cancelled', 'approved'] as const) {
      const p = await t.requestWithItem(null, { neededBy: '2026-10-28' })
      await t.approve(p.line, outcome)
      if (outcome === 'approved') await t.pay(await t.expense(), p.line)
    }
    const approved = await t.requestWithItem(null, { neededBy: '2026-10-28', title: '승인만' })
    await t.approve(approved.line)
    const empty = await t.make(t.council, 'request', {
      type: 'purchase',
      title: '품목 없음',
      requestedBy: t.council.people.president.memberId,
      neededBy: '2026-10-28',
    })
    assert.deepEqual(
      new Set((await h.read()).items.map(item => item.key)),
      new Set([`purchase_needed_by:${approved.request}`, `purchase_needed_by:${empty}`]),
    )
  }),
)

test(
  '모든 운영진은 학생회 전체를 읽고 타 학생회 원본 넷은 섞이지 않는다',
  withSettlement(async t => {
    const h = open(t)
    const theirs = await t.event({ startsAt: now }, t.other)
    await t.form(theirs, t.other, { closesAt: now })
    await h.task({ dueAt: now }, t.other)
    await t.requestWithItem(theirs, { neededBy: '2026-10-28' }, t.other)
    const ours = await t.event({ startsAt: now })
    await t.form(ours, t.council, { closesAt: now })
    await h.task({ dueAt: now, departmentId: t.council.departments.finance })
    await t.requestWithItem(ours, { neededBy: '2026-10-28' })
    for (const user of ['s-president', 's-planningMember', 's-plain']) {
      const items = (await h.read(query, user)).items
      assert.equal(items.length, 4)
      assert.deepEqual(
        new Set(items.map(item => item.source)),
        new Set(['event', 'task_due', 'registration_close', 'purchase_needed_by']),
      )
      assert.ok(items.every(item => item.event === null || item.event.id === ours))
    }
  }),
)

test(
  '정렬은 날짜·종일·시각·종류·key이며 mine과 overdue는 한국 날짜 기준이다',
  withSettlement(async t => {
    const h = open(t)
    const mine = t.council.people.plain.memberId
    const host = await t.event({ name: '아침', startsAt: at('2026-10-28T00:00'), ownerId: mine })
    const earlier = await t.event({ name: '전날', startsAt: at('2026-10-27T23:59') })
    const later = await t.event({ name: '저녁', startsAt: at('2026-10-28T18:00') })
    const form = await t.form(host, t.council, { closesAt: at('2026-10-28T00:00') })
    const tasks: string[] = []
    for (const day of ['27', '28', '28', '29'])
      tasks.push(await h.task({ dueAt: at(`2026-10-${day}T23:59`), assigneeId: mine }))
    const requests: string[] = []
    for (const day of ['27', '28', '29'])
      requests.push(
        (await t.requestWithItem(null, { neededBy: `2026-10-${day}`, requestedBy: mine })).request,
      )
    const { items } = await h.read(query, 's-plain')
    assert.deepEqual(
      items.map(item => item.key),
      [
        `purchase_needed_by:${requests[0]}`,
        `task_due:${tasks[0]}`,
        `event:${earlier}`,
        `purchase_needed_by:${requests[1]}`,
        ...tasks
          .slice(1, 3)
          .sort()
          .map(id => `task_due:${id}`),
        `event:${host}`,
        `registration_close:${form}`,
        `event:${later}`,
        `purchase_needed_by:${requests[2]}`,
        `task_due:${tasks[3]}`,
      ],
    )
    for (const item of items) {
      assert.equal(item.overdue, item.allDay && item.start === '2026-10-27', item.key)
      assert.equal(
        item.mine,
        item.key !== `event:${earlier}` && item.key !== `event:${later}`,
        item.key,
      )
    }
  }),
)

test(
  '정렬한 뒤 500줄로 자르고 정확히 상한이면 truncated가 아니다',
  withSettlement(async t => {
    const h = open(t)
    await t.pg.query(
      `WITH made AS (
    INSERT INTO record (kind, council_id) SELECT 'task', $1 FROM generate_series(1, $2) RETURNING id
  ) INSERT INTO task (id, title, due_at) SELECT id, '업무', '2026-10-28T23:59:00+09:00' FROM made`,
      [t.council.councilId, CALENDAR_ITEM_LIMIT],
    )
    const exact = await h.read()
    assert.equal(exact.items.length, CALENDAR_ITEM_LIMIT)
    assert.equal(exact.truncated, false)
    const first = await t.event({ startsAt: at('2026-10-27T00:00') })
    const over = await h.read()
    assert.equal(over.items.length, CALENDAR_ITEM_LIMIT)
    assert.equal(over.truncated, true)
    assert.equal(over.items[0]?.key, `event:${first}`)
    assert.deepEqual(over.items.slice(1), exact.items.slice(0, -1))
  }),
)

test(
  '미인증 401, 소속 없음·끝난 소속·다른 학생회 403, 잘못된 쿼리 400',
  withSettlement(async t => {
    const h = open(t)
    assert.equal((await h.api.get(`${h.path}?${query}`)).status, 401)
    for (const user of ['s-ended', 'o-president', 'unknown'])
      assert.equal((await h.get(query, user)).status, 403)
    assert.equal((await h.get('bad=1', 'o-president')).status, 403)
    for (const q of [
      '',
      'from=2026-10-28',
      'from=2026-10-29&to=2026-10-28',
      'from=2026-10-01&to=2027-01-01',
      'from=2026-02-29&to=2026-03-01',
      `${query}&from=2026-10-27`,
      `${query}&unknown=1`,
      'from=x&to=y',
    ])
      assert.equal((await h.get(q)).status, 400, q)
    assert.deepEqual(await h.read(), { items: [], truncated: false })
  }),
)
