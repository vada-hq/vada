import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { TaskDetail, TasksResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import { createRecord, updateRecord } from '../records/records.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createTaskRoutes } from './routes.js'

// 행사 책임자는 그 행사의 업무를 어느 부서로든 다룬다(기능 006 조각 4).
const noon = new Date('2026-10-25T03:00:00Z')
const MISSING = '019e0000-0000-7000-8000-000000000000'

async function start() {
  const { pg, db, close } = await createTestDb()
  const council = await seedCouncil(db, pg)
  const other = await seedCouncil(db, pg, 'o')
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      tasks: createTaskRoutes(db, testSession, { clock: () => noon }),
    }),
  )
  const base = `/api/organizations/${council.councilId}/tasks`
  const event = (ownerId: string | null, name = '봄 축제', owner = council) =>
    db.transaction(tx =>
      createRecord(tx, {
        kind: 'event',
        councilId: owner.councilId,
        actor: owner.people.president.memberId,
        values: { name, ownerId },
      }),
    )
  const setOwner = (id: string, ownerId: string | null) =>
    db.transaction(tx =>
      updateRecord(tx, {
        kind: 'event',
        id,
        actor: council.people.president.memberId,
        reason: null,
        changes: { ownerId },
      }),
    )
  const post = (path: string, body: unknown, user = 's-president') =>
    api.post(`${base}${path}`, body, user)
  const made = async (body: unknown, user = 's-president') => {
    const response = await api.post(base, body, user)
    assert.equal(response.status, 201, await response.clone().text())
    return ((await response.json()) as { task: TaskDetail }).task
  }
  const detail = async (id: string, user = 's-president') =>
    ((await (await api.get(`${base}/${id}`, user)).json()) as { task: TaskDetail }).task
  const count = async (sql: string, params: unknown[] = []) =>
    Number(((await pg.query(sql, params)).rows[0] as { n: string }).n)
  return { pg, council, other, api, base, event, setOwner, post, made, detail, count, close }
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
const EDIT = { title: '고침', body: null, dueDate: null }
const plainDetail = (s: S, id: string) => s.detail(id, 's-plain')

test(
  '행사 책임자는 직급이 없어도 그 행사의 업무를 어느 부서로든 만들고, 행사 없는 업무는 004대로다',
  run(async s => {
    const { plain, planningMember } = s.council.people
    const eventId = await s.event(plain.memberId)
    const { planning, finance } = s.council.departments
    for (const departmentId of [planning, finance, null]) {
      const task = await s.made({ title: 'a', eventId, departmentId }, 's-plain')
      assert.deepEqual(task.event, { id: eventId, name: '봄 축제' })
      assert.deepEqual(task.actions, [
        'task.manage',
        'task.set_department',
        'task.assign',
        'task.status',
      ])
    }
    const ok = await s.made({ title: 'b', eventId, assigneeId: planningMember.memberId }, 's-plain')
    assert.equal(ok.assignee?.id, planningMember.memberId)
    const before = await s.count('SELECT count(*) AS n FROM task')
    // 행사 없는 업무, 다른 책임자의 행사: 004 규칙이라 직급 없는 사람은 남의 일을 만들지 못한다.
    const otherEvent = await s.event(planningMember.memberId, '가을 축제')
    for (const body of [
      { title: 'c', assigneeId: planningMember.memberId },
      { title: 'd', eventId: otherEvent },
      { title: 'e', eventId: otherEvent, departmentId: planning },
    ])
      assert.equal((await s.post('', body, 's-plain')).status, 403, JSON.stringify(body))
    assert.equal(await s.count('SELECT count(*) AS n FROM task'), before)
    // 책임자가 없는 행사는 아무에게도 열리지 않는다(기본 거부).
    const orphan = await s.event(null)
    assert.equal((await s.post('', { title: 'f', eventId: orphan }, 's-plain')).status, 403)
    assert.equal((await s.post('', { title: 'g', eventId: orphan }, 's-planningHead')).status, 403)
  }),
)

test(
  '다른 학생회 행사나 없는 행사는 409 EVENT_INVALID이고 업무가 생기지 않는다. 403이 먼저다',
  run(async s => {
    const foreign = await s.event(s.other.people.president.memberId, '남의 행사', s.other)
    const before = await s.count('SELECT count(*) AS n FROM task')
    for (const eventId of [foreign, MISSING]) {
      const response = await s.post('', { title: 'a', eventId })
      assert.equal(response.status, 409)
      assert.equal(await errorOf(response), 'EVENT_INVALID')
      // 권한이 없는 사람에게는 행사가 있는지 드러내지 않고 403이다.
      assert.equal((await s.post('', { title: 'a', eventId }, 's-plain')).status, 403)
    }
    assert.equal(await s.count('SELECT count(*) AS n FROM task'), before)
    assert.equal((await s.post('', { title: 'a', eventId: 'nope' })).status, 400)
  }),
)

test(
  '행사 책임자는 그 행사의 업무를 고치고 상태를 바꾸고 맡기고 부서를 정하고 지운다',
  run(async s => {
    const { plain, planningMember } = s.council.people
    const eventId = await s.event(plain.memberId)
    const task = await s.made({ title: 'a', eventId })
    const as = 's-plain'
    const planning = s.council.departments.planning
    assert.equal((await s.post(`/${task.id}`, EDIT, as)).status, 200)
    assert.equal((await s.post(`/${task.id}/status`, { status: 'done' }, as)).status, 200)
    const assign = { assigneeId: planningMember.memberId }
    assert.equal((await s.post(`/${task.id}/assignee`, assign, as)).status, 200)
    const dept = { departmentId: planning }
    assert.equal((await s.post(`/${task.id}/department`, dept, as)).status, 200)
    assert.equal((await plainDetail(s, task.id)).department?.id, planning)
    assert.equal((await s.post(`/${task.id}/delete`, {}, as)).status, 204)
    // 행사 없는 업무와 다른 행사의 업무는 004대로 403이다.
    const bare = await s.made({ title: 'b' })
    const foreignEvent = await s.event(planningMember.memberId, '가을 축제')
    const other = await s.made({ title: 'c', eventId: foreignEvent })
    for (const id of [bare.id, other.id]) {
      assert.equal((await s.post(`/${id}`, EDIT, as)).status, 403)
      assert.equal((await s.post(`/${id}/status`, { status: 'done' }, as)).status, 403)
      assert.equal((await s.post(`/${id}/assignee`, assign, as)).status, 403)
      assert.equal((await s.post(`/${id}/department`, dept, as)).status, 403)
      assert.equal((await s.post(`/${id}/delete`, {}, as)).status, 403)
    }
  }),
)

test(
  '책임자가 바뀐 뒤 전 책임자는 403이고 새 책임자가 다룬다. 책임자를 비워도 403이다',
  run(async s => {
    const { plain, planningMember } = s.council.people
    const eventId = await s.event(plain.memberId)
    const task = await s.made({ title: 'a', eventId })
    await s.setOwner(eventId, planningMember.memberId)
    assert.equal((await s.post(`/${task.id}`, EDIT, 's-plain')).status, 403)
    assert.equal((await s.post(`/${task.id}/status`, { status: 'done' }, 's-plain')).status, 403)
    assert.equal((await s.post('', { title: 'b', eventId }, 's-plain')).status, 403)
    assert.deepEqual((await plainDetail(s, task.id)).actions, [])
    assert.equal((await s.post(`/${task.id}`, EDIT, 's-planningMember')).status, 200)
    await s.setOwner(eventId, null)
    assert.equal((await s.post(`/${task.id}`, EDIT, 's-planningMember')).status, 403)
  }),
)

test(
  '고치기로 행사를 바꾸거나 비우면 전과 뒤 모두에서 task.manage가 있어야 한다',
  run(async s => {
    const { plain, planningMember } = s.council.people
    const mine = await s.event(plain.memberId, '내 행사')
    const theirs = await s.event(planningMember.memberId, '남의 행사')
    const task = await s.made({ title: 'a', eventId: mine })
    const move = (id: string, eventId: string | null, user: string) =>
      s.post(`/${id}`, { ...EDIT, eventId }, user)
    // 뒤에 권한이 없다: 내 행사 업무를 남의 행사로, 비우기로.
    assert.equal((await move(task.id, theirs, 's-plain')).status, 403)
    assert.equal((await move(task.id, null, 's-plain')).status, 403)
    assert.equal((await plainDetail(s, task.id)).event?.id, mine)
    // 앞에 권한이 없다: 남의 행사 업무를 내 행사로 끌어오지 못한다.
    const pulled = await s.made({ title: 'b', eventId: theirs })
    assert.equal((await move(pulled.id, mine, 's-plain')).status, 403)
    assert.equal((await s.detail(pulled.id)).event?.id, theirs)
    // 전과 뒤 모두에 권한이 있다(회장단): 바꾸기, 비우기, 되돌리기
    for (const eventId of [theirs, null, mine]) {
      const response = await move(task.id, eventId, 's-president')
      assert.equal(response.status, 200)
      const body = (await response.json()) as { task: TaskDetail }
      assert.equal(body.task.event?.id ?? null, eventId)
    }
    // 다른 학생회 행사는 409이고 업무는 그대로다.
    const foreign = await s.event(s.other.people.president.memberId, '남의 학생회', s.other)
    const response = await move(task.id, foreign, 's-president')
    assert.equal(response.status, 409)
    assert.equal(await errorOf(response), 'EVENT_INVALID')
    assert.equal((await plainDetail(s, task.id)).event?.id, mine)
  }),
)

test(
  '고치기에서 행사 칸을 빼거나 같은 값을 보내면 행사도 판도 바뀌지 않는다',
  run(async s => {
    const eventId = await s.event(s.council.people.plain.memberId)
    const task = await s.made({ title: 'a', eventId })
    const versions = () =>
      s.count('SELECT count(*) AS n FROM record_version WHERE record_id = $1', [task.id])
    const same = { title: 'a', body: null, dueDate: null }
    assert.equal(await versions(), 1)
    assert.equal((await s.post(`/${task.id}`, same)).status, 200)
    assert.equal((await s.post(`/${task.id}`, { ...same, eventId })).status, 200)
    assert.equal(await versions(), 1)
    assert.equal((await plainDetail(s, task.id)).event?.id, eventId)
    // 책임자가 없어진 뒤에도 같은 값은 확인도 판도 없다(회장단이 아닌 부서 부장은 원래 403이므로 회장단으로).
    await s.setOwner(eventId, null)
    assert.equal((await s.post(`/${task.id}`, { ...same, eventId })).status, 200)
    assert.equal(await versions(), 1)
  }),
)

test(
  'GET tasks?event=는 그 행사의 업무만 view·status와 함께 준다. 다른 학생회 행사는 404, 틀린 값은 400',
  run(async s => {
    const { plain, planningMember } = s.council.people
    const first = await s.event(plain.memberId, '첫 행사')
    const second = await s.event(plain.memberId, '둘째 행사')
    const a = await s.made({
      title: 'a',
      eventId: first,
      departmentId: s.council.departments.planning,
      assigneeId: planningMember.memberId,
    })
    const b = await s.made({ title: 'b', eventId: first })
    const done = await s.made({ title: 'done', eventId: first })
    await s.post(`/${done.id}/status`, { status: 'done' })
    await s.made({ title: 'c', eventId: second })
    await s.made({ title: 'bare' })
    const list = async (query: string, user = 's-president') => {
      const response = await s.api.get(`${s.base}?${query}`, user)
      assert.equal(response.status, 200, query)
      return ((await response.json()) as TasksResponse).tasks.map(row => row.id)
    }
    assert.deepEqual((await list(`view=all&event=${first}`)).sort(), [a.id, b.id].sort())
    assert.deepEqual(await list(`view=all&event=${first}&status=done`), [done.id])
    assert.deepEqual(await list(`view=unassigned&event=${first}`), [b.id])
    assert.deepEqual(await list(`view=mine&event=${first}`, 's-planningMember'), [a.id])
    assert.equal((await list('view=all')).length, 4)
    const foreign = await s.event(s.other.people.president.memberId, '남', s.other)
    const get = (query: string) => s.api.get(`${s.base}?${query}`, 's-president')
    for (const event of [foreign, MISSING])
      assert.equal((await get(`view=all&event=${event}`)).status, 404)
    assert.equal((await get('view=all&event=nope')).status, 400)
    assert.equal((await get(`view=all&event=${first}&event=${second}`)).status, 400)
  }),
)

test(
  '업무 줄과 상세에 행사 이름이 지금 이름으로 보이고, 행사 없는 업무는 null이다',
  run(async s => {
    const eventId = await s.event(null, '이름 전')
    const task = await s.made({ title: 'a', eventId })
    const bare = await s.made({ title: 'b' })
    await s.pg.query("UPDATE event SET name = '이름 뒤' WHERE id = $1", [eventId])
    assert.deepEqual((await s.detail(task.id)).event, { id: eventId, name: '이름 뒤' })
    assert.equal((await s.detail(bare.id)).event, null)
    const response = await s.api.get(`${s.base}?view=all`, 's-president')
    const rows = ((await response.json()) as TasksResponse).tasks
    assert.deepEqual(rows.find(row => row.id === task.id)?.event, { id: eventId, name: '이름 뒤' })
    assert.equal(rows.find(row => row.id === bare.id)?.event, null)
  }),
)

test(
  '업무 이력에 행사 변경이 전·후 이름과 함께 남고, 비우기와 처음 값도 보인다',
  run(async s => {
    const first = await s.event(null, '첫 행사')
    const second = await s.event(null, '둘째 행사')
    const task = await s.made({ title: 'a', eventId: first })
    for (const eventId of [second, null, first])
      assert.equal((await s.post(`/${task.id}`, { ...EDIT, title: 'a', eventId })).status, 200)
    const ref = (id: string, name: string) => ({ id, name })
    const changes = (await s.detail(task.id)).history.map(version => version.changes)
    assert.deepEqual(changes, [
      [{ field: 'created' }],
      [{ field: 'event', from: ref(first, '첫 행사'), to: ref(second, '둘째 행사') }],
      [{ field: 'event', from: ref(second, '둘째 행사'), to: null }],
      [{ field: 'event', from: null, to: ref(first, '첫 행사') }],
    ])
  }),
)
