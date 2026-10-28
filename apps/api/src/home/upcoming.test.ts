import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { HomeResponse, HomeUpcomingItem } from '@vada/contracts'
import { createApp } from '../app.js'
import { clockNow, updateRecord } from '../records/records.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'
import { createHomeRoutes } from './routes.js'

// 한국 시각 2026-10-25(일) 12:00. 가까운 일정은 오늘(10-25)부터 7일째(11-01) 끝까지다.
const now = new Date('2026-10-25T03:00:00Z')
const due = (date: string) => new Date(`${date}T23:59:59+09:00`)
const at = (value: string) => new Date(`${value}+09:00`)
// 양식만 보려는 행사의 시작은 범위 밖에 둔다.
const FAR = at('2026-12-01T10:00:00')

function open(t: SettlementKit) {
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      home: createHomeRoutes(t.db, testSession, { clock: () => now }),
    }),
  )
  const read = async (user: string) => {
    const response = await api.get(`/api/organizations/${t.council.councilId}/home`, user)
    assert.equal(response.status, 200, user)
    return ((await response.json()) as HomeResponse).upcoming
  }
  const task = (values: Record<string, unknown>, owner = t.council) =>
    t.make(owner, 'task', { title: '업무', ...values })
  return { read, task }
}

// 줄을 '종류 이름 날짜 시각'으로 읽는다.
const label = (item: HomeUpcomingItem) => {
  const name =
    item.kind === 'task_due'
      ? item.task.title
      : item.kind === 'registration_close'
        ? item.form.name
        : item.kind === 'schedule_item'
          ? item.item.title
          : item.event.name
  return `${item.kind} ${name} ${item.date}${item.time ? ` ${item.time}` : ''}`
}
const labels = async (h: ReturnType<typeof open>, user: string) =>
  (await h.read(user)).items.map(label)

test(
  '가까운 일정은 모든 홈에서 읽기 범위를 따르고 종일은 업무 뒤·시각은 시각순이다',
  withSettlement(async t => {
    const h = open(t)
    const make = (values: Record<string, unknown>, owner = t.council) =>
      t.make(owner, 'schedule_item', {
        type: 'other',
        title: '종일',
        startsOn: '2026-10-25',
        ...values,
      })
    const day = await make({})
    const spanning = await make({ title: '진행 중', startsOn: '2026-10-23', endsOn: '2026-10-26' })
    const timed = await make({ title: '시각', startsOn: null, startsAt: at('2026-10-25T09:00:00') })
    const timedOverlap = await make({
      title: '이어지는 답사',
      startsOn: null,
      startsAt: at('2026-10-24T15:00:00'),
      endsAt: at('2026-10-26T18:00:00'),
    })
    const privateId = await make({
      title: '부서',
      visibility: 'department',
      departmentId: t.council.departments.planning,
    })
    await make({ title: '밖', startsOn: '2026-11-02' })
    await make({ title: '끝남', startsOn: '2026-10-24' })
    await make({ title: '취소', cancelledAt: now })
    await make({ title: '다른 학생회' }, t.other)
    await h.task({
      title: '업무 마감',
      dueAt: due('2026-10-25'),
      assigneeId: t.council.people.plain.memberId,
    })
    for (const user of [
      's-president',
      's-planningHead',
      's-planningMember',
      's-financeMember',
      's-plain',
    ]) {
      const response = await h.read(user)
      const ids = response.items.flatMap(item =>
        item.kind === 'schedule_item' ? item.item.id : [],
      )
      assert.deepEqual(
        new Set(ids),
        new Set(
          ['s-president', 's-planningHead', 's-planningMember'].includes(user)
            ? [day, spanning, timed, timedOverlap, privateId]
            : [day, spanning, timed, timedOverlap],
        ),
      )
    }
    const response = await h.read('s-plain')
    assert.equal(response.items[2]?.kind, 'task_due')
    assert.equal(response.items[3]?.kind, 'schedule_item')
    assert.equal(response.items[3]?.time, null)
    assert.equal(response.items.at(-1)?.time, '09:00')
    const overlap = response.items.find(
      item => item.kind === 'schedule_item' && item.item.id === spanning,
    )
    assert.equal(overlap?.date, '2026-10-23')
    const ongoing = response.items.find(
      item => item.kind === 'schedule_item' && item.item.id === timedOverlap,
    )
    assert.equal(ongoing?.date, '2026-10-24')
    assert.equal(ongoing?.time, '15:00')
  }),
)

test('가까운 일정은 오늘 0시부터 7일째 23:59:59까지(한국)이고 8일째와 전날은 없다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    await t.event({ name: '전날 끝', startsAt: at('2026-10-24T23:59:59') })
    await t.event({ name: '오늘 0시', startsAt: at('2026-10-25T00:00:00') })
    await t.event({ name: '7일째 끝', startsAt: at('2026-11-01T23:59:59') })
    await t.event({ name: '8일째 0시', startsAt: at('2026-11-02T00:00:00') })
    const host = await t.event({ name: '양식 행사', startsAt: FAR })
    await t.form(host, t.council, { name: '전날 마감', closesAt: at('2026-10-24T23:59:59') })
    await t.form(host, t.council, { name: '오늘 마감', closesAt: at('2026-10-25T00:00:00') })
    await t.form(host, t.council, { name: '7일째 마감', closesAt: at('2026-11-01T23:59:59') })
    await t.form(host, t.council, { name: '8일째 마감', closesAt: at('2026-11-02T00:00:00') })
    await h.task({ title: '어제 마감', dueAt: due('2026-10-24') })
    await h.task({ title: '오늘 마감 업무', dueAt: due('2026-10-25') })
    await h.task({ title: '7일째 업무', dueAt: due('2026-11-01') })
    await h.task({ title: '8일째 업무', dueAt: due('2026-11-02') })
    assert.deepEqual(await labels(h, 's-president'), [
      'task_due 오늘 마감 업무 2026-10-25',
      'event_start 오늘 0시 2026-10-25 00:00',
      'registration_close 오늘 마감 2026-10-25 00:00',
      'task_due 7일째 업무 2026-11-01',
      'event_start 7일째 끝 2026-11-01 23:59',
      'registration_close 7일째 마감 2026-11-01 23:59',
    ])
  })()
})

test('같은 날에는 종일인 업무 마감이 앞이고 그다음 시각순이며, 완료 행사·끝난 업무·지운 업무는 없다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    await t.event({ name: '저녁 행사', startsAt: at('2026-10-26T20:00:00') })
    const morning = await t.event({ name: '아침 행사', startsAt: at('2026-10-27T09:00:00') })
    await t.form(morning, t.council, { name: '저녁 마감', closesAt: at('2026-10-27T18:00:00') })
    await h.task({ title: '종일 업무', dueAt: due('2026-10-27') })
    await h.task({ title: '끝난 업무', dueAt: due('2026-10-27'), status: 'done' })
    const gone = await h.task({ title: '지운 업무', dueAt: due('2026-10-27') })
    await t.db.transaction(tx =>
      updateRecord(tx, {
        kind: 'task',
        id: gone,
        actor: t.council.people.president.memberId,
        reason: null,
        changes: { cancelledAt: clockNow },
      }),
    )
    const done = await t.event({ name: '완료 행사', startsAt: at('2026-10-25T00:30:00') })
    await t.form(done, t.council, { name: '완료 행사 양식', closesAt: at('2026-10-28T10:00:00') })
    await t.completion(done, 'completed', new Date('2026-10-25T02:00:00Z'))
    assert.deepEqual(await labels(h, 's-president'), [
      'event_start 저녁 행사 2026-10-26 20:00',
      'task_due 종일 업무 2026-10-27',
      'event_start 아침 행사 2026-10-27 09:00',
      'registration_close 저녁 마감 2026-10-27 18:00',
    ])
  })()
})

test('범위: 회장단은 학생회 전체, 부원·부서장은 그 부서, 부서 없는 운영진은 학생회 행사와 내 업무 마감이다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const { planning, finance } = t.council.departments
    const { plain, planningHead } = t.council.people
    const ours = await t.event({ name: '기획 행사', startsAt: at('2026-10-29T10:00:00') })
    await t.form(ours, t.council, { name: '기획 양식', closesAt: at('2026-10-28T10:00:00') })
    // 기획 행사의 다음 마감(부서장 카드에 이미 보인다)
    await h.task({
      title: '기획 행사 업무',
      eventId: ours,
      departmentId: planning,
      dueAt: due('2026-10-26'),
    })
    const theirs = await t.event({ name: '재정 행사', startsAt: at('2026-10-30T10:00:00') })
    await t.form(theirs, t.council, { name: '재정 양식', closesAt: at('2026-10-29T12:00:00') })
    await h.task({
      title: '재정 행사 업무',
      eventId: theirs,
      departmentId: finance,
      dueAt: due('2026-11-05'),
    })
    await h.task({ title: '기획 업무', departmentId: planning, dueAt: due('2026-10-27') })
    await h.task({ title: '재정 업무', departmentId: finance, dueAt: due('2026-10-27') })
    await h.task({ title: '내 업무', assigneeId: plain.memberId, dueAt: due('2026-10-28') })
    await h.task({
      title: '학생회 업무',
      assigneeId: planningHead.memberId,
      dueAt: due('2026-10-28'),
    })
    const all = [
      'task_due 기획 행사 업무 2026-10-26',
      'task_due 기획 업무 2026-10-27',
      'task_due 재정 업무 2026-10-27',
      'task_due 내 업무 2026-10-28',
      'task_due 학생회 업무 2026-10-28',
      'registration_close 기획 양식 2026-10-28 10:00',
      'event_start 기획 행사 2026-10-29 10:00',
      'registration_close 재정 양식 2026-10-29 12:00',
      'event_start 재정 행사 2026-10-30 10:00',
    ]
    assert.deepEqual(await labels(h, 's-president'), all)
    const planningScope = [
      'task_due 기획 행사 업무 2026-10-26',
      'task_due 기획 업무 2026-10-27',
      'registration_close 기획 양식 2026-10-28 10:00',
      'event_start 기획 행사 2026-10-29 10:00',
    ]
    assert.deepEqual(await labels(h, 's-planningMember'), planningScope)
    // 부서장은 참여 행사 줄의 다음 마감과 같은 업무를 뺀다.
    assert.deepEqual(await labels(h, 's-planningHead'), planningScope.slice(1))
    assert.deepEqual(await labels(h, 's-plain'), [
      'task_due 내 업무 2026-10-28',
      'registration_close 기획 양식 2026-10-28 10:00',
      'event_start 기획 행사 2026-10-29 10:00',
      'registration_close 재정 양식 2026-10-29 12:00',
      'event_start 재정 행사 2026-10-30 10:00',
    ])
    assert.equal((await h.read('s-plain')).total, 5)
  })()
})
