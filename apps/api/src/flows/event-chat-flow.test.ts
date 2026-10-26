import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  ChatMessage,
  EventRoomsResponse,
  MessagePageResponse,
  PurchaseRequestResponse,
  RoomListResponse,
} from '@vada/contracts'
import { createTestDb } from '../db/test-db.js'
import { fakeStorage } from '../test-support/storage.js'
import { createPerson, type Person } from './people.js'
import { rehearsalStart, runRehearsal } from './rehearsal.js'
import { startFlow } from './server.js'

const FINAL = new Date('2026-11-03T03:00:00Z')
const get = async <T>(person: Person, path: string) => {
  const response = await person.api.get(path)
  assert.equal(response.status, 200)
  return (await response.json()) as T
}

// 계정 이후 모든 행사·소속·대화·구매·정산은 기존 HTTP 리허설로 만들고, SQL은 저장된 근거 연결 확인에만 쓴다.
test('행사 대화에서 구매 요청을 내고 정산 완료 후 보관하며 완료 취소 뒤 다시 대화한다', async () => {
  const { db, pg, close } = await createTestDb()
  const fake = fakeStorage()
  try {
    const flow = await startFlow(db, {
      start: rehearsalStart(FINAL),
      scope: 'connection',
      storage: fake.storage,
    })
    const chief = await createPerson(flow, 'event-chat-chief', '회장', { googleLinked: true })
    const {
      state: { cast, w },
    } = await runRehearsal(flow, { chief, finalAt: FINAL, uploadEvidence: key => fake.put(key) })
    const base = `/api/organizations/${w.councilId}`
    const request = await get<PurchaseRequestResponse>(
      cast.planner,
      `${base}/purchase-requests/${w.requestId}`,
    )
    assert.equal(request.request.event?.id, w.eventId)
    const source = await pg.query<{ event_id: string; room_id: string }>(
      'SELECT cr.event_id, cr.id AS room_id FROM message m JOIN chat_room cr ON cr.id = m.room_id WHERE m.id = $1',
      [w.messageId],
    )
    assert.equal(source.rows[0]?.event_id, w.eventId)
    const evidence = await pg.query<{ message_id: string }>(
      'SELECT message_id FROM evidence_link WHERE record_id = $1',
      [w.requestId],
    )
    assert.deepEqual(
      evidence.rows.map(row => row.message_id),
      [w.messageId],
    )
    const rooms = await get<EventRoomsResponse>(cast.planHead, `${base}/events/${w.eventId}/rooms`)
    assert.equal(rooms.archived, true)
    assert.ok(rooms.rooms.some(room => room.type === 'all_members'))
    assert.ok(rooms.rooms.some(room => room.id === source.rows[0]!.room_id && room.readOnly))
    const roomId = source.rows[0].room_id
    const history = await get<MessagePageResponse>(
      cast.planHead,
      `${base}/rooms/${roomId}/messages`,
    )
    assert.ok(history.messages.some(message => message.id === w.messageId))
    const list = await get<RoomListResponse>(cast.planner, `${base}/rooms`)
    assert.ok(list.rooms.every(room => room.eventId !== w.eventId))
    const blocked = await cast.planner.api.post(`${base}/rooms/${roomId}/messages`, {
      body: '완료 뒤에는 보낼 수 없음',
    })
    assert.equal(blocked.status, 409)
    assert.deepEqual(await blocked.json(), { error: 'ROOM_ARCHIVED' })
    const reopened = await chief.api.post(`${base}/events/${w.eventId}/cancel-completion`, {
      reason: '추가 준비',
    })
    assert.equal(reopened.status, 200)
    const sent = await cast.planHead.api.post(`${base}/rooms/${roomId}/messages`, {
      body: '추가 준비를 이어갑니다',
    })
    assert.equal(sent.status, 201)
    const message = (await sent.json()) as ChatMessage
    const received = await get<MessagePageResponse>(
      cast.planner,
      `${base}/rooms/${roomId}/messages`,
    )
    assert.ok(received.messages.some(row => row.id === message.id))
  } finally {
    await close()
  }
})
