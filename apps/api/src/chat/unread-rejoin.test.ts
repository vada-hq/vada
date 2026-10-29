import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  CreateCouncilResponse,
  InviteCodeResponse,
  RoomListResponse,
  TeamResponse,
} from '@vada/contracts'
import { createApp } from '../app.js'
import { createCouncilRoutes } from '../councils/routes.js'
import { createTestDb } from '../db/test-db.js'
import { createEventRoutes } from '../events/routes.js'
import { createInviteRoutes } from '../invites/routes.js'
import { createRecord } from '../records/records.js'
import { createTeamRoutes } from '../team/routes.js'
import { addUser, markLeft } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createChatRoutes } from './routes.js'

// 내보내졌다가 같은 계정으로 초대 코드로 다시 들어온 사람의 대화 합계 배지(unreadTotal).
// 내보낼 때 공지방 읽음 위치를 남기고(left_room_read) 다시 들어올 때 되살린다. 나가 있던 동안의 공지는 안 읽음이다(DEC-90).
// 한국 시각 2026-10-19 12:00. 기수는 2026년이다.
const now = new Date('2026-10-19T03:00:00Z')

async function start() {
  const testDb = await createTestDb()
  const { pg, db } = testDb
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      councils: createCouncilRoutes(db, testSession, () => now),
      invites: createInviteRoutes(db, testSession, () => now),
      team: createTeamRoutes(db, testSession, () => now),
      events: createEventRoutes(db, testSession, { clock: () => now }),
      chat: createChatRoutes(db, testSession, { clock: () => now }),
    }),
  )
  for (const [id, name] of [
    ['kim', '김회장'],
    ['lee', '이운영'],
  ] as const)
    await addUser(pg, id, { name, email: `${id}@example.test` })
  const created = (await (
    await api.post(
      '/api/organizations/create',
      { name: '컴퓨터학부 학생회', unit: 'department', schoolName: '한양대학교 ERICA', year: 2026 },
      'kim',
    )
  ).json()) as CreateCouncilResponse
  const councilId = created.council.id
  const base = `/api/organizations/${councilId}`
  const { code } = (await (await api.get(`${base}/invite`, 'kim')).json()) as InviteCodeResponse
  const memberOf = async (user: string) =>
    (
      await pg.query<{ member_id: string }>(
        'SELECT member_id FROM member_login WHERE user_id = $1',
        [user],
      )
    ).rows[0]!.member_id
  const join = async (user: string) =>
    assert.equal((await api.post('/api/organizations/join', { code }, user)).status, 200)
  const post = async (path: string, body: unknown) =>
    assert.equal((await api.post(`${base}${path}`, body, 'kim')).status, 200)
  const team = async () => (await (await api.get(`${base}/members`, 'kim')).json()) as TeamResponse
  const list = async (user: string) =>
    (await (await api.get(`${base}/rooms`, user)).json()) as RoomListResponse
  const roomOf = async (type: string, eventId: string | null = null) =>
    (
      await pg.query<{ id: string }>(
        `SELECT cr.id FROM chat_room cr JOIN record r ON r.id = cr.id
          WHERE r.council_id = $1 AND cr.type = $2 AND cr.event_id IS NOT DISTINCT FROM $3`,
        [councilId, type, eventId],
      )
    ).rows[0]!.id
  const createEvent = async () => {
    const response = await api.post(
      `${base}/events`,
      { name: '가을 축제', startsAt: '2026-11-20T10:00', endsAt: '2026-11-20T18:00' },
      'kim',
    )
    assert.equal(response.status, 201)
    return ((await response.json()) as { event: { id: string } }).event.id
  }
  const kept = async (memberId: string) =>
    (
      await pg.query<{ room_id: string }>(
        'SELECT room_id FROM left_room_read WHERE member_id = $1 ORDER BY room_id',
        [memberId],
      )
    ).rows.map(row => row.room_id)
  // 보낸 시각을 정해 메시지를 넣는다(시험이 DB 시계에 기대지 않게).
  const send = (roomId: string, sender: string, at: string) =>
    db.transaction(tx =>
      createRecord(tx, {
        kind: 'message',
        councilId,
        actor: sender,
        values: { roomId, body: `메시지 ${at}`, sentAt: new Date(at) },
      }),
    )
  const markRead = async (user: string, roomId: string, messageId: string) =>
    assert.equal((await api.post(`${base}/rooms/${roomId}/read`, { messageId }, user)).status, 204)
  const setJoined = (memberId: string, at: string) =>
    pg.query('UPDATE room_membership SET joined_at = $2 WHERE member_id = $1', [memberId, at])
  return {
    testDb,
    pg,
    councilId,
    join,
    post,
    team,
    list,
    roomOf,
    createEvent,
    kept,
    send,
    markRead,
    setJoined,
    memberOf,
  }
}

const allOf = (list: RoomListResponse) => list.rooms.find(room => room.type === 'all_members')!

test('다시 들어온 사람의 공지방 안 읽은 수에 나가기 전에 이미 읽은 메시지가 다시 세어지지 않는다', async () => {
  const s = await start()
  try {
    await s.join('lee')
    const kim = await s.memberOf('kim')
    const lee = await s.memberOf('lee')
    await s.setJoined(lee, '2026-03-01T00:00:00Z')
    const all = await s.roomOf('all_members')
    // 나가기 전: 공지 3개를 받고 모두 읽었다.
    await s.send(all, kim, '2026-04-01T00:00:00Z')
    await s.send(all, kim, '2026-04-02T00:00:00Z')
    const lastBefore = await s.send(all, kim, '2026-04-03T00:00:00Z')
    assert.equal(allOf(await s.list('lee')).unread, 3)
    await s.markRead('lee', all, lastBefore)
    assert.equal((await s.list('lee')).unreadTotal, 0)
    // 내보내짐: 공지방 참여 줄이 지워진다(읽은 위치도 함께).
    await s.post(`/members/${lee}/remove`, {})
    // 나가 있던 동안 공지 2개.
    await s.send(all, kim, '2026-05-01T00:00:00Z')
    await s.send(all, kim, '2026-05-02T00:00:00Z')
    // 같은 계정으로 다시 들어옴: 새 참여 줄(들어온 시각 6/1, 읽음 없음).
    await s.join('lee')
    await s.setJoined(lee, '2026-06-01T00:00:00Z')
    const rows = await s.pg.query(
      'SELECT joined_at, last_read_at FROM room_membership WHERE member_id = $1',
      [lee],
    )
    assert.equal(rows.rows.length, 1, '공지방 참여 줄은 하나뿐이다(이중으로 세지 않음)')
    // 다시 들어온 뒤 공지 1개.
    await s.send(all, kim, '2026-06-02T00:00:00Z')
    const after = await s.list('lee')
    // 기대: 나가 있던 동안 2개 + 다시 들어온 뒤 1개 = 3. 이미 읽은 4월의 3개는 다시 세지 않는다.
    assert.equal(allOf(after).unread, 3, `공지방 안 읽은 수 ${allOf(after).unread}`)
    assert.equal(after.unreadTotal, 3, `합계 배지 ${after.unreadTotal}`)
  } finally {
    await s.testDb.close()
  }
})

test('다시 들어온 사람에게 예전 부서방·회장단방 메시지는 세어지지 않는다(참여 줄이 지워지고 돌아오지 않는다)', async () => {
  const s = await start()
  try {
    await s.join('lee')
    const kim = await s.memberOf('kim')
    const lee = await s.memberOf('lee')
    const finance = (await s.team()).departments[0]!.id
    await s.post(`/members/${lee}/departments`, { departmentId: finance, rank: null })
    await s.post(`/members/${lee}/rank`, { rank: 'vice_president' })
    await s.setJoined(lee, '2026-03-01T00:00:00Z')
    const dept = await s.roomOf('department')
    const leadership = await s.roomOf('leadership')
    await s.markRead('lee', dept, await s.send(dept, kim, '2026-04-01T00:00:00Z'))
    await s.post(`/members/${lee}/remove`, {})
    // 부서방은 들어온 뒤의 메시지만 보이므로 읽음 위치를 남기지 않는다.
    assert.deepEqual(await s.kept(lee), [])
    await s.send(dept, kim, '2026-05-01T00:00:00Z')
    await s.send(leadership, kim, '2026-05-01T00:00:00Z')
    await s.join('lee')
    await s.setJoined(lee, '2026-06-01T00:00:00Z')
    await s.send(dept, kim, '2026-06-02T00:00:00Z')
    await s.send(leadership, kim, '2026-06-02T00:00:00Z')
    const after = await s.list('lee')
    assert.deepEqual(
      after.rooms.map(room => room.type),
      ['all_members'],
    )
    assert.equal(after.unreadTotal, 0)
  } finally {
    await s.testDb.close()
  }
})

test('지운 메시지는 안 읽은 수에 세지 않는다(보이지 않는 것은 세지 않음)', async () => {
  const s = await start()
  try {
    await s.join('lee')
    const kim = await s.memberOf('kim')
    const lee = await s.memberOf('lee')
    await s.setJoined(lee, '2026-03-01T00:00:00Z')
    const all = await s.roomOf('all_members')
    const id = await s.send(all, kim, '2026-04-01T00:00:00Z')
    await s.send(all, kim, '2026-04-02T00:00:00Z')
    await s.pg.query('UPDATE message SET deleted_at = now(), body = NULL WHERE id = $1', [id])
    const after = await s.list('lee')
    assert.equal(allOf(after).unread, 1)
    assert.equal(after.unreadTotal, 1)
  } finally {
    await s.testDb.close()
  }
})

test('행사 공지방도 다시 들어오면 읽음 위치가 돌아오고, 되살린 뒤에는 남긴 읽음 위치가 지워진다', async () => {
  const s = await start()
  try {
    await s.join('lee')
    const kim = await s.memberOf('kim')
    const lee = await s.memberOf('lee')
    const eventId = await s.createEvent()
    await s.setJoined(lee, '2026-03-01T00:00:00Z')
    const notice = await s.roomOf('all_members', eventId)
    const read = await s.send(notice, kim, '2026-04-01T00:00:00Z')
    await s.markRead('lee', notice, read)
    await s.post(`/members/${lee}/remove`, {})
    // 읽은 공지방만 남긴다(학생회 공지방은 읽지 않았다).
    assert.deepEqual(await s.kept(lee), [notice])
    await s.send(notice, kim, '2026-05-01T00:00:00Z')
    await s.join('lee')
    await s.setJoined(lee, '2026-06-01T00:00:00Z')
    const event = (await s.list('lee')).rooms.find(room => room.id === notice)!
    assert.equal(event.unread, 1)
    assert.deepEqual(await s.kept(lee), [])
  } finally {
    await s.testDb.close()
  }
})

test('읽은 적 없는 공지방은 읽음 위치를 남기지 않고, 다시 들어오면 같은 기수의 공지가 모두 안 읽음이다', async () => {
  const s = await start()
  try {
    await s.join('lee')
    const kim = await s.memberOf('kim')
    const lee = await s.memberOf('lee')
    const all = await s.roomOf('all_members')
    await s.send(all, kim, '2026-04-01T00:00:00Z')
    await s.post(`/members/${lee}/remove`, {})
    assert.deepEqual(await s.kept(lee), [])
    await s.join('lee')
    assert.equal(allOf(await s.list('lee')).unread, 1)
  } finally {
    await s.testDb.close()
  }
})

// 탈퇴한 사람은 다시 들어올 일이 없다. 보관된 행사 방의 완료를 취소해 방 맞추기가 그 사람을 뺄 때도 읽음 위치를 남기지 않는다.
test('탈퇴한 사람이 방에서 빠지면 읽음 위치를 남기지 않는다', async () => {
  const s = await start()
  try {
    await s.join('lee')
    const kim = await s.memberOf('kim')
    const lee = await s.memberOf('lee')
    const all = await s.roomOf('all_members')
    await s.markRead('lee', all, await s.send(all, kim, '2026-04-01T00:00:00Z'))
    await markLeft(s.pg, lee, '2026-10-18T00:00:00Z')
    await s.post(`/members/${lee}/remove`, {})
    assert.deepEqual(await s.kept(lee), [])
  } finally {
    await s.testDb.close()
  }
})
