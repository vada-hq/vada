import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { HomeResponse, TasksResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createSettlementRoutes } from '../settlement/routes.js'
import { clockNow, updateRecord } from '../records/records.js'
import { sectionKeys } from '../test-support/home.js'
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
    assert.deepEqual(sectionKeys(await h.read('s-planningMember')), ['mine', 'today'])
    // 재정부원은 부서를 받지 않고 재정 부분만 더 받는다.
    assert.deepEqual(sectionKeys(await h.read('s-financeMember')), [
      'financeBoard',
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

// 회장단 화면은 회장단 홈 칸(councilBoard)만 읽어 옛 council 칸을 읽지 않는다(기능 027 조각 6). 다른 종류는 지금 부분 그대로다.
test('학생회 직급이 있으면 부서 직급도 있어도 회장단 홈 칸만 받고 옛 council·departments는 없다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    assert.deepEqual(sectionKeys(await h.read('s-president')), [
      'councilBoard',
      'financeSummary',
      'mine',
      'today',
    ])
    await t.pg.query(
      `UPDATE council_membership SET council_rank = 'vice_president' WHERE member_id = $1`,
      [t.council.people.planningHead.memberId],
    )
    assert.deepEqual(sectionKeys(await h.read('s-planningHead')), [
      'councilBoard',
      'financeSummary',
      'mine',
      'today',
    ])
    // 회장단이면서 재정이면 재정 보기용 받은 것은 그대로 받는다(조각 8이 쓴다).
    await t.make(t.council, 'department_membership', {
      memberId: t.council.people.vicePresident.memberId,
      departmentId: t.council.departments.finance,
      cohortId: t.council.cohortId,
      departmentRank: null,
      startsAt: clockNow,
    })
    assert.deepEqual(sectionKeys(await h.read('s-vicePresident')), [
      'councilBoard',
      'financeBoard',
      'financeSummary',
      'mine',
      'received',
      'today',
    ])
  })()
})

test('담당자 없음은 부서 유무와 무관하게 홈·행사 카드·업무 목록이 같은 업무를 센다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const eventId = await t.event({ startsAt: null })
    const departmentId = planning(t)
    const missing = await h.task({ eventId, departmentId, assigneeId: null })
    const noDepartment = await h.task({ eventId, assigneeId: null })
    const left = await h.task({
      eventId,
      departmentId,
      assigneeId: t.council.people.ended.memberId,
    })
    const leftWithoutDepartment = await h.task({
      eventId,
      assigneeId: t.council.people.ended.memberId,
      status: 'in_progress',
    })
    await h.task({ eventId, departmentId })
    await h.task({ eventId })
    await h.task({ eventId, assigneeId: null, status: 'done' })
    await h.task({ eventId, assigneeId: t.council.people.ended.memberId, status: 'done' })
    await h.task({ eventId, assigneeId: null, cancelledAt: clockNow })
    await h.task({ assigneeId: null }, t.other)
    const rows = await h.tasksOf('view=unassigned')
    const expected = [missing, noDepartment, left, leftWithoutDepartment].sort()
    assert.deepEqual(rows.map(row => row.id).sort(), expected)
    const home = (await h.read('s-president')).councilBoard!
    assert.equal(home.events.cards[0]!.tasks.unassigned, rows.length)
    const card = (await h.read('s-planningHead')).departments![0]!
    assert.equal(card.counts.unassigned, 2)
    assert.deepEqual(card.unassigned.tasks.map(row => row.id).sort(), [missing, left].sort())
  })()
})
