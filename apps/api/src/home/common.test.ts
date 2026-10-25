import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  openRequestsOf,
  type HomeResponse,
  type PurchaseRequestsResponse,
  type TasksResponse,
} from '@vada/contracts'
import { createApp } from '../app.js'
import { createPurchaseRoutes } from '../purchases/routes.js'
import { clockNow, updateRecord } from '../records/records.js'
import { setDbClock } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'
import { createTaskRoutes } from '../tasks/routes.js'
import { createHomeRoutes } from './routes.js'

// 한국 시각 2026-10-25(일) 12:00. 시험 도구(SettlementKit)의 시계와 같다.
const now = new Date('2026-10-25T03:00:00Z')
const due = (date: string) => new Date(`${date}T23:59:59+09:00`)
const at = (value: string) => new Date(`${value}+09:00`)

function open(t: SettlementKit) {
  const clock = () => now
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      tasks: createTaskRoutes(t.db, testSession, { clock }),
      purchases: createPurchaseRoutes(t.db, testSession, { clock }),
      home: createHomeRoutes(t.db, testSession, { clock }),
    }),
  )
  const base = `/api/organizations/${t.council.councilId}`
  const read = async (user: string) => {
    const response = await api.get(`${base}/home`, user)
    assert.equal(response.status, 200, user)
    return (await response.json()) as HomeResponse
  }
  const tasksOf = async (query: string, user: string) =>
    ((await (await api.get(`${base}/tasks?${query}`, user)).json()) as TasksResponse).tasks
  const task = (values: Record<string, unknown>, owner = t.council) =>
    t.make(owner, 'task', { title: '업무', ...values })
  const cancel = (id: string) =>
    t.db.transaction(tx =>
      updateRecord(tx, {
        kind: 'task',
        id,
        actor: t.council.people.president.memberId,
        reason: null,
        changes: { cancelledAt: clockNow },
      }),
    )
  return { api, base, read, tasksOf, task, cancel }
}

const people = (t: SettlementKit) => t.council.people
const financeOf = (t: SettlementKit) => t.council.departments.finance
const planningOf = (t: SettlementKit) => t.council.departments.planning

test('홈 종류는 직급과 재정 역할로 가르고, 재정 부서 이름을 바꿔도 같다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const users = [
      's-president',
      's-vicePresident',
      's-financeMember',
      's-planningHead',
      's-planningViceHead',
      's-planningMember',
      's-plain',
    ]
    const kinds = async () => {
      const result: Record<string, [string, boolean]> = {}
      for (const user of users) {
        const home = await h.read(user)
        result[user] = [home.kind, home.financeView]
      }
      return result
    }
    assert.deepEqual(await kinds(), {
      's-president': ['council', false],
      's-vicePresident': ['council', false],
      's-financeMember': ['finance', false],
      's-planningHead': ['department', false],
      's-planningViceHead': ['department', false],
      's-planningMember': ['member', false],
      's-plain': ['member', false],
    })
    // 재정부장(재정 역할 부서의 부장)은 재정부 홈, 회장단이면서 재정 역할 부서 소속이면 회장단 홈과 재정 보기다.
    await t.pg.query(
      `UPDATE department_membership SET department_rank = 'head' WHERE member_id = $1`,
      [people(t).financeMember.memberId],
    )
    await t.make(t.council, 'department_membership', {
      memberId: people(t).vicePresident.memberId,
      departmentId: financeOf(t),
      cohortId: t.council.cohortId,
      departmentRank: null,
      startsAt: clockNow,
    })
    await t.pg.query(`UPDATE department SET name = '돈 관리부' WHERE id = $1`, [financeOf(t)])
    const after = await kinds()
    assert.deepEqual(after['s-financeMember'], ['finance', false])
    assert.deepEqual(after['s-vicePresident'], ['council', true])
    assert.deepEqual(after['s-president'], ['council', false])
  })()
})

test('응답에 응답을 만든 서버 시각(한국)이 있다', async () => {
  await withSettlement(async t => {
    const home = await open(t).read('s-planningMember')
    assert.equal(home.asOf, '2026-10-25T12:00')
    assert.equal(home.today, '2026-10-25')
  })()
})

test('내 업무 요약은 끝나지 않은 수, 지남 수, 가장 가까운 마감 하나이고 업무 내 업무 탭과 같다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const me = people(t).planningMember.memberId
    await h.task({ title: '다음 주', assigneeId: me, dueAt: due('2026-10-30') })
    await h.task({ title: '지난 것', assigneeId: me, dueAt: due('2026-10-20') })
    await h.task({ title: '마감 없음', assigneeId: me })
    await h.task({ title: '끝남', assigneeId: me, dueAt: due('2026-10-19'), status: 'done' })
    await h.cancel(await h.task({ title: '지움', assigneeId: me, dueAt: due('2026-10-18') }))
    await h.task({
      title: '남의 것',
      assigneeId: people(t).planningHead.memberId,
      dueAt: due('2026-10-18'),
    })
    const { myTasks } = await h.read('s-planningMember')
    const tab = await h.tasksOf('view=mine', 's-planningMember')
    assert.equal(myTasks.open, tab.length)
    assert.equal(myTasks.overdue, tab.filter(row => row.overdue).length)
    assert.deepEqual([myTasks.open, myTasks.overdue], [3, 1])
    assert.equal(myTasks.nearest?.title, '지난 것')
    assert.equal(myTasks.nearest?.overdue, true)
    // 업무가 없으면 0과 null이다.
    assert.deepEqual((await h.read('s-plain')).myTasks, { open: 0, overdue: 0, nearest: null })
  })()
})

test('주요 행사는 진행 중 먼저, 다가오는 순, 날짜 미정은 끝으로 셋이고 완료 행사와 끝난 행사는 없다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const ongoing = await t.event({ name: '진행 중', startsAt: at('2026-10-25T09:00:00') })
    const soon = await t.event({ name: '다음 주', startsAt: at('2026-11-01T10:00:00') })
    const tbd = await t.event({ name: '날짜 미정', startsAt: null })
    await t.event({ name: '끝남', startsAt: at('2026-10-20T10:00:00') })
    const done = await t.event({ name: '완료', startsAt: at('2026-10-21T10:00:00') })
    await t.completion(done, 'completed', new Date('2026-10-24T03:00:00Z'))
    await t.event({ name: '다른 학생회', startsAt: at('2026-10-25T08:00:00') }, t.other)
    const ids = async () => (await h.read('s-planningMember')).featuredEvents.map(row => row.id)
    assert.deepEqual(await ids(), [ongoing, soon, tbd])
    const later = await t.event({ name: '다음 달', startsAt: at('2026-11-20T10:00:00') })
    assert.deepEqual(await ids(), [ongoing, soon, later])
  })()
})

test('참여 행사는 내 부서가 담당 부서인 완료 전 행사이고 부서 업무 n/m이 행사 업무 탭의 그 부서 수와 같다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const planning = planningOf(t)
    const finance = financeOf(t)
    const ongoing = await t.event({ name: '진행 중', startsAt: at('2026-10-25T09:00:00') })
    const upcoming = await t.event({ name: '예정', startsAt: at('2026-11-10T10:00:00') })
    const tbd = await t.event({ name: '미정', startsAt: null })
    const ended = await t.event({ name: '끝남', startsAt: at('2026-10-20T10:00:00') })
    const financeOnly = await t.event({ name: '재정만', startsAt: at('2026-11-05T10:00:00') })
    const completed = await t.event({ name: '완료', startsAt: at('2026-10-21T10:00:00') })
    await t.completion(completed, 'completed', new Date('2026-10-24T03:00:00Z'))
    const cancelledOnly = await t.event({
      name: '취소한 업무만',
      startsAt: at('2026-11-03T10:00:00'),
    })
    const other = await t.event(
      { name: '다른 학생회', startsAt: at('2026-10-25T09:00:00') },
      t.other,
    )
    await h.task({ eventId: ongoing, departmentId: planning, dueAt: due('2026-10-20') })
    await h.task({
      eventId: ongoing,
      departmentId: planning,
      title: '다음 마감',
      dueAt: due('2026-10-28'),
    })
    await h.task({ eventId: ongoing, departmentId: planning, dueAt: due('2026-10-30') })
    await h.task({ eventId: ongoing, departmentId: planning, status: 'done' })
    await h.cancel(await h.task({ eventId: ongoing, departmentId: planning }))
    await h.task({ eventId: ongoing, departmentId: finance, dueAt: due('2026-10-26') })
    await h.task({ eventId: ongoing, dueAt: due('2026-10-26') })
    for (const eventId of [upcoming, tbd, ended, completed])
      await h.task({ eventId, departmentId: planning })
    await h.task({ eventId: financeOnly, departmentId: finance })
    await h.cancel(await h.task({ eventId: cancelledOnly, departmentId: planning }))
    await h.task({ eventId: other, departmentId: t.other.departments.planning }, t.other)
    const { participating } = await h.read('s-planningMember')
    assert.deepEqual(
      participating.events.map(row => row.event.id),
      [ongoing, upcoming, tbd, ended],
    )
    assert.equal(participating.total, 4)
    const card = participating.events[0]!
    const tab = async (status: string) =>
      (await h.tasksOf(`view=all&event=${ongoing}&status=${status}`, 's-planningMember')).filter(
        row => row.department?.id === planning,
      ).length
    const done = await tab('done')
    assert.deepEqual(card.tasks, { done, total: done + (await tab('open')) })
    assert.deepEqual(card.tasks, { done: 1, total: 4 })
    assert.equal(card.next?.title, '다음 마감')
    assert.equal(card.next?.dueDate, '2026-10-28')
    // 재정부 홈은 참여 행사 카드가 없어 빈 목록이고, 부서 없는 운영진도 빈 목록이다.
    assert.deepEqual((await h.read('s-financeMember')).participating, { events: [], total: 0 })
    assert.deepEqual((await h.read('s-plain')).participating, { events: [], total: 0 })
  })()
})

test('내 요청은 지금 별도 읽기(재정 내 요청 + 홈 거르기)와 같은 줄·차례다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    await setDbClock(t.db, new Date('2026-09-01T03:00:00Z'))
    const old = await t.requestWithItem(null, { title: '오래전 반려' })
    await t.approve(old.line, 'rejected')
    const oldPending = await t.requestWithItem(null, { title: '오래된 대기' })
    await setDbClock(t.db, new Date('2026-10-24T03:00:00Z'))
    const rejected = await t.requestWithItem(null, { title: '반려' })
    await t.approve(rejected.line, 'rejected')
    const approved = await t.requestWithItem(null, { title: '승인' })
    await t.approve(approved.line)
    const partial = await t.requestWithItem(null, { title: '일부 승인' })
    await t.approve(partial.line)
    const second = await t.make(t.council, 'line_item', {
      requestId: partial.request,
      name: '지우개',
      quantity: 1,
    })
    await t.approve(second, 'rejected')
    const pending = await t.requestWithItem(null, { title: '대기' })
    await t.requestWithItem(null, {
      title: '남의 요청',
      requestedBy: people(t).planningHead.memberId,
    })
    await t.requestWithItem(null, { title: '다른 학생회' }, t.other)
    await setDbClock(t.db, new Date())
    const home = await h.read('s-planningMember')
    const listed = (await (
      await h.api.get(`${h.base}/purchase-requests?view=mine`, 's-planningMember')
    ).json()) as PurchaseRequestsResponse
    const separate = openRequestsOf(listed.requests, home.today)
    assert.deepEqual(home.myRequests.requests, separate)
    assert.equal(home.myRequests.total, separate.length)
    assert.deepEqual(
      home.myRequests.requests.map(row => row.id),
      [partial.request, rejected.request, oldPending.request, pending.request],
    )
  })()
})

test('새 칸에 다른 학생회 것과 신청자 이름·휴대폰 번호가 없다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const start = at('2026-10-27T10:00:00')
    const closes = at('2026-10-26T18:00:00')
    // 같은 날짜·같은 값의 우리 것과 다른 학생회 것. 학생회 거르기를 지우면 다른 학생회 것이 섞인다.
    const mine = await t.event({ name: '축제', startsAt: start })
    const theirs = await t.event({ name: '축제', startsAt: start }, t.other)
    const myForm = await t.form(mine, t.council, { closesAt: closes })
    const theirForm = await t.form(theirs, t.other, { closesAt: closes })
    await t.registration(myForm)
    await t.registration(theirForm, { name: '이남', phone: '01099998888' }, t.other)
    await h.task({ eventId: mine, departmentId: planningOf(t), dueAt: due('2026-10-26') })
    const theirTask = await h.task(
      { eventId: theirs, departmentId: t.other.departments.planning, dueAt: due('2026-10-26') },
      t.other,
    )
    const theirRequest = await t.requestWithItem(theirs, {}, t.other)
    for (const user of [
      's-president',
      's-planningHead',
      's-planningMember',
      's-plain',
      's-financeMember',
    ]) {
      const text = await (await h.api.get(`${h.base}/home`, user)).text()
      for (const id of [theirs, theirForm, theirTask, theirRequest.request])
        assert.ok(!text.includes(id), `${user} ${id}`)
      for (const value of ['김학생', '01012345678', '이남', '01099998888'])
        assert.ok(!text.includes(value), `${user} ${value}`)
    }
    // 우리 것은 있다(거르기가 모두 빼서 통과한 것이 아니다).
    const home = await h.read('s-president')
    assert.ok(
      home.upcoming.items.some(
        item => item.kind === 'registration_close' && item.form.id === myForm,
      ),
    )
    assert.ok((await h.read('s-plain')).featuredEvents.some(row => row.id === mine))
  })()
})

test('종류마다 화면이 쓰지 않는 칸은 읽지 않고 빈 값이다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const finance = financeOf(t)
    const { plain } = people(t)
    // 모두에게 보일 만한 것: 진행 중인 행사, 재정부가 맡은 7일 안 업무, 부서 없는 운영진의 업무
    const ongoing = await t.event({ name: '진행 중', startsAt: at('2026-10-25T09:00:00') })
    await h.task({ eventId: ongoing, departmentId: finance, dueAt: due('2026-10-27') })
    await h.task({ title: '내 업무', assigneeId: plain.memberId, dueAt: due('2026-10-27') })
    const empty = { participating: { events: [], total: 0 }, upcoming: { items: [], total: 0 } }
    // 회장단: 주요 행사 타일이 없다.
    const council = await h.read('s-president')
    assert.deepEqual(council.featuredEvents, [])
    assert.equal(council.upcoming.total, 3)
    // 재정부 홈(재정부원, 재정부장): 참여 행사와 가까운 일정이 없다.
    const member = await h.read('s-financeMember')
    assert.deepEqual({ participating: member.participating, upcoming: member.upcoming }, empty)
    assert.deepEqual(
      member.featuredEvents.map(row => row.id),
      [ongoing],
    )
    await t.pg.query(
      `UPDATE department_membership SET department_rank = 'head' WHERE member_id = $1`,
      [people(t).financeMember.memberId],
    )
    const head = await h.read('s-financeMember')
    assert.deepEqual({ participating: head.participating, upcoming: head.upcoming }, empty)
    assert.ok(head.departments, '재정부장은 지금 화면의 부서 부분을 그대로 받는다')
    // 부서 없는 운영진: 학생회 전체 업무를 읽지 않아도 학생회 행사와 내 업무 마감이 있다.
    const alone = await h.read('s-plain')
    assert.equal(alone.kind, 'member')
    assert.deepEqual(alone.participating, empty.participating)
    assert.deepEqual(
      alone.upcoming.items.map(item => item.kind),
      ['event_start', 'task_due'],
    )
    assert.deepEqual(
      alone.featuredEvents.map(row => row.id),
      [ongoing],
    )
  })()
})
