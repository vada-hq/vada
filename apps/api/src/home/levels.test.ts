import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  HOME_ENDED_LIMIT,
  HOME_EVENT_LIMIT,
  HOME_LIST_LIMIT,
  type HomeResponse,
  type TasksResponse,
} from '@vada/contracts'
import { createApp } from '../app.js'
import { createSettlementRoutes } from '../settlement/routes.js'
import { clockNow, updateRecord } from '../records/records.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'
import { createTaskRoutes } from '../tasks/routes.js'
import { createHomeRoutes } from './routes.js'

// 한국 시각 2026-10-25 12:00. 시험 도구(SettlementKit)의 시계와 같다.
const now = new Date('2026-10-25T03:00:00Z')
const due = (date: string) => new Date(`${date}T23:59:59+09:00`)
const OVERDUE = due('2026-10-20')

function open(t: SettlementKit) {
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      tasks: createTaskRoutes(t.db, testSession, { clock: () => now }),
      settlement: createSettlementRoutes(t.db, testSession, { clock: () => now }),
      home: createHomeRoutes(t.db, testSession, { clock: () => now }),
    }),
  )
  const councilBase = `/api/organizations/${t.council.councilId}`
  const read = async (user: string) => {
    const response = await api.get(`${councilBase}/home`, user)
    assert.equal(response.status, 200)
    return (await response.json()) as HomeResponse
  }
  const tasksOf = async (query: string) =>
    (
      (await (
        await api.get(`${councilBase}/tasks?${query}`, 's-president')
      ).json()) as TasksResponse
    ).tasks
  const task = (values: Record<string, unknown>, owner = t.council) =>
    t.make(owner, 'task', {
      title: '업무',
      assigneeId: owner.people.planningMember.memberId,
      ...values,
    })
  return { api, read, tasksOf, task, councilBase }
}

const planning = (t: SettlementKit) => t.council.departments.planning

test('부장은 직급이 있는 부서의 수와 지난 업무·담당자 없는 업무를 받고 학생회 부분은 없다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const { ended } = t.council.people
    const department = planning(t)
    await h.task({ title: '할 일', departmentId: department })
    await h.task({ title: '진행 중', departmentId: department, status: 'in_progress' })
    await h.task({ title: '지남', departmentId: department, dueAt: OVERDUE })
    await h.task({ title: '끝남', departmentId: department, dueAt: OVERDUE, status: 'done' })
    await h.task({ title: '담당 없음', departmentId: department, assigneeId: null })
    // 담당자가 떠난 업무도 담당자 없음이다.
    await h.task({ title: '떠난 담당', departmentId: department, assigneeId: ended.memberId })
    const cancelled = await h.task({ title: '지움', departmentId: department, assigneeId: null })
    await t.db.transaction(tx =>
      updateRecord(tx, {
        kind: 'task',
        id: cancelled,
        actor: t.council.people.planningHead.memberId,
        reason: null,
        changes: { cancelledAt: clockNow },
      }),
    )
    // 다른 부서가 아닌 업무, 다른 학생회 업무는 섞이지 않는다.
    await h.task({ title: '다른 학생회', assigneeId: null }, t.other)
    const home = await h.read('s-planningHead')
    assert.equal(home.council, undefined)
    assert.equal(home.departments?.length, 1)
    const card = home.departments[0]!
    assert.equal(card.name, '기획부')
    assert.deepEqual(card.counts, { todo: 4, inProgress: 1, overdue: 1, unassigned: 2 })
    assert.deepEqual(
      card.overdue.tasks.map(row => row.title),
      ['지남'],
    )
    assert.deepEqual(card.unassigned.tasks.map(row => row.title).sort(), ['담당 없음', '떠난 담당'])
    assert.equal(card.unassigned.total, 2)
    // 부부장도 같고, 소속만 있는 부원과 재정부원은 부서를 받지 않는다.
    assert.equal((await h.read('s-planningViceHead')).departments?.[0]?.name, '기획부')
    assert.deepEqual(Object.keys(await h.read('s-planningMember')).sort(), ['mine', 'today'])
    // 재정부원은 부서를 받지 않고 재정 부분만 더 받는다.
    assert.deepEqual(Object.keys(await h.read('s-financeMember')).sort(), [
      'mine',
      'received',
      'settling',
      'today',
    ])
  })()
})

test('부서 카드의 지남과 담당자 없음 수는 업무 화면과 같다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    await h.task({ departmentId: planning(t), dueAt: OVERDUE })
    await h.task({ departmentId: planning(t), assigneeId: null })
    await h.task({ departmentId: planning(t), assigneeId: t.council.people.ended.memberId })
    const card = (await h.read('s-planningHead')).departments![0]!
    const screen = await h.tasksOf(`view=all&status=open`)
    assert.equal(card.counts.overdue, screen.filter(row => row.overdue).length)
    assert.equal(card.counts.unassigned, (await h.tasksOf('view=unassigned&status=open')).length)
  })()
})

test('회장단은 council을 받고 departments는 없고, 행사 차례와 수가 업무 화면과 같다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const ended = await t.event({
      name: '끝난 지 오래',
      startsAt: new Date('2026-10-10T00:00:00Z'),
    })
    const endedLater = await t.event({
      name: '막 끝남',
      startsAt: new Date('2026-10-22T00:00:00Z'),
    })
    const ongoing = await t.event({
      name: '진행 중',
      startsAt: new Date('2026-10-25T00:00:00Z'),
      endsAt: new Date('2026-10-26T00:00:00Z'),
    })
    const upcomingLate = await t.event({
      name: '예정 늦음',
      startsAt: new Date('2026-11-30T00:00:00Z'),
    })
    const upcoming = await t.event({
      name: '예정 빠름',
      startsAt: new Date('2026-10-30T00:00:00Z'),
    })
    await t.event({ name: '날짜 미정', startsAt: null })
    // 다른 학생회 행사와 완료한 행사는 없다.
    await t.event({ name: '남의 행사' }, t.other)
    const done = await t.event({ name: '완료함', startsAt: new Date('2026-10-01T00:00:00Z') })
    await t.completion(done, 'completed', now)
    const department = planning(t)
    await h.task({ eventId: ongoing, departmentId: department, dueAt: OVERDUE })
    await h.task({ eventId: ongoing, departmentId: department, status: 'done' })
    await h.task({ eventId: ongoing, departmentId: department, assigneeId: null })
    await h.task({ eventId: upcoming, departmentId: department })
    const cancelled = await h.task({ eventId: upcoming, departmentId: department })
    await t.db.transaction(tx =>
      updateRecord(tx, {
        kind: 'task',
        id: cancelled,
        actor: t.council.people.planningHead.memberId,
        reason: null,
        changes: { cancelledAt: clockNow },
      }),
    )
    const home = await h.read('s-vicePresident')
    assert.equal(home.departments, undefined)
    const council = home.council!
    assert.deepEqual(
      council.events.map(card => card.event.name),
      ['끝난 지 오래', '막 끝남', '진행 중', '예정 빠름', '예정 늦음', '날짜 미정'],
    )
    assert.equal(council.truncated, false)
    const card = council.events.find(item => item.event.id === ongoing)!
    assert.deepEqual(card.tasks, { done: 1, total: 3, overdue: 1, unassigned: 1 })
    assert.equal(card.settlement, undefined)
    assert.deepEqual(council.events.find(item => item.event.id === upcoming)!.tasks, {
      done: 0,
      total: 1,
      overdue: 0,
      unassigned: 0,
    })
    // 행사 업무 탭(업무 화면의 행사 거르기)과 같은 수
    const tab = await h.tasksOf(`view=all&status=open&event=${ongoing}`)
    assert.equal(tab.filter(row => row.overdue).length, card.tasks.overdue)
    assert.equal(
      (await h.tasksOf(`view=unassigned&status=open&event=${ongoing}`)).length,
      card.tasks.unassigned,
    )
    assert.ok(ended && endedLater && upcomingLate)
  })()
})

test('끝난 행사에만 정산에 남은 것 수가 있고 행사 돈 탭의 수와 같다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const ended = await t.event({ name: '끝남' })
    const clean = await t.event({ name: '깨끗', startsAt: new Date('2026-10-19T00:00:00Z') })
    const ongoing = await t.event({
      name: '진행',
      startsAt: new Date('2026-10-25T00:00:00Z'),
      endsAt: new Date('2026-10-26T00:00:00Z'),
    })
    await t.requestWithItem(ended, { title: '대기' })
    await t.expense({ eventId: ended, reason: null })
    await t.requestWithItem(ongoing, { title: '진행 중 행사 요청' })
    const home = await h.read('s-president')
    const byId = (id: string) => home.council!.events.find(card => card.event.id === id)!
    const tab = await t.settlement(ended)
    const total = tab.remaining.reduce((sum, item) => sum + item.count, 0)
    assert.ok(total > 0)
    assert.deepEqual(byId(ended).settlement, { remaining: total, settled: false })
    assert.deepEqual(byId(clean).settlement, { remaining: 0, settled: true })
    assert.equal(byId(ongoing).settlement, undefined)
    // 다른 학생회의 남은 것은 세지 않는다.
    const foreign = await t.event({ name: '남의 행사' }, t.other)
    await t.expense({ eventId: foreign, reason: null }, t.other)
    assert.deepEqual(
      (await h.read('s-president')).council!.events.find(c => c.event.id === ended)!.settlement,
      { remaining: total, settled: false },
    )
  })()
})

test('부서별 막힌 곳은 지남이나 담당자 없음이 있는 부서와 부서 없음만, 지난 업무는 오래된 것부터 상한까지다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    // 재정부는 업무가 없고 기획부는 정상 업무만 있으면 막힌 곳이 아니다.
    await h.task({ title: '정상', departmentId: planning(t), dueAt: due('2026-11-20') })
    const before = await h.read('s-president')
    assert.deepEqual(before.council!.blocked, [])
    await h.task({ title: '부서 없음 지남', departmentId: null, dueAt: due('2026-10-18') })
    await h.task({
      title: '재정 담당 없음',
      departmentId: t.council.departments.finance,
      assigneeId: null,
    })
    for (let day = 0; day < HOME_LIST_LIMIT + 1; day++)
      await h.task({
        title: `지남 ${day}`,
        departmentId: planning(t),
        dueAt: due(`2026-10-${10 + day}`),
      })
    const home = await h.read('s-president')
    assert.deepEqual(
      home.council!.blocked.map(item => [
        item.department?.name ?? null,
        item.overdue,
        item.unassigned,
      ]),
      [
        ['기획부', HOME_LIST_LIMIT + 1, 0],
        ['재정부', 0, 1],
        [null, 1, 1],
      ],
    )
    const { overdue } = home.council!
    assert.equal(overdue.total, HOME_LIST_LIMIT + 2)
    assert.equal(overdue.tasks.length, HOME_LIST_LIMIT)
    assert.equal(overdue.tasks[0]?.title, '지남 0')
    assert.equal(overdue.tasks[1]?.title, '지남 1')
  })()
})

test('행사 카드는 20개까지고 넘으면 truncated이다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    for (let index = 0; index <= HOME_EVENT_LIMIT; index++)
      await t.event({ name: `행사 ${index}`, startsAt: null })
    const { council } = await h.read('s-president')
    assert.equal(council!.events.length, HOME_EVENT_LIMIT)
    assert.equal(council!.truncated, true)
  })()
})

test('응답에 신청자 이름·휴대폰 번호가 없다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const ended = await t.event()
    const form = await t.form(ended)
    const registration = await t.registration(form)
    await t.deposit(registration)
    const response = await h.api.get(`${h.councilBase}/home`, 's-president')
    const text = await response.text()
    assert.ok(text.includes(ended))
    assert.ok(!text.includes('김학생'))
    assert.ok(!text.includes('01012345678'))
  })()
})

test('직급을 잃으면 다음 읽기에서 그 부분이 빠진다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    assert.ok((await h.read('s-planningHead')).departments)
    await t.pg.query(
      `UPDATE department_membership SET department_rank = NULL WHERE member_id = $1`,
      [t.council.people.planningHead.memberId],
    )
    assert.equal((await h.read('s-planningHead')).departments, undefined)
  })()
})

test('학생회 직급이 있으면 부서 직급도 있어도 departments는 없고 council만 받는다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    await t.pg.query(
      `UPDATE council_membership SET council_rank = 'vice_president' WHERE member_id = $1`,
      [t.council.people.planningHead.memberId],
    )
    const home = await h.read('s-planningHead')
    assert.equal(home.departments, undefined)
    assert.ok(home.council)
  })()
})

test('끝난 행사는 오래된 것부터 10개까지만 카드가 되고 전체 수가 따로 오며 정산은 보이는 것에만 돈다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    for (let day = 1; day <= HOME_ENDED_LIMIT + 2; day++)
      await t.event({
        name: `끝남 ${day}`,
        startsAt: new Date(`2026-09-${String(day).padStart(2, '0')}T00:00:00Z`),
      })
    for (let index = 0; index < HOME_EVENT_LIMIT; index++)
      await t.event({ name: `미정 ${index}`, startsAt: null })
    const { council } = await h.read('s-president')
    const cards = council!.events
    assert.equal(cards.length, HOME_EVENT_LIMIT)
    assert.equal(council!.endedTotal, HOME_ENDED_LIMIT + 2)
    assert.equal(council!.truncated, true)
    const ended = cards.filter(card => card.event.status === 'ended')
    assert.deepEqual(ended.map(card => card.event.name).slice(0, 2), ['끝남 1', '끝남 2'])
    assert.equal(ended.length, HOME_ENDED_LIMIT)
    assert.equal(cards.filter(card => card.settlement).length, HOME_ENDED_LIMIT)
    assert.equal(
      cards.filter(card => card.event.status === 'tbd').length,
      HOME_EVENT_LIMIT - HOME_ENDED_LIMIT,
    )
  })()
})

test('끝난 행사만 11개 이상이어도 truncated이다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    for (let day = 1; day <= HOME_ENDED_LIMIT + 1; day++)
      await t.event({
        name: `끝남 ${day}`,
        startsAt: new Date(`2026-09-${String(day).padStart(2, '0')}T00:00:00Z`),
      })
    const { council } = await h.read('s-president')
    assert.equal(council!.events.length, HOME_ENDED_LIMIT)
    assert.equal(council!.endedTotal, HOME_ENDED_LIMIT + 1)
    assert.equal(council!.truncated, true)
  })()
})
