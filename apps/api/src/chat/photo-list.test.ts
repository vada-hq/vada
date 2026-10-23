import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CHAT_PHOTO_LIST_MAX, type ChatPhotoListResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { roomMembership } from '../db/schema.js'
import { createTestDb } from '../db/test-db.js'
import { createRecord } from '../records/records.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createChatRoutes } from './routes.js'

// 한국 시각 2026-10-19 12:00. 기본 기수는 2026-01-01부터 12-31까지다.
const now = new Date('2026-10-19T03:00:00Z')
const JOINED = '2026-03-01T00:00:00Z'
const SAME_TIME = '2026-06-01T00:00:00Z'

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
  await api.get(`${base}/rooms`, 's-president')
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
  // 사진 한 장이 붙은 메시지 하나. 사진 번호를 돌려준다.
  const attach = (
    councilId: string,
    room: string,
    sender: string,
    values: { sentAt: Date; isNotice: boolean },
  ) =>
    db.transaction(async tx => {
      const messageId = await createRecord(tx, {
        kind: 'message',
        councilId,
        actor: sender,
        values: { roomId: room, body: '', ...values },
      })
      const id = await createRecord(tx, {
        kind: 'file',
        councilId,
        actor: sender,
        values: {
          name: 'photo-1.jpg',
          mediaType: 'image/jpeg',
          sizeBytes: 10,
          storageKey: `chat/${crypto.randomUUID()}`,
          attachedToId: messageId,
        },
      })
      return { id, messageId }
    })
  const photo = (councilId: string, room: string, sender: string, at: string) =>
    attach(councilId, room, sender, { sentAt: new Date(at), isNotice: false })
  const noticePhoto = (councilId: string, room: string, sender: string, at: string) =>
    attach(councilId, room, sender, { sentAt: new Date(at), isNotice: true })
  const list = (user?: string, at = base) => api.get(`${at}/chat/photos`, user)
  const listed = async (user: string, at = base) =>
    (await (await list(user, at)).json()) as ChatPhotoListResponse
  return {
    pg,
    db,
    close,
    council,
    other,
    roomId,
    photo,
    noticePhoto,
    list,
    listed,
    base,
    otherBase: `/api/organizations/${other.councilId}`,
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
const ids = (result: ChatPhotoListResponse) => result.photos.map(item => item.id)

test(
  '목록은 최근 것부터 사진·메시지·방·보낸 사람·시각을 주고 no-store이며 참여한 방의 사진만 있다',
  run(async s => {
    const planning = await s.roomId(s.council.councilId, '기획부')
    const finance = await s.roomId(s.council.councilId, '재정부')
    const head = s.person.planningHead.memberId
    const older = await s.photo(s.council.councilId, planning, head, '2026-04-01T00:00:00Z')
    const newer = await s.photo(s.council.councilId, planning, head, '2026-05-01T00:00:00Z')
    const hidden = await s.photo(
      s.council.councilId,
      finance,
      s.person.financeMember.memberId,
      '2026-05-02T00:00:00Z',
    )
    const response = await s.list('s-planningMember')
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    const result = (await response.json()) as ChatPhotoListResponse
    assert.deepEqual(ids(result), [newer.id, older.id])
    assert.equal(result.truncated, false)
    assert.ok(result.photos[0]!.senderName)
    assert.deepEqual(result.photos[0], {
      id: newer.id,
      messageId: newer.messageId,
      room: { id: planning, type: 'department', name: '기획부' },
      senderId: head,
      senderName: result.photos[0]!.senderName,
      sentAt: '2026-05-01T00:00:00.000Z',
    })
    assert.ok(!ids(result).includes(hidden.id))
    // 회장도 기획부방 참여자가 아니면 그 사진을 받지 않는다(물려받지 않는다).
    assert.ok(!ids(await s.listed('s-president')).includes(newer.id))
    assert.deepEqual(ids(await s.listed('s-financeMember')), [hidden.id])
  }),
)

test(
  '들어오기 전 사진, 방에서 빠진 뒤의 사진, 지운 메시지의 사진은 없다',
  run(async s => {
    const planning = await s.roomId(s.council.councilId, '기획부')
    const head = s.person.planningHead.memberId
    const before = await s.photo(s.council.councilId, planning, head, '2026-02-01T00:00:00Z')
    const after = await s.photo(s.council.councilId, planning, head, '2026-04-01T00:00:00Z')
    const gone = await s.photo(s.council.councilId, planning, head, '2026-04-02T00:00:00Z')
    const seen = await s.listed('s-planningMember')
    assert.deepEqual(ids(seen), [gone.id, after.id])
    assert.ok(!ids(seen).includes(before.id))
    await s.pg.query('DELETE FROM file WHERE attached_to_id = $1', [gone.messageId])
    await s.pg.query('DELETE FROM message WHERE id = $1', [gone.messageId])
    assert.deepEqual(ids(await s.listed('s-planningMember')), [after.id])
    await s.pg.query('DELETE FROM room_membership WHERE member_id = $1', [
      s.person.planningMember.memberId,
    ])
    assert.deepEqual(ids(await s.listed('s-planningMember')), [])
  }),
)

test(
  '같은 기수의 공지 사진은 들어오기 전 것도 있고 공지를 떼거나 기수 밖이면 없다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const president = s.person.president.memberId
    await s.pg.query(`UPDATE room_membership SET joined_at = '2026-07-01T00:00:00Z'`)
    const notice = await s.noticePhoto(s.council.councilId, all, president, SAME_TIME)
    const plain = await s.photo(s.council.councilId, all, president, SAME_TIME)
    const outside = await s.noticePhoto(s.council.councilId, all, president, '2025-06-01T00:00:00Z')
    const seen = await s.listed('s-plain')
    assert.deepEqual(ids(seen), [notice.id])
    assert.ok(!ids(seen).includes(plain.id) && !ids(seen).includes(outside.id))
    await s.pg.query('UPDATE message SET is_notice = false WHERE id = $1', [notice.messageId])
    assert.deepEqual(ids(await s.listed('s-plain')), [])
  }),
)

test(
  '다른 학생회의 사진은 같은 시각의 공지이고 내게 참여 줄이 있어도 없다',
  run(async s => {
    const mine = await s.roomId(s.council.councilId, 'all')
    const theirs = await s.roomId(s.other.councilId, 'all')
    const president = s.person.president.memberId
    const own = await s.noticePhoto(s.council.councilId, mine, president, SAME_TIME)
    const foreign = await s.noticePhoto(
      s.other.councilId,
      theirs,
      s.other.people.president.memberId,
      SAME_TIME,
    )
    await s.db
      .insert(roomMembership)
      .values({ roomId: theirs, memberId: president, joinedAt: new Date(JOINED) })
    const result = await s.listed('s-president')
    assert.deepEqual(ids(result), [own.id])
    assert.deepEqual(ids(await s.listed('o-president', s.otherBase)), [foreign.id])
  }),
)

test(
  '60장을 넘으면 최근 60장과 truncated이고 정확히 60장이면 아니다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const president = s.person.president.memberId
    for (let n = 0; n < CHAT_PHOTO_LIST_MAX; n += 1) {
      const at = new Date(Date.UTC(2026, 5, 1, 0, n)).toISOString()
      await s.photo(s.council.councilId, all, president, at)
    }
    const exact = await s.listed('s-president')
    assert.equal(exact.photos.length, CHAT_PHOTO_LIST_MAX)
    assert.equal(exact.truncated, false)
    const newest = await s.photo(s.council.councilId, all, president, '2026-06-02T00:00:00Z')
    const over = await s.listed('s-president')
    assert.equal(over.photos.length, CHAT_PHOTO_LIST_MAX)
    assert.equal(over.truncated, true)
    assert.equal(over.photos[0]!.id, newest.id)
  }),
)

test(
  '1:1 방은 상대 이름으로 나오고 운영진이 아니면 403, 로그인하지 않으면 401이다',
  run(async s => {
    const a = s.person.planningHead.memberId
    const b = s.person.financeMember.memberId
    const room = await s.db.transaction(async tx => {
      const id = await createRecord(tx, {
        kind: 'chat_room',
        councilId: s.council.councilId,
        actor: a,
        values: { type: 'direct' },
      })
      await tx
        .insert(roomMembership)
        .values([a, b].map(memberId => ({ roomId: id, memberId, joinedAt: new Date(JOINED) })))
      return id
    })
    await s.photo(s.council.councilId, room, a, SAME_TIME)
    const result = await s.listed('s-financeMember')
    assert.equal(result.photos[0]!.room.type, 'direct')
    assert.equal(result.photos[0]!.room.name, result.photos[0]!.senderName)
    assert.equal((await s.list('o-president')).status, 403)
    assert.equal((await s.list()).status, 401)
  }),
)
