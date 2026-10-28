import assert from 'node:assert/strict'
import { test } from 'node:test'
import { taskFromPath, taskUrl } from '@vada/contracts'
import type { TaskDetail, TaskSummary, TasksResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createTaskRoutes } from './routes.js'

// 한국 시각 2026-10-25 12:00. 기본 기수는 2026-01-01부터 12-31까지다.
const noon = new Date('2026-10-25T03:00:00Z')
const MISSING = '019e0000-0000-7000-8000-000000000000'

type Council = Awaited<ReturnType<typeof seedCouncil>>
type Values = Record<string, unknown>

async function start(clock = () => noon) {
  const { pg, db, close } = await createTestDb()
  const council = await seedCouncil(db, pg)
  const other = await seedCouncil(db, pg, 'o')
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      tasks: createTaskRoutes(db, testSession, { clock: () => clock() }),
    }),
  )
  const base = `/api/organizations/${council.councilId}/tasks`
  const make = (values: Values, owner: Council = council) =>
    db.transaction(tx =>
      createRecord(tx, {
        kind: 'task',
        councilId: owner.councilId,
        actor: owner.people.president.memberId,
        values: { title: '현수막 주문', ...values },
      }),
    )
  const change = (id: string, changes: Values) =>
    db.transaction(tx =>
      updateRecord(tx, {
        kind: 'task',
        id,
        actor: council.people.planningHead.memberId,
        reason: null,
        changes,
      }),
    )
  const list = async (query: string, user = 's-president') => {
    const response = await api.get(`${base}?${query}`, user)
    assert.equal(response.status, 200, query)
    return (await response.json()) as TasksResponse
  }
  const titles = async (query: string, user?: string) =>
    (await list(query, user)).tasks.map(row => row.title)
  const detail = async (id: string, user = 's-president') =>
    ((await (await api.get(`${base}/${id}`, user)).json()) as { task: TaskDetail }).task
  return { pg, council, other, api, base, make, change, list, titles, detail, close }
}

test('목록과 상세의 줄마다 next가 상태에서 나온다: 할 일 → 진행 중 → 끝남 → null', async () => {
  const t = await start()
  try {
    const todo = await t.make({ title: '할 일', status: 'todo' })
    const doing = await t.make({ title: '진행 중', status: 'in_progress' })
    const done = await t.make({ title: '끝남', status: 'done' })
    const expected = new Map([
      [todo, 'in_progress'],
      [doing, 'done'],
      [done, null],
    ])
    for (const [id, next] of expected) assert.equal((await t.detail(id)).next, next, id)
    const rows = [
      ...(await t.list('view=all')).tasks,
      ...(await t.list('view=all&status=done')).tasks,
    ]
    assert.equal(rows.length, 3)
    for (const row of rows) assert.equal(row.next, expected.get(row.id), row.title)
  } finally {
    await t.close()
  }
})

test('내 업무는 나에게 맡긴 것만, 전체는 지운 것만 빼고 모두 준다', async () => {
  const t = await start()
  try {
    const { planningMember, planningHead } = t.council.people
    await t.make({ title: '내 것', assigneeId: planningMember.memberId })
    await t.make({ title: '남의 것', assigneeId: planningHead.memberId })
    await t.make({ title: '주인 없음' })
    const gone = await t.make({ title: '지운 것' })
    await t.change(gone, { cancelledAt: clockNow })
    await t.make({ title: '다른 학생회 것' }, t.other)
    assert.deepEqual(await t.titles('view=mine', 's-planningMember'), ['내 것'])
    assert.deepEqual((await t.titles('view=all')).sort(), ['내 것', '남의 것', '주인 없음'].sort())
  } finally {
    await t.close()
  }
})

test('내 부서는 내가 속한 부서가 맡은 업무만 주고, 부서가 없으면 빈 목록이다', async () => {
  const t = await start()
  try {
    const { planning, finance } = t.council.departments
    const { financeMember } = t.council.people
    await t.make({ title: '기획 담당자 없음', departmentId: planning })
    await t.make({
      title: '기획 남이 맡음',
      departmentId: planning,
      assigneeId: financeMember.memberId,
    })
    await t.make({ title: '재정', departmentId: finance })
    await t.make({ title: '부서 없음' })
    await t.make({ title: '다른 학생회 기획', departmentId: t.other.departments.planning }, t.other)
    assert.deepEqual((await t.titles('view=department', 's-planningMember')).sort(), [
      '기획 남이 맡음',
      '기획 담당자 없음',
    ])
    assert.deepEqual(await t.titles('view=department', 's-financeMember'), ['재정'])
    assert.deepEqual(await t.titles('view=department', 's-president'), [])
  } finally {
    await t.close()
  }
})

test('담당자 없음은 부서와 무관하게 담당자가 없거나 떠난 미완료 업무만 준다', async () => {
  const t = await start()
  try {
    const { planningMember, ended } = t.council.people
    const planning = t.council.departments.planning
    await t.make({ title: '없음', departmentId: planning })
    await t.make({ title: '떠남', departmentId: planning, assigneeId: ended.memberId })
    await t.make({ title: '부서 없음', assigneeId: planningMember.memberId })
    await t.make({ title: '둘 다 없음' })
    await t.make({ title: '부서 없이 떠남', assigneeId: ended.memberId, status: 'in_progress' })
    await t.make({ title: '끝남', status: 'done' })
    await t.make({ title: '떠났지만 끝남', assigneeId: ended.memberId, status: 'done' })
    await t.make({ title: '취소', cancelledAt: clockNow })
    await t.make({ title: '다른 학생회' }, t.other)
    await t.make({ title: '정상', departmentId: planning, assigneeId: planningMember.memberId })
    const result = await t.list('view=unassigned')
    assert.deepEqual(result.tasks.map(row => row.title).sort(), [
      '둘 다 없음',
      '떠남',
      '부서 없이 떠남',
      '없음',
    ])
    assert.deepEqual(await t.titles('view=unassigned&status=done'), [])
    const left = result.tasks.find(row => row.title === '떠남')
    assert.equal(left?.assignee?.current, false)
    assert.equal(left?.assignee?.name, 's ended')
    const present = (await t.list('view=all')).tasks.find(row => row.title === '정상')
    assert.equal(present?.assignee?.current, true)
    assert.equal(present?.department?.name, '기획부')
  } finally {
    await t.close()
  }
})

test('끝나지 않은 것은 마감 순(없으면 뒤)에 만든 순이고, status=done은 끝남만 마지막으로 바뀐 순이다', async () => {
  const t = await start()
  try {
    const due = (date: string) => new Date(`${date}T23:59:59+09:00`)
    await t.make({ title: '없음1' })
    await t.make({ title: '늦음', dueAt: due('2026-11-01') })
    await t.make({ title: '일찍', dueAt: due('2026-10-26') })
    await t.make({ title: '없음2' })
    const first = await t.make({ title: '끝1', status: 'done' })
    await t.make({ title: '끝2', status: 'done' })
    assert.deepEqual(await t.titles('view=all'), ['일찍', '늦음', '없음1', '없음2'])
    assert.deepEqual(await t.titles('view=all&status=open'), ['일찍', '늦음', '없음1', '없음2'])
    assert.deepEqual(await t.titles('view=all&status=done'), ['끝2', '끝1'])
    await t.change(first, { title: '끝1 고침' })
    assert.deepEqual(await t.titles('view=all&status=done'), ['끝1 고침', '끝2'])
  } finally {
    await t.close()
  }
})

test('끝나지 않은 것은 300개, 끝남은 50개까지 주고 넘치면 truncated이다', async () => {
  const t = await start()
  try {
    await t.pg.exec(`INSERT INTO record (id, kind, council_id)
      SELECT uuidv7(), 'task', '${t.council.councilId}' FROM generate_series(1, 351)`)
    await t.pg.exec(`INSERT INTO task (id, title, status)
      SELECT id, 't', CASE WHEN row_number() OVER () <= 301 THEN 'todo' ELSE 'done' END
      FROM record WHERE kind = 'task'`)
    await t.pg.exec(`INSERT INTO record_version (record_id, version_no, valid, data)
      SELECT id, 1, tstzrange(now(), NULL), '{}'::jsonb FROM record WHERE kind = 'task'`)
    const open = await t.list('view=all')
    assert.equal(open.tasks.length, 300)
    assert.equal(open.truncated, true)
    const done = await t.list('view=all&status=done')
    assert.equal(done.tasks.length, 50)
    assert.equal(done.truncated, false)
  } finally {
    await t.close()
  }
})

test('끝남이 51개면 50개를 주고 truncated이다', async () => {
  const t = await start()
  try {
    await t.pg.exec(`INSERT INTO record (id, kind, council_id)
      SELECT uuidv7(), 'task', '${t.council.councilId}' FROM generate_series(1, 51)`)
    await t.pg.exec(
      `INSERT INTO task (id, title, status) SELECT id, 't', 'done' FROM record WHERE kind = 'task'`,
    )
    await t.pg.exec(`INSERT INTO record_version (record_id, version_no, valid, data)
      SELECT id, 1, tstzrange(now(), NULL), '{}'::jsonb FROM record WHERE kind = 'task'`)
    const done = await t.list('view=all&status=done')
    assert.equal(done.tasks.length, 50)
    assert.equal(done.truncated, true)
  } finally {
    await t.close()
  }
})

test('담당자 없음은 300개 상한 전에 거르고 행사 없음과 학생회 경계도 지킨다', async () => {
  const t = await start()
  try {
    await t.pg.exec(`INSERT INTO record (id, kind, council_id)
      SELECT uuidv7(), 'task', '${t.council.councilId}' FROM generate_series(1, 301)`)
    await t.pg.exec(`INSERT INTO task (id, title, assignee_id, due_at)
      SELECT id, '담당 있음', '${t.council.people.planningMember.memberId}', '2026-10-20T00:00:00Z'
      FROM record WHERE kind = 'task'`)
    const free = await t.make({ title: '상한 뒤 담당자 없음' })
    const left = await t.make({ title: '떠난 담당자', assigneeId: t.council.people.ended.memberId })
    await t.make({ title: '다른 학생회' }, t.other)
    assert.equal((await t.list('view=all&event=none')).truncated, true)
    const result = await t.list('view=unassigned&event=none')
    assert.deepEqual(result.tasks.map(row => row.id).sort(), [free, left].sort())
    assert.equal(result.truncated, false)
    assert.equal(
      (await t.api.get(`${t.base}?view=unassigned&event=none`, 'o-president')).status,
      403,
    )
  } finally {
    await t.close()
  }
})

test('모르는 키, 틀린 값, 빠진 view, 같은 키 두 번은 400 INVALID_INPUT이다', async () => {
  const t = await start()
  try {
    for (const query of [
      'view=mine&x=1',
      'view=other',
      'view=mine&status=cancelled',
      'status=open',
      '',
      'view=mine&view=all',
      'view=mine&status=open&status=done',
      'view=',
    ]) {
      const response = await t.api.get(`${t.base}?${query}`, 's-president')
      assert.equal(response.status, 400, query)
      assert.deepEqual(await response.json(), { error: 'INVALID_INPUT' }, query)
    }
  } finally {
    await t.close()
  }
})

test('마감일 당일 한국 23:59:59는 지남이 아니고 다음 날 00:00은 지남이며 끝남은 지나도 아니다', async () => {
  let now = new Date('2026-10-25T14:59:59Z')
  const t = await start(() => now)
  try {
    const dueAt = new Date('2026-10-25T23:59:59+09:00')
    await t.make({ title: '열림', dueAt })
    await t.make({ title: '끝남', dueAt, status: 'done' })
    const overdue = async (status = 'open') =>
      (await t.list(`view=all&status=${status}`)).tasks.map(row => [row.title, row.overdue])
    assert.deepEqual(await overdue(), [['열림', false]])
    now = new Date('2026-10-25T15:00:00Z')
    assert.deepEqual(await overdue(), [['열림', true]])
    assert.deepEqual(await overdue('done'), [['끝남', false]])
    assert.equal((await t.list('view=all')).tasks[0]?.dueDate, '2026-10-25')
  } finally {
    await t.close()
  }
})

test('줄마다 actions가 그 사람의 권한과 같다', async () => {
  const t = await start()
  try {
    const { planningMember } = t.council.people
    const planning = t.council.departments.planning
    const finance = t.council.departments.finance
    const mine = await t.make({ title: '기획 것', departmentId: planning })
    const assigned = await t.make({
      title: '맡은 것',
      departmentId: finance,
      assigneeId: planningMember.memberId,
    })
    const orphan = await t.make({ title: '부서 없음' })
    const actionsFor = async (user: string, id: string) => (await t.detail(id, user)).actions
    assert.deepEqual(await actionsFor('s-president', mine), [
      'task.edit',
      'task.remove',
      'task.change_department',
      'task.change_assignee',
      'task.change_status',
    ])
    assert.deepEqual(await actionsFor('s-planningHead', mine), [
      'task.edit',
      'task.remove',
      'task.change_assignee',
      'task.change_status',
    ])
    assert.deepEqual(await actionsFor('s-planningMember', mine), [])
    assert.deepEqual(await actionsFor('s-planningMember', assigned), [
      'task.edit',
      'task.change_status',
    ])
    assert.deepEqual(await actionsFor('s-planningHead', assigned), [])
    assert.deepEqual(await actionsFor('s-planningHead', orphan), [])
    assert.deepEqual(await actionsFor('s-plain', orphan), [])
    const row = (await t.list('view=all', 's-planningMember')).tasks.find(x => x.id === assigned)
    assert.deepEqual((row as TaskSummary).actions, ['task.edit', 'task.change_status'])
  } finally {
    await t.close()
  }
})

test('업무 하나는 내용, 만든 사람, 판마다 바뀐 칸을 준다', async () => {
  const t = await start()
  try {
    const { planningMember } = t.council.people
    const planning = t.council.departments.planning
    const id = await t.make({
      title: '현수막',
      body: '처음 내용',
      dueAt: new Date('2026-10-30T23:59:59+09:00'),
    })
    await t.change(id, { title: '현수막 주문', body: '고친 내용' })
    await t.change(id, { dueAt: null, status: 'in_progress' })
    await t.change(id, { departmentId: planning, assigneeId: planningMember.memberId })
    await t.change(id, { assigneeId: null })
    const task = await t.detail(id)
    assert.equal(task.body, '고친 내용')
    assert.deepEqual(task.createdBy, {
      id: t.council.people.president.memberId,
      name: 's president',
    })
    assert.equal(task.history.length, 5)
    assert.deepEqual(
      task.history.map(version => version.versionNo),
      [1, 2, 3, 4, 5],
    )
    assert.deepEqual(task.history[0]?.changes, [{ field: 'created' }])
    assert.deepEqual(task.history[1]?.changes, [
      { field: 'title', from: '현수막', to: '현수막 주문' },
      { field: 'body' },
    ])
    assert.deepEqual(task.history[2]?.changes, [
      { field: 'dueDate', from: '2026-10-30', to: null },
      { field: 'status', from: 'todo', to: 'in_progress' },
    ])
    const people = (id: string | null, name: string | null) => (id ? { id, name } : null)
    assert.deepEqual(task.history[3]?.changes, [
      { field: 'department', from: null, to: people(planning, '기획부') },
      { field: 'assignee', from: null, to: people(planningMember.memberId, 's planningMember') },
    ])
    assert.deepEqual(task.history[4]?.changes, [
      {
        field: 'assignee',
        from: people(planningMember.memberId, 's planningMember'),
        to: null,
      },
    ])
    assert.equal(task.history[1]?.by?.name, 's planningHead')
    assert.ok(task.history.every(version => !Number.isNaN(Date.parse(version.at))))
  } finally {
    await t.close()
  }
})

test('다른 학생회 업무, 지운 업무, 형식이 틀린 번호는 404이다', async () => {
  const t = await start()
  try {
    const foreign = await t.make({}, t.other)
    const gone = await t.make({})
    await t.change(gone, { cancelledAt: clockNow })
    for (const id of [foreign, gone, MISSING, 'not-a-uuid']) {
      const response = await t.api.get(`${t.base}/${id}`, 's-president')
      assert.equal(response.status, 404, id)
      assert.deepEqual(await response.json(), { error: 'NOT_FOUND' }, id)
    }
  } finally {
    await t.close()
  }
})

test('알림 주소만으로는 남의 업무를 볼 수 없다: 서버가 학생회를 요청마다 본다', async () => {
  const t = await start()
  try {
    const foreign = await t.make({ title: '남의 업무' }, t.other)
    const address = taskUrl(t.other.councilId, foreign)
    const parsed = taskFromPath(address)
    assert.deepEqual(parsed, { councilId: t.other.councilId, taskId: foreign })
    // 주소의 학생회로 읽으면 그 학생회 사람이 아니라 403이고, 내 학생회 칸에 끼워 읽으면 없는 것과 같은 404이다.
    const asIs = await t.api.get(
      `/api/organizations/${parsed.councilId}/tasks/${parsed.taskId}`,
      's-president',
    )
    assert.equal(asIs.status, 403)
    const swapped = await t.api.get(`${t.base}/${parsed.taskId}`, 's-president')
    assert.equal(swapped.status, 404)
    assert.equal(JSON.stringify(await asIs.json()).includes('남의 업무'), false)
    assert.equal(JSON.stringify(await swapped.json()).includes('남의 업무'), false)
  } finally {
    await t.close()
  }
})

test('운영진이 아니면 403, 내보낸 사람의 다음 요청도 403, 다른 학생회 사람도 403, 로그인하지 않으면 401이다', async () => {
  const t = await start()
  try {
    const id = await t.make({})
    for (const path of [`${t.base}?view=all`, `${t.base}/${id}`]) {
      for (const user of ['s-ended', 'o-president', 'stranger'])
        assert.equal((await t.api.get(path, user)).status, 403, `${user} ${path}`)
      assert.equal((await t.api.get(path)).status, 401, path)
    }
    assert.equal(
      (await t.api.get(`${t.base.replace(t.council.councilId, 'bad')}`, 's-president')).status,
      403,
    )
  } finally {
    await t.close()
  }
})

test('JSON 응답은 no-store이다', async () => {
  const t = await start()
  try {
    const id = await t.make({})
    for (const path of [`${t.base}?view=all`, `${t.base}/${id}`])
      assert.equal((await t.api.get(path, 's-president')).headers.get('cache-control'), 'no-store')
  } finally {
    await t.close()
  }
})

test('다른 학생회의 운영진 업무는 내 목록에 섞이지 않는다', async () => {
  const t = await start()
  try {
    await t.make({ title: '남의 학생회' }, t.other)
    assert.deepEqual(await t.titles('view=all'), [])
    assert.deepEqual(await t.titles('view=unassigned'), [])
  } finally {
    await t.close()
  }
})
