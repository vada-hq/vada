import assert from 'node:assert/strict'
import { test } from 'node:test'
import { TASK_BODY_MAX, TASK_TITLE_MAX, type TaskDetail } from '@vada/contracts'
import { inCouncilChange } from '../access/authorize.js'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import { createRateLimiter } from '../http/rate-limit.js'
import { createRecord } from '../records/records.js'
import { removeMember } from '../team/service.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createTaskRoutes } from './routes.js'

// 한국 시각 2026-10-25 12:00. 기본 기수는 2026-01-01부터 12-31까지다.
const noon = new Date('2026-10-25T03:00:00Z')
const MISSING = '019e0000-0000-7000-8000-000000000000'
const EDIT = { title: 'a', body: null, dueDate: null }

async function start(limiter?: ReturnType<typeof createRateLimiter>) {
  const { pg, db, close } = await createTestDb()
  const council = await seedCouncil(db, pg)
  const other = await seedCouncil(db, pg, 'o')
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      tasks: createTaskRoutes(db, testSession, {
        clock: () => noon,
        ...(limiter ? { writeLimiter: limiter } : {}),
      }),
    }),
  )
  const base = `/api/organizations/${council.councilId}/tasks`
  const count = async (sql: string, params: unknown[] = []) =>
    Number(((await pg.query(sql, params)).rows[0] as { n: string }).n)
  const taskCount = () => count('SELECT count(*) AS n FROM task')
  const versions = (id: string) =>
    count('SELECT count(*) AS n FROM record_version WHERE record_id = $1', [id])
  const create = (body: unknown, user = 's-president') => api.post(base, body, user)
  const made = async (body: unknown, user = 's-president') => {
    const response = await create(body, user)
    assert.equal(response.status, 201)
    return ((await response.json()) as { task: TaskDetail }).task
  }
  const row = async (id: string) =>
    (
      await pg.query<{ status: string; due_at: Date | null; cancelled_at: Date | null }>(
        'SELECT status, due_at, cancelled_at FROM task WHERE id = $1',
        [id],
      )
    ).rows[0]!
  const post = (path: string, body: unknown, user = 's-president') =>
    api.post(`${base}${path}`, body, user)
  return {
    pg,
    db,
    council,
    other,
    api,
    base,
    count,
    taskCount,
    versions,
    create,
    made,
    row,
    post,
    close,
  }
}

type S = Awaited<ReturnType<typeof start>>
const run = (body: (s: S) => Promise<void>) => async () => {
  const s = await start()
  try {
    await body(s)
  } finally {
    await s.close()
  }
}
const errorOf = async (response: Response) => ((await response.json()) as { error: string }).error

test(
  '회장단은 아무 부서나 학생회 업무를 만든다: 201, 판 1, 할 일, 마감은 그날 한국 23:59:59',
  run(async s => {
    const { planning } = s.council.departments
    const task = await s.made({
      title: '  현수막 주문 ',
      body: '내용',
      dueDate: '2026-10-30',
      departmentId: planning.toUpperCase(),
      assigneeId: s.council.people.planningMember.memberId,
    })
    assert.equal(task.title, '현수막 주문')
    assert.equal(task.status, 'todo')
    assert.equal(task.dueDate, '2026-10-30')
    assert.equal(task.department?.id, planning)
    assert.equal(task.assignee?.name, 's planningMember')
    assert.equal(task.history.length, 1)
    assert.equal(await s.versions(task.id), 1)
    assert.equal((await s.row(task.id)).due_at?.toISOString(), '2026-10-30T14:59:59.000Z')
    const bare = await s.made({ title: '학생회 일' }, 's-vicePresident')
    assert.equal(bare.department, null)
    assert.equal(bare.dueDate, null)
  }),
)

test(
  '부장은 자기 부서 업무를, 누구나 부서가 없거나 내 부서인 자기 업무를 만든다',
  run(async s => {
    const { planning, finance } = s.council.departments
    const { planningHead, planningMember, plain } = s.council.people
    await s.made({ title: 'a', departmentId: planning }, 's-planningHead')
    const own = { departmentId: planning, assigneeId: planningHead.memberId }
    await s.made({ title: 'b', ...own }, 's-planningHead')
    await s.made({ title: 'c', assigneeId: planningMember.memberId }, 's-planningMember')
    const inDept = { departmentId: planning, assigneeId: planningMember.memberId }
    await s.made({ title: 'd', ...inDept }, 's-planningMember')
    await s.made({ title: 'e', assigneeId: plain.memberId }, 's-plain')
    const before = await s.taskCount()
    const denied: [unknown, string][] = [
      [{ title: '부장의 학생회 업무' }, 's-planningHead'],
      [{ title: '부원의 남 업무', ...own }, 's-planningMember'],
      [{ title: '부원의 부서 업무', departmentId: planning }, 's-planningMember'],
      [
        {
          title: '남의 부서 자기 업무',
          departmentId: finance,
          assigneeId: planningMember.memberId,
        },
        's-planningMember',
      ],
      [{ title: '남의 부서', departmentId: finance }, 's-planningHead'],
      [{ title: '직급 없는 사람의 남 업무', assigneeId: planningMember.memberId }, 's-plain'],
    ]
    for (const [body, user] of denied) {
      const response = await s.create(body, user)
      assert.equal(response.status, 403, JSON.stringify(body))
    }
    assert.equal(await s.taskCount(), before)
  }),
)

test(
  '다른 학생회 부서는 409 TASK_DEPARTMENT_INVALID, 내보낸 사람과 다른 학생회 사람은 409 TASK_ASSIGNEE_INVALID이고 403이 409보다 먼저다',
  run(async s => {
    const cases: [unknown, string][] = [
      [{ title: 'x', departmentId: s.other.departments.planning }, 'TASK_DEPARTMENT_INVALID'],
      [{ title: 'x', departmentId: s.other.councilId }, 'TASK_DEPARTMENT_INVALID'],
      [{ title: 'x', departmentId: MISSING }, 'TASK_DEPARTMENT_INVALID'],
      [{ title: 'x', assigneeId: s.council.people.ended.memberId }, 'TASK_ASSIGNEE_INVALID'],
      [{ title: 'x', assigneeId: s.other.people.president.memberId }, 'TASK_ASSIGNEE_INVALID'],
      [{ title: 'x', assigneeId: MISSING }, 'TASK_ASSIGNEE_INVALID'],
    ]
    for (const [body, code] of cases) {
      const response = await s.create(body)
      assert.equal(response.status, 409, JSON.stringify(body))
      assert.equal(await errorOf(response), code)
    }
    assert.equal(await s.taskCount(), 0)
    const denied = await s.create(
      { title: 'x', departmentId: s.other.departments.planning },
      's-planningHead',
    )
    assert.equal(denied.status, 403)
  }),
)

test(
  '입력 경우: 필수값 누락, 빈 글과 공백, 상한+1(이모지 포함), NUL, 홀로 쓰인 서러게이트, 모르는 키, 나쁜 번호와 마감은 400이고 아무것도 남지 않는다',
  run(async s => {
    const bad: unknown[] = [
      {},
      { body: '내용' },
      { title: '' },
      { title: ' \n\t' },
      { title: 'a'.repeat(TASK_TITLE_MAX + 1) },
      { title: '😀'.repeat(TASK_TITLE_MAX + 1) },
      { title: 'a\u0000b' },
      { title: 'a\uD800' },
      { title: 'a', body: 'a'.repeat(TASK_BODY_MAX + 1) },
      { title: 'a', body: '😀'.repeat(TASK_BODY_MAX + 1) },
      { title: 'a', body: '' },
      { title: 'a', body: 'x\u0000' },
      { title: 'a', extra: 1 },
      { title: 'a', departmentId: 'abc' },
      { title: 'a', assigneeId: `${s.council.people.plain.memberId}\u0000` },
      { title: 'a', dueDate: '2026-02-30' },
      { title: 'a', dueDate: '2026-10-30T12:00' },
      { title: 'a', dueDate: '1999-12-31' },
      { title: 'a', dueDate: '' },
      { title: 'a', dueDate: 20261030 },
    ]
    for (const body of bad) {
      const response = await s.create(body)
      assert.equal(response.status, 400, JSON.stringify(body).slice(0, 80))
      assert.equal(await errorOf(response), 'INVALID_INPUT')
    }
    assert.equal(await s.taskCount(), 0)
    await s.made({ title: '😀'.repeat(TASK_TITLE_MAX), body: '😀'.repeat(TASK_BODY_MAX) })
  }),
)

test(
  '다른 학생회 사람과 내보낸 사람은 403, 로그인하지 않으면 401이고 아무것도 만들지 않는다',
  run(async s => {
    const body = { title: 'x' }
    assert.equal((await s.create(body, 'o-president')).status, 403)
    assert.equal((await s.create(body, 's-ended')).status, 403)
    assert.equal((await s.api.post(s.base, body)).status, 401)
    assert.equal(await s.taskCount(), 0)
  }),
)

test(
  '담당자와 부장은 고치고 상태를 어느 쪽으로든 바꾸며, 다른 부원은 403이다',
  run(async s => {
    const { planning } = s.council.departments
    const { planningMember } = s.council.people
    const task = await s.made({
      title: '원래',
      departmentId: planning,
      assigneeId: planningMember.memberId,
    })
    const edit = (user: string, body: unknown) => s.post(`/${task.id}`, body, user)
    const status = (user: string, value: string) =>
      s.post(`/${task.id}/status`, { status: value }, user)
    const fields = { title: '고침', body: '내용', dueDate: '2026-11-01' }
    // 첫 고침만 판을 늘리고 나머지는 같은 값이다.
    for (const user of ['s-planningMember', 's-planningHead', 's-president'])
      assert.equal((await edit(user, fields)).status, 200, user)
    assert.equal((await edit('s-plain', fields)).status, 403)
    assert.equal((await status('s-plain', 'done')).status, 403)
    assert.equal((await status('s-planningViceHead', 'in_progress')).status, 200)
    assert.equal((await status('s-planningMember', 'done')).status, 200)
    assert.equal((await status('s-planningMember', 'todo')).status, 200)
    assert.equal((await s.post(`/${task.id}/delete`, {}, 's-plain')).status, 403)
    const after = (await (await s.api.get(`${s.base}/${task.id}`, 's-president')).json()) as {
      task: TaskDetail
    }
    assert.equal(after.task.title, '고침')
    assert.equal(after.task.status, 'todo')
    assert.equal(after.task.dueDate, '2026-11-01')
    assert.equal(await s.versions(task.id), 5)
    const cleared = await edit('s-planningHead', { title: '고침', body: null, dueDate: null })
    assert.equal(cleared.status, 200)
    const body = (await cleared.json()) as { task: TaskDetail }
    assert.equal(body.task.body, null)
    assert.equal(body.task.dueDate, null)
  }),
)

test(
  '부서 없는 학생회 업무는 회장단만 고치고, 담당자 기준은 회장단도 물려받지 않는다',
  run(async s => {
    const { planningMember } = s.council.people
    const bare = await s.made({ title: '학생회 일' })
    const edit = (id: string, user: string) => s.post(`/${id}`, EDIT, user)
    assert.equal((await edit(bare.id, 's-planningHead')).status, 403)
    assert.equal((await edit(bare.id, 's-vicePresident')).status, 200)
    const mine = await s.made({ title: '부원 일', assigneeId: planningMember.memberId })
    assert.equal((await edit(mine.id, 's-planningMember')).status, 200)
    assert.equal((await edit(mine.id, 's-plain')).status, 403)
  }),
)

test(
  '같은 값(앞뒤 공백, 대문자 번호 포함)이면 판이 늘지 않고 200이다',
  run(async s => {
    const task = await s.made({ title: '제목', body: '내용', dueDate: '2026-10-30' })
    const same = await s.post(`/${task.id.toUpperCase()}`, {
      title: ' 제목 ',
      body: '내용\n',
      dueDate: '2026-10-30',
    })
    assert.equal(same.status, 200)
    assert.equal((await s.post(`/${task.id}/status`, { status: 'todo' })).status, 200)
    assert.equal(await s.versions(task.id), 1)
  }),
)

test(
  '고치기·상태·지우기 입력: 정하지 않은 상태, 빈 본문, 모르는 키는 400이고 판이 늘지 않는다',
  run(async s => {
    const task = await s.made({ title: 'x' })
    for (const body of [{}, { status: 'open' }, { status: 'done', extra: 1 }, { status: 1 }])
      assert.equal((await s.post(`/${task.id}/status`, body)).status, 400, JSON.stringify(body))
    const edits = [
      {},
      { title: 'a' },
      { ...EDIT, x: 1 },
      { ...EDIT, title: ' ' },
      { ...EDIT, dueDate: 'x' },
    ]
    for (const body of edits)
      assert.equal((await s.post(`/${task.id}`, body)).status, 400, JSON.stringify(body))
    assert.equal((await s.post(`/${task.id}/delete`, { x: 1 })).status, 400)
    assert.equal(await s.versions(task.id), 1)
  }),
)

test(
  '지우면 204이고 다시 열거나 고치거나 지우면 404이며 판과 기록은 남는다',
  run(async s => {
    const task = await s.made({ title: '지울 것' })
    const response = await s.post(`/${task.id}/delete`, {})
    assert.equal(response.status, 204)
    assert.equal(await response.text(), '')
    assert.ok((await s.row(task.id)).cancelled_at)
    assert.equal(await s.versions(task.id), 2)
    assert.equal((await s.api.get(`${s.base}/${task.id}`, 's-president')).status, 404)
    assert.equal((await s.post(`/${task.id}/delete`, {})).status, 404)
    assert.equal((await s.post(`/${task.id}`, EDIT)).status, 404)
    assert.equal((await s.post(`/${task.id}/status`, { status: 'done' })).status, 404)
    assert.equal(await s.count('SELECT count(*) AS n FROM record WHERE id = $1', [task.id]), 1)
  }),
)

test(
  '다른 학생회 업무, 없는 번호, 형식이 틀린 번호는 404이고 운영진이 아니면 업무를 읽기 전에 403이다',
  run(async s => {
    const foreign = await s.db.transaction(tx =>
      createRecord(tx, {
        kind: 'task',
        councilId: s.other.councilId,
        actor: s.other.people.president.memberId,
        values: { title: '남의 것' },
      }),
    )
    const bodies: [string, unknown][] = [
      ['', EDIT],
      ['/status', { status: 'done' }],
      ['/delete', {}],
    ]
    for (const id of [foreign, MISSING, 'abc'])
      for (const [path, body] of bodies)
        assert.equal((await s.post(`/${id}${path}`, body)).status, 404, `${id}${path}`)
    assert.equal(await s.count('SELECT count(*) AS n FROM task WHERE cancelled_at IS NOT NULL'), 0)
    assert.equal((await s.post(`/${MISSING}/delete`, {}, 's-ended')).status, 403)
    assert.equal((await s.post(`/${foreign}/delete`, {}, 'o-president')).status, 403)
    assert.equal((await s.api.post(`${s.base}/${MISSING}/delete`, {})).status, 401)
  }),
)

test(
  '내보낸 사람의 다음 요청은 403이다',
  run(async s => {
    const { planningMember } = s.council.people
    const task = await s.made({ title: 'x', assigneeId: planningMember.memberId })
    await inCouncilChange(
      s.db,
      { userId: 's-president', councilId: s.council.councilId, action: 'member.manage', now: noon },
      (tx, actor) => removeMember(tx, actor, planningMember.memberId),
    )
    assert.equal((await s.post(`/${task.id}`, EDIT, 's-planningMember')).status, 403)
    assert.equal(
      (await s.post(`/${task.id}/status`, { status: 'done' }, 's-planningMember')).status,
      403,
    )
    assert.equal((await s.create({ title: 'y' }, 's-planningMember')).status, 403)
    assert.equal(await s.versions(task.id), 1)
  }),
)

test(
  '고치기 입력: 상한+1(이모지 포함), NUL, 홀로 쓰인 서러게이트, 빈 글은 400이고 판이 늘지 않으며 상한 그대로는 받는다',
  run(async s => {
    const task = await s.made({ title: 'x' })
    const bad: unknown[] = [
      { ...EDIT, title: 'a'.repeat(TASK_TITLE_MAX + 1) },
      { ...EDIT, title: '😀'.repeat(TASK_TITLE_MAX + 1) },
      { ...EDIT, title: 'a\u0000b' },
      { ...EDIT, title: 'a\uD800' },
      { ...EDIT, title: '' },
      { ...EDIT, body: 'a'.repeat(TASK_BODY_MAX + 1) },
      { ...EDIT, body: '😀'.repeat(TASK_BODY_MAX + 1) },
      { ...EDIT, body: 'x\u0000' },
      { ...EDIT, body: 'x\uDC00' },
      { ...EDIT, body: ' \n' },
      { ...EDIT, dueDate: '2026-13-01' },
    ]
    for (const body of bad) {
      const response = await s.post(`/${task.id}`, body)
      assert.equal(response.status, 400, JSON.stringify(body).slice(0, 80))
      assert.equal(await errorOf(response), 'INVALID_INPUT')
    }
    assert.equal(await s.versions(task.id), 1)
    const full = {
      title: '😀'.repeat(TASK_TITLE_MAX),
      body: '😀'.repeat(TASK_BODY_MAX),
      dueDate: null,
    }
    assert.equal((await s.post(`/${task.id}`, full)).status, 200)
  }),
)

test(
  '담당자를 내보낸 사람으로 해도 권한이 없으면 403이 먼저다',
  run(async s => {
    const before = await s.taskCount()
    const body = { title: 'x', assigneeId: s.council.people.ended.memberId }
    assert.equal((await s.create(body, 's-planningMember')).status, 403)
    assert.equal((await s.create(body, 's-plain')).status, 403)
    assert.equal(await s.taskCount(), before)
  }),
)

test(
  '고치기·상태 바꾸기·지우기: 다른 학생회 사용자와 내보낸 사람은 403, 로그인하지 않으면 401이고 업무는 그대로다',
  run(async s => {
    const task = await s.made({ title: '그대로' })
    const calls: [string, unknown][] = [
      [`/${task.id}`, { title: '바뀜', body: null, dueDate: null }],
      [`/${task.id}/status`, { status: 'done' }],
      [`/${task.id}/delete`, {}],
    ]
    for (const [path, body] of calls) {
      assert.equal((await s.post(path, body, 'o-president')).status, 403, path)
      assert.equal((await s.post(path, body, 's-ended')).status, 403, path)
      assert.equal((await s.api.post(`${s.base}${path}`, body)).status, 401, path)
    }
    assert.equal(await s.versions(task.id), 1)
    assert.equal((await s.row(task.id)).cancelled_at, null)
  }),
)

test('계정마다 10초에 21번째 만들기는 429이고 다른 사람은 막히지 않으며 막힌 업무는 남지 않는다', async () => {
  const s = await start()
  try {
    for (let index = 0; index < 20; index++)
      assert.equal((await s.create({ title: `업무 ${index}` })).status, 201)
    const blocked = await s.create({ title: '스물한 번째' })
    assert.equal(blocked.status, 429)
    assert.equal(await errorOf(blocked), 'TOO_MANY_REQUESTS')
    assert.equal(await s.taskCount(), 20)
    assert.equal((await s.create({ title: '다른 사람' }, 's-vicePresident')).status, 201)
    // 로그인하지 않은 요청은 401이고 센 수에 들지 않는다.
    assert.equal((await s.api.post(s.base, { title: 'x' })).status, 401)
  } finally {
    await s.close()
  }
})
