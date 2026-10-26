import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MESSAGE_BODY_MAX, type ChatMessage, type MessagePageResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import type { PushSender } from '../push/sender.js'
import { clockNow, createRecord } from '../records/records.js'
import { memberLogin } from '../db/schema.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { fakeStorage } from '../test-support/storage.js'
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
  const store = fakeStorage()
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
      chat: createChatRoutes(db, testSession, { clock: () => now, push, storage: store.storage }),
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
    db,
    api,
    base,
    council,
    calls,
    store,
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
  '사진만 보내면 알림 본문이 사진이고 글과 함께면 글 앞부분이다',
  run(async s => {
    const all = await s.roomId('all')
    const photo = async (user: string, body?: string) => {
      const issued = (await (
        await s.api.post(`${s.base}/rooms/${all}/uploads`, {}, user)
      ).json()) as { key: string }
      s.store.put(issued.key)
      return s.send(all, user, { ...(body ? { body } : {}), photos: [issued.key] })
    }
    assert.equal((await photo('s-president')).status, 201)
    assert.equal(s.calls[0]![1].body, '사진')
    s.calls.length = 0
    s.setNow(new Date(start.getTime() + 60_000))
    assert.equal((await photo('s-president', '행사 사진')).status, 201)
    assert.equal(s.calls[0]![1].body, '행사 사진')
  }),
)

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
      title: '공지방',
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
    // 이전 쪽(before) 읽기는 보는 중이 아니다.
    await s.api.get(`${s.base}/rooms/${all}/messages?before=${first.id}`, 's-financeMember')
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

test(
  '방 참여 줄이 남았어도 학생회를 떠난 사람과 지난 기수 사람에게는 알림이 가지 않는다',
  run(async s => {
    const all = await s.roomId('all')
    const { ended } = s.council.people
    const councilId = s.council.councilId
    await s.pg.query(
      "INSERT INTO users (id, name, email) VALUES ('s-old', 'old', 'old@example.test')",
    )
    const old = await s.db.transaction(async tx => {
      const cohortId = await createRecord(tx, {
        kind: 'cohort',
        councilId,
        actor: s.council.people.president.memberId,
        values: { name: '2025', startsOn: '2025-01-01', endsOn: '2025-12-31' },
      })
      const memberId = await createRecord(tx, {
        kind: 'member',
        councilId: null,
        actor: null,
        values: { name: 'old', email: 'old@example.test' },
      })
      await tx.insert(memberLogin).values({ memberId, userId: 's-old' })
      await createRecord(tx, {
        kind: 'council_membership',
        councilId,
        actor: s.council.people.president.memberId,
        values: { memberId, cohortId, councilRank: null, startsAt: clockNow },
      })
      return memberId
    })
    for (const [memberId, user] of [
      [ended.memberId, 's-ended'],
      [old, 's-old'],
    ] as const) {
      await s.pg.query(
        'INSERT INTO room_membership (room_id, member_id, joined_at) VALUES ($1,$2,$3)',
        [all, memberId, JOINED],
      )
      if (user === 's-old')
        await s.pg.query(
          'INSERT INTO push_device (user_id, endpoint, p256dh, auth) VALUES ($1,$2,$3,$4)',
          [user, endpointOf(user), 'p', 'a'],
        )
    }
    await s.send(all, 's-president', { body: '전체' })
    const reached = endpointsOf(s)
    assert.ok(!reached.includes(endpointOf('s-ended')))
    assert.ok(!reached.includes(endpointOf('s-old')))
    assert.ok(reached.includes(endpointOf('s-plain')))
  }),
)

test(
  '최신까지 이어 읽는 중이면 10초가 지나도 알림이 오지 않고, 이전 쪽을 보는 사람은 받는다',
  run(async s => {
    const all = await s.roomId('all')
    const first = (await (await s.send(all, 's-president', { body: '하나' })).json()) as ChatMessage
    s.calls.length = 0
    // 화면은 열린 방을 3초마다 after 커서로 이어 읽는다. 최신까지 닿으면(hasNewer=false) 보는 중이다.
    for (const seconds of [3, 6, 9, 12]) {
      s.setNow(new Date(start.getTime() + seconds * 1000))
      const page = await s.api.get(`${s.base}/rooms/${all}/messages?after=${first.id}`, 's-plain')
      assert.equal(((await page.json()) as MessagePageResponse).hasNewer, false)
      // 이전 쪽 보기는 보는 중이 아니다.
      await s.api.get(`${s.base}/rooms/${all}/messages?before=${first.id}`, 's-financeMember')
    }
    await s.send(all, 's-president', { body: '둘' })
    assert.ok(!endpointsOf(s).includes(endpointOf('s-plain')))
    assert.ok(endpointsOf(s).includes(endpointOf('s-financeMember')))
  }),
)

test(
  '답글 알림은 원글 쓴 사람, 그 원글에 답글을 쓴 사람, 부른 사람에게만 가고 나와 답글을 보는 중인 사람은 뺀다(DEC-90)',
  run(async s => {
    const all = await s.roomId('all')
    const original = (await (
      await s.send(all, 's-president', { body: '내일 행사 공지' })
    ).json()) as ChatMessage
    s.calls.length = 0
    // 첫 답글: 원글 쓴 회장에게만 간다. 방의 다른 사람에게는 없다.
    assert.equal(
      (await s.send(all, 's-plain', { body: '몇 시예요?', replyTo: original.id })).status,
      201,
    )
    assert.deepEqual(endpointsOf(s), usersOf('president'))
    assert.equal(s.calls[0]![1].title, '공지방')
    // 누르면 그 방을 열고 원글의 답글 패널을 연다(022 조각 11). 원글마다 갈아 끼운다.
    assert.equal(s.calls[0]![1].url, `/chat/${s.council.councilId}/${all}?reply=${original.id}`)
    assert.equal(s.calls[0]![1].tag, `reply:${original.id}`)
    // 둘째 답글: 원글 쓴 회장과 먼저 답글을 쓴 사람에게 간다. 부른 기획부장은 부름 문구로 받는다.
    s.calls.length = 0
    const called = s.council.people.planningHead.memberId
    await s.send(all, 's-financeMember', {
      body: '@기획부장 확인 부탁해요',
      mentions: [called],
      replyTo: original.id,
    })
    assert.deepEqual(endpointsOf(s), usersOf('president', 'plain', 'planningHead'))
    const byEndpoint = new Map(s.calls.map(call => [call[0].endpoint, call[1]]))
    assert.equal(
      byEndpoint.get(endpointOf('s-planningHead'))!.title,
      's financeMember님이 나를 불렀어요',
    )
    // 답글을 최신까지 읽는 회장은 보는 중이라 빠진다. 보낸 사람(답글을 쓴 사람이어도)은 받지 않는다.
    s.calls.length = 0
    const replies = await s.api.get(
      `${s.base}/rooms/${all}/messages/${original.id}/replies`,
      's-president',
    )
    assert.equal(replies.status, 200)
    await s.send(all, 's-plain', { body: '알겠어요', replyTo: original.id })
    assert.deepEqual(endpointsOf(s), usersOf('financeMember'))
  }),
)

test(
  '원글을 볼 수 없는 사람은 답글에서 불러도, 그 원글에 답글을 쓴 적이 있어도 알림과 부름 수가 없다(보이는 범위, DEC-90)',
  run(async s => {
    const planning = await s.roomId('기획부')
    const people = s.council.people
    // 기획부원은 5월에 (다시) 들어왔다. 4월 원글은 그 사람에게 보이지 않는다.
    await s.pg.query(
      `UPDATE room_membership SET joined_at = '2026-05-01T00:00:00Z' WHERE room_id = $1 AND member_id = $2`,
      [planning, people.planningMember.memberId],
    )
    const put = (sender: string, body: string, at: string, replyTo: string | null = null) =>
      s.db.transaction(tx =>
        createRecord(tx, {
          kind: 'message',
          councilId: s.council.councilId,
          actor: sender,
          values: { roomId: planning, body, sentAt: new Date(at), replyToId: replyTo },
        }),
      )
    const original = await put(people.planningHead.memberId, '4월 원글', '2026-04-01T00:00:00Z')
    const reply = (body: unknown) => s.send(planning, 's-planningViceHead', body)
    assert.equal(
      (
        await reply({
          body: '@기획부원 봐 주세요',
          mentions: [people.planningMember.memberId],
          replyTo: original,
        })
      ).status,
      201,
    )
    assert.deepEqual(endpointsOf(s), usersOf('planningHead'))
    const mentions = await s.pg.query<{ n: string }>(
      `SELECT count(*) AS n FROM notification WHERE recipient_id = $1 AND type = 'mention'`,
      [people.planningMember.memberId],
    )
    assert.equal(Number(mentions.rows[0]!.n), 0)
    const listed = (await (await s.api.get(`${s.base}/rooms`, 's-planningMember')).json()) as {
      rooms: { id: string; mentions: number; unread: number }[]
    }
    const room = listed.rooms.find(item => item.id === planning)!
    assert.deepEqual([room.mentions, room.unread], [0, 0])
    // 들어오기 전에 그 원글에 답글을 쓴 사람도 지금 원글을 볼 수 없으면 받지 않는다.
    await put(people.planningMember.memberId, '4월 답글', '2026-04-02T00:00:00Z', original)
    s.calls.length = 0
    s.setNow(new Date(start.getTime() + 60_000))
    assert.equal((await reply({ body: '하나 더', replyTo: original })).status, 201)
    assert.deepEqual(endpointsOf(s), usersOf('planningHead'))
  }),
)
