import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { HomeEventLane, HomeResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'
import { createHomeRoutes } from './routes.js'

// 회장단 홈 ② 행사(e6 가로 시간 축, 시연 조각 ㉰). 한국 시각 2026-10-25(일) 12:00.
const now = new Date('2026-10-25T03:00:00Z')
const at = (value: string) => new Date(`${value}+09:00`)
const due = (date: string) => new Date(`${date}T23:59:59+09:00`)

function open(t: SettlementKit) {
  const home = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      home: createHomeRoutes(t.db, testSession, { clock: () => now }),
    }),
  )
  const lanes = async (user = 's-president', owner = t.council) => {
    const response = await home.get(`/api/organizations/${owner.councilId}/home`, user)
    assert.equal(response.status, 200, user)
    const board = ((await response.json()) as HomeResponse).councilBoard
    assert.ok(board, `${user}의 회장단 홈`)
    return board.lanes
  }
  const event = (name: string, values: Record<string, unknown> = {}, owner = t.council) =>
    t.event({ name, place: '학생회실', ...values }, owner)
  return { lanes, event }
}

const names = (events: HomeEventLane[]) => events.map(row => row.event.name)
const laneOf = (events: HomeEventLane[], name: string) => {
  const lane = events.find(row => row.event.name === name)
  assert.ok(lane, name)
  return lane
}

test('행사는 다음 일정이 가까운 순으로 셋이고, 다음 일정은 신청 마감·신청 시작·행사 시작·진행 중이면 행사 종료 가운데 가장 이른 것이다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    await h.event('진행 중', {
      startsAt: at('2026-10-25T09:00:00'),
      endsAt: at('2026-10-26T18:00:00'),
    })
    const recruiting = await h.event('신청 중', { startsAt: at('2026-11-01T10:00:00') })
    await t.form(recruiting, t.council, {
      opensAt: at('2026-10-20T09:00:00'),
      closesAt: at('2026-10-27T18:00:00'),
    })
    await h.event('사흘 뒤', { startsAt: at('2026-10-28T10:00:00') })
    await h.event('날짜 미정', { startsAt: null })
    await h.event('끝남', { startsAt: at('2026-10-20T10:00:00') })
    await h.event('다른 학생회', { startsAt: at('2026-10-26T10:00:00') }, t.other)
    const { events, total } = await h.lanes()
    assert.deepEqual(names(events), ['진행 중', '신청 중', '사흘 뒤'])
    assert.deepEqual(
      events.map(row => row.milestone),
      [
        { kind: 'event_end', date: '2026-10-26', days: 1 },
        { kind: 'registration_close', date: '2026-10-27', days: 2 },
        { kind: 'event_start', date: '2026-10-28', days: 3 },
      ],
    )
    assert.equal(events[0]!.event.status, 'ongoing')
    // 머리 수는 끝나지 않은 행사(기획 중 + 진행 중)다.
    assert.equal(total, 4)
  })()
})

test('일정 미정 행사는 맨 뒤이고 다음 일정이 없다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    await h.event('날짜 미정', { startsAt: null })
    await h.event('다음 달', { startsAt: at('2026-11-20T10:00:00') })
    const { events } = await h.lanes()
    assert.deepEqual(names(events), ['다음 달', '날짜 미정'])
    assert.equal(events[1]!.milestone, null)
    assert.deepEqual(events[0]!.milestone, { kind: 'event_start', date: '2026-11-20', days: 26 })
  })()
})

test('신청은 받는 중·정원 참 양식만 싣고 여럿이면 마감이 이른 것이며, 멈춘 양식은 다음 일정에도 들지 않는다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const id = await h.event('행사', { startsAt: at('2026-11-10T10:00:00') })
    const full = await t.form(id, t.council, {
      opensAt: at('2026-10-20T09:00:00'),
      closesAt: at('2026-10-30T18:00:00'),
      capacity: 2,
    })
    await t.registration(full)
    await t.registration(full)
    await t.form(id, t.council, { closesAt: at('2026-11-05T18:00:00'), capacity: 40 })
    const paused = await t.form(id, t.council, { closesAt: at('2026-10-26T18:00:00') })
    await t.pg.query(`UPDATE registration_form SET paused_at = now() WHERE id = $1`, [paused])
    const lane = laneOf((await h.lanes()).events, '행사')
    assert.deepEqual(lane.registration, { formId: full, count: 2, capacity: 2, full: true })
    assert.deepEqual(lane.milestone, { kind: 'registration_close', date: '2026-10-30', days: 5 })
  })()
})

test('장소 미정과 늦은 부서(지남 많은 순, 학생회 업무는 부서 없음)를 싣는다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const id = await h.event('행사', { startsAt: at('2026-11-10T10:00:00'), place: null })
    const planning = t.council.departments.planning
    const task = (values: Record<string, unknown>) =>
      t.make(t.council, 'task', { title: '업무', eventId: id, ...values })
    await task({ departmentId: planning, dueAt: due('2026-10-20') })
    await task({ departmentId: planning, dueAt: due('2026-10-21') })
    await task({ dueAt: due('2026-10-22') })
    await task({ departmentId: planning, dueAt: due('2026-10-30') })
    const lane = laneOf((await h.lanes()).events, '행사')
    assert.deepEqual(lane.undecided, ['place'])
    assert.deepEqual(lane.late, [
      { department: { id: planning, name: '기획부' }, overdue: 2 },
      { department: null, overdue: 1 },
    ])
    assert.deepEqual(laneOf((await h.lanes()).events, '행사').registration, null)
  })()
})

test('예산 신호는 회계 기간이 있을 때만이고, 지출 예산 항목이 없는 행사는 예산 미정이다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const id = await h.event('행사', { startsAt: at('2026-11-10T10:00:00') })
    const other = await h.event('예산 있음', { startsAt: at('2026-11-11T10:00:00') })
    assert.equal(laneOf((await h.lanes()).events, '행사').budget, null)
    const { budget } = await t.budgetOf()
    await t.budgetItem(budget, { eventId: other })
    const { events } = await h.lanes()
    assert.deepEqual(laneOf(events, '행사').budget, { kind: 'undecided' })
    assert.equal(laneOf(events, '예산 있음').budget, null)
    assert.ok(id)
  })()
})

test('행사 색은 완료하지 않은 행사를 만든 차례로 팔레트에서 고르고, 완료한 행사는 색을 쓰지 않는다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const done = await h.event('완료', { startsAt: at('2026-10-10T10:00:00') })
    await t.completion(done, 'completed', new Date('2026-10-12T03:00:00Z'))
    await h.event('첫째', { startsAt: at('2026-11-01T10:00:00') })
    await h.event('둘째', { startsAt: at('2026-11-02T10:00:00') })
    await h.event('셋째', { startsAt: at('2026-11-03T10:00:00') })
    const { events } = await h.lanes()
    assert.deepEqual(
      events.map(row => [row.event.name, row.event.color]),
      [
        ['첫째', 'lime'],
        ['둘째', 'sky'],
        ['셋째', 'violet'],
      ],
    )
  })()
})
