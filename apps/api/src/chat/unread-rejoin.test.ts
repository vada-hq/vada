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
import { createInviteRoutes } from '../invites/routes.js'
import { createRecord } from '../records/records.js'
import { createTeamRoutes } from '../team/routes.js'
import { addUser } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createChatRoutes } from './routes.js'

// 재현: 내보내졌다가 같은 계정으로 초대 코드로 다시 들어온 사람의 대화 합계 배지(unreadTotal).
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
  const roomOf = async (type: string) =>
    (
      await pg.query<{ id: string }>(
        `SELECT cr.id FROM chat_room cr JOIN record r ON r.id = cr.id
          WHERE r.council_id = $1 AND cr.type = $2 AND cr.event_id IS NULL`,
        [councilId, type],
      )
    ).rows[0]!.id
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
    await s.post(`/members/${lee}/remove`, {})
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

test('지운 메시지도 안 읽은 수에 남는다(부름은 빠진다) — 지금 동작 기록', async () => {
  const s = await start()
  try {
    await s.join('lee')
    const kim = await s.memberOf('kim')
    const lee = await s.memberOf('lee')
    await s.setJoined(lee, '2026-03-01T00:00:00Z')
    const all = await s.roomOf('all_members')
    const id = await s.send(all, kim, '2026-04-01T00:00:00Z')
    await s.pg.query('UPDATE message SET deleted_at = now(), body = NULL WHERE id = $1', [id])
    assert.equal(allOf(await s.list('lee')).unread, 1)
  } finally {
    await s.testDb.close()
  }
})
