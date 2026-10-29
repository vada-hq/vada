import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { HomeDepartmentBoard, HomeResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'
import { DEMO_SCHOOL_NAME } from './demo-budget.js'
import { createHomeRoutes } from './routes.js'

// 부장 홈(HOME-01D, 10/30 확정): 회장단 홈 구역에 부장 범위의 데이터만. 한국 시각 2026-10-25(일) 12:00.
const now = new Date('2026-10-25T03:00:00Z')
const due = (day: string) => new Date(`${day}T23:59:59+09:00`)
const future = new Date('2026-11-01T01:00:00Z')

function open(t: SettlementKit) {
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      home: createHomeRoutes(t.db, testSession, { clock: () => now }),
    }),
  )
  const read = async (user = 's-planningHead') => {
    const response = await api.get(`/api/organizations/${t.council.councilId}/home`, user)
    assert.equal(response.status, 200, user)
    return (await response.json()) as HomeResponse
  }
  const board = async (user = 's-planningHead'): Promise<HomeDepartmentBoard> => {
    const home = await read(user)
    assert.ok(home.departmentBoard, `${user}의 부장 홈`)
    return home.departmentBoard
  }
  const { people, departments } = t.council
  const task = (values: Record<string, unknown>, owner = t.council) =>
    t.make(owner, 'task', { title: '업무', ...values })
  const planning = (title: string, day: string | null, values: Record<string, unknown> = {}) =>
    task({
      title,
      departmentId: departments.planning,
      assigneeId: people.planningMember.memberId,
      ...(day ? { dueAt: due(day) } : {}),
      ...values,
    })
  return { read, board, people, departments, task, planning }
}

test(
  '① 우리 부서 업무의 지남·오늘·내일만 담당자를 연락할 사람으로 싣고, 담당자 없는 업무는 부장이 배정할 일로 센다',
  withSettlement(async t => {
    const h = open(t)
    await h.planning('사흘 지남', '2026-10-22')
    await h.planning('오늘', '2026-10-25')
    await h.planning('내일', '2026-10-26')
    await h.planning('모레', '2026-10-27')
    await h.planning('끝남', '2026-10-20', { status: 'done' })
    await h.planning('내 업무', '2026-10-24', { assigneeId: h.people.planningHead.memberId })
    await h.planning('담당자 없음 지남', '2026-10-23', { assigneeId: null })
    await h.planning('담당자 없음 마감 없음', null, { assigneeId: null })
    await h.task({
      title: '다른 부서',
      departmentId: h.departments.finance,
      dueAt: due('2026-10-24'),
      assigneeId: h.people.financeMember.memberId,
    })
    await h.task({
      title: '부서 없음',
      dueAt: due('2026-10-24'),
      assigneeId: h.people.plain.memberId,
    })
    await h.task({ title: '부서 미정', dueAt: due('2026-10-24') })
    // 결재 대기는 재정부의 일이라 부장 ①에 없다.
    await t.requestWithItem(null, { title: '곧 필요', neededBy: '2026-10-26' })
    const { ops } = await h.board()
    assert.deepEqual(
      ops.rows.map(row => [row.title, row.kind, row.days]),
      [
        ['사흘 지남', 'late', 3],
        ['오늘', 'today', 0],
        ['내일', 'tomorrow', 1],
      ],
    )
    for (const row of ops.rows) {
      assert.deepEqual(row.contact?.role, { kind: 'assignee' })
      assert.equal(row.contact?.memberId, h.people.planningMember.memberId)
      assert.equal(row.noHead, null)
    }
    assert.deepEqual(ops.counts, { late: 1, today: 1, tomorrow: 1, approval: 0 })
    assert.deepEqual(ops.assign, {
      by: 'head',
      noAssignee: 2,
      departments: [{ id: h.departments.planning, name: '기획부' }],
    })
    assert.equal(ops.total, 5)
    // 부부장도 같은 부서 범위를 본다. 부장의 업무는 부부장에게는 남의 일이라 ①에 있다.
    assert.deepEqual(
      (await h.board('s-planningViceHead')).ops.rows.map(row => row.title),
      ['사흘 지남', '내 업무', '오늘', '내일'],
    )
  }),
)

test(
  '직급 부서가 둘이면 두 부서 업무를 합치고, 직급이 끝난 부서는 빠진다',
  withSettlement(async t => {
    const h = open(t)
    const outreach = await t.make(t.council, 'department', { name: '소통부' })
    const placement = await t.make(t.council, 'department_membership', {
      memberId: h.people.planningHead.memberId,
      departmentId: outreach,
      cohortId: t.council.cohortId,
      departmentRank: 'vice_head',
      startsAt: now,
    })
    await h.planning('기획 지남', '2026-10-23')
    await h.task({
      title: '소통 지남',
      departmentId: outreach,
      dueAt: due('2026-10-24'),
      assigneeId: h.people.plain.memberId,
    })
    await h.task({ title: '소통 미배정', departmentId: outreach })
    const ops = (await h.board()).ops
    assert.deepEqual(
      ops.rows.map(row => row.title),
      ['기획 지남', '소통 지남'],
    )
    assert.equal(ops.assign.by === 'head' && ops.assign.noAssignee, 1)
    assert.equal(ops.assign.by === 'head' && ops.assign.departments.length, 2)
    await t.pg.query('UPDATE department_membership SET ends_at = now() WHERE id = $1', [placement])
    assert.deepEqual(
      (await h.board()).ops.rows.map(row => row.title),
      ['기획 지남'],
    )
  }),
)

test(
  '② 우리 부서가 맡은 행사(끝나지 않은 업무를 우리 부서가 맡음)만 싣고, 늦은 부서도 우리 부서만이다',
  withSettlement(async t => {
    const h = open(t)
    const ours = await t.event({ name: '우리 행사', startsAt: future })
    const shared = await t.event({ name: '함께 하는 행사', startsAt: future })
    const theirs = await t.event({ name: '재정부 행사', startsAt: future })
    const finished = await t.event({ name: '우리 일 끝난 행사', startsAt: future })
    await t.event({ name: '업무 없는 행사', startsAt: future })
    await h.planning('우리 행사 업무', '2026-10-24', { eventId: ours })
    await h.planning('함께 우리 몫', '2026-10-28', { eventId: shared })
    await h.task({
      title: '함께 재정 몫',
      eventId: shared,
      departmentId: h.departments.finance,
      dueAt: due('2026-10-23'),
    })
    await h.task({ title: '재정 몫', eventId: theirs, departmentId: h.departments.finance })
    await h.planning('끝낸 일', null, { eventId: finished, status: 'done' })
    const otherEvent = await t.event({ name: '다른 학생회 행사', startsAt: future }, t.other)
    await h.task(
      {
        title: '다른 학생회 기획',
        eventId: otherEvent,
        departmentId: t.other.departments.planning,
      },
      t.other,
    )
    const { lanes } = await h.board()
    assert.deepEqual(lanes.events.map(lane => lane.event.name).sort(), [
      '우리 행사',
      '함께 하는 행사',
    ])
    assert.equal(lanes.total, 2)
    const sharedLane = lanes.events.find(lane => lane.event.id === shared)!
    assert.deepEqual(sharedLane.late, [])
    const ourLane = lanes.events.find(lane => lane.event.id === ours)!
    assert.deepEqual(ourLane.late, [
      { department: { id: h.departments.planning, name: '기획부' }, overdue: 1 },
    ])
  }),
)

test(
  '③ 내 업무의 지남·오늘만 싣고 부원·회장단 업무는 싣지 않는다',
  withSettlement(async t => {
    const h = open(t)
    const me = h.people.planningHead.memberId
    await h.planning('내 지남', '2026-10-23', { assigneeId: me })
    await h.planning('내 오늘', '2026-10-25', { assigneeId: me })
    await h.planning('내 내일', '2026-10-26', { assigneeId: me })
    await h.task({ title: '부서 없는 내 일', dueAt: due('2026-10-24'), assigneeId: me })
    await h.planning('부원 지남', '2026-10-23')
    await h.planning('회장 지남', '2026-10-23', { assigneeId: h.people.president.memberId })
    const { todo, ops } = await h.board()
    assert.deepEqual(
      todo.rows.map(row =>
        row.kind === 'task_late' || row.kind === 'task_today'
          ? [row.kind, row.task.title, row.owner]
          : row.kind,
      ),
      [
        ['task_late', '내 지남', null],
        ['task_late', '부서 없는 내 일', null],
        ['task_today', '내 오늘', null],
      ],
    )
    assert.equal(todo.total, 3)
    // 회장단이 맡은 우리 부서 업무는 ①에서 담당자(회장)에게 묻는 줄이다.
    assert.deepEqual(
      ops.rows.map(row => row.title),
      ['부원 지남', '회장 지남'],
    )
  }),
)

test(
  '③ 행사 정리는 우리 부서가 맡은 끝난 행사만이다',
  withSettlement(async t => {
    const h = open(t)
    const ours = await t.event({ name: '우리 끝난 행사' })
    const older = await t.event({
      name: '우리 먼저 끝난 행사',
      startsAt: new Date('2026-10-10T00:00:00Z'),
    })
    const theirs = await t.event({ name: '재정부 끝난 행사' })
    await h.planning('뒷정리', null, { eventId: ours })
    await h.planning('먼저 뒷정리', null, { eventId: older })
    await h.task({ title: '정산', eventId: theirs, departmentId: h.departments.finance })
    const { todo } = await h.board()
    assert.deepEqual(
      todo.rows.flatMap(row => (row.kind === 'event_tidy' ? [row.event.name] : [])),
      // 끝난 지 오래된 것부터(회장단 행사 정리와 같은 차례)
      ['우리 먼저 끝난 행사', '우리 끝난 행사'],
    )
    assert.equal(todo.counts.event_tidy, 2)
  }),
)

test(
  '역할마다 홈 칸이 다르다: 회장단은 회장단 홈, 부장·부부장은 부장 홈, 부원·재정부는 둘 다 없다',
  withSettlement(async t => {
    const h = open(t)
    const president = await h.read('s-president')
    assert.equal(president.kind, 'council')
    assert.ok(president.councilBoard)
    assert.equal(president.councilBoard.ops.assign.by, 'council')
    assert.equal(president.departmentBoard, undefined)
    for (const user of ['s-planningHead', 's-planningViceHead']) {
      const home = await h.read(user)
      assert.equal(home.kind, 'department')
      assert.equal(home.councilBoard, undefined)
      assert.ok(home.departmentBoard?.week)
    }
    for (const user of ['s-planningMember', 's-financeMember', 's-plain']) {
      const home = await h.read(user)
      assert.equal(home.councilBoard, undefined, user)
      assert.equal(home.departmentBoard, undefined, user)
    }
  }),
)

test(
  '시연용 임시 예산 한 줄은 시연 학생회의 부장 홈에만 온다',
  withSettlement(async t => {
    const h = open(t)
    assert.equal((await h.board()).budget, null)
    await t.pg.query('UPDATE council SET school_name = $1 WHERE id = $2', [
      DEMO_SCHOOL_NAME,
      t.other.councilId,
    ])
    assert.equal((await h.board()).budget, null)
    await t.pg.query('UPDATE council SET school_name = $1 WHERE id = $2', [
      DEMO_SCHOOL_NAME,
      t.council.councilId,
    ])
    assert.deepEqual((await h.board()).budget, {
      name: '가을 축제 상금',
      amount: 600_000,
      remaining: 600_000,
    })
  }),
)
