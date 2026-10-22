import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EVENT_LIST_LIMIT } from '@vada/contracts'
import { clockNow, createRecord } from '../records/records.js'
import { MISSING, withEvents } from '../test-support/events.js'

// 'YYYY-MM-DDTHH:mm' 또는 초까지 쓴 한국 시각
const korean = (value: string) => new Date(`${value.length === 16 ? `${value}:00` : value}+09:00`)

test(
  '목록은 진행 중, 예정(가까운 순), 날짜 미정(만든 순), 끝남(최근에 끝난 순)이고 상태가 붙는다',
  withEvents(async t => {
    // 지금은 한국 2026-10-25 12:00이다.
    await t.make({
      name: '끝남 오래전',
      startsAt: korean('2026-09-01T10:00'),
      endsAt: korean('2026-09-01T12:00'),
    })
    await t.make({ name: '예정 먼 것', startsAt: korean('2026-12-01T10:00') })
    await t.make({ name: '미정 둘째' })
    await t.make({
      name: '진행 중',
      startsAt: korean('2026-10-25T09:00'),
      endsAt: korean('2026-10-25T18:00'),
    })
    await t.make({ name: '예정 가까운 것', startsAt: korean('2026-10-26T10:00') })
    await t.make({ name: '끝남 최근', startsAt: korean('2026-10-24T10:00') })
    await t.make({ name: '다른 학생회' }, t.other)
    const { events, truncated } = await t.list()
    assert.equal(truncated, false)
    assert.deepEqual(
      events.map(item => [item.name, item.status]),
      [
        ['진행 중', 'ongoing'],
        ['예정 가까운 것', 'upcoming'],
        ['예정 먼 것', 'upcoming'],
        ['미정 둘째', 'tbd'],
        ['끝남 최근', 'ended'],
        ['끝남 오래전', 'ended'],
      ],
    )
  }),
)

test(
  '끝이 없는 행사는 한국 23:59:59까지 진행 중이고 자정에 끝남으로 바뀐다(목록 순서와 상태 모두)',
  withEvents(async t => {
    await t.make({ name: '오늘 행사', startsAt: korean('2026-10-25T14:00') })
    await t.make({ name: '내일 행사', startsAt: korean('2026-10-26T14:00') })
    const states = async () => (await t.list()).events.map(item => `${item.name} ${item.status}`)
    t.setNow(korean('2026-10-25T23:59:58'))
    assert.deepEqual(await states(), ['오늘 행사 ongoing', '내일 행사 upcoming'])
    t.setNow(korean('2026-10-25T23:59:59'))
    assert.deepEqual(await states(), ['오늘 행사 ongoing', '내일 행사 upcoming'])
    t.setNow(korean('2026-10-26T00:00:00'))
    assert.deepEqual(await states(), ['내일 행사 upcoming', '오늘 행사 ended'])
    t.setNow(korean('2026-10-26T13:59:59'))
    assert.deepEqual(await states(), ['내일 행사 upcoming', '오늘 행사 ended'])
    t.setNow(korean('2026-10-26T14:00:00'))
    assert.deepEqual(await states(), ['내일 행사 ongoing', '오늘 행사 ended'])
  }),
)

test(
  '끝이 있는 행사는 끝 시각의 그 초까지 진행 중이다(±1초)',
  withEvents(async t => {
    await t.make({
      name: '행사',
      startsAt: korean('2026-10-25T09:00'),
      endsAt: korean('2026-10-25T12:00'),
    })
    t.setNow(korean('2026-10-25T12:00:00'))
    assert.equal((await t.list()).events[0]?.status, 'ongoing')
    t.setNow(korean('2026-10-25T12:00:01'))
    assert.equal((await t.list()).events[0]?.status, 'ended')
  }),
)

test(
  '목록은 200개까지 주고 넘치면 truncated이며 모든 운영진이 본다',
  withEvents(async t => {
    await t.db.transaction(async tx => {
      for (let i = 0; i <= EVENT_LIST_LIMIT; i++)
        await createRecord(tx, {
          kind: 'event',
          councilId: t.council.councilId,
          actor: t.council.people.president.memberId,
          values: { name: `행사 ${i}` },
        })
    })
    const all = await t.list('s-plain')
    assert.equal(all.events.length, EVENT_LIST_LIMIT)
    assert.equal(all.truncated, true)
    assert.equal(all.events[0]?.name, '행사 0')
  }),
)

test(
  '읽기는 401, 다른 학생회 사람과 내보낸 운영진은 403이다',
  withEvents(async t => {
    const id = await t.make({})
    assert.equal((await t.api.get(t.base)).status, 401)
    assert.equal((await t.api.get(`${t.base}/${id}`)).status, 401)
    for (const user of ['o-president', 's-ended']) {
      assert.equal((await t.api.get(t.base, user)).status, 403, user)
      assert.equal((await t.api.get(`${t.base}/${id}`, user)).status, 403, user)
    }
    const foreign = await t.make({}, t.other)
    assert.equal((await t.api.get(`${t.base}/${foreign}`, 's-president')).status, 404)
    assert.equal((await t.api.get(`${t.base}/not-a-uuid`, 's-president')).status, 404)
    assert.equal((await t.api.get(`${t.base}/${MISSING}`, 's-president')).status, 404)
    assert.equal((await t.api.get(`${t.base}/not-a-uuid`, 'o-president')).status, 403)
  }),
)

test(
  '행사 하나는 칸, 책임자, 끝나지 않은 업무 수와 전체 수, 이력, 그 사람의 동작을 준다',
  withEvents(async t => {
    const { planningMember, president } = t.council.people
    const id = await t.make({ name: '축제', ownerId: planningMember.memberId, place: '운동장' })
    const task = (values: Record<string, unknown>, owner = t.council) =>
      t.db.transaction(tx =>
        createRecord(tx, {
          kind: 'task',
          councilId: owner.councilId,
          actor: president.memberId,
          values: { title: '업무', ...values },
        }),
      )
    await task({ eventId: id })
    await task({ eventId: id, status: 'done' })
    await task({ eventId: id, cancelledAt: clockNow })
    await task({})
    await t.change(id, { place: '강당' })
    const asOwner = await t.detail(id, 's-planningMember')
    assert.deepEqual(asOwner.tasks, { open: 1, total: 2 })
    assert.deepEqual(asOwner.actions, ['event.update'])
    assert.deepEqual(
      asOwner.history.map(v => v.versionNo),
      [1, 2],
    )
    assert.deepEqual(asOwner.history[1]?.changes, [{ field: 'place', from: '운동장', to: '강당' }])
    assert.equal(asOwner.history[1]?.by?.id, president.memberId)
    assert.deepEqual((await t.detail(id, 's-president')).actions, [
      'event.set_owner',
      'event.complete',
    ])
    assert.deepEqual((await t.detail(id, 's-plain')).actions, [])
  }),
)

test(
  '일시가 바뀌면 이력에 한국 시각으로 보이고, 책임자가 떠나면 current:false로 보인다',
  withEvents(async t => {
    const id = await t.make({ name: '축제', startsAt: korean('2026-11-05T14:00') })
    await t.change(id, { startsAt: korean('2026-11-06T09:30'), endsAt: korean('2026-11-06T12:00') })
    const detail = await t.detail(id)
    assert.deepEqual(detail.history[1]?.changes, [
      { field: 'startsAt', from: '2026-11-05T14:00', to: '2026-11-06T09:30' },
      { field: 'endsAt', from: null, to: '2026-11-06T12:00' },
    ])
    await t.change(id, { ownerId: t.council.people.ended.memberId })
    const left = await t.detail(id)
    assert.deepEqual(left.owner, {
      id: t.council.people.ended.memberId,
      name: 's ended',
      current: false,
    })
  }),
)

test(
  '끝 시각 0.5초 뒤에도 그 초가 끝나지 않았으면 진행 중으로 묶여 날짜 미정보다 앞이다',
  withEvents(async t => {
    await t.make({ name: '미정' })
    await t.make({
      name: '끝 있는 행사',
      startsAt: korean('2026-10-25T09:00'),
      endsAt: korean('2026-10-25T12:00'),
    })
    await t.make({ name: '끝 없는 행사', startsAt: korean('2026-10-24T14:00') })
    t.setNow(new Date(korean('2026-10-25T12:00:00').getTime() + 500))
    assert.deepEqual(
      (await t.list()).events.map(item => [item.name, item.status]),
      [
        ['끝 있는 행사', 'ongoing'],
        ['미정', 'tbd'],
        ['끝 없는 행사', 'ended'],
      ],
    )
    t.setNow(new Date(korean('2026-10-24T23:59:59').getTime() + 500))
    const names = (await t.list()).events.map(item => item.name)
    assert.deepEqual(names, ['끝 없는 행사', '끝 있는 행사', '미정'])
  }),
)

test(
  '행사 응답은 no-store이다',
  withEvents(async t => {
    const id = await t.make({})
    const responses = [
      await t.api.get(t.base, 's-president'),
      await t.api.get(`${t.base}/${id}`, 's-president'),
      await t.post('', { name: '새 행사' }),
      await t.post(`/${id}/owner`, { ownerId: null }),
    ]
    for (const response of responses) {
      assert.equal(response.headers.get('Cache-Control'), 'no-store')
    }
  }),
)
