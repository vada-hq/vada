import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  MessagePageResponse,
  NoticeListResponse,
  RoomDetailResponse,
  RoomListResponse,
} from '@vada/contracts'
import { createApp } from '../app.js'
import { roomMembership } from '../db/schema.js'
import { createTestDb } from '../db/test-db.js'
import { createRecord } from '../records/records.js'
import { roomMap } from '../test-support/chat.js'
import { addUser, seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createChatRoutes } from './routes.js'

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
  // 방 목록을 처음 읽으면 방이 채워진다. 그 뒤 모든 참여의 들어온 시각을 정해 시험이 시계에 기대지 않게 한다.
  await list()
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
  const post = (
    room: string,
    sender: string,
    body: string,
    values: { sentAt: Date; isNotice: boolean },
  ) =>
    db.transaction(tx =>
      createRecord(tx, {
        kind: 'message',
        councilId: council.councilId,
        actor: sender,
        values: { roomId: room, body, ...values },
      }),
    )
  const send = (room: string, sender: string, body: string, at: string) =>
    post(room, sender, body, { sentAt: new Date(at), isNotice: false })
  const notice = (room: string, sender: string, body: string, at: string) =>
    post(room, sender, body, { sentAt: new Date(at), isNotice: true })
  // 1:1 방. 두 사람이 참여하고 학생회의 기록이다.
  const direct = (a: string, b: string) =>
    db.transaction(async tx => {
      const id = await createRecord(tx, {
        kind: 'chat_room',
        councilId: council.councilId,
        actor: a,
        values: { type: 'direct' },
      })
      await tx
        .insert(roomMembership)
        .values([a, b].map(memberId => ({ roomId: id, memberId, joinedAt: new Date(JOINED) })))
      return id
    })
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
    notice,
    direct,
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
const messagesOf = (s: Setup, room: string, query = '', user = 's-president') =>
  s.api.get(`${s.base}/rooms/${room}/messages${query}`, user)
const pageOf = async (response: Response) => (await response.json()) as MessagePageResponse
const bodies = (page: MessagePageResponse) => page.messages.map(item => item.body)
const readUpTo = (s: Setup, room: string, messageId: string, user = 's-president') =>
  s.api.post(`${s.base}/rooms/${room}/read`, { messageId }, user)

test(
  '로그인하지 않으면 모든 읽기 경로가 401이다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    for (const path of [
      `${s.base}/rooms`,
      `${s.base}/rooms/${all}`,
      `${s.base}/rooms/${all}/messages`,
      `${s.base}/notices`,
    ])
      assert.equal((await s.api.get(path)).status, 401, path)
    assert.equal(
      (await s.api.post(`${s.base}/rooms/${all}/read`, { messageId: MISSING })).status,
      401,
    )
  }),
)

test(
  '운영진이 아니거나 내보낸 사람, 다른 학생회 사람은 403이다. 학생회 번호가 틀려도 403이다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    await addUser(s.pg, 'stranger')
    for (const user of ['stranger', 's-ended', 'o-president'])
      for (const path of [
        `${s.base}/rooms`,
        `${s.base}/rooms/${all}`,
        `${s.base}/rooms/${all}/messages`,
        `${s.base}/notices`,
      ])
        assert.equal((await s.api.get(path, user)).status, 403, `${user} ${path}`)
    const wrong = await s.api.get('/api/organizations/not-a-uuid/rooms', 's-president')
    assert.equal(wrong.status, 403)
    assert.equal((await readUpTo(s, all, MISSING, 's-ended')).status, 403)
  }),
)

test(
  '다른 학생회의 방과 없는 방, 번호 형식이 틀린 방은 404다',
  run(async s => {
    await s.api.get(`/api/organizations/${s.other.councilId}/rooms`, 'o-president')
    const foreign = await s.roomId(s.other.councilId, 'all')
    for (const room of [foreign, MISSING, 'nope']) {
      for (const path of [`rooms/${room}`, `rooms/${room}/messages`])
        assert.equal((await s.api.get(`${s.base}/${path}`, 's-president')).status, 404, path)
      assert.equal((await readUpTo(s, room, MISSING)).status, 404, room)
    }
  }),
)

test(
  '방 참여자가 아니면 403이다. 회장도 남의 부서방을 읽지 못하고, 회장단이 아니면 회장단방을 읽지 못한다',
  run(async s => {
    const planning = await s.roomId(s.council.councilId, '기획부')
    const leadership = await s.roomId(s.council.councilId, 'leadership')
    const cases: [string, string][] = [
      ['s-president', planning],
      ['s-plain', leadership],
      ['s-financeMember', planning],
    ]
    for (const [user, room] of cases) {
      for (const path of [`rooms/${room}`, `rooms/${room}/messages`])
        assert.equal((await s.api.get(`${s.base}/${path}`, user)).status, 403, `${user} ${path}`)
      assert.equal((await readUpTo(s, room, MISSING, user)).status, 403, user)
    }
  }),
)

test(
  '방 목록은 내 방만 보이고 순서는 전체, 회장단, 부서(이름순), 1:1(최근순)이다',
  run(async s => {
    const president = await s.list('s-president')
    assert.deepEqual(
      president.rooms.map(room => room.type),
      ['all_members', 'leadership'],
    )
    assert.deepEqual(
      (await s.list('s-planningHead')).rooms.map(room => [room.type, room.name]),
      [
        ['all_members', null],
        ['department', '기획부'],
      ],
    )
    const finance = await s.roomId(s.council.councilId, '재정부')
    await s.pg.query(
      `INSERT INTO room_membership (room_id, member_id, joined_at) VALUES ($1, $2, $3)`,
      [finance, s.person.planningHead.memberId, JOINED],
    )
    const newer = await s.direct(s.person.planningHead.memberId, s.person.plain.memberId)
    const older = await s.direct(s.person.planningHead.memberId, s.person.planningMember.memberId)
    await s.send(older, s.person.planningMember.memberId, '먼저', '2026-05-01T00:00:00Z')
    await s.send(newer, s.person.plain.memberId, '나중', '2026-05-02T00:00:00Z')
    const rooms = (await s.list('s-planningHead')).rooms
    assert.deepEqual(
      rooms.map(room => room.name),
      [null, '기획부', '재정부', 's plain', 's planningMember'],
    )
    assert.deepEqual(
      rooms.map(room => room.type),
      ['all_members', 'department', 'department', 'direct', 'direct'],
    )
  }),
)

test(
  '방 목록은 no-store이고 안 읽은 수(남이 보낸 것, 들어온 뒤)와 부름, 합계가 나온다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const lead = await s.roomId(s.council.councilId, 'leadership')
    const lee = s.person.vicePresident.memberId
    const kim = s.person.president.memberId
    await s.send(all, lee, '들어오기 전', '2026-02-28T23:59:59Z')
    const first = await s.send(all, lee, '하나', '2026-03-01T00:00:00Z')
    await s.send(all, lee, '둘', '2026-04-02T00:00:00Z')
    await s.send(all, kim, '내가 보낸 것', '2026-04-03T00:00:00Z')
    await s.send(lead, lee, '회장단', '2026-04-04T00:00:00Z')
    await s.db.transaction(async tx => {
      await createRecord(tx, {
        kind: 'notification',
        councilId: s.council.councilId,
        actor: null,
        values: { recipientId: kim, recordId: first, type: 'mention', notifiedAt: new Date(now) },
      })
    })
    const response = await s.api.get(`${s.base}/rooms`, 's-president')
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    const result = (await response.json()) as RoomListResponse
    const byType = Object.fromEntries(result.rooms.map(room => [room.type, room]))
    assert.deepEqual(
      [byType.all_members!.unread, byType.all_members!.mentions, byType.leadership!.unread],
      [2, 1, 1],
    )
    assert.equal(byType.all_members!.lastMessageAt, '2026-04-03T00:00:00.000Z')
    assert.deepEqual([result.unreadTotal, result.mentionTotal], [3, 1])
    // 공지를 올릴 수 있는 방은 서버가 알려 준다(전체방만).
    assert.deepEqual([byType.all_members!.noticeRoom, byType.leadership!.noticeRoom], [true, false])
  }),
)

test(
  '메시지가 없는 1:1은 목록에 없다. 상대가 학생회를 떠난 1:1은 보기만 된다',
  run(async s => {
    const kim = s.person.president.memberId
    const quiet = await s.direct(kim, s.person.plain.memberId)
    const gone = await s.direct(kim, s.person.ended.memberId)
    assert.deepEqual(
      (await s.list('s-president')).rooms.map(room => room.type),
      ['all_members', 'leadership'],
    )
    await s.send(quiet, s.person.plain.memberId, '안녕', '2026-05-01T00:00:00Z')
    await s.send(gone, s.person.ended.memberId, '떠나요', '2026-05-02T00:00:00Z')
    const rooms = (await s.list('s-president')).rooms.filter(room => room.type === 'direct')
    assert.deepEqual(
      rooms.map(room => [room.id, room.name, room.readOnly]),
      [
        [gone, 's ended', true],
        [quiet, 's plain', false],
      ],
    )
    // 상대에게는 내 이름으로 보인다. 참여자가 아닌 사람은 읽지 못한다.
    assert.equal(
      (await s.list('s-plain')).rooms.find(room => room.id === quiet)?.name,
      's president',
    )
    assert.equal((await s.api.get(`${s.base}/rooms/${quiet}`, 's-planningMember')).status, 403)
  }),
)

test(
  '방 하나를 열면 방 모습과 참여자가 이름순으로 나온다',
  run(async s => {
    const planning = await s.roomId(s.council.councilId, '기획부')
    const response = await s.api.get(`${s.base}/rooms/${planning}`, 's-planningHead')
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    const detail = (await response.json()) as RoomDetailResponse
    assert.deepEqual(
      [detail.room.id, detail.room.type, detail.room.name],
      [planning, 'department', '기획부'],
    )
    assert.deepEqual(
      detail.participants.map(item => item.name),
      ['s planningHead', 's planningMember', 's planningViceHead'],
    )
  }),
)

test(
  '메시지는 들어온 뒤의 것만 오래된 순서로 나온다. 들어온 시각과 같은 메시지는 보인다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const lee = s.person.vicePresident.memberId
    await s.send(all, lee, '전', '2026-02-28T23:59:59Z')
    await s.send(all, lee, '같은 시각', JOINED)
    await s.send(all, lee, '후', '2026-03-01T00:00:01Z')
    const page = await pageOf(await messagesOf(s, all))
    assert.deepEqual(bodies(page), ['같은 시각', '후'])
    assert.deepEqual([page.hasOlder, page.hasNewer], [false, false])
    assert.deepEqual(
      [page.messages[0]!.senderName, page.messages[0]!.senderId],
      ['s vicePresident', lee],
    )
    assert.equal((await messagesOf(s, all)).headers.get('Cache-Control'), 'no-store')
  }),
)

test(
  '메시지는 50개씩 커서로 나온다: 처음은 가장 최근 쪽, before는 더 오래된 쪽, after는 더 새 쪽',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const lee = s.person.vicePresident.memberId
    const ids: string[] = []
    for (let n = 1; n <= 120; n++) {
      const at = new Date(Date.parse(JOINED) + n * 60_000).toISOString()
      ids.push(await s.send(all, lee, `m${n}`, at))
    }
    const label = (from: number, to: number) =>
      Array.from({ length: to - from + 1 }, (_, i) => `m${from + i}`)
    const latest = await pageOf(await messagesOf(s, all))
    assert.deepEqual(bodies(latest), label(71, 120))
    assert.deepEqual([latest.hasOlder, latest.hasNewer], [true, false])
    const older = await pageOf(await messagesOf(s, all, `?before=${latest.messages[0]!.id}`))
    assert.deepEqual(bodies(older), label(21, 70))
    assert.deepEqual([older.hasOlder, older.hasNewer], [true, true])
    const oldest = await pageOf(await messagesOf(s, all, `?before=${older.messages[0]!.id}`))
    assert.deepEqual(bodies(oldest), label(1, 20))
    assert.deepEqual([oldest.hasOlder, oldest.hasNewer], [false, true])
    const newer = await pageOf(await messagesOf(s, all, `?after=${ids[9]}`))
    assert.deepEqual(bodies(newer), label(11, 60))
    assert.deepEqual([newer.hasOlder, newer.hasNewer], [true, true])
    const tail = await pageOf(await messagesOf(s, all, `?after=${ids[99]}`))
    assert.deepEqual(bodies(tail), label(101, 120))
    assert.deepEqual([tail.hasOlder, tail.hasNewer], [true, false])
    const end = await pageOf(await messagesOf(s, all, `?after=${ids[119]}`))
    assert.deepEqual([bodies(end), end.hasNewer], [[], false])
  }),
)

test(
  '같은 시각의 메시지도 번호 순서로 빠짐없이 한 번씩 나온다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const lee = s.person.vicePresident.memberId
    const tie = '2026-04-01T00:00:00Z'
    const first = await s.send(all, lee, 'a', tie)
    const second = await s.send(all, lee, 'b', tie)
    const third = await s.send(all, lee, 'c', tie)
    assert.deepEqual(bodies(await pageOf(await messagesOf(s, all))), ['a', 'b', 'c'])
    assert.deepEqual(bodies(await pageOf(await messagesOf(s, all, `?after=${first}`))), ['b', 'c'])
    assert.deepEqual(bodies(await pageOf(await messagesOf(s, all, `?before=${third}`))), ['a', 'b'])
    assert.ok(first < second && second < third)
  }),
)

test(
  '커서가 들어오기 전 메시지나 다른 방 메시지, 없는 메시지, 형식이 틀린 값이면 400 INVALID_CURSOR다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const lead = await s.roomId(s.council.councilId, 'leadership')
    const lee = s.person.vicePresident.memberId
    const early = await s.send(all, lee, '전', '2026-02-28T23:59:59Z')
    const elsewhere = await s.send(lead, lee, '다른 방', '2026-04-01T00:00:00Z')
    for (const cursor of [early, elsewhere, MISSING, 'abc'])
      for (const key of ['before', 'after']) {
        const response = await messagesOf(s, all, `?${key}=${cursor}`)
        assert.equal(response.status, 400, `${key} ${cursor}`)
        assert.deepEqual(await response.json(), { error: 'INVALID_CURSOR' })
      }
    for (const query of [`?before=${early}&after=${early}`, '?x=1', '?before=']) {
      const response = await messagesOf(s, all, query)
      assert.equal(response.status, 400, query)
      assert.deepEqual(await response.json(), { error: 'INVALID_INPUT' })
    }
  }),
)

test(
  '같은 기수의 공지는 들어오기 전 것도 공지 목록과 방 목록에 나오고 흐름에는 끼지 않는다. 기수 경계는 한국 날짜로 ±1초다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const lead = await s.roomId(s.council.councilId, 'leadership')
    const kim = s.person.president.memberId
    const notice = (body: string, at: string) => s.notice(all, kim, body, at)
    await notice('지난 기수 끝', '2025-12-31T14:59:59Z')
    await notice('기수 첫 순간', '2025-12-31T15:00:00Z')
    await notice('봄', '2026-04-01T00:00:00Z')
    await notice('여름', '2026-06-01T00:00:00Z')
    await notice('기수 끝 순간', '2026-12-31T14:59:59Z')
    await notice('다음 기수 첫 순간', '2026-12-31T15:00:00Z')
    await s.send(all, kim, '공지 아님', '2026-05-01T00:00:00Z')
    await s.notice(lead, kim, '회장단방 공지 표시', '2026-05-02T00:00:00Z')
    const response = await s.api.get(`${s.base}/notices`, 's-planningMember')
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    const notices = ((await response.json()) as NoticeListResponse).notices
    assert.deepEqual(
      notices.map(item => item.body),
      ['기수 끝 순간', '여름', '봄', '기수 첫 순간'],
    )
    assert.equal(notices[0]!.senderName, 's president')
    assert.ok(notices.every(item => item.isNotice))
    const listed = await s.list('s-planningMember')
    assert.deepEqual(
      listed.notices.map(item => item.body),
      ['기수 끝 순간', '여름', '봄'],
    )
    // 흐름은 들어온 뒤의 것만이다(들어온 날은 2026-03-01).
    const flow = bodies(await pageOf(await messagesOf(s, all, '', 's-planningMember')))
    assert.deepEqual(flow, ['봄', '공지 아님', '여름', '기수 끝 순간', '다음 기수 첫 순간'])
  }),
)

test(
  '읽음은 그 메시지까지 남고 뒤로 가지 않는다. 부름도 같이 줄어든다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const lee = s.person.vicePresident.memberId
    const kim = s.person.president.memberId
    const one = await s.send(all, lee, '하나', '2026-04-01T00:00:00Z')
    const two = await s.send(all, lee, '둘', '2026-04-02T00:00:00Z')
    const three = await s.send(all, lee, '셋', '2026-04-03T00:00:00Z')
    await s.db.transaction(async tx => {
      await createRecord(tx, {
        kind: 'notification',
        councilId: s.council.councilId,
        actor: null,
        values: { recipientId: kim, recordId: two, type: 'mention', notifiedAt: new Date(now) },
      })
    })
    const state = async () => {
      const room = (await s.list()).rooms.find(item => item.id === all)!
      return [room.unread, room.mentions]
    }
    assert.deepEqual(await state(), [3, 1])
    assert.equal((await readUpTo(s, all, two)).status, 204)
    assert.deepEqual(await state(), [1, 0])
    assert.equal((await readUpTo(s, all, one)).status, 204)
    assert.deepEqual(await state(), [1, 0])
    assert.equal((await readUpTo(s, all, three)).status, 204)
    assert.deepEqual(await state(), [0, 0])
    assert.equal((await s.list()).unreadTotal, 0)
  }),
)

test(
  '읽음 표시의 메시지가 들어오기 전 것이거나 다른 방 것이면 404이고 본문이 틀리면 400이다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const lead = await s.roomId(s.council.councilId, 'leadership')
    const lee = s.person.vicePresident.memberId
    const early = await s.send(all, lee, '전', '2026-02-28T23:59:59Z')
    const elsewhere = await s.send(lead, lee, '다른 방', '2026-04-01T00:00:00Z')
    for (const messageId of [early, elsewhere, MISSING])
      assert.equal((await readUpTo(s, all, messageId)).status, 404, messageId)
    for (const body of [{}, { messageId: 'abc' }, { messageId: early, extra: 1 }]) {
      const response = await s.api.post(`${s.base}/rooms/${all}/read`, body, 's-president')
      assert.equal(response.status, 400, JSON.stringify(body))
    }
    const stored = await s.pg.query(
      `SELECT last_read_at FROM room_membership WHERE room_id = $1 AND member_id = $2`,
      [all, s.person.president.memberId],
    )
    assert.equal((stored.rows[0] as { last_read_at: unknown }).last_read_at, null)
  }),
)

test('이 기능 전에 만든 학생회는 방 목록을 처음 읽을 때 방이 채워진다', async () => {
  const { pg, db, close } = await createTestDb()
  try {
    const council = await seedCouncil(db, pg)
    const api = caller(
      createApp({
        auth: { handler: async () => new Response() },
        trustedOrigin: ORIGIN,
        chat: createChatRoutes(db, testSession, { clock: () => now }),
      }),
    )
    assert.deepEqual(await roomMap(pg, council.councilId), {})
    const response = await api.get(`/api/organizations/${council.councilId}/rooms`, 's-plain')
    assert.deepEqual(
      ((await response.json()) as RoomListResponse).rooms.map(room => room.type),
      ['all_members'],
    )
    assert.deepEqual(Object.keys(await roomMap(pg, council.councilId)).sort(), [
      'all',
      'dept:기획부',
      'dept:재정부',
      'leadership',
    ])
  } finally {
    await close()
  }
})

// 행사방: 종류 칸이 전체방과 같아도 event_id가 있으면 편성 방이 아니다.
async function eventRoom(s: Pick<Setup, 'pg'>, councilId: string) {
  const row = async (kind: string) =>
    (
      await s.pg.query<{ id: string }>(
        `INSERT INTO record (kind, council_id) VALUES ($1, $2) RETURNING id`,
        [kind, councilId],
      )
    ).rows[0]!.id
  const event = await row('event')
  await s.pg.query(`INSERT INTO event (id, name) VALUES ($1, '행사')`, [event])
  const room = await row('chat_room')
  await s.pg.query(`INSERT INTO chat_room (id, type, event_id) VALUES ($1, 'all_members', $2)`, [
    room,
    event,
  ])
  return room
}
const noticesBodies = async (s: Setup, user: string) =>
  ((await (await s.api.get(`${s.base}/notices`, user)).json()) as NoticeListResponse).notices.map(
    item => item.body,
  )

test(
  '다른 학생회의 공지는 기간이 겹쳐도 공지 목록과 방 목록에 나오지 않는다',
  run(async s => {
    await s.api.get(`/api/organizations/${s.other.councilId}/rooms`, 'o-president')
    const foreign = await s.roomId(s.other.councilId, 'all')
    await s.db.transaction(tx =>
      createRecord(tx, {
        kind: 'message',
        councilId: s.other.councilId,
        actor: s.other.people.president.memberId,
        values: {
          roomId: foreign,
          body: '남의 공지',
          sentAt: new Date('2026-04-01T00:00:00Z'),
          isNotice: true,
        },
      }),
    )
    const all = await s.roomId(s.council.councilId, 'all')
    await s.notice(all, s.person.president.memberId, '우리 공지', '2026-04-02T00:00:00Z')
    assert.deepEqual(await noticesBodies(s, 's-plain'), ['우리 공지'])
    assert.deepEqual(
      (await s.list('s-plain')).notices.map(item => item.body),
      ['우리 공지'],
    )
  }),
)

test(
  '행사방에 붙은 공지는 공지 목록과 방 목록에 나오지 않는다',
  run(async s => {
    const room = await eventRoom(s, s.council.councilId)
    await s.notice(room, s.person.president.memberId, '행사방 공지', '2026-04-01T00:00:00Z')
    assert.deepEqual(await noticesBodies(s, 's-plain'), [])
    assert.deepEqual((await s.list('s-plain')).notices, [])
  }),
)

test('행사방만 있는 학생회도 방 목록을 처음 읽을 때 편성 방이 채워진다', async () => {
  const { pg, db, close } = await createTestDb()
  try {
    const council = await seedCouncil(db, pg)
    await eventRoom({ pg }, council.councilId)
    const api = caller(
      createApp({
        auth: { handler: async () => new Response() },
        trustedOrigin: ORIGIN,
        chat: createChatRoutes(db, testSession, { clock: () => now }),
      }),
    )
    const response = await api.get(`/api/organizations/${council.councilId}/rooms`, 's-plain')
    assert.deepEqual(
      ((await response.json()) as RoomListResponse).rooms.map(room => room.type),
      ['all_members'],
    )
    const real = await pg.query(
      `SELECT 1 FROM chat_room WHERE type = 'all_members' AND event_id IS NULL`,
    )
    assert.equal(real.rows.length, 1)
  } finally {
    await close()
  }
})

test(
  '들어오기 전 메시지의 부름은 세지 않고, 들어온 시각과 같은 메시지의 부름은 센다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const kim = s.person.president.memberId
    const lee = s.person.vicePresident.memberId
    const early = await s.send(all, lee, '전', '2026-02-28T23:59:59Z')
    const same = await s.send(all, lee, '같은 시각', JOINED)
    for (const recordId of [early, same])
      await s.db.transaction(async tx => {
        await createRecord(tx, {
          kind: 'notification',
          councilId: s.council.councilId,
          actor: null,
          values: { recipientId: kim, recordId, type: 'mention', notifiedAt: new Date(now) },
        })
      })
    const room = (await s.list()).rooms.find(item => item.id === all)!
    assert.deepEqual([room.unread, room.mentions], [1, 1])
  }),
)
