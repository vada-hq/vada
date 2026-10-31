import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  EVENT_STATUS_LABEL,
  type EventResponse,
  type EventSettlementsResponse,
  type EventsResponse,
  type HomeResponse,
  type TasksResponse,
} from '@vada/contracts'
import { createApp } from '../app.js'
import { clockNow } from '../records/records.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'
import { createHomeRoutes } from './routes.js'

// 회장단 홈(HOME-01C, 기능 027 조각 6). 수는 원래 화면(행사 목록, 행사 업무 탭, 행사 머리, 재정 '행사 정산' 탭, 업무 화면)과 같다.
// 한국 시각 2026-10-25(일) 12:00. 시험 도구(SettlementKit)의 시계와 같다.
const now = new Date('2026-10-25T03:00:00Z')
const due = (date: string) => new Date(`${date}T23:59:59+09:00`)
const at = (value: string) => new Date(`${value}+09:00`)

function open(t: SettlementKit) {
  const home = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      home: createHomeRoutes(t.db, testSession, { clock: () => now }),
    }),
  )
  const root = `/api/organizations/${t.council.councilId}`
  const get = async <T>(path: string, user = 's-president') => {
    const response = await (path.endsWith('/home') ? home : t.api).get(`${root}${path}`, user)
    assert.equal(response.status, 200, `${path} ${user}`)
    return (await response.json()) as T
  }
  const read = (user = 's-president') => get<HomeResponse>('/home', user)
  const board = async (user = 's-president') => {
    const value = (await read(user)).councilBoard
    assert.ok(value, `${user}의 회장단 홈`)
    return value
  }
  const tasksOf = async (query: string) => (await get<TasksResponse>(`/tasks?${query}`)).tasks
  const task = (values: Record<string, unknown>, owner = t.council) =>
    t.make(owner, 'task', { title: '업무', ...values })
  return { get, read, board, tasksOf, task }
}

test('회장단 행사 카드는 진행 중 → 기획 중(날짜순, 미정은 끝) 셋이고 상태별 수가 행사 목록과 같다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const ongoing = await t.event({ name: '진행 중', startsAt: at('2026-10-25T09:00:00') })
    const later = await t.event({ name: '다음 달', startsAt: at('2026-11-20T10:00:00') })
    const soon = await t.event({ name: '다음 주', startsAt: at('2026-11-01T10:00:00') })
    await t.event({ name: '날짜 미정', startsAt: null })
    await t.event({ name: '끝남', startsAt: at('2026-10-20T10:00:00') })
    const done = await t.event({ name: '완료', startsAt: at('2026-10-21T10:00:00') })
    await t.completion(done, 'completed', new Date('2026-10-24T03:00:00Z'))
    await t.event({ name: '다른 학생회', startsAt: at('2026-10-25T08:00:00') }, t.other)
    const { events } = await h.board()
    assert.deepEqual(
      events.cards.map(card => card.event.id),
      [ongoing, soon, later],
    )
    // 행사 목록의 상태 칩 이름으로 센 수와 같다(완료는 칩 밖이다).
    const listed = (await h.get<EventsResponse>('/events')).events
    const countOf = (label: string) =>
      listed.filter(row => row.status !== 'completed' && EVENT_STATUS_LABEL[row.status] === label)
        .length
    assert.deepEqual(events.counts, {
      planning: countOf('기획 중'),
      ongoing: countOf('진행 중'),
      followUp: countOf('후속 정리 중'),
    })
    assert.deepEqual(events.counts, { planning: 3, ongoing: 1, followUp: 1 })
    // 카드에 책임자를 싣지 않는다(DEC-95).
    assert.ok(!('owner' in events.cards[0]!.event))
  })()
})

test('행사 카드의 업무 n/m은 행사 업무 탭과, 다음 마감과 이유 칩 수는 행사 머리와 같다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const planning = t.council.departments.planning
    const ongoing = await t.event({ name: '진행 중', startsAt: at('2026-10-25T09:00:00') })
    const upcoming = await t.event({ name: '다음 주', startsAt: at('2026-10-27T10:00:00') })
    await h.task({ eventId: ongoing, departmentId: planning, dueAt: due('2026-10-20') })
    await h.task({ eventId: ongoing, title: '다음 마감', dueAt: due('2026-10-28') })
    await h.task({ eventId: ongoing, dueAt: due('2026-10-30') })
    await h.task({ eventId: ongoing, status: 'done' })
    // 다음 주 행사는 업무 마감보다 행사 시작이 이르다(머리의 다음 일정이 행사 시작).
    await h.task({ eventId: upcoming, title: '늦은 업무', dueAt: due('2026-10-29') })
    const { events } = await h.board()
    const [first, second] = events.cards
    const tab = async (eventId: string, status: string) =>
      (await h.tasksOf(`view=all&event=${eventId}&status=${status}`)).length
    const done = await tab(ongoing, 'done')
    assert.deepEqual(
      { done: first!.tasks.done, total: first!.tasks.total },
      { done, total: done + (await tab(ongoing, 'open')) },
    )
    assert.deepEqual(first!.tasks, { done: 1, total: 4, overdue: 1, unassigned: 3 })
    for (const card of [first!, second!]) {
      const { event } = await h.get<EventResponse>(`/events/${card.event.id}`)
      assert.deepEqual(card.next, event.next)
      // 이유 칩의 지남·담당자 없음은 행사 머리 건강도의 근거 수와 같다.
      assert.deepEqual(
        { overdue: card.tasks.overdue, unassigned: card.tasks.unassigned },
        event.health,
      )
    }
    assert.deepEqual(first!.next, { kind: 'task', dueDate: '2026-10-28', title: '다음 마감' })
    assert.equal(second!.next?.kind, 'start')
  })()
})

test('후속 정리 중인 행사는 재정 행사 정산 탭과 같은 행사·차례·정산 수이고 남은 업무와 끝난 지 며칠이 있다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const old = await t.event({ name: '오래전', startsAt: at('2026-10-10T10:00:00') })
    const recent = await t.event({ name: '최근', startsAt: at('2026-10-22T10:00:00') })
    const done = await t.event({ name: '완료', startsAt: at('2026-10-21T10:00:00') })
    await t.completion(done, 'completed', new Date('2026-10-24T03:00:00Z'))
    await t.event({ name: '진행 중', startsAt: at('2026-10-25T09:00:00') })
    await t.event({ name: '다른 학생회', startsAt: at('2026-10-10T10:00:00') }, t.other)
    // 오래전 행사: 승인했고 결제 전인 품목(정산에 남은 것)과 끝나지 않은 업무 둘
    const { line } = await t.requestWithItem(old)
    await t.approve(line)
    await h.task({ eventId: old })
    await h.task({ eventId: old, status: 'in_progress' })
    await h.task({ eventId: old, status: 'done' })
    const { followUp } = await h.board()
    const tab = await h.get<EventSettlementsResponse>('/event-settlements')
    const ended = tab.events.filter(row => row.event.status === 'ended')
    assert.deepEqual(
      followUp.events.map(row => row.event.id),
      ended.map(row => row.event.id),
    )
    assert.deepEqual(
      followUp.events.map(row => row.event.id),
      [old, recent],
    )
    assert.equal(followUp.total, ended.length)
    const [first, second] = followUp.events
    assert.equal(first!.remaining.settlement, ended[0]!.settlement.remaining)
    assert.ok(first!.remaining.settlement > 0)
    assert.equal(first!.remaining.tasks, 2)
    assert.deepEqual(second!.remaining, { tasks: 0, settlement: 0 })
    // 끝난 날(한국)부터 오늘까지: 10월 10일 → 15일, 10월 22일 → 3일. 행사 머리와 같은 셈이다.
    assert.equal(first!.endedDays, 15)
    assert.equal(second!.endedDays, 3)
    const { event } = await h.get<EventResponse>(`/events/${old}`)
    assert.equal(first!.endedDays, event.endedDays)
  })()
})

test('회장단 홈 칸은 회장단에게만 오고 미배정 수가 부서에 넣으면 준다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const home = await h.read('s-vicePresident')
    assert.equal(home.councilBoard?.unassignedMembers, 1)
    for (const user of ['s-financeMember', 's-planningHead', 's-planningMember', 's-plain'])
      assert.equal((await h.read(user)).councilBoard, undefined, user)
    // 미배정 운영진을 부서에 넣으면 0이다.
    await t.make(t.council, 'department_membership', {
      memberId: t.council.people.plain.memberId,
      departmentId: t.council.departments.planning,
      cohortId: t.council.cohortId,
      departmentRank: null,
      startsAt: clockNow,
    })
    assert.equal((await h.board()).unassignedMembers, 0)
  })()
})
