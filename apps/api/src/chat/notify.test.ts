import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MESSAGE_BODY_MAX, type ChatMessage, type MessagePageResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import type { PushSender } from '../push/sender.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createChatPush } from './notify.js'
import { createChatRoutes } from './routes.js'

const start = new Date('2026-10-19T03:00:00Z')
const JOINED = '2026-03-01T00:00:00Z'
const endpointOf = (user: string, n = 1) => `https://fcm.googleapis.com/fcm/send/${user}-${n}`

type Outcome = Awaited<ReturnType<PushSender>> | 'throw'
async function setup(outcomeOf: (endpoint: string) => Outcome) {
  const { pg, db, close } = await createTestDb()
  const council = await seedCouncil(db, pg)
  let now = start
  const calls: Parameters<PushSender>[] = []
  let gate: Promise<void> = Promise.resolve()
  const send: PushSender = async (...args) => {
    calls.push(args)
    await gate
    const outcome = outcomeOf(args[0].endpoint)
    if (outcome === 'throw') throw new Error(`secret ${args[0].endpoint}`)
    return outcome
  }
  const pending: Promise<void>[] = []
  const chatPush = createChatPush(db, send)
  const push = {
    seen: chatPush.seen,
    notify: (id: string, at: Date) => {
      const done = chatPush.notify(id, at)
      pending.push(done)
      return done
    },
  }
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      chat: createChatRoutes(db, testSession, { clock: () => now, push }),
    }),
  )
  const base = `/api/organizations/${council.councilId}`
  await api.get(`${base}/rooms`, 's-president')
  await pg.query('UPDATE room_membership SET joined_at = $1', [JOINED])
  for (const person of Object.values(council.people))
    await pg.query(
      'INSERT INTO push_device (user_id, endpoint, p256dh, auth) VALUES ($1,$2,$3,$4)',
      [person.userId, endpointOf(person.userId), 'p', 'a'],
    )
  const roomId = async (which: string) =>
    (
      await pg.query<{ id: string }>(
        `SELECT cr.id FROM chat_room cr JOIN record r ON r.id = cr.id
           LEFT JOIN department d ON d.id = cr.department_id
          WHERE r.council_id = $1 AND CASE WHEN cr.type = 'department' THEN d.name
                WHEN cr.type = 'all_members' THEN 'all' ELSE cr.type END = $2`,
        [council.councilId, which],
      )
    ).rows[0]!.id
  const settled = async () => {
    await Promise.all(pending)
  }
  const sendAs = async (room: string, user: string, body: unknown) => {
    const response = await api.post(`${base}/rooms/${room}/messages`, body, user)
    await settled()
    return response
  }
  return {
    pg,
    api,
    base,
    council,
    calls,
    roomId,
    send: sendAs,
    settled,
    setNow: (at: Date) => {
      now = at
    },
    hold: () => {
      let release!: () => void
      gate = new Promise<void>(resolve => (release = resolve))
      return release
    },
    close,
  }
}
type Setup = Awaited<ReturnType<typeof setup>>
const sentOutcome = (): Outcome => ({ result: 'sent' })
const run =
  (body: (s: Setup) => Promise<void>, outcomeOf: (endpoint: string) => Outcome = sentOutcome) =>
  async () => {
    const s = await setup(outcomeOf)
    try {
      await body(s)
    } finally {
      await s.close()
    }
  }
const endpointsOf = (s: Setup) => s.calls.map(call => call[0].endpoint).sort()
const usersOf = (...names: string[]) => names.map(name => endpointOf(`s-${name}`)).sort()

test(
  '글을 보내면 그 방의 다른 참여자 기기마다 한 번씩 가고 보낸 사람과 내보낸 사람은 뺀다',
  run(async s => {
    await s.pg.query(
      'INSERT INTO push_device (user_id, endpoint, p256dh, auth) VALUES ($1,$2,$3,$4)',
      ['s-plain', endpointOf('s-plain', 2), 'p', 'a'],
    )
    const all = await s.roomId('all')
    const response = await s.send(all, 's-president', { body: '안녕하세요' })
    assert.equal(response.status, 201)
    assert.deepEqual(
      endpointsOf(s),
      [
        ...usersOf(
          'vicePresident',
          'financeMember',
          'planningHead',
          'planningViceHead',
          'planningMember',
          'plain',
        ),
        endpointOf('s-plain', 2),
      ].sort(),
    )
    const [, message, options] = s.calls[0]!
    assert.deepEqual(message, {
      title: '전체방',
      body: '안녕하세요',
      url: `/chat/${s.council.councilId}/${all}`,
      tag: `room:${all}`,
    })
    assert.deepEqual(options, { ttl: 86_400 })
  }),
)

test(
  '부서방은 그 부서원에게만 가고 제목이 부서 이름이다',
  run(async s => {
    const planning = await s.roomId('기획부')
    await s.send(planning, 's-planningHead', { body: '회의' })
    assert.deepEqual(endpointsOf(s), usersOf('planningViceHead', 'planningMember'))
    assert.equal(s.calls[0]![1].title, '기획부')
  }),
)

test(
  '부름 받은 사람은 부름 문구로 한 번만 받고 나머지는 새 글 문구로 받는다',
  run(async s => {
    const planning = await s.roomId('기획부')
    const called = s.council.people.planningMember.memberId
    await s.send(planning, 's-planningHead', { body: '@기획부원 확인', mentions: [called] })
    assert.equal(s.calls.length, 2)
    const byEndpoint = new Map(s.calls.map(call => [call[0].endpoint, call[1]]))
    assert.equal(
      byEndpoint.get(endpointOf('s-planningMember'))!.title,
      's planningHead님이 나를 불렀어요',
    )
    assert.equal(byEndpoint.get(endpointOf('s-planningViceHead'))!.title, '기획부')
  }),
)

test(
  '본문은 앞 100자까지이고 이모지를 반쪽으로 자르지 않는다',
  run(async s => {
    const all = await s.roomId('all')
    await s.send(all, 's-president', { body: '😀'.repeat(MESSAGE_BODY_MAX / 2) })
    assert.equal(s.calls[0]![1].body, '😀'.repeat(100))
  }),
)

test(
  '1:1은 제목이 보낸 사람이고 상대에게만 간다',
  run(async s => {
    const opened = await s.api.post(
      `${s.base}/direct`,
      { memberId: s.council.people.plain.memberId },
      's-president',
    )
    const { roomId } = (await opened.json()) as { roomId: string }
    await s.send(roomId, 's-president', { body: '안녕' })
    assert.deepEqual(endpointsOf(s), usersOf('plain'))
    assert.equal(s.calls[0]![1].title, 's president')
  }),
)

test(
  '10초 안에 그 방의 최신 쪽을 읽은 사람은 빠지고 10초가 지나면 다시 받는다',
  run(async s => {
    const all = await s.roomId('all')
    const first = (await (await s.send(all, 's-president', { body: '하나' })).json()) as ChatMessage
    s.calls.length = 0
    assert.equal((await s.api.get(`${s.base}/rooms/${all}/messages`, 's-plain')).status, 200)
    // 커서가 있는 읽기는 최신 쪽이 아니라 보는 중이 아니다.
    await s.api.get(`${s.base}/rooms/${all}/messages?after=${first.id}`, 's-financeMember')
    await s.send(all, 's-president', { body: '둘' })
    assert.ok(!endpointsOf(s).includes(endpointOf('s-plain')))
    assert.ok(endpointsOf(s).includes(endpointOf('s-financeMember')))
    s.calls.length = 0
    s.setNow(new Date(start.getTime() + 10_000))
    await s.send(all, 's-president', { body: '셋' })
    assert.ok(endpointsOf(s).includes(endpointOf('s-plain')))
  }),
)

test(
  '응답은 알림을 기다리지 않는다',
  run(async s => {
    const release = s.hold()
    const all = await s.roomId('all')
    const response = await s.api.post(
      `${s.base}/rooms/${all}/messages`,
      { body: '빨리' },
      's-president',
    )
    assert.equal(response.status, 201)
    assert.equal(((await response.json()) as ChatMessage).body, '빨리')
    release()
    await s.settled()
    assert.equal(s.calls.length, 6)
  }),
)

test(
  '끝난 구독은 기기 줄이 지워지고, 거절이나 던진 오류는 줄을 두고 다른 기기에는 계속 보낸다',
  run(
    async s => {
      const warns: string[] = []
      const original = console.warn
      console.warn = (line: string) => warns.push(line)
      try {
        const all = await s.roomId('all')
        await s.send(all, 's-president', { body: '비밀 본문' })
      } finally {
        console.warn = original
      }
      assert.equal(s.calls.length, 6)
      const rows = await s.pg.query<{ user_id: string }>('SELECT user_id FROM push_device')
      const left = rows.rows.map(row => row.user_id)
      assert.ok(!left.includes('s-plain'))
      assert.ok(left.includes('s-financeMember'))
      assert.ok(left.includes('s-planningHead'))
      assert.equal(left.length, 7)
      const log = warns.join('\n')
      assert.ok(
        warns.every(line => (JSON.parse(line) as { event: string }).event === 'push_send_failed'),
      )
      for (const secret of [
        'fcm.googleapis',
        '비밀 본문',
        s.council.people.plain.memberId,
        'secret',
      ])
        assert.ok(!log.includes(secret), secret)
    },
    endpoint =>
      endpoint.includes('s-plain')
        ? { result: 'expired', status: 410 }
        : endpoint.includes('financeMember')
          ? { result: 'rejected', status: 400 }
          : endpoint.includes('planningHead')
            ? 'throw'
            : { result: 'sent' },
  ),
)

test(
  '공지 표시에는 알림이 없다',
  run(async s => {
    const all = await s.roomId('all')
    const sent = (await (await s.send(all, 's-president', { body: '공지' })).json()) as ChatMessage
    s.calls.length = 0
    const marked = await s.api.post(
      `${s.base}/messages/${sent.id}/notice`,
      { isNotice: true },
      's-president',
    )
    assert.equal(marked.status, 200)
    await s.settled()
    assert.equal(s.calls.length, 0)
  }),
)

test('알림 열쇠가 없어도(push 없음) 대화는 돈다', async () => {
  const { pg, db, close } = await createTestDb()
  try {
    const council = await seedCouncil(db, pg)
    const api = caller(
      createApp({
        auth: { handler: async () => new Response() },
        trustedOrigin: ORIGIN,
        chat: createChatRoutes(db, testSession, { clock: () => start }),
      }),
    )
    const base = `/api/organizations/${council.councilId}`
    const listed = (await (await api.get(`${base}/rooms`, 's-president')).json()) as {
      rooms: { id: string; type: string }[]
    }
    const all = listed.rooms.find(room => room.type === 'all_members')!.id
    const posted = await api.post(`${base}/rooms/${all}/messages`, { body: '글' }, 's-president')
    assert.equal(posted.status, 201)
    const page = (await (
      await api.get(`${base}/rooms/${all}/messages`, 's-president')
    ).json()) as MessagePageResponse
    assert.equal(page.messages.length, 1)
  } finally {
    await close()
  }
})
