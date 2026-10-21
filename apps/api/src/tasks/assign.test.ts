import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { TaskDetail } from '@vada/contracts'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import { createRateLimiter } from '../http/rate-limit.js'
import type { PushSender } from '../push/sender.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createTaskPush } from './notify.js'
import { createTaskRoutes } from './routes.js'

// 한국 시각 2026-10-25 12:00
const noon = new Date('2026-10-25T03:00:00Z')
const MISSING = '019e0000-0000-7000-8000-000000000000'
const endpointOf = (user: string) => `https://fcm.googleapis.com/fcm/send/${user}`

async function start(
  options: { withPush?: boolean; limiter?: ReturnType<typeof createRateLimiter> } = {},
) {
  const { pg, db, close } = await createTestDb()
  const council = await seedCouncil(db, pg)
  const other = await seedCouncil(db, pg, 'o')
  const calls: Parameters<PushSender>[] = []
  let gate: Promise<void> = Promise.resolve()
  const send: PushSender = async (...args) => {
    calls.push(args)
    await gate
    if (args[0].endpoint.endsWith('s-planningViceHead')) throw new Error('secret')
    return { result: 'sent' }
  }
  const pending: Promise<void>[] = []
  const taskPush = createTaskPush(db, send)
  const push = {
    notify: (notice: Parameters<typeof taskPush.notify>[0]) => {
      const done = taskPush.notify(notice)
      pending.push(done)
      return done
    },
  }
  for (const person of Object.values(council.people))
    await pg.query(
      'INSERT INTO push_device (user_id, endpoint, p256dh, auth) VALUES ($1,$2,$3,$4)',
      [person.userId, endpointOf(person.userId), 'p', 'a'],
    )
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      tasks: createTaskRoutes(db, testSession, {
        clock: () => noon,
        ...(options.withPush === false ? {} : { push }),
        ...(options.limiter ? { writeLimiter: options.limiter } : {}),
      }),
    }),
  )
  const base = `/api/organizations/${council.councilId}/tasks`
  const count = async (sql: string, params: unknown[] = []) =>
    Number(((await pg.query(sql, params)).rows[0] as { n: string }).n)
  const settled = async () => {
    await Promise.all(pending)
  }
  const made = async (body: unknown, user = 's-president') => {
    const response = await api.post(base, body, user)
    assert.equal(response.status, 201)
    await settled()
    return ((await response.json()) as { task: TaskDetail }).task
  }
  const assign = async (id: string, assigneeId: unknown, user = 's-president') => {
    const response = await api.post(`${base}/${id}/assignee`, { assigneeId }, user)
    await settled()
    return response
  }
  const department = async (id: string, departmentId: unknown, user = 's-president') =>
    api.post(`${base}/${id}/department`, { departmentId }, user)
  const versions = (id: string) =>
    count('SELECT count(*) AS n FROM record_version WHERE record_id = $1', [id])
  const notices = () => count("SELECT count(*) AS n FROM notification WHERE type = 'assignment'")
  const hold = () => {
    let release!: () => void
    gate = new Promise<void>(resolve => (release = resolve))
    return release
  }
  return {
    pg,
    council,
    other,
    api,
    base,
    calls,
    made,
    assign,
    department,
    versions,
    notices,
    settled,
    hold,
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
const detailOf = async (response: Response) =>
  ((await response.json()) as { task: TaskDetail }).task

test(
  '그 부서 부장과 회장단은 지금 운영진 누구에게나 맡기고 비운다',
  run(async s => {
    const { planning } = s.council.departments
    const { financeMember, plain } = s.council.people
    const task = await s.made({ title: 'a', departmentId: planning })
    let response = await s.assign(task.id, financeMember.memberId.toUpperCase(), 's-planningHead')
    assert.equal(response.status, 200)
    assert.equal((await detailOf(response)).assignee?.id, financeMember.memberId)
    response = await s.assign(task.id, plain.memberId)
    assert.equal((await detailOf(response)).assignee?.id, plain.memberId)
    response = await s.assign(task.id, null, 's-planningHead')
    assert.equal((await detailOf(response)).assignee, null)
    assert.equal(await s.versions(task.id), 4)
  }),
)

test(
  '담당자와 부원, 다른 부서 부장은 403이고 떠난 사람과 다른 학생회 사람은 409이며 판이 늘지 않는다',
  run(async s => {
    const { planning } = s.council.departments
    const { planningMember, financeMember, ended } = s.council.people
    const task = await s.made({
      title: 'a',
      departmentId: planning,
      assigneeId: planningMember.memberId,
    })
    assert.equal((await s.assign(task.id, financeMember.memberId, 's-planningMember')).status, 403)
    assert.equal((await s.assign(task.id, financeMember.memberId, 's-financeMember')).status, 403)
    assert.equal((await s.assign(task.id, financeMember.memberId, 's-plain')).status, 403)
    for (const id of [ended.memberId, s.other.people.president.memberId, MISSING]) {
      const response = await s.assign(task.id, id)
      assert.equal(response.status, 409)
      assert.equal(await errorOf(response), 'TASK_ASSIGNEE_INVALID')
    }
    // 403이 409보다 먼저다.
    assert.equal((await s.assign(task.id, ended.memberId, 's-planningMember')).status, 403)
    assert.equal(await s.versions(task.id), 1)
  }),
)

test(
  '회장단만 부서를 정하고 비운다. 부장은 403이고 담당자는 그대로다',
  run(async s => {
    const { planning, finance } = s.council.departments
    const { planningMember } = s.council.people
    const task = await s.made({ title: 'a', assigneeId: planningMember.memberId })
    let response = await s.department(task.id, planning.toUpperCase(), 's-vicePresident')
    assert.equal(response.status, 200)
    let detail = await detailOf(response)
    assert.equal(detail.department?.id, planning)
    assert.equal(detail.assignee?.id, planningMember.memberId)
    assert.equal((await s.department(task.id, finance, 's-planningHead')).status, 403)
    assert.equal((await s.department(task.id, null, 's-planningHead')).status, 403)
    assert.equal((await s.department(task.id, finance, 's-planningMember')).status, 403)
    for (const id of [s.other.departments.planning, s.other.councilId, MISSING]) {
      response = await s.department(task.id, id)
      assert.equal(response.status, 409)
      assert.equal(await errorOf(response), 'TASK_DEPARTMENT_INVALID')
    }
    assert.equal(await s.versions(task.id), 2)
    response = await s.department(task.id, planning)
    assert.equal(await s.versions(task.id), 2)
    detail = await detailOf(await s.department(task.id, null))
    assert.equal(detail.department, null)
    assert.equal(detail.assignee?.id, planningMember.memberId)
    assert.equal(await s.versions(task.id), 3)
    assert.equal(await s.notices(), 1)
  }),
)

test(
  '담당자를 정해 만들면 알림 기록 하나와 새 담당자의 기기마다 한 번 알림이 가고 누르면 그 업무가 열린다',
  run(async s => {
    const { planningMember } = s.council.people
    const task = await s.made({
      title: '현수막 주문',
      dueDate: '2026-10-25',
      assigneeId: planningMember.memberId,
    })
    assert.equal(await s.notices(), 1)
    const [call] = s.calls
    assert.equal(s.calls.length, 1)
    assert.equal(call![0].endpoint, endpointOf('s-planningMember'))
    assert.deepEqual(call![1], {
      title: '업무를 맡았어요',
      body: 's president: 현수막 주문 · 10월 25일까지',
      url: `/tasks/${s.council.councilId}/${task.id}`,
      tag: `task:${task.id}`,
    })
    assert.equal(call![2]?.ttl, 86_400)
    const row = await s.pg.query<{ record_id: string; recipient_id: string }>(
      "SELECT record_id, recipient_id FROM notification WHERE type = 'assignment'",
    )
    assert.deepEqual(row.rows, [{ record_id: task.id, recipient_id: planningMember.memberId }])
    const bare = await s.made({ title: '마감 없음', assigneeId: planningMember.memberId })
    assert.equal(s.calls[1]![1].body, 's president: 마감 없음')
    assert.equal(bare.assignee?.id, planningMember.memberId)
  }),
)

test(
  '다른 사람으로 바꾸면 새 담당자만 받고 이전 담당자는 받지 않는다. 나에게 맡기기, 같은 사람, 비우기는 없다',
  run(async s => {
    const { planningMember, financeMember, plain } = s.council.people
    const task = await s.made({ title: 'a', assigneeId: planningMember.memberId })
    s.calls.length = 0
    await s.assign(task.id, financeMember.memberId)
    assert.deepEqual(
      s.calls.map(call => call[0].endpoint),
      [endpointOf('s-financeMember')],
    )
    assert.equal(await s.notices(), 2)
    await s.assign(task.id, financeMember.memberId)
    await s.assign(task.id, null)
    await s.assign(task.id, s.council.people.president.memberId)
    assert.equal(await s.notices(), 2)
    assert.equal(s.calls.length, 1)
    // 나에게 맡겨 만들기도 알리지 않는다.
    await s.made({ title: 'mine', assigneeId: plain.memberId }, 's-plain')
    assert.equal(await s.notices(), 2)
    assert.equal(s.calls.length, 1)
  }),
)

test(
  '부서, 상태, 내용 바꾸기, 지우기, 실패한 쓰기는 알림도 기록도 없다',
  run(async s => {
    const { planning, finance } = s.council.departments
    const { planningMember } = s.council.people
    const task = await s.made({ title: 'a', assigneeId: planningMember.memberId })
    s.calls.length = 0
    const base = `${s.base}/${task.id}`
    await s.department(task.id, planning)
    await s.api.post(`${base}/status`, { status: 'done' }, 's-president')
    await s.api.post(base, { title: 'b', body: null, dueDate: null }, 's-president')
    await s.assign(task.id, s.council.people.ended.memberId)
    await s.assign(task.id, s.council.people.plain.memberId, 's-planningMember')
    await s.department(task.id, finance, 's-planningHead')
    await s.api.post(`${base}/delete`, {}, 's-president')
    await s.assign(task.id, s.council.people.plain.memberId)
    await s.settled()
    assert.equal(await s.notices(), 1)
    assert.equal(s.calls.length, 0)
  }),
)

test(
  '응답은 알림을 기다리지 않고 알림 기기 하나가 실패해도 업무와 기록은 남으며 로그에 비밀이 없다',
  run(async s => {
    const { planningMember, planningViceHead } = s.council.people
    const release = s.hold()
    const warnings: string[] = []
    const original = console.warn
    console.warn = (line: string) => void warnings.push(line)
    try {
      const response = await s.api.post(
        s.base,
        { title: '비밀 제목', assigneeId: planningMember.memberId },
        's-president',
      )
      assert.equal(response.status, 201)
      assert.equal(await s.notices(), 1)
      const second = await s.api.post(
        s.base,
        { title: '비밀 제목', assigneeId: planningViceHead.memberId },
        's-president',
      )
      assert.equal(second.status, 201)
      release()
      await s.settled()
    } finally {
      console.warn = original
    }
    assert.equal(await s.notices(), 2)
    const logged = warnings.join('\n')
    assert.match(logged, /push_send_failed/)
    for (const secret of ['비밀 제목', planningViceHead.memberId, 'fcm.googleapis.com', 'secret'])
      assert.equal(logged.includes(secret), false, secret)
  }),
)

test('알림 열쇠가 없어도 업무와 알림 기록은 생긴다', async () => {
  const s = await start({ withPush: false })
  try {
    const task = await s.made({ title: 'a', assigneeId: s.council.people.plain.memberId })
    assert.equal((await s.assign(task.id, s.council.people.planningMember.memberId)).status, 200)
    assert.equal(await s.notices(), 2)
    assert.equal(s.calls.length, 0)
  } finally {
    await s.close()
  }
})

test('만들기와 맡기기가 한도 하나를 같이 쓴다', async () => {
  const s = await start({ limiter: createRateLimiter({ limit: 3, windowMs: 10_000 }) })
  try {
    const task = await s.made({ title: 'a' })
    await s.made({ title: 'b' })
    assert.equal((await s.assign(task.id, s.council.people.plain.memberId)).status, 200)
    const blocked = await s.assign(task.id, null)
    assert.equal(blocked.status, 429)
    assert.equal(await errorOf(blocked), 'TOO_MANY_REQUESTS')
    assert.equal((await s.assign(task.id, null, 's-vicePresident')).status, 200)
  } finally {
    await s.close()
  }
})

test(
  '입력 경우와 인증: 키 누락, 모르는 키, 나쁜 번호는 400, 미인증은 401, 다른 학생회와 없는 업무는 404나 403',
  run(async s => {
    const task = await s.made({ title: 'a' })
    for (const [path, body] of [
      ['assignee', {}],
      ['assignee', { assigneeId: 'abc' }],
      ['assignee', { assigneeId: `${s.council.people.plain.memberId}\u0000` }],
      ['assignee', { assigneeId: null, extra: 1 }],
      ['assignee', { assigneeId: 1 }],
      ['department', {}],
      ['department', { departmentId: '' }],
      ['department', { departmentId: null, extra: 1 }],
    ] as const) {
      const response = await s.api.post(`${s.base}/${task.id}/${path}`, body, 's-president')
      assert.equal(response.status, 400, `${path} ${JSON.stringify(body)}`)
      assert.equal(await errorOf(response), 'INVALID_INPUT')
    }
    assert.equal(
      (await s.api.post(`${s.base}/${task.id}/assignee`, { assigneeId: null })).status,
      401,
    )
    assert.equal(
      (await s.api.post(`${s.base}/${task.id}/department`, { departmentId: null })).status,
      401,
    )
    // 다른 학생회 사람은 운영진이 아니라 403, 없는 업무와 지운 업무는 404
    assert.equal((await s.assign(task.id, null, 'o-president')).status, 403)
    assert.equal((await s.department(task.id, null, 'o-president')).status, 403)
    assert.equal((await s.assign(MISSING, null)).status, 404)
    assert.equal((await s.department(MISSING, null)).status, 404)
    assert.equal((await s.assign('abc', null)).status, 404)
    await s.api.post(`${s.base}/${task.id}/delete`, {}, 's-president')
    assert.equal((await s.assign(task.id, s.council.people.plain.memberId)).status, 404)
    assert.equal((await s.department(task.id, null)).status, 404)
    assert.equal(await s.notices(), 0)
  }),
)
