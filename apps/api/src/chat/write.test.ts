import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  MENTION_MAX,
  MESSAGE_BODY_MAX,
  type ChatMessage,
  type OpenDirectResponse,
  type RoomListResponse,
} from '@vada/contracts'
import { inCouncilChange } from '../access/authorize.js'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import { createRateLimiter } from '../http/rate-limit.js'
import { createRecord } from '../records/records.js'
import { removeMember } from '../team/service.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createChatRoutes } from './routes.js'
import { syncRooms } from './rooms.js'

// 한국 시각 2026-10-19 12:00. 기본 기수는 2026-01-01부터 12-31까지다.
const now = new Date('2026-10-19T03:00:00Z')
const JOINED = '2026-03-01T00:00:00Z'
const MISSING = '019e0000-0000-7000-8000-000000000000'

async function start(sendLimiter?: ReturnType<typeof createRateLimiter>) {
  const { pg, db, close } = await createTestDb()
  const council = await seedCouncil(db, pg)
  const other = await seedCouncil(db, pg, 'o')
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      chat: createChatRoutes(db, testSession, {
        clock: () => now,
        ...(sendLimiter ? { sendLimiter } : {}),
      }),
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
  const send = (room: string, user: string, body: unknown) =>
    api.post(`${base}/rooms/${room}/messages`, body, user)
  const count = async (sql: string, params: unknown[] = []) =>
    Number(((await pg.query(sql, params)).rows[0] as { n: string }).n)
  const mentionsOf = async (messageId: string) =>
    (
      await pg.query<{ name: string }>(
        `SELECT m.name FROM notification n JOIN member m ON m.id = n.recipient_id
          WHERE n.record_id = $1 AND n.type = 'mention' ORDER BY m.name`,
        [messageId],
      )
    ).rows.map(row => row.name)
  const messageCount = () => count('SELECT count(*) AS n FROM message')
  const versions = (id: string) =>
    count('SELECT count(*) AS n FROM record_version WHERE record_id = $1', [id])
  // 학생회 행을 잠그는 라우트와 같은 길로 내보낸다(편성 변경 거래의 끝에서 방을 맞춘다).
  const remove = (memberId: string) =>
    inCouncilChange(
      db,
      { userId: 's-president', councilId: council.councilId, action: 'member.manage', now },
      async (tx, actor) => {
        await removeMember(tx, actor, memberId)
        await syncRooms(tx, actor)
      },
    )
  const direct = async (user: string, memberId: string) =>
    api.post(`${base}/direct`, { memberId }, user)
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
    count,
    mentionsOf,
    messageCount,
    versions,
    remove,
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
const sentOf = async (response: Response) => (await response.json()) as ChatMessage
const errorOf = async (response: Response) => ((await response.json()) as { error: string }).error

test(
  '참여자가 글을 보내면 201이고 내 읽음이 그 메시지까지 가며 남의 안 읽은 수만 는다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const response = await s.send(all, 's-president', { body: '  안녕하세요  ' })
    assert.equal(response.status, 201)
    const sent = await sentOf(response)
    assert.equal(sent.body, '안녕하세요')
    assert.equal(sent.senderName, 's president')
    assert.equal(sent.isNotice, false)
    assert.equal(await s.versions(sent.id), 1)
    const mine = (await s.list('s-president')).rooms.find(room => room.id === all)!
    assert.equal(mine.unread, 0)
    const theirs = (await s.list('s-plain')).rooms.find(room => room.id === all)!
    assert.equal(theirs.unread, 1)
    assert.equal(await s.count('SELECT count(*) AS n FROM notification'), 0)
  }),
)

test(
  '부르면 그 방의 지금 참여자(나 빼고)에게만 부름 기록이 생기고 나머지 번호는 조용히 빠진다',
  run(async s => {
    const planning = await s.roomId(s.council.councilId, '기획부')
    const p = s.person
    const outsider = p.financeMember.memberId // 기획부 방 참여자가 아니다
    const foreign = s.other.people.president.memberId
    const response = await s.send(planning, 's-planningHead', {
      body: '@기획부원 @재정부원 @나 @없는사람',
      mentions: [
        p.planningMember.memberId,
        p.planningMember.memberId,
        p.planningHead.memberId,
        outsider,
        foreign,
        p.ended.memberId,
        MISSING,
      ],
    })
    assert.equal(response.status, 201)
    assert.deepEqual(await s.mentionsOf((await sentOf(response)).id), ['s planningMember'])
    const list = await s.list('s-planningMember')
    assert.equal(list.rooms.find(room => room.id === planning)!.mentions, 1)
    assert.equal(list.mentionTotal, 1)
  }),
)

test(
  '내보낸 사람과 지금 참여자가 아닌 사람에게는 줄이 남아 있어도 부름 기록이 없다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const p = s.person
    // 기록 모듈은 끝난 소속에게도 알림을 허용한다. 줄이 남은 끝난 소속을 일부러 만들어 서비스가 따로 거르는지 본다.
    await s.pg.query(
      `INSERT INTO room_membership (room_id, member_id, joined_at) VALUES ($1, $2, $3)`,
      [all, p.ended.memberId, JOINED],
    )
    const first = await s.send(all, 's-president', {
      body: '부름',
      mentions: [p.ended.memberId, p.plain.memberId],
    })
    assert.deepEqual(await s.mentionsOf((await sentOf(first)).id), ['s plain'])
    // 정말 내보내면 줄이 지워져 그 사람은 부를 수 없다.
    await s.remove(p.planningMember.memberId)
    const second = await s.send(all, 's-president', {
      body: '다시',
      mentions: [p.planningMember.memberId],
    })
    assert.equal(second.status, 201)
    assert.deepEqual(await s.mentionsOf((await sentOf(second)).id), [])
  }),
)

test(
  '빠진 사람은 빠진 뒤로 보내지 못한다: 내보내면 403이고 부서에서 빠지면 그 부서방만 403이다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const planning = await s.roomId(s.council.councilId, '기획부')
    assert.equal((await s.send(planning, 's-planningMember', { body: '전' })).status, 201)
    await s.remove(s.person.planningMember.memberId)
    const before = await s.messageCount()
    for (const room of [all, planning])
      assert.equal((await s.send(room, 's-planningMember', { body: '후' })).status, 403)
    assert.equal(await s.messageCount(), before)
  }),
)

test(
  '참여자가 아니면 403이고 다른 학생회의 방이거나 없는 방이면 404이며 다른 학생회 사람과 로그인하지 않은 요청은 막힌다',
  run(async s => {
    const finance = await s.roomId(s.council.councilId, '재정부')
    const leadership = await s.roomId(s.council.councilId, 'leadership')
    const foreignAll = await s.roomId(s.other.councilId, 'all')
    const body = { body: '안녕' }
    // 회장단도 부서방을 물려받지 않고, 부서원도 회장단방에 못 보낸다(PRIN-5).
    assert.equal((await s.send(finance, 's-president', body)).status, 403)
    assert.equal((await s.send(leadership, 's-planningMember', body)).status, 403)
    assert.equal((await s.send(foreignAll, 's-president', body)).status, 404)
    assert.equal((await s.send(MISSING, 's-president', body)).status, 404)
    assert.equal((await s.send('abc', 's-president', body)).status, 404)
    // 다른 학생회의 운영진은 이 학생회 경로에서 운영진이 아니다.
    assert.equal((await s.send(finance, 'o-president', body)).status, 403)
    assert.equal((await s.api.post(`${s.base}/rooms/${finance}/messages`, body)).status, 401)
    assert.equal(await s.messageCount(), 0)
  }),
)

test(
  '입력 경우: 필수값 누락, 빈 글과 공백, 상한+1(이모지 포함), NUL, 홀로 쓰인 서러게이트, 모르는 키, 나쁜 부름 번호는 400이고 아무것도 남지 않는다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const id = s.person.plain.memberId
    const bad: unknown[] = [
      {},
      { mentions: [] },
      { body: '' },
      { body: ' \n\t' },
      { body: 'a'.repeat(MESSAGE_BODY_MAX + 1) },
      { body: '😀'.repeat(MESSAGE_BODY_MAX + 1) },
      { body: 'a\u0000b' },
      { body: 'a\uD800' },
      { body: 'a', extra: 1 },
      { body: 'a', mentions: 'x' },
      { body: 'a', mentions: ['abc'] },
      { body: 'a', mentions: [`${id}\u0000`] },
      { body: 'a', mentions: Array.from({ length: MENTION_MAX + 1 }, () => id) },
    ]
    for (const body of bad) {
      const response = await s.send(all, 's-president', body)
      assert.equal(response.status, 400, JSON.stringify(body).slice(0, 80))
      assert.equal(await errorOf(response), 'INVALID_INPUT')
    }
    assert.equal(await s.messageCount(), 0)
    // 상한 그대로는 받는다(이모지는 한 글자로 센다).
    assert.equal(
      (await s.send(all, 's-president', { body: '😀'.repeat(MESSAGE_BODY_MAX) })).status,
      201,
    )
  }),
)

test('10초 안에 21번째로 보내면 429이고 다른 사람은 막히지 않으며 막힌 글은 남지 않는다', async () => {
  const s = await start()
  try {
    const all = await s.roomId(s.council.councilId, 'all')
    for (let index = 0; index < 20; index++)
      assert.equal((await s.send(all, 's-president', { body: `글 ${index}` })).status, 201)
    const blocked = await s.send(all, 's-president', { body: '스물한 번째' })
    assert.equal(blocked.status, 429)
    assert.equal(await errorOf(blocked), 'TOO_MANY_REQUESTS')
    assert.equal(await s.messageCount(), 20)
    assert.equal((await s.send(all, 's-plain', { body: '다른 사람' })).status, 201)
  } finally {
    await s.close()
  }
})

test('속도 제한은 로그인한 계정만 센다: 로그인하지 않은 요청은 401이고 센 수에 들지 않는다', async () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 10_000 })
  const s = await start(limiter)
  try {
    const all = await s.roomId(s.council.councilId, 'all')
    for (let index = 0; index < 3; index++)
      assert.equal(
        (await s.api.post(`${s.base}/rooms/${all}/messages`, { body: '글' })).status,
        401,
      )
    assert.equal((await s.send(all, 's-president', { body: '글' })).status, 201)
  } finally {
    await s.close()
  }
})

test(
  '같은 방의 보낸 시각은 겹치지 않고 방의 가장 늦은 메시지보다 뒤다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    await s.db.transaction(tx =>
      createRecord(tx, {
        kind: 'message',
        councilId: s.council.councilId,
        actor: s.person.president.memberId,
        values: { roomId: all, body: '먼 미래', sentAt: new Date('2099-01-01T00:00:00Z') },
      }),
    )
    for (const body of ['하나', '둘', '셋']) await s.send(all, 's-president', { body })
    const rows = await s.pg.query<{ body: string; after_future: boolean }>(
      `SELECT body, sent_at > '2099-01-01T00:00:00Z' AS after_future FROM message
        WHERE room_id = $1 ORDER BY sent_at, id`,
      [all],
    )
    assert.deepEqual(
      rows.rows.map(row => row.body),
      ['먼 미래', '하나', '둘', '셋'],
    )
    assert.ok(rows.rows.slice(1).every(row => row.after_future))
    const distinct = await s.count('SELECT count(DISTINCT sent_at) AS n FROM message')
    assert.equal(distinct, 4)
  }),
)

test(
  '회장단이 전체방 메시지에 공지를 붙이고 떼면 판이 남고 같은 값이면 판이 늘지 않는다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const sent = await sentOf(await s.send(all, 's-plain', { body: '공지할 글' }))
    const mark = (user: string, id: string, isNotice: unknown) =>
      s.api.post(`${s.base}/messages/${id}/notice`, { isNotice }, user)
    const on = await mark('s-vicePresident', sent.id, true)
    assert.equal(on.status, 200)
    assert.equal((await sentOf(on)).isNotice, true)
    assert.equal(await s.versions(sent.id), 2)
    const changer = await s.pg.query<{ changed_by: string }>(
      'SELECT changed_by FROM record_version WHERE record_id = $1 AND version_no = 2',
      [sent.id],
    )
    assert.equal(changer.rows[0]!.changed_by, s.person.vicePresident.memberId)
    assert.equal((await mark('s-president', sent.id, true)).status, 200)
    assert.equal(await s.versions(sent.id), 2)
    assert.equal((await s.list('s-plain')).notices.length, 1)
    assert.equal((await sentOf(await mark('s-president', sent.id, false))).isNotice, false)
    assert.equal(await s.versions(sent.id), 3)
    assert.equal((await mark('s-president', sent.id, false)).status, 200)
    assert.equal(await s.versions(sent.id), 3)
  }),
)

test(
  '공지 표시: 회장단이 아니면 403, 부서방·회장단방·다른 학생회·없는·들어오기 전 메시지는 404, 로그인 전은 401, 나쁜 본문은 400이다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const planning = await s.roomId(s.council.councilId, '기획부')
    const leadership = await s.roomId(s.council.councilId, 'leadership')
    const foreignAll = await s.roomId(s.other.councilId, 'all')
    const own = await sentOf(await s.send(all, 's-plain', { body: '전체방' }))
    const inPlanning = await sentOf(await s.send(planning, 's-planningMember', { body: '부서방' }))
    const inLeadership = await sentOf(await s.send(leadership, 's-president', { body: '회장단방' }))
    const foreign = await sentOf(
      await s.api.post(
        `/api/organizations/${s.other.councilId}/rooms/${foreignAll}/messages`,
        { body: '남의 방' },
        'o-president',
      ),
    )
    const early = await s.db.transaction(tx =>
      createRecord(tx, {
        kind: 'message',
        councilId: s.council.councilId,
        actor: s.person.vicePresident.memberId,
        values: { roomId: all, body: '전', sentAt: new Date('2026-02-28T00:00:00Z') },
      }),
    )
    const mark = (user: string | undefined, id: string, body: unknown = { isNotice: true }) =>
      s.api.post(`${s.base}/messages/${id}/notice`, body, user)
    assert.equal((await mark('s-planningHead', own.id)).status, 403)
    assert.equal((await mark('s-plain', own.id)).status, 403)
    assert.equal((await mark('o-president', own.id)).status, 403)
    assert.equal((await mark(undefined, own.id)).status, 401)
    for (const id of [inPlanning.id, inLeadership.id, foreign.id, early, MISSING, 'abc'])
      assert.equal((await mark('s-president', id)).status, 404, id)
    for (const body of [{}, { isNotice: 'yes' }, { isNotice: true, x: 1 }])
      assert.equal((await mark('s-president', own.id, body)).status, 400, JSON.stringify(body))
    assert.equal(await s.versions(own.id), 1)
    assert.equal(await s.versions(inPlanning.id), 1)
    assert.equal(await s.versions(foreign.id), 1)
  }),
)

test(
  '1:1은 두 번 열어도, 상대가 열어도 같은 방이고 메시지가 없으면 목록에 없다',
  run(async s => {
    const p = s.person
    const first = await s.direct('s-president', p.plain.memberId)
    assert.equal(first.status, 200)
    const { roomId } = (await first.json()) as OpenDirectResponse
    const again = (await (
      await s.direct('s-president', p.plain.memberId)
    ).json()) as OpenDirectResponse
    const reverse = (await (
      await s.direct('s-plain', p.president.memberId)
    ).json()) as OpenDirectResponse
    assert.equal(again.roomId, roomId)
    assert.equal(reverse.roomId, roomId)
    assert.equal(await s.count(`SELECT count(*) AS n FROM chat_room WHERE type = 'direct'`), 1)
    assert.equal(await s.versions(roomId), 1)
    assert.ok(!(await s.list('s-president')).rooms.some(room => room.id === roomId))
    assert.equal((await s.send(roomId, 's-president', { body: '안녕' })).status, 201)
    const listed = (await s.list('s-plain')).rooms.find(room => room.id === roomId)!
    assert.equal(listed.type, 'direct')
    assert.equal(listed.name, 's president')
    assert.equal(listed.unread, 1)
    // 다른 사람과는 다른 방이다.
    const other = (await (
      await s.direct('s-president', p.planningMember.memberId)
    ).json()) as OpenDirectResponse
    assert.notEqual(other.roomId, roomId)
    // 1:1은 그 두 사람만 본다.
    assert.equal((await s.send(roomId, 's-planningMember', { body: '엿듣기' })).status, 403)
  }),
)

test(
  '1:1 열기: 나와 열면 409, 없는 사람·다른 학생회·내보낸 사람이면 404, 나쁜 본문은 400, 로그인 전은 401이다',
  run(async s => {
    const p = s.person
    const self = await s.direct('s-president', p.president.memberId)
    assert.equal(self.status, 409)
    assert.equal(await errorOf(self), 'CANNOT_DIRECT_SELF')
    for (const memberId of [MISSING, s.other.people.plain.memberId, p.ended.memberId])
      assert.equal((await s.direct('s-president', memberId)).status, 404, memberId)
    for (const body of [{}, { memberId: 'x' }, { memberId: p.plain.memberId, y: 1 }])
      assert.equal((await s.api.post(`${s.base}/direct`, body, 's-president')).status, 400)
    assert.equal((await s.api.post(`${s.base}/direct`, { memberId: p.plain.memberId })).status, 401)
    assert.equal((await s.direct('o-president', p.plain.memberId)).status, 403)
    assert.equal(await s.count(`SELECT count(*) AS n FROM chat_room WHERE type = 'direct'`), 0)
  }),
)

test(
  '상대가 떠난 1:1은 보기만 된다: 목록에 readOnly이고 보내면 409이며 읽기는 된다',
  run(async s => {
    const p = s.person
    const { roomId } = (await (
      await s.direct('s-president', p.plain.memberId)
    ).json()) as OpenDirectResponse
    assert.equal((await s.send(roomId, 's-plain', { body: '떠나기 전' })).status, 201)
    await s.remove(p.plain.memberId)
    const room = (await s.list('s-president')).rooms.find(item => item.id === roomId)!
    assert.equal(room.readOnly, true)
    const blocked = await s.send(roomId, 's-president', {
      body: '이제는 못 보냄',
      mentions: [p.plain.memberId],
    })
    assert.equal(blocked.status, 409)
    assert.equal(await errorOf(blocked), 'ROOM_READ_ONLY')
    assert.equal(await s.count('SELECT count(*) AS n FROM notification'), 0)
    assert.equal(await s.messageCount(), 1)
    assert.equal((await s.api.get(`${s.base}/rooms/${roomId}/messages`, 's-president')).status, 200)
    // 떠난 사람 쪽은 내보낸 사람의 다음 요청이라 막힌다.
    assert.equal((await s.send(roomId, 's-plain', { body: '돌아옴' })).status, 403)
    // 떠난 사람과는 새로 열 수 없다.
    assert.equal((await s.direct('s-president', p.plain.memberId)).status, 404)
  }),
)

test(
  '공지 떼기는 보이는 공지와 같은 조건이다: 공지가 붙은 뒤 들어온 회장단도 같은 기수 공지는 떼고, 지난 기수 공지와 보이지 않는 글은 404다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const post = (body: string, sentAt: string, isNotice: boolean) =>
      s.db.transaction(tx =>
        createRecord(tx, {
          kind: 'message',
          councilId: s.council.councilId,
          actor: s.person.president.memberId,
          values: { roomId: all, body, sentAt: new Date(sentAt), isNotice },
        }),
      )
    const shown = await post('보이는 공지', '2026-05-01T00:00:00Z', true)
    const lastYear = await post('지난 기수 공지', '2025-05-01T00:00:00Z', true)
    const hidden = await post('들어오기 전 일반 글', '2026-05-02T00:00:00Z', false)
    await s.pg.query(
      `UPDATE room_membership SET joined_at = '2026-06-01T00:00:00Z'
        WHERE room_id = $1 AND member_id = $2`,
      [all, s.person.vicePresident.memberId],
    )
    const mark = (id: string, isNotice: boolean) =>
      s.api.post(`${s.base}/messages/${id}/notice`, { isNotice }, 's-vicePresident')
    assert.equal((await s.list('s-vicePresident')).notices.length, 1)
    assert.equal((await mark(lastYear, false)).status, 404)
    assert.equal((await mark(hidden, true)).status, 404)
    const off = await mark(shown, false)
    assert.equal(off.status, 200)
    assert.equal((await sentOf(off)).isNotice, false)
    assert.equal((await s.list('s-vicePresident')).notices.length, 0)
    // 뗀 글은 들어오기 전 글이라 다시 붙일 수는 없다.
    assert.equal((await mark(shown, true)).status, 404)
  }),
)
