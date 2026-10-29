import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { HomeOps, HomeResponse, TasksResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'
import { createHomeRoutes } from './routes.js'

// 회장단 홈 ① '확인이 필요한 운영 상황'(f8). 한국 시각 2026-10-25(일) 12:00. 시험 도구(SettlementKit)의 시계와 같다.
const now = new Date('2026-10-25T03:00:00Z')
const due = (date: string) => new Date(`${date}T23:59:59+09:00`)

function open(t: SettlementKit) {
  const home = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      home: createHomeRoutes(t.db, testSession, { clock: () => now }),
    }),
  )
  const root = `/api/organizations/${t.council.councilId}`
  const read = async (user = 's-president') => {
    const response = await home.get(`${root}/home`, user)
    assert.equal(response.status, 200, user)
    return (await response.json()) as HomeResponse
  }
  const ops = async (user = 's-president'): Promise<HomeOps> => {
    const board = (await read(user)).councilBoard
    assert.ok(board, `${user}의 회장단 홈`)
    return board.ops
  }
  const { people, departments } = t.council
  const task = (values: Record<string, unknown>, owner = t.council) =>
    t.make(owner, 'task', { title: '업무', ...values })
  const planningTask = (title: string, date: string, values: Record<string, unknown> = {}) =>
    task({ title, departmentId: departments.planning, dueAt: due(date), ...values })
  const tasksOf = async (query: string) => {
    const response = await t.api.get(`${root}/tasks?${query}`, 's-president')
    assert.equal(response.status, 200)
    return ((await response.json()) as TasksResponse).tasks
  }
  return { read, ops, people, task, planningTask, tasksOf }
}

const titles = (ops: HomeOps) => ops.rows.map(row => row.title)

test('일 줄은 지남(오래된 것부터) → 오늘 → 내일 → 결재 3일 안이고, 부서 업무는 부장, 부서 없는 업무는 담당자가 연락할 사람이다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const { people } = h
    await h.planningTask('사흘 지남', '2026-10-22')
    await h.task({
      title: '하루 지남',
      dueAt: due('2026-10-24'),
      assigneeId: people.plain.memberId,
    })
    await h.planningTask('오늘', '2026-10-25')
    await h.planningTask('내일', '2026-10-26')
    await h.planningTask('모레', '2026-10-27')
    await h.planningTask('끝남', '2026-10-20', { status: 'done' })
    const soon = await t.requestWithItem(null, { title: '사흘 뒤 필요', neededBy: '2026-10-28' })
    await t.requestWithItem(null, { title: '나흘 뒤 필요', neededBy: '2026-10-29' })
    await t.requestWithItem(null, { title: '이미 지남', neededBy: '2026-10-20' })
    await t.requestWithItem(null, { title: '필요한 때 없음' })
    const decided = await t.requestWithItem(null, { title: '결재함', neededBy: '2026-10-26' })
    await t.approve(decided.line)
    const ops = await h.ops()
    assert.deepEqual(titles(ops), [
      '사흘 지남',
      '하루 지남',
      '오늘',
      '내일',
      '이미 지남',
      '사흘 뒤 필요',
    ])
    assert.deepEqual(
      ops.rows.map(row => [row.kind, row.days]),
      [
        ['late', 3],
        ['late', 1],
        ['today', 0],
        ['tomorrow', 1],
        ['approval', -5],
        ['approval', 3],
      ],
    )
    const [late, assigned] = ops.rows
    assert.deepEqual(late!.contact?.role, { kind: 'head', department: '기획부', title: '부장' })
    assert.equal(late!.contact?.memberId, people.planningHead.memberId)
    assert.equal(late!.contact?.name, 's planningHead')
    assert.deepEqual(assigned!.contact?.role, { kind: 'assignee' })
    assert.equal(assigned!.contact?.memberId, people.plain.memberId)
    assert.deepEqual(ops.rows.at(-1)!.target, { kind: 'request', id: soon.request })
    // 재정부에 부장이 없으면 결재 줄의 연락할 사람이 없다.
    assert.equal(ops.rows.at(-1)!.contact, null)
    assert.deepEqual(ops.counts, { late: 2, today: 1, tomorrow: 1, approval: 2 })
    // 묻기는 아직 없다.
    assert.ok(ops.rows.every(row => row.actions.length === 0))
  })()
})

test('같은 사람은 어느 줄에서나 같은 얼굴 색이고, 색은 지금 기수에 들어온 차례로 정한다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    await h.planningTask('가', '2026-10-22')
    await h.planningTask('나', '2026-10-25')
    await h.task({ title: '다', dueAt: due('2026-10-24'), assigneeId: h.people.plain.memberId })
    const ops = await h.ops()
    const tintOf = (title: string) => ops.rows.find(row => row.title === title)!.contact!.tint
    assert.equal(tintOf('가'), tintOf('나'))
    // 들어온 차례: 회장 0, 부회장 1, 재정부원 2, 기획부장 3, 부부장 4, 기획부원 5, 직급 없음 6 → 0
    assert.equal(tintOf('가'), 3)
    assert.equal(tintOf('다'), 0)
  })()
})

test('부서 미정은 부서도 담당자도 없는 업무이고 업무 목록의 부서 없음 + 담당자 없음 거르기와 같은 수다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const { people } = h
    await h.task({ title: '부서 미정 지남', dueAt: due('2026-10-20') })
    await h.task({ title: '부서 미정 마감 없음' })
    // 떠난 담당자는 담당자 없음이다(업무 화면과 같다).
    await h.task({ title: '떠난 담당자', assigneeId: people.ended.memberId })
    await h.task({ title: '담당자 있음', assigneeId: people.plain.memberId })
    const ops = await h.ops()
    assert.equal(ops.assign.noDepartment, 3)
    assert.equal((await h.tasksOf('view=all&dept=none&assignee=none')).length, 3)
    assert.ok(!titles(ops).includes('부서 미정 지남'))
    // 미배정 구성원: 직급도 부서도 없는 운영진(plain) 한 명
    assert.equal(ops.assign.unassignedMembers, 1)
    assert.equal(ops.assign.financeStaffed, true)
    assert.equal(ops.total, ops.rows.length + 3 + 1)
  })()
})

test('담당자가 나이거나 회장단인 업무, 연락할 사람이 나인 줄은 빼고 남의 홈에는 남는다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const { people } = h
    await h.planningTask('회장 업무', '2026-10-22', { assigneeId: people.president.memberId })
    await h.task({
      title: '부회장 업무',
      dueAt: due('2026-10-22'),
      assigneeId: people.vicePresident.memberId,
    })
    await h.planningTask('기획부 업무', '2026-10-23', {
      assigneeId: people.planningMember.memberId,
    })
    await t.requestWithItem(null, { title: '다과', neededBy: '2026-10-26' })
    // 회장이 재정부장이 된다.
    await t.pg.query(
      `UPDATE department_membership SET member_id = $1, department_rank = 'head' WHERE member_id = $2`,
      [people.president.memberId, people.financeMember.memberId],
    )
    assert.deepEqual(titles(await h.ops()), ['기획부 업무'])
    const vice = await h.ops('s-vicePresident')
    assert.deepEqual(titles(vice), ['기획부 업무', '다과'])
    const approval = vice.rows[1]!
    assert.deepEqual(approval.contact?.role, {
      kind: 'finance_head',
      department: '재정부',
      title: '부장',
    })
    assert.equal(approval.contact?.memberId, people.president.memberId)
  })()
})

test('일 줄은 상한까지 싣고 갈래별 수와 머리 건수는 전체를 센다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    for (let i = 0; i < 52; i += 1) await h.planningTask(`지남 ${i}`, '2026-10-20')
    await h.planningTask('오늘', '2026-10-25')
    const ops = await h.ops()
    assert.equal(ops.rows.length, 50)
    assert.deepEqual(ops.counts, { late: 52, today: 1, tomorrow: 0, approval: 0 })
    assert.equal(ops.total, 53 + 1)
  })()
})

test('다른 학생회의 업무·요청·사람은 들어오지 않고 그 학생회 회장에게는 그쪽 것만 보인다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    await h.task(
      {
        title: '다른 쪽 지남',
        departmentId: t.other.departments.planning,
        dueAt: due('2026-10-22'),
      },
      t.other,
    )
    await t.requestWithItem(null, { title: '다른 쪽 다과', neededBy: '2026-10-26' }, t.other)
    await h.task({ title: '다른 쪽 부서 미정' }, t.other)
    const ops = await h.ops()
    assert.deepEqual(ops.rows, [])
    assert.equal(ops.assign.noDepartment, 0)
    const home = caller(
      createApp({
        auth: { handler: async () => new Response() },
        trustedOrigin: ORIGIN,
        home: createHomeRoutes(t.db, testSession, { clock: () => now }),
      }),
    )
    const response = await home.get(`/api/organizations/${t.other.councilId}/home`, 'o-president')
    const theirs = ((await response.json()) as HomeResponse).councilBoard!.ops
    assert.deepEqual(titles(theirs), ['다른 쪽 지남', '다른 쪽 다과'])
    assert.equal(theirs.rows[0]!.contact?.name, 'o planningHead')
    assert.equal(theirs.assign.noDepartment, 1)
    // 다른 학생회 사람은 우리 홈을 읽지 못한다.
    assert.equal(
      (await home.get(`/api/organizations/${t.council.councilId}/home`, 'o-president')).status,
      403,
    )
  })()
})

test('①은 회장단 홈에만 있고 회장과 부회장은 같은 줄을 읽는다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    await h.planningTask('지남', '2026-10-22')
    assert.deepEqual(titles(await h.ops('s-vicePresident')), titles(await h.ops()))
    for (const user of ['s-planningHead', 's-financeMember', 's-planningMember', 's-plain'])
      assert.equal((await h.read(user)).councilBoard, undefined, user)
  })()
})
