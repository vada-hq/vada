import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { TaskDetail } from '@vada/contracts'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import { createRateLimiter } from '../http/rate-limit.js'
import type { PushSender } from '../push/sender.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { capturePushLogs, fanoutSummary } from '../test-support/push.js'
import { createPendingPush } from '../push/pending.js'
import { ASSIGNMENT_NOTICE_DELAY_MS, createTaskPush, type AfterTimer } from './notify.js'
import { createTaskRoutes } from './routes.js'

// 한국 시각 2026-10-25 12:00
const noon = new Date('2026-10-25T03:00:00Z')
const MISSING = '019e0000-0000-7000-8000-000000000000'
const endpointOf = (user: string) => `https://fcm.googleapis.com/fcm/send/${user}`

// 가짜 타이머: 시간은 advance로만 가고, 기한이 된 일을 끝날 때까지 기다린다.
function fakeTimer() {
  let now = 0
  const jobs = new Set<{ at: number; run: () => Promise<void> }>()
  const after: AfterTimer = (ms, run) => {
    const job = { at: now + ms, run }
    jobs.add(job)
    return () => void jobs.delete(job)
  }
  const advance = async (ms: number) => {
    now += ms
    for (const job of [...jobs].sort((a, b) => a.at - b.at))
      if (job.at <= now && jobs.delete(job)) await job.run()
  }
  return { after, advance, waiting: () => jobs.size }
}

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
  const timer = fakeTimer()
  const pendingPush = createPendingPush()
  const push = createTaskPush(db, send, timer.after, pendingPush)
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
    await timer.advance(ASSIGNMENT_NOTICE_DELAY_MS)
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
    timer,
    push,
    pendingPush,
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

const DELAY = ASSIGNMENT_NOTICE_DELAY_MS
const sentTo = (s: S) => s.calls.map(call => call[0].endpoint)
const rawAssign = (s: S, id: string, assigneeId: string | null, user = 's-president') =>
  s.api.post(`${s.base}/${id}/assignee`, { assigneeId }, user)

test(
  'flush는 10초를 기다리지 않고 대기 업무를 보내고 타이머를 지운다',
  run(async s => {
    const task = await s.made({ title: 'a' })
    await rawAssign(s, task.id, s.council.people.plain.memberId)
    const logs = await capturePushLogs(async () => {
      s.push.flush()
      await s.pendingPush.settle(5000)
    })
    assert.deepEqual(sentTo(s), [endpointOf('s-plain')])
    assert.equal(s.timer.waiting(), 0)
    await s.timer.advance(DELAY)
    assert.equal(s.calls.length, 1)
    assert.deepEqual(
      logs.map(line => JSON.parse(line) as unknown),
      [fanoutSummary('task', 1, 1, 1)],
    )
  }),
)

test(
  '처음 담당자로 되돌린 업무는 flush해도 보내지 않고 reverted 한 줄을 남긴다',
  run(async s => {
    const { planningMember, plain } = s.council.people
    const task = await s.made({ title: 'a', assigneeId: planningMember.memberId })
    s.calls.length = 0
    await rawAssign(s, task.id, plain.memberId)
    await rawAssign(s, task.id, planningMember.memberId)
    const logs = await capturePushLogs(async () => {
      await s.pendingPush.settle(5000)
    })
    assert.equal(s.calls.length, 0)
    assert.equal(s.timer.waiting(), 0)
    assert.deepEqual(
      logs.map(line => JSON.parse(line) as unknown),
      [{ ...fanoutSummary('task'), skipped: 'reverted' }],
    )
  }),
)

test(
  '9.999초에는 가지 않고 10초에 한 번 간다. 만들 때 정한 담당자도 같다',
  run(async s => {
    const { planningMember, financeMember } = s.council.people
    const task = await s.made({ title: 'a', assigneeId: planningMember.memberId })
    s.calls.length = 0
    await rawAssign(s, task.id, financeMember.memberId)
    assert.equal(await s.notices(), 2)
    await s.timer.advance(DELAY - 1)
    assert.equal(s.calls.length, 0)
    await s.timer.advance(1)
    assert.deepEqual(sentTo(s), [endpointOf('s-financeMember')])
    await s.timer.advance(DELAY)
    assert.equal(s.calls.length, 1)
    // 만들기도 10초 뒤 한 번이다.
    const response = await s.api.post(
      s.base,
      { title: 'b', assigneeId: planningMember.memberId },
      's-president',
    )
    assert.equal(response.status, 201)
    await s.timer.advance(DELAY - 1)
    assert.equal(s.calls.length, 1)
    await s.timer.advance(1)
    assert.equal(s.calls.length, 2)
  }),
)

test(
  '10초 안에 처음 담당자로 되돌리면 B와 C 모두 받지 않고 기록은 남는다',
  run(async s => {
    const { planningMember, financeMember } = s.council.people
    const task = await s.made({ title: 'a', assigneeId: planningMember.memberId })
    s.calls.length = 0
    await rawAssign(s, task.id, financeMember.memberId)
    await s.timer.advance(DELAY - 1)
    await rawAssign(s, task.id, planningMember.memberId)
    await s.timer.advance(DELAY * 2)
    assert.equal(s.calls.length, 0)
    assert.equal(await s.notices(), 3)
    assert.equal(s.timer.waiting(), 0)
  }),
)

test(
  '10초 안에 C에서 D로 다시 고르면 D만 한 번 받고 본문의 맡긴 사람은 마지막에 바꾼 사람이다',
  run(async s => {
    const { planningMember, financeMember, plain } = s.council.people
    const task = await s.made({ title: 'a', assigneeId: planningMember.memberId })
    s.calls.length = 0
    await rawAssign(s, task.id, financeMember.memberId, 's-president')
    await rawAssign(s, task.id, plain.memberId, 's-vicePresident')
    assert.equal(s.timer.waiting(), 1)
    await s.timer.advance(DELAY)
    assert.deepEqual(sentTo(s), [endpointOf('s-plain')])
    assert.match(s.calls[0]![1].body, /^s vicePresident: a/)
  }),
)

test(
  '모은 사이에 나에게 맡기거나 비우거나 지우면 보내지 않고, 다른 업무끼리는 모으지 않는다',
  run(async s => {
    const { planningMember, financeMember, plain, president } = s.council.people
    const one = await s.made({ title: 'one' })
    const two = await s.made({ title: 'two' })
    const three = await s.made({ title: 'three' })
    const four = await s.made({ title: 'four' })
    s.calls.length = 0
    await rawAssign(s, one.id, financeMember.memberId)
    await rawAssign(s, one.id, president.memberId)
    await rawAssign(s, two.id, planningMember.memberId)
    await rawAssign(s, two.id, null)
    await rawAssign(s, three.id, plain.memberId)
    await s.api.post(`${s.base}/${three.id}/delete`, {}, 's-president')
    await rawAssign(s, four.id, planningMember.memberId)
    assert.equal(s.timer.waiting(), 4)
    const logs = await capturePushLogs(() => s.timer.advance(DELAY))
    assert.deepEqual(sentTo(s), [endpointOf('s-planningMember')])
    assert.deepEqual(
      logs.map(line => JSON.parse(line) as unknown),
      [
        { ...fanoutSummary('task'), skipped: 'self' },
        { ...fanoutSummary('task'), skipped: 'unassigned' },
        { ...fanoutSummary('task'), skipped: 'cancelled' },
        fanoutSummary('task', 1, 1, 1),
      ],
    )
  }),
)

test(
  '보낼 때 DB의 지금 담당자를 다시 읽는다: 받는 사람이 담당자일 때만 간다',
  run(async s => {
    const { financeMember, plain } = s.council.people
    const task = await s.made({ title: 'a' })
    await rawAssign(s, task.id, financeMember.memberId)
    await s.pg.query('UPDATE task SET assignee_id = $1 WHERE id = $2', [plain.memberId, task.id])
    const logs = await capturePushLogs(() => s.timer.advance(DELAY))
    assert.equal(s.calls.length, 0)
    assert.deepEqual(
      logs.map(line => JSON.parse(line) as unknown),
      [{ ...fanoutSummary('task'), skipped: 'reassigned' }],
    )
  }),
)

test(
  '비우거나 나에게 맡긴 뒤 10초 안에 처음 담당자로 되돌려도 아무도 받지 않는다',
  run(async s => {
    const { planningMember, president, plain } = s.council.people
    const task = await s.made({ title: 'a', assigneeId: planningMember.memberId })
    s.calls.length = 0
    await rawAssign(s, task.id, null)
    await s.timer.advance(1000)
    await rawAssign(s, task.id, planningMember.memberId)
    await s.timer.advance(DELAY)
    assert.equal(s.calls.length, 0)
    await rawAssign(s, task.id, president.memberId)
    await s.timer.advance(1000)
    await rawAssign(s, task.id, planningMember.memberId)
    await s.timer.advance(DELAY)
    assert.equal(s.calls.length, 0)
    // 처음 담당자가 아닌 사람은 받는다.
    await rawAssign(s, task.id, null)
    await rawAssign(s, task.id, plain.memberId)
    await s.timer.advance(DELAY)
    assert.deepEqual(sentTo(s), [endpointOf('s-plain')])
  }),
)
