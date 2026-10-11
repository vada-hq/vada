import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { EventTasksResponse, MyTasksResponse, TaskDetail, TaskResponse } from '@vada/contracts'
import { setupPurchases } from '../purchases/test-setup.js'

// 학생회 a: 기획부 p·q, 총무부 f, 회장단 l, 미배정 n. 학생회 b: x. 행사 e·e2(a), ex(b).
type Env = Awaited<ReturnType<typeof setupPurchases>>
const base = '/events/e/tasks'
const body = (overrides: Record<string, unknown> = {}) => ({ title: '현수막 디자인', description: '시안 두 개', departmentId: 'dp',
  assigneeMembershipId: 'mq', dueOn: '2999-08-10', ...overrides })
const create = async (env: Env, overrides: Record<string, unknown> = {}, path = base) =>
  (await env.ok<TaskResponse>(env.request('POST', path, body(overrides)), 201)).task
async function refused(pending: Response | Promise<Response>, status: number, error: string) {
  const response = await pending
  assert.equal(response.status, status, error)
  assert.deepEqual(await response.json(), { error })
}
// 지금 업무의 칸을 그대로 보내고 바꿀 칸만 덮어쓴다.
const edit = (task: TaskDetail, overrides: Record<string, unknown> = {}) => ({ version: task.version, title: task.title,
  description: task.description, departmentId: task.department?.id ?? null, assigneeMembershipId: task.assignee?.membershipId ?? null,
  dueOn: task.dueOn, ...overrides })

test('부서가 있는 구성원이 업무를 만들고, 구성원 누구나 목록과 상세를 본다', async () => {
  const env = await setupPurchases()
  try {
    const task = await create(env)
    assert.equal(task.status, 'todo')
    assert.equal(task.version, 1)
    assert.deepEqual(task.event, { id: 'e', name: '체육대회' })
    assert.deepEqual(task.department, { id: 'dp', name: '기획부' })
    assert.deepEqual(task.assignee, { membershipId: 'mq', name: '기획2' })
    assert.deepEqual(task.createdBy, { id: 'p', name: '기획' })
    assert.equal(task.completedAt, null)
    assert.deepEqual(task.history.map(entry => [entry.action, entry.actor.name]), [['created', '기획']])
    env.as('n')
    const list = await env.ok<EventTasksResponse>(env.request('GET', base))
    assert.deepEqual(list.tasks.map(item => item.id), [task.id])
    assert.equal(list.registrationClosesAt, null)
    assert.equal((await env.ok<TaskResponse>(env.request('GET', `${base}/${task.id}`))).task.title, '현수막 디자인')
  } finally { await env.pg.close() }
})

test('보드는 마감일 순이고 마감일 없는 업무는 뒤에 온다. 참가 신청 마감도 함께 준다', async () => {
  const env = await setupPurchases()
  try {
    const late = await create(env, { title: '정산', dueOn: '2999-09-01' })
    const none = await create(env, { title: '후기', dueOn: null })
    const early = await create(env, { title: '대관', dueOn: '2999-07-01' })
    await env.ok(env.request('PATCH', '/events/e', { version: 1, startsAt: '2999-08-20T10:00', endsAt: null, place: null, ownerDepartmentId: null, ownerMembershipId: null }))
    await env.ok(env.request('POST', '/events/e/registration', { opensAt: null, closesAt: '2999-08-19T23:59', capacity: null, notice: null,
      collectPhone: false, fee: 0, memberFee: null }), 201)
    const list = await env.ok<EventTasksResponse>(env.request('GET', base))
    assert.deepEqual(list.tasks.map(item => item.id), [early.id, late.id, none.id])
    assert.equal(list.registrationClosesAt, '2999-08-19T23:59')
  } finally { await env.pg.close() }
})

test('상태: 완료는 완료 시각을 남기고, 되돌리면 지운다. 같은 상태는 그대로다', async () => {
  const env = await setupPurchases()
  try {
    const task = await create(env)
    const status = (version: number, value: string) => env.request('POST', `${base}/${task.id}/status`, { version, status: value })
    const done = (await env.ok<TaskResponse>(status(1, 'done'))).task
    assert.equal(done.status, 'done')
    assert.equal(done.version, 2)
    assert.ok(done.completedAt)
    const same = (await env.ok<TaskResponse>(status(2, 'done'))).task
    assert.equal(same.version, 2)
    assert.equal(same.history.length, 2)
    const back = (await env.ok<TaskResponse>(status(2, 'doing'))).task
    assert.equal(back.completedAt, null)
    assert.deepEqual(back.history.slice(1).map(entry => [entry.action, entry.changes]), [
      ['status_changed', { status: { from: 'todo', to: 'done' } }], ['status_changed', { status: { from: 'done', to: 'doing' } }]])
    await refused(status(2, 'todo'), 409, 'VERSION_CONFLICT')
  } finally { await env.pg.close() }
})

test('수정: 바뀐 칸만 이전·이후로 남기고 부서·담당자는 이름으로 남긴다. 바뀐 것이 없으면 버전도 그대로다', async () => {
  const env = await setupPurchases()
  try {
    const task = await create(env)
    const same = (await env.ok<TaskResponse>(env.request('PATCH', `${base}/${task.id}`, edit(task)))).task
    assert.equal(same.version, 1)
    assert.equal(same.history.length, 1)
    const changed = (await env.ok<TaskResponse>(env.request('PATCH', `${base}/${task.id}`, edit(task, { title: '현수막 인쇄', description: null,
      departmentId: 'df', assigneeMembershipId: 'mf', dueOn: null })))).task
    assert.equal(changed.version, 2)
    assert.deepEqual(changed.history.at(-1)?.changes, { title: { from: '현수막 디자인', to: '현수막 인쇄' }, description: { from: '시안 두 개', to: null },
      department: { from: '기획부', to: '총무부' }, assignee: { from: '기획2', to: '재정' }, dueOn: { from: '2999-08-10', to: null } })
    await refused(env.request('PATCH', `${base}/${task.id}`, edit(task)), 409, 'VERSION_CONFLICT')
  } finally { await env.pg.close() }
})

test('담당자는 같은 학생회에서 부서가 있는 구성원이고, 맡긴 뒤 미배정이 되어도 다른 칸은 고칠 수 있다', async () => {
  const env = await setupPurchases()
  try {
    for (const assigneeMembershipId of ['mn', 'mx', 'nobody']) await refused(env.request('POST', base, body({ assigneeMembershipId })), 409, 'TASK_ASSIGNEE_INVALID')
    for (const departmentId of ['dx', 'nobody']) await refused(env.request('POST', base, body({ departmentId })), 409, 'TASK_DEPARTMENT_INVALID')
    const task = await create(env)
    await env.pg.exec("UPDATE memberships SET department_id = NULL WHERE id = 'mq'")
    const renamed = (await env.ok<TaskResponse>(env.request('PATCH', `${base}/${task.id}`, edit(task, { title: '현수막 수정' })))).task
    assert.deepEqual(renamed.assignee, { membershipId: 'mq', name: '기획2' })
    const moved = (await env.ok<TaskResponse>(env.request('PATCH', `${base}/${task.id}`, edit(renamed, { assigneeMembershipId: 'mp' })))).task
    await refused(env.request('PATCH', `${base}/${task.id}`, edit(moved, { assigneeMembershipId: 'mq' })), 409, 'TASK_ASSIGNEE_INVALID')
    // 버전이 다르면 담당자 오류보다 VERSION_CONFLICT가 먼저다.
    await refused(env.request('PATCH', `${base}/${task.id}`, edit(renamed, { assigneeMembershipId: 'mn' })), 409, 'VERSION_CONFLICT')
  } finally { await env.pg.close() }
})

test('미배정·다른 학생회·로그인 안 함은 막고, 다른 행사의 경로로는 업무를 찾지 못한다', async () => {
  const env = await setupPurchases()
  try {
    const task = await create(env)
    env.as('n')
    await refused(env.request('POST', base, body()), 403, 'FORBIDDEN')
    await refused(env.request('PATCH', `${base}/${task.id}`, edit(task)), 403, 'FORBIDDEN')
    await refused(env.request('POST', `${base}/${task.id}/status`, { version: 1, status: 'done' }), 403, 'FORBIDDEN')
    await refused(env.request('POST', `${base}/${task.id}/delete`, { version: 1 }), 403, 'FORBIDDEN')
    env.as('x')
    await refused(env.request('GET', base), 403, 'FORBIDDEN')
    await refused(env.request('GET', '/my-tasks'), 403, 'FORBIDDEN')
    env.as(null)
    assert.equal((await env.request('GET', base)).status, 401)
    assert.equal((await env.request('POST', base, body())).status, 401)
    env.as('p')
    await refused(env.request('GET', '/events/ex/tasks'), 404, 'NOT_FOUND')
    await refused(env.request('POST', '/events/ex/tasks', body()), 404, 'NOT_FOUND')
    await refused(env.request('GET', `/events/e2/tasks/${task.id}`), 404, 'NOT_FOUND')
    await refused(env.request('POST', `/events/e2/tasks/${task.id}/status`, { version: 1, status: 'done' }), 404, 'NOT_FOUND')
  } finally { await env.pg.close() }
})

test('형식이 틀린 본문은 400이다: 필수값 누락, 공백만, 상한+1, NUL·홀로 쓰인 서러게이트, 모르는 키', async () => {
  const env = await setupPurchases()
  try {
    const { title: _title, ...missing } = body()
    for (const bad of [missing, body({ title: '   ' }), body({ title: '😀'.repeat(101) }), body({ title: `현수막${String.fromCharCode(0)}` }),
      body({ title: `현수막${String.fromCharCode(0xd800)}` }), body({ description: '😀'.repeat(1001) }), body({ dueOn: '2999-02-30' }), body({ extra: 1 })]) {
      await refused(env.request('POST', base, bad), 400, 'INVALID_INPUT')
    }
  } finally { await env.pg.close() }
})

test('지우기: 버전이 맞아야 하고, 처리 기록과 함께 지운 뒤 남은 목록을 준다', async () => {
  const env = await setupPurchases()
  try {
    const keep = await create(env, { title: '대관' })
    const task = await create(env)
    await env.ok(env.request('POST', `${base}/${task.id}/status`, { version: 1, status: 'doing' }))
    await refused(env.request('POST', `${base}/${task.id}/delete`, { version: 1 }), 409, 'VERSION_CONFLICT')
    const list = await env.ok<EventTasksResponse>(env.request('POST', `${base}/${task.id}/delete`, { version: 2 }))
    assert.deepEqual(list.tasks.map(item => item.id), [keep.id])
    await refused(env.request('GET', `${base}/${task.id}`), 404, 'NOT_FOUND')
    assert.equal((await env.pg.query('SELECT 1 FROM task_events WHERE task_id = $1', [task.id])).rows.length, 0)
  } finally { await env.pg.close() }
})

test('행사마다 업무는 300개까지이고, 다른 행사는 영향이 없다', async () => {
  const env = await setupPurchases()
  try {
    await env.pg.exec(`INSERT INTO tasks (id,organization_id,event_id,title,created_by)
      SELECT 'bulk-' || n, 'a', 'e', '업무 ' || n, 'p' FROM generate_series(1, 300) AS n`)
    await refused(env.request('POST', base, body()), 409, 'TASKS_FULL')
    await create(env, {}, '/events/e2/tasks')
  } finally { await env.pg.close() }
})

test('내 업무: 이 학생회에서 내가 맡은 업무를 모든 행사에서 모은다. 할 일은 마감일 순, 완료는 최근 순이다', async () => {
  const env = await setupPurchases()
  try {
    const later = await create(env, { title: '정산', dueOn: '2999-09-01' })
    const undated = await create(env, { title: '후기', dueOn: null })
    const other = await create(env, { title: '축제 포스터', dueOn: '2999-07-01' }, '/events/e2/tasks')
    const finished = await create(env, { title: '대관' })
    await create(env, { title: '남의 일', assigneeMembershipId: 'mp' })
    await env.ok(env.request('POST', `${base}/${finished.id}/status`, { version: 1, status: 'done' }))
    env.as('q')
    const mine = await env.ok<MyTasksResponse>(env.request('GET', '/my-tasks'))
    assert.deepEqual(mine.open.map(item => item.id), [other.id, later.id, undated.id])
    assert.deepEqual(mine.done.map(item => item.id), [finished.id])
    assert.equal(mine.truncated, false)
    assert.deepEqual(mine.open[0]?.event, { id: 'e2', name: '축제' })
  } finally { await env.pg.close() }
})

test('내 업무는 완료한 행사의 업무를 빼고, 완료를 취소하면 다시 보인다', async () => {
  const env = await setupPurchases()
  try {
    const kept = await create(env, { title: '대관', assigneeMembershipId: 'mq' })
    const other = await create(env, { title: '후기', assigneeMembershipId: 'mq' }, '/events/e2/tasks')
    await env.pg.exec(`INSERT INTO event_finances(event_id, organization_id, settled_at, settled_by) VALUES ('e','a', now(), 'f')`)
    env.as('l')
    await env.ok(env.request('POST', '/events/e/completion', { version: 1 }))
    env.as('q')
    assert.deepEqual((await env.ok<MyTasksResponse>(env.request('GET', '/my-tasks'))).open.map(task => task.id), [other.id])
    env.as('l')
    await env.ok(env.request('POST', '/events/e/completion/cancel', { version: 2 }))
    env.as('q')
    assert.deepEqual((await env.ok<MyTasksResponse>(env.request('GET', '/my-tasks'))).open.map(task => task.id).sort(), [kept.id, other.id].sort())
  } finally { await env.pg.close() }
})
