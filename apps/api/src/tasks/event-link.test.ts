import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getTableName, type Table } from 'drizzle-orm'
import type { TaskCreateOptionsResponse, TaskDetail } from '@vada/contracts'
import { actorOf } from '../access/actor.js'
import { eventDepartmentIdsOf } from '../access/event-departments.js'
import { can } from '../access/permissions.js'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import type { Tx } from '../db/types.js'
import { createRecord } from '../records/records.js'
import { registrationContextOf } from '../registrations/permission-context.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createOptionsOf } from './create-options.js'
import { createTaskRoutes } from './routes.js'

// 행사에 새 부서의 업무 잇기(기능 026 조각 1, DEC-94, DEC-28): 업무의 부서가 그 행사의 지금 담당 부서가 아니게 되는
// 잇기는 행사 책임자와 회장단만 한다. 그 부서 사람 모두가 신청자 정보를 보게 되기 때문이다(DEC-56).
const noon = new Date('2026-10-25T03:00:00Z')

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
  const { people, departments } = council
  const event = (ownerId: string | null, name = '봄 축제', owner = council) =>
    db.transaction(tx =>
      createRecord(tx, {
        kind: 'event',
        councilId: owner.councilId,
        actor: owner.people.president.memberId,
        values: { name, ownerId },
      }),
    )
  const post = (path: string, body: unknown, user: string) => api.post(`${base}${path}`, body, user)
  const made = async (body: unknown, user: string) => {
    const response = await api.post(base, body, user)
    assert.equal(response.status, 201, await response.clone().text())
    return ((await response.json()) as { task: TaskDetail }).task
  }
  const detail = async (id: string) =>
    ((await (await api.get(`${base}/${id}`, 's-president')).json()) as { task: TaskDetail }).task
  const options = async (user: string, eventId?: string) => {
    const response = await api.get(`${base}/options${eventId ? `?event=${eventId}` : ''}`, user)
    assert.equal(response.status, 200, user)
    return (await response.json()) as TaskCreateOptionsResponse
  }
  const count = async (sql: string, params: unknown[] = []) =>
    Number(((await pg.query(sql, params)).rows[0] as { n: string }).n)
  // 신청자 정보를 보는 사람인가: 신청 라우트와 같은 맥락(registrationContextOf)으로 묻는다.
  const seesApplicants = async (user: string, eventId: string, ownerId: string | null) => {
    const actor = (await actorOf(db, user, council.councilId, noon))!
    const context = await registrationContextOf(db, actor, { id: eventId, ownerId })
    return can(actor, 'registration.view_applicants', context)
  }
  const departmentsOf = (eventId: string) => eventDepartmentIdsOf(db, council.councilId, eventId)
  return {
    db,
    council,
    other,
    people,
    departments,
    api,
    event,
    post,
    made,
    detail,
    options,
    count,
    seesApplicants,
    departmentsOf,
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
const EDIT = { title: '고침', body: null, dueDate: null }
const tasks = 'SELECT count(*) AS n FROM task'

test(
  '부원과 부장이 자기 부서 업무가 없는 행사에 그 부서 업무를 만들면 403이고 업무도 신청자 정보 열람도 생기지 않는다',
  run(async s => {
    const { plain, planningMember } = s.people
    const { planning } = s.departments
    const eventId = await s.event(plain.memberId)
    const before = await s.count(tasks)
    const member = {
      title: 'a',
      eventId,
      departmentId: planning,
      assigneeId: planningMember.memberId,
    }
    const head = { title: 'b', eventId, departmentId: planning }
    for (const [body, user] of [
      [member, 's-planningMember'],
      [head, 's-planningHead'],
      [head, 's-planningViceHead'],
    ] as const) {
      const response = await s.post('', body, user)
      assert.equal(response.status, 403, user)
      assert.equal(await errorOf(response), 'FORBIDDEN')
    }
    assert.equal(await s.count(tasks), before)
    assert.deepEqual(await s.departmentsOf(eventId), [])
    // 기획부의 다른 사람도 그 행사의 신청자 정보를 그대로 보지 못한다.
    for (const user of ['s-planningViceHead', 's-planningMember'])
      assert.equal(await s.seesApplicants(user, eventId, plain.memberId), false, user)
  }),
)

test(
  '행사 책임자와 회장단은 새 부서의 업무를 잇고, 그 뒤 그 부서의 부원과 부장은 같은 행사에 만든다',
  run(async s => {
    const { plain, planningMember } = s.people
    const { planning, finance } = s.departments
    const owned = await s.event(plain.memberId)
    await s.made({ title: '책임자', eventId: owned, departmentId: planning }, 's-plain')
    const led = await s.event(plain.memberId, '가을 축제')
    await s.made({ title: '회장', eventId: led, departmentId: finance }, 's-president')
    await s.made({ title: '부회장', eventId: led, departmentId: planning }, 's-vicePresident')
    assert.deepEqual((await s.departmentsOf(led)).sort(), [finance, planning].sort())
    // 이미 그 행사의 담당 부서다.
    for (const eventId of [owned, led]) {
      const mine = {
        title: 'c',
        eventId,
        departmentId: planning,
        assigneeId: planningMember.memberId,
      }
      await s.made(mine, 's-planningMember')
      await s.made({ title: 'd', eventId, departmentId: planning }, 's-planningHead')
    }
    // 부서 없는 업무(학생회 업무)를 잇는 것은 지금대로다.
    const fresh = await s.event(plain.memberId, '겨울 축제')
    const council = { title: 'e', eventId: fresh, assigneeId: planningMember.memberId }
    assert.equal((await s.made(council, 's-planningMember')).department, null)
    assert.deepEqual(await s.departmentsOf(fresh), [])
  }),
)

test(
  '취소한 업무의 부서는 담당 부서가 아니라 다시 막힌다',
  run(async s => {
    const { plain, planningMember } = s.people
    const { planning } = s.departments
    const eventId = await s.event(plain.memberId)
    const first = await s.made({ title: 'a', eventId, departmentId: planning }, 's-plain')
    assert.equal((await s.post(`/${first.id}/delete`, {}, 's-plain')).status, 204)
    const mine = {
      title: 'b',
      eventId,
      departmentId: planning,
      assigneeId: planningMember.memberId,
    }
    assert.equal((await s.post('', mine, 's-planningMember')).status, 403)
  }),
)

test(
  '담당자가 자기 업무의 행사를 바꾸면 같은 규칙이고(이 업무 자신은 세지 않는다), 떼면 200이다',
  run(async s => {
    const { plain, planningMember } = s.people
    const { planning } = s.departments
    const as = 's-planningMember'
    const mine = { departmentId: planning, assigneeId: planningMember.memberId }
    const task = await s.made({ title: 'a', ...mine }, as)
    const move = (id: string, eventId: string | null, user = as) =>
      s.post(`/${id}`, { ...EDIT, eventId }, user)
    const versions = () =>
      s.count('SELECT count(*) AS n FROM record_version WHERE record_id = $1', [task.id])
    const empty = await s.event(plain.memberId, '빈 행사')
    const staffed = await s.event(plain.memberId, '기획부 행사')
    await s.made({ title: 'x', eventId: staffed, departmentId: planning }, 's-plain')
    const before = await versions()
    const denied = await move(task.id, empty)
    assert.equal(denied.status, 403)
    assert.equal(await errorOf(denied), 'FORBIDDEN')
    assert.equal(await versions(), before)
    assert.equal((await s.detail(task.id)).event, null)
    assert.equal((await move(task.id, staffed)).status, 200)
    // 이 업무가 기획부의 단 하나인 행사에서 다른 빈 행사로 옮기는 것도 막힌다(옮기는 업무 자신은 새 행사에 없다).
    const lone = await s.made({ title: 'b', ...mine, eventId: staffed }, as)
    const other = await s.event(plain.memberId, '다른 빈 행사')
    assert.equal((await move(lone.id, other)).status, 403)
    // 떼면 보는 사람이 좁아질 뿐이라 지금대로다.
    assert.equal((await move(task.id, null)).status, 200)
    assert.equal((await s.detail(task.id)).event, null)
    // 부장도 같고, 회장단은 된다.
    const headTask = await s.made({ title: 'c', departmentId: planning }, 's-planningHead')
    assert.equal((await move(headTask.id, empty, 's-planningHead')).status, 403)
    assert.equal((await move(headTask.id, empty, 's-president')).status, 200)
    assert.deepEqual(await s.departmentsOf(empty), [planning])
  }),
)

test(
  '행사 책임자는 자기가 맡은 업무를 자기 행사로 옮겨 새 부서를 잇고, 남의 행사로는 못 옮긴다',
  run(async s => {
    const { plain, planningMember } = s.people
    const { finance } = s.departments
    const mine = await s.event(plain.memberId, '내 행사')
    const second = await s.event(plain.memberId, '내 둘째 행사')
    const theirs = await s.event(planningMember.memberId, '남의 행사')
    const task = await s.made(
      { title: 'a', eventId: mine, departmentId: finance, assigneeId: plain.memberId },
      's-plain',
    )
    const move = (eventId: string) => s.post(`/${task.id}`, { ...EDIT, eventId }, 's-plain')
    assert.equal((await move(theirs)).status, 403)
    assert.equal((await move(second)).status, 200)
    assert.deepEqual(await s.departmentsOf(second), [finance])
  }),
)

test(
  '만들기 선택지: 그 행사에 이을 수 없는 부서가 없고, 이을 수 있는 행사가 부서마다 실린다',
  run(async s => {
    const { plain, planningHead } = s.people
    const { planning, finance } = s.departments
    const empty = await s.event(plain.memberId, '빈 행사')
    const staffed = await s.event(plain.memberId, '기획부 행사')
    await s.made({ title: 'x', eventId: staffed, departmentId: planning }, 's-plain')
    const ids = (options: TaskCreateOptionsResponse) => options.departments.map(item => item.id)
    assert.deepEqual(ids(await s.options('s-planningMember', empty)), [null])
    assert.deepEqual(ids(await s.options('s-planningHead', empty)), [null])
    assert.deepEqual(ids(await s.options('s-planningMember', staffed)), [planning, null])
    // 부서는 번호 순이고 학생회 업무가 맨 뒤다.
    const everything = [...[finance, planning].sort(), null]
    for (const user of ['s-plain', 's-president'])
      assert.deepEqual(ids(await s.options(user, empty)), everything, user)
    const linkable = (options: TaskCreateOptionsResponse, departmentId: string | null) =>
      [
        ...(options.linkableEvents.find(item => item.departmentId === departmentId)?.eventIds ??
          []),
      ].sort()
    const member = await s.options('s-planningMember')
    assert.deepEqual(linkable(member, planning), [staffed])
    assert.deepEqual(linkable(member, finance), [])
    assert.deepEqual(linkable(member, null), [empty, staffed].sort())
    const owner = await s.options('s-plain')
    for (const departmentId of [planning, finance, null])
      assert.deepEqual(linkable(owner, departmentId), [empty, staffed].sort())
    // 남의 행사의 책임자: 그 행사에는 어느 부서든 잇는다.
    const theirs = await s.event(planningHead.memberId, '부장 행사')
    const head = await s.options('s-planningHead')
    assert.deepEqual(linkable(head, finance), [theirs])
    assert.deepEqual(linkable(head, planning), [staffed, theirs].sort())
    const president = await s.options('s-president')
    assert.equal(president.linkableEvents.length, 3)
    for (const item of president.linkableEvents)
      assert.deepEqual([...item.eventIds].sort(), [empty, staffed, theirs].sort())
  }),
)

test(
  '만들기 선택지: 다른 학생회 행사는 이을 수 있는 행사에 없고 그 행사의 선택지는 404다',
  run(async s => {
    const foreign = await s.event(s.other.people.president.memberId, '남의 학생회', s.other)
    const ownEvent = await s.event(s.people.plain.memberId)
    const president = await s.options('s-president')
    const text = JSON.stringify(president.linkableEvents)
    assert.ok(!text.includes(foreign), '다른 학생회 행사가 실렸다')
    assert.ok(text.includes(ownEvent))
    const response = await s.api.get(
      `/api/organizations/${s.council.councilId}/tasks/options?event=${foreign}`,
      's-president',
    )
    assert.equal(response.status, 404)
    // 다른 학생회 사람은 우리 학생회의 선택지를 읽지 못하고, 로그인 없으면 401이다.
    const path = `/api/organizations/${s.council.councilId}/tasks/options`
    assert.equal((await s.api.get(path, 'o-president')).status, 403)
    assert.equal((await s.api.get(path)).status, 401)
  }),
)

test(
  '부서 정하기로 이어진 행사의 담당 부서가 아닌 부서를 잇는 것도 같은 규칙이고, 거절하면 판이 생기지 않는다',
  run(async s => {
    const { plain } = s.people
    const { planning, finance } = s.departments
    const eventId = await s.event(plain.memberId)
    const task = await s.made({ title: 'a', eventId, departmentId: planning }, 's-plain')
    const versions = () =>
      s.count('SELECT count(*) AS n FROM record_version WHERE record_id = $1', [task.id])
    const set = (departmentId: string | null, user: string) =>
      s.post(`/${task.id}/department`, { departmentId }, user)
    const before = await versions()
    for (const user of ['s-planningHead', 's-planningMember', 's-financeMember']) {
      const response = await set(finance, user)
      assert.equal(response.status, 403, user)
      assert.equal(await errorOf(response), 'FORBIDDEN')
    }
    assert.equal(await versions(), before)
    assert.deepEqual(await s.departmentsOf(eventId), [planning])
    // 행사 책임자와 회장단은 새 부서를 잇는다.
    assert.equal((await set(finance, 's-plain')).status, 200)
    assert.deepEqual(await s.departmentsOf(eventId), [finance])
    assert.equal((await set(planning, 's-vicePresident')).status, 200)
    assert.deepEqual(await s.departmentsOf(eventId), [planning])
  }),
)

// 업무 표를 읽는 select의 표 이름을 모은다. 선택지 한 번에 행사 담당 부서를 몇 번 셌는지 보려는 것이다.
const tablesRead = (tx: Tx, read: string[]): Tx =>
  new Proxy(tx, {
    get(target, prop, receiver) {
      const value: unknown = Reflect.get(target, prop, receiver)
      if (typeof value !== 'function') return value
      if (prop !== 'select' && prop !== 'selectDistinct') return value.bind(target) as unknown
      return (...args: unknown[]) => {
        const builder = value.apply(target, args) as { from: (table: Table) => unknown }
        const from = builder.from.bind(builder)
        builder.from = (table: Table) => {
          read.push(getTableName(table))
          return from(table)
        }
        return builder
      }
    },
  })

test(
  '행사의 만들기 선택지는 담당 부서를 한 번만 세고(업무 표 한 번) 답은 라우트와 같다',
  run(async s => {
    const { plain } = s.people
    const { planning } = s.departments
    const staffed = await s.event(plain.memberId, '기획부 행사')
    await s.made({ title: 'x', eventId: staffed, departmentId: planning }, 's-plain')
    const actor = (await actorOf(s.db, 's-planningMember', s.council.councilId, noon))!
    const read: string[] = []
    const options = await s.db.transaction(tx =>
      createOptionsOf(tablesRead(tx, read), actor, staffed, noon),
    )
    assert.equal(read.filter(table => table === 'task').length, 1, read.join(','))
    assert.deepEqual(
      options.departments.map(item => item.id),
      [planning, null],
    )
    assert.deepEqual(options, await s.options('s-planningMember', staffed))
  }),
)
