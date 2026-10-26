import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  ChatMessage,
  MessagePageResponse,
  ReplyPageResponse,
  RoomListResponse,
} from '@vada/contracts'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import { createRecord } from '../records/records.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createChatRoutes } from './routes.js'

// 답글(022 조각 10, DEC-90): 원글 아래 한 단계, 같은 방, 원글이 안 보이면 답글도 안 보인다.

// 한국 시각 2026-10-19 12:00. 기본 기수는 2026-01-01부터 12-31까지다.
const now = new Date('2026-10-19T03:00:00Z')
const JOINED = '2026-03-01T00:00:00Z'
const MISSING = '019e0000-0000-7000-8000-000000000000'

async function start() {
  const { pg, db, close } = await createTestDb()
  const council = await seedCouncil(db, pg)
  const other = await seedCouncil(db, pg, 'o')
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      chat: createChatRoutes(db, testSession, { clock: () => now }),
    }),
  )
  const base = `/api/organizations/${council.councilId}`
  const list = async (user = 's-president') =>
    (await (await api.get(`${base}/rooms`, user)).json()) as RoomListResponse
  await list()
  await api.get(`/api/organizations/${other.councilId}/rooms`, 'o-president')
  await pg.query('UPDATE room_membership SET joined_at = $1', [JOINED])
  const roomId = async (councilId: string, which: string) =>
    (
      await pg.query<{ id: string }>(
        `SELECT cr.id FROM chat_room cr JOIN record r ON r.id = cr.id
           LEFT JOIN department d ON d.id = cr.department_id
          WHERE r.council_id = $1 AND CASE WHEN cr.type = 'department' THEN d.name
                WHEN cr.type = 'all_members' THEN 'all' ELSE cr.type END = $2`,
        [councilId, which],
      )
    ).rows[0]!.id
  // API로 보낸다. 보낸 시각은 DB 시계(지금)다.
  const send = (room: string, user: string, body: unknown, at = base) =>
    api.post(`${at}/rooms/${room}/messages`, body, user)
  const sent = async (room: string, user: string, body: unknown) => {
    const response = await send(room, user, body)
    assert.equal(response.status, 201)
    return (await response.json()) as ChatMessage
  }
  // 보낸 시각을 정해 바로 넣는다(들어오기 전·다른 기수의 글).
  const put = (values: {
    room: string
    sender: string
    body: string
    at: string
    replyTo?: string
  }) =>
    db.transaction(tx =>
      createRecord(tx, {
        kind: 'message',
        councilId: council.councilId,
        actor: values.sender,
        values: {
          roomId: values.room,
          body: values.body,
          sentAt: new Date(values.at),
          replyToId: values.replyTo ?? null,
        },
      }),
    )
  const repliesOf = (room: string, messageId: string, user = 's-president', query = '') =>
    api.get(`${base}/rooms/${room}/messages/${messageId}/replies${query}`, user)
  const flowOf = async (room: string, user = 's-president') => {
    const response = await api.get(`${base}/rooms/${room}/messages`, user)
    assert.equal(response.status, 200)
    return (await response.json()) as MessagePageResponse
  }
  const count = async (sql: string) => Number(((await pg.query(sql)).rows[0] as { n: string }).n)
  // 메시지·기록·판·알림 어느 것도 늘지 않았는지 보는 합이다.
  const total = () =>
    count(
      `SELECT (SELECT count(*) FROM record) + (SELECT count(*) FROM record_version)
            + (SELECT count(*) FROM message) + (SELECT count(*) FROM notification) AS n`,
    )
  return {
    pg,
    db,
    close,
    api,
    base,
    council,
    other,
    list,
    roomId,
    send,
    sent,
    put,
    repliesOf,
    flowOf,
    total,
    person: council.people,
  }
}
type Setup = Awaited<ReturnType<typeof start>>
const run = (body: (s: Setup) => Promise<void>) => async () => {
  const s = await start()
  try {
    await body(s)
  } finally {
    await s.close()
  }
}
const pageOf = async (response: Response) => {
  assert.equal(response.status, 200)
  return (await response.json()) as ReplyPageResponse
}
const errorOf = async (response: Response) => ((await response.json()) as { error: string }).error
const bodies = (page: MessagePageResponse) => page.messages.map(item => item.body)

test(
  'replyTo로 보내면 답글이 생기고 방 흐름에는 원글만 남으며 원글의 답글 수와 마지막 답글 시각이 는다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const original = await s.sent(all, 's-president', { body: '내일 모임' })
    assert.deepEqual([original.replyCount, original.lastReplyAt], [0, null])
    const first = await s.sent(all, 's-plain', { body: '몇 시예요?', replyTo: original.id })
    const second = await s.sent(all, 's-financeMember', {
      body: '저도 궁금해요',
      replyTo: original.id,
    })
    assert.deepEqual([first.replyCount, first.lastReplyAt], [0, null])
    const flow = await s.flowOf(all, 's-plain')
    assert.deepEqual(bodies(flow), ['내일 모임'])
    assert.equal(flow.messages[0]!.replyCount, 2)
    assert.equal(flow.messages[0]!.lastReplyAt, second.sentAt)
    // 답글 읽기는 원글과 답글을 보낸 순으로 준다.
    const thread = await pageOf(await s.repliesOf(all, original.id, 's-plain'))
    assert.equal(thread.original.id, original.id)
    assert.equal(thread.original.replyCount, 2)
    assert.deepEqual(bodies(thread), ['몇 시예요?', '저도 궁금해요'])
    assert.deepEqual([thread.hasOlder, thread.hasNewer], [false, false])
    const stored = await s.pg.query<{ reply_to_id: string | null }>(
      'SELECT reply_to_id FROM message WHERE id = $1',
      [first.id],
    )
    assert.equal(stored.rows[0]!.reply_to_id, original.id)
  }),
)

test(
  '다른 방의 메시지·다른 학생회의 메시지·보이지 않는 원글·없는 번호에 답글은 404, 답글에 답글은 400이고 아무것도 남지 않는다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const planning = await s.roomId(s.council.councilId, '기획부')
    const finance = await s.roomId(s.council.councilId, '재정부')
    const foreignRoom = await s.roomId(s.other.councilId, 'all')
    const elsewhere = await s.sent(planning, 's-planningHead', { body: '기획부 글' })
    const original = await s.sent(all, 's-president', { body: '공지' })
    const reply = await s.sent(all, 's-plain', { body: '답글', replyTo: original.id })
    const foreignSent = await s.send(
      foreignRoom,
      'o-president',
      { body: '다른 학생회' },
      `/api/organizations/${s.other.councilId}`,
    )
    assert.equal(foreignSent.status, 201)
    const foreign = (await foreignSent.json()) as ChatMessage
    // 재정부원이 들어오기 전 재정부방의 글은 재정부원에게 보이지 않는다.
    const hidden = await s.put({
      room: finance,
      sender: s.person.president.memberId,
      body: '들어오기 전',
      at: '2026-02-01T00:00:00Z',
    })
    const before = await s.total()
    const cases: [string, string, string, number, string][] = [
      [all, 's-plain', elsewhere.id, 404, 'NOT_FOUND'],
      [all, 's-plain', foreign.id, 404, 'NOT_FOUND'],
      [all, 's-plain', MISSING, 404, 'NOT_FOUND'],
      [finance, 's-financeMember', hidden, 404, 'NOT_FOUND'],
      [all, 's-financeMember', reply.id, 400, 'INVALID_INPUT'],
    ]
    for (const [room, user, replyTo, status, error] of cases) {
      const response = await s.send(room, user, { body: '답', replyTo })
      assert.equal(response.status, status, replyTo)
      assert.equal(await errorOf(response), error, replyTo)
    }
    // 형식이 틀린 번호와 업무 공지와 함께 온 답글은 계약이 막는다.
    for (const body of [
      { body: '답', replyTo: 'x' },
      { body: '답', replyTo: original.id, taskId: MISSING },
    ])
      assert.equal((await s.send(all, 's-plain', body)).status, 400)
    assert.equal(await s.total(), before)
  }),
)

test(
  '답글 읽기: 원글이 보이지 않거나 다른 방이거나 답글이거나 없으면 404, 방 참여자가 아니면 403, 다른 학생회 방은 404, 로그인 없으면 401이다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const planning = await s.roomId(s.council.councilId, '기획부')
    const finance = await s.roomId(s.council.councilId, '재정부')
    const original = await s.sent(all, 's-president', { body: '공지' })
    const reply = await s.sent(all, 's-plain', { body: '답글', replyTo: original.id })
    const elsewhere = await s.sent(planning, 's-planningHead', { body: '기획부 글' })
    const hidden = await s.put({
      room: finance,
      sender: s.person.president.memberId,
      body: '들어오기 전',
      at: '2026-02-01T00:00:00Z',
    })
    const cases: [string, string, string, number][] = [
      [all, elsewhere.id, 's-plain', 404],
      [all, reply.id, 's-plain', 404],
      [all, MISSING, 's-plain', 404],
      [all, 'x', 's-plain', 404],
      [finance, hidden, 's-financeMember', 404],
      [planning, elsewhere.id, 's-financeMember', 403],
      [all, original.id, 'o-president', 403],
    ]
    for (const [room, id, user, status] of cases)
      assert.equal((await s.repliesOf(room, id, user)).status, status, `${id} ${user}`)
    const foreignRoom = await s.roomId(s.other.councilId, 'all')
    assert.equal((await s.repliesOf(foreignRoom, original.id)).status, 404)
    assert.equal(
      (await s.api.get(`${s.base}/rooms/${all}/messages/${original.id}/replies`)).status,
      401,
    )
    // 볼 수 있는 원글이면 재정부방의 지금 글도 200이다.
    const visible = await s.sent(finance, 's-financeMember', { body: '보이는 글' })
    assert.equal((await s.repliesOf(finance, visible.id, 's-financeMember')).status, 200)
  }),
)

test(
  '답글은 50개씩 같은 커서로 읽는다. 원글이나 다른 원글의 답글을 커서로 주면 400 INVALID_CURSOR다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const president = s.person.president.memberId
    const original = await s.put({
      room: all,
      sender: president,
      body: '원글',
      at: '2026-10-01T00:00:00Z',
    })
    const another = await s.put({
      room: all,
      sender: president,
      body: '다른 원글',
      at: '2026-10-01T00:00:01Z',
    })
    const strayReply = await s.put({
      room: all,
      sender: president,
      body: '다른 답글',
      at: '2026-10-02T00:00:00Z',
      replyTo: another,
    })
    const ids: string[] = []
    for (let n = 0; n < 55; n += 1)
      ids.push(
        await s.put({
          room: all,
          sender: president,
          body: `답 ${n}`,
          at: new Date(Date.UTC(2026, 9, 3, 0, 0, n)).toISOString(),
          replyTo: original,
        }),
      )
    const latest = await pageOf(await s.repliesOf(all, original))
    assert.equal(latest.messages.length, 50)
    assert.equal(latest.messages[0]!.body, '답 5')
    assert.deepEqual([latest.hasOlder, latest.hasNewer], [true, false])
    assert.equal(latest.original.replyCount, 55)
    const older = await pageOf(await s.repliesOf(all, original, 's-president', `?before=${ids[5]}`))
    assert.deepEqual(bodies(older), ['답 0', '답 1', '답 2', '답 3', '답 4'])
    const newer = await pageOf(await s.repliesOf(all, original, 's-president', `?after=${ids[53]}`))
    assert.deepEqual(bodies(newer), ['답 54'])
    for (const cursor of [original, another, strayReply])
      assert.equal(
        (await s.repliesOf(all, original, 's-president', `?before=${cursor}`)).status,
        400,
      )
    // 방 흐름의 커서로 답글을 주어도 400이다(흐름에는 원글만 있다).
    const flow = await s.api.get(`${s.base}/rooms/${all}/messages?before=${ids[0]}`, 's-president')
    assert.equal(flow.status, 400)
  }),
)

test(
  '답글도 방의 안 읽은 수에 들고, 방 줄의 미리보기와 마지막 메시지 시각에는 들지 않는다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const original = await s.sent(all, 's-president', { body: '공지' })
    await s.sent(all, 's-plain', { body: '답글이에요', replyTo: original.id })
    const room = (await s.list('s-financeMember')).rooms.find(item => item.id === all)!
    assert.equal(room.unread, 2)
    assert.deepEqual(room.lastMessage, { senderName: 's president', preview: '공지' })
    assert.equal(room.lastMessageAt, original.sentAt)
    // 답글을 읽으면(읽음 표시) 방의 읽음이 그 답글까지 간다.
    const [{ id: replyId }] = (
      await s.pg.query<{ id: string }>('SELECT id FROM message WHERE reply_to_id = $1', [
        original.id,
      ])
    ).rows as [{ id: string }]
    assert.equal(
      (await s.api.post(`${s.base}/rooms/${all}/read`, { messageId: replyId }, 's-financeMember'))
        .status,
      204,
    )
    assert.equal((await s.list('s-financeMember')).rooms.find(item => item.id === all)!.unread, 0)
  }),
)

test(
  '공지방 답글도 같은 기수면 들어오기 전 것을 본다. 들어오기 전 부서방 원글의 답글은 들어온 뒤의 것이어도 보이지 않는다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const planning = await s.roomId(s.council.councilId, '기획부')
    const president = s.person.president.memberId
    const head = s.person.planningHead.memberId
    // 기획부원은 2026-03-01에 들어왔다.
    const notice = await s.put({
      room: all,
      sender: president,
      body: '봄 공지',
      at: '2026-02-01T00:00:00Z',
    })
    await s.put({
      room: all,
      sender: head,
      body: '봄 답글',
      at: '2026-02-02T00:00:00Z',
      replyTo: notice,
    })
    const thread = await pageOf(await s.repliesOf(all, notice, 's-planningMember'))
    assert.deepEqual(bodies(thread), ['봄 답글'])
    assert.equal((await s.flowOf(all, 's-planningMember')).messages[0]!.replyCount, 1)
    // 부서방은 들어온 뒤의 것만 본다. 기획부원은 5월에 들어온 것으로 두고, 그 전 원글에 6월에 단 답글을 본다.
    await s.pg.query(
      `UPDATE room_membership SET joined_at = '2026-05-01T00:00:00Z' WHERE room_id = $1 AND member_id = $2`,
      [planning, s.person.planningMember.memberId],
    )
    const early = await s.put({
      room: planning,
      sender: head,
      body: '부서 전',
      at: '2026-04-01T00:00:00Z',
    })
    const late = await s.put({
      room: planning,
      sender: head,
      body: '들어온 뒤 답글',
      at: '2026-06-01T00:00:00Z',
      replyTo: early,
    })
    assert.equal((await s.repliesOf(planning, early, 's-planningMember')).status, 404)
    assert.deepEqual(bodies(await s.flowOf(planning, 's-planningMember')), [])
    const room = (await s.list('s-planningMember')).rooms.find(item => item.id === planning)!
    assert.deepEqual([room.unread, room.lastMessage], [0, null])
    // 원글이 안 보이면 답글로 읽음 표시도 404다.
    assert.equal(
      (
        await s.api.post(
          `${s.base}/rooms/${planning}/read`,
          { messageId: late },
          's-planningMember',
        )
      ).status,
      404,
    )
    // 원글을 볼 수 있는 기획부장에게는 보인다.
    assert.deepEqual(bodies(await pageOf(await s.repliesOf(planning, early, 's-planningHead'))), [
      '들어온 뒤 답글',
    ])
  }),
)

test(
  '우리 원글에 걸린 다른 학생회 기록의 답글은 답글 수와 답글 읽기, 안 읽은 수에 섞이지 않는다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const original = await s.sent(all, 's-president', { body: '공지' })
    // 우리 원글을 가리키지만 다른 학생회의 기록인 답글(어긋난 자료). 기록 모듈은 이것을 막으므로 DB에 바로 쓴다.
    const stray = await s.pg.query<{ id: string }>(
      `INSERT INTO record (kind, council_id, created_by) VALUES ('message', $1, $2) RETURNING id`,
      [s.other.councilId, s.other.people.president.memberId],
    )
    await s.pg.query(
      `INSERT INTO message (id, room_id, body, sent_at, reply_to_id) VALUES ($1, $2, $3, now(), $4)`,
      [stray.rows[0]!.id, all, '다른 학생회 답글', original.id],
    )
    const thread = await pageOf(await s.repliesOf(all, original.id, 's-plain'))
    assert.deepEqual([bodies(thread), thread.original.replyCount], [[], 0])
    assert.equal((await s.flowOf(all, 's-plain')).messages[0]!.replyCount, 0)
    assert.equal((await s.list('s-plain')).rooms.find(item => item.id === all)!.unread, 1)
  }),
)

test(
  '방의 가장 최근 원글로 읽음을 보내면 그 뒤 답글까지 읽은 것이다. 더 새 원글이 있으면 지금처럼 그 원글까지만이다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const unreadOf = async () =>
      (await s.list('s-financeMember')).rooms.find(item => item.id === all)!.unread
    const read = async (messageId: string) =>
      assert.equal(
        (await s.api.post(`${s.base}/rooms/${all}/read`, { messageId }, 's-financeMember')).status,
        204,
      )
    const a = await s.sent(all, 's-president', { body: 'A' })
    await s.sent(all, 's-plain', { body: 'A의 답글', replyTo: a.id })
    assert.equal(await unreadOf(), 2)
    await read(a.id)
    assert.equal(await unreadOf(), 0)
    // A, B 중 A로 읽으면 B와 그 뒤 답글이 남는다.
    const b = await s.sent(all, 's-president', { body: 'B' })
    await s.sent(all, 's-plain', { body: 'A의 둘째 답글', replyTo: a.id })
    await read(a.id)
    assert.equal(await unreadOf(), 2)
    await read(b.id)
    assert.equal(await unreadOf(), 0)
  }),
)

test(
  '볼 수 없는 답글은 가장 최근 원글로 보낸 읽음을 앞당기지 않는다',
  run(async s => {
    const planning = await s.roomId(s.council.councilId, '기획부')
    const head = s.person.planningHead.memberId
    const member = s.person.planningMember.memberId
    await s.pg.query(
      `UPDATE room_membership SET joined_at = '2026-05-01T00:00:00Z' WHERE room_id = $1 AND member_id = $2`,
      [planning, member],
    )
    const early = await s.put({
      room: planning,
      sender: head,
      body: '4월',
      at: '2026-04-01T00:00:00Z',
    })
    const visible = await s.put({
      room: planning,
      sender: head,
      body: '7월',
      at: '2026-07-01T00:00:00Z',
    })
    await s.put({
      room: planning,
      sender: head,
      body: '8월 답글',
      at: '2026-08-01T00:00:00Z',
      replyTo: early,
    })
    assert.equal(
      (
        await s.api.post(
          `${s.base}/rooms/${planning}/read`,
          { messageId: visible },
          's-planningMember',
        )
      ).status,
      204,
    )
    const { rows } = await s.pg.query<{ at: string }>(
      `SELECT to_char(last_read_at at time zone 'UTC', 'YYYY-MM-DD') AS at FROM room_membership
        WHERE room_id = $1 AND member_id = $2`,
      [planning, member],
    )
    assert.equal(rows[0]!.at, '2026-07-01')
  }),
)
