import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import {
  type ChatMessage,
  type ExpenseDetail,
  type MessagePageResponse,
  type PhotoUploadResponse,
  type RoomListResponse,
} from '@vada/contracts'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import { createExpenseRoutes } from '../expenses/routes.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { fakeStorage } from '../test-support/storage.js'
import { createChatRoutes } from './routes.js'
import { noticeStagesOf } from './stage.js'

const NOW = new Date('2026-10-25T03:00:00Z')
const WRITER = 's-planningMember'
const BODY = '내 계좌로 보내 주세요'

async function start() {
  const kit = await createTestDb()
  const council = await seedCouncil(kit.db, kit.pg)
  const other = await seedCouncil(kit.db, kit.pg, 'o')
  const store = fakeStorage()
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      chat: createChatRoutes(kit.db, testSession, { clock: () => NOW, storage: store.storage }),
      expenses: createExpenseRoutes(kit.db, testSession, {
        clock: () => NOW,
        storage: store.storage,
        receiptKey: 'test-receipt-key',
      }),
    }),
  )
  const base = `/api/organizations/${council.councilId}`
  const rooms = (await (await api.get(`${base}/rooms`, WRITER)).json()) as RoomListResponse
  await kit.pg.query("UPDATE room_membership SET joined_at = '2026-03-01T00:00:00Z'")
  const room = rooms.rooms.find(item => item.type === 'all_members')!.id
  const send = async (roomId = room, photo = false) => {
    let key: string | undefined
    if (photo) {
      const upload = (await (
        await api.post(`${base}/rooms/${roomId}/uploads`, {}, WRITER)
      ).json()) as PhotoUploadResponse
      key = upload.key
      store.put(key)
    }
    const sent = await api.post(
      `${base}/rooms/${roomId}/messages`,
      { body: BODY, photos: key ? [key] : [] },
      WRITER,
    )
    assert.equal(sent.status, 201)
    return { message: (await sent.json()) as ChatMessage, key }
  }
  const remove = (id: string, user: string | undefined = WRITER, at = base) =>
    api.post(`${at}/messages/${id}/delete`, {}, user)
  return { ...kit, council, other, store, api, base, rooms, room, send, remove }
}
type Kit = Awaited<ReturnType<typeof start>>
const run = (body: (s: Kit) => Promise<void>) => async () => {
  const s = await start()
  try {
    await body(s)
  } finally {
    await s.close()
  }
}

test(
  '보내기·최신/이후 쪽 읽기는 보는 사람의 삭제 동작을 주고 삭제 뒤에는 비운다',
  run(async s => {
    const first = await s.send()
    const second = await s.send()
    assert.deepEqual(second.message.actions, ['message.delete'])
    for (const user of [WRITER, 's-president', 's-plain']) {
      for (const query of ['', `?after=${first.message.id}`]) {
        const response = await s.api.get(`${s.base}/rooms/${s.room}/messages${query}`, user)
        assert.equal(response.status, 200)
        const page = (await response.json()) as MessagePageResponse
        assert.deepEqual(
          page.messages.find(item => item.id === second.message.id)!.actions,
          user === WRITER ? ['message.delete'] : [],
        )
      }
    }
    const deleted = (await (await s.remove(second.message.id)).json()) as ChatMessage
    assert.deepEqual(deleted.actions, [])
    const page = (await (
      await s.api.get(`${s.base}/rooms/${s.room}/messages`, WRITER)
    ).json()) as MessagePageResponse
    assert.deepEqual(page.messages.find(item => item.id === second.message.id)!.actions, [])
  }),
)

test(
  '그만두는 학생회의 메시지는 읽히지만 삭제 동작이 없고 서버도 삭제를 거절한다',
  run(async s => {
    const { message } = await s.send()
    await s.pg.query('UPDATE council SET closing_requested_at = $1 WHERE id = $2', [
      NOW,
      s.council.councilId,
    ])
    const response = await s.api.get(`${s.base}/rooms/${s.room}/messages`, WRITER)
    assert.equal(response.status, 200)
    const page = (await response.json()) as MessagePageResponse
    assert.equal(page.messages[0]!.body, BODY)
    assert.deepEqual(page.messages[0]!.actions, [])
    const rejected = await s.remove(message.id)
    assert.equal(rejected.status, 409)
    assert.deepEqual(await rejected.json(), { error: 'COUNCIL_CLOSING' })
  }),
)

test(
  '쓴 사람만 삭제: 남의 메시지·다른 학생회·없는 번호는 404, 미인증은 401이고 바뀌지 않는다',
  run(async s => {
    const { message } = await s.send()
    for (const user of ['s-president', 's-financeMember', 'o-planningMember'])
      assert.equal((await s.remove(message.id, user)).status, 404, user)
    assert.equal(
      (await s.remove(message.id, WRITER, `/api/organizations/${s.other.councilId}`)).status,
      404,
    )
    for (const id of [randomUUID(), 'missing']) assert.equal((await s.remove(id)).status, 404)
    assert.equal((await s.api.post(`${s.base}/messages/${message.id}/delete`, {})).status, 401)
    const row = await s.pg.query('SELECT body, deleted_at FROM message WHERE id = $1', [message.id])
    assert.deepEqual(row.rows, [{ body: BODY, deleted_at: null }])
  }),
)

test(
  '쓴 사람이어도 참여하지 않거나 들어오기 전 메시지는 404이고 삭제하지 않는다',
  run(async s => {
    const room = s.rooms.rooms.find(item => item.type === 'department')!.id
    const { message } = await s.send(room)
    const memberId = s.council.people.planningMember.memberId
    await s.pg.query(
      "UPDATE room_membership SET joined_at = (SELECT sent_at + interval '1 microsecond' FROM message WHERE id = $3) WHERE room_id = $1 AND member_id = $2",
      [room, memberId, message.id],
    )
    assert.equal((await s.remove(message.id)).status, 404)
    await s.pg.query('DELETE FROM room_membership WHERE room_id = $1 AND member_id = $2', [
      room,
      memberId,
    ])
    assert.equal((await s.remove(message.id)).status, 404)
  }),
)

test(
  '기간 제한 없이 삭제하고 모든 판·사진을 비우며 지운 사람은 나·사유 없음, 공지 결과는 excluded, 다른 사람의 다음 읽기도 같다',
  run(async s => {
    const { message, key } = await s.send(s.room, true)
    await s.pg.query("UPDATE message SET sent_at = '2026-03-02T00:00:00Z' WHERE id = $1", [
      message.id,
    ])
    let committed = false
    const remove = s.store.storage.remove.bind(s.store.storage)
    s.store.storage.remove = async key => {
      const row = await s.pg.query<{ body: string | null }>(
        'SELECT body FROM message WHERE id = $1',
        [message.id],
      )
      committed = row.rows[0]!.body === null
      await remove(key)
    }
    const response = await s.remove(message.id)
    assert.equal(response.status, 200)
    const deleted = (await response.json()) as ChatMessage
    assert.equal(deleted.body, null)
    assert.ok(deleted.deletedAt)
    assert.deepEqual(deleted.photos, [])
    assert.ok(committed, '객체 삭제 전에 DB가 커밋된다')
    assert.deepEqual(s.store.removed, [key])
    const versions = await s.pg.query<{ data: Record<string, unknown> }>(
      'SELECT data FROM record_version WHERE record_id = ANY($1)',
      [[message.id, message.photos[0]!.id]],
    )
    for (const row of versions.rows) {
      assert.ok(!JSON.stringify(row.data).includes(BODY))
      assert.ok(!JSON.stringify(row.data).includes(key!))
      assert.ok(!JSON.stringify(row.data).includes('photo-1.jpg'))
    }
    const last = await s.pg.query(
      'SELECT changed_by, reason FROM record_version WHERE record_id = $1 ORDER BY version_no DESC LIMIT 1',
      [message.id],
    )
    assert.deepEqual(last.rows, [
      { changed_by: s.council.people.planningMember.memberId, reason: null },
    ])
    const files = await s.pg.query('SELECT name, storage_key FROM file WHERE id = $1', [
      message.photos[0]!.id,
    ])
    assert.deepEqual(files.rows, [{ name: null, storage_key: null }])
    assert.equal((await noticeStagesOf(s.db, [message.id])).get(message.id), 'excluded')
    const page = (await (
      await s.api.get(`${s.base}/rooms/${s.room}/messages`, 's-plain')
    ).json()) as MessagePageResponse
    assert.equal(page.messages.find(item => item.id === message.id)!.body, null)
    assert.equal((await s.api.get(`${s.base}/files/${message.photos[0]!.id}`, WRITER)).status, 404)
    const before = await s.pg.query(
      'SELECT * FROM record_version WHERE record_id = ANY($1) ORDER BY record_id, version_no',
      [[message.id, message.photos[0]!.id]],
    )
    assert.equal((await s.remove(message.id)).status, 200)
    const after = await s.pg.query(
      'SELECT * FROM record_version WHERE record_id = ANY($1) ORDER BY record_id, version_no',
      [[message.id, message.photos[0]!.id]],
    )
    assert.deepEqual(after.rows, before.rows)
    assert.deepEqual(s.store.removed, [key])
  }),
)

test(
  '근거 메시지를 삭제해도 지출과 증빙 복사본이 남고 근거는 삭제된 메시지다',
  run(async s => {
    const { message } = await s.send(s.room, true)
    const created = await s.api.post(
      `${s.base}/expenses`,
      {
        method: 'card',
        vendor: '다이소',
        description: '마커',
        amount: 1000,
        paidOn: '2026-10-25',
        sourceMessageId: message.id,
      },
      's-financeMember',
    )
    assert.equal(created.status, 201)
    const { expense } = (await created.json()) as { expense: ExpenseDetail }
    const attached = await s.api.post(
      `${s.base}/expenses/${expense.id}/evidence/from-chat`,
      { photoId: message.photos[0]!.id },
      's-financeMember',
    )
    assert.equal(attached.status, 201)
    const fileId = ((await attached.json()) as { expense: ExpenseDetail }).expense.evidence[0]!
      .fileId
    assert.equal((await s.remove(message.id)).status, 200)
    const detail = await s.api.get(`${s.base}/expenses/${expense.id}`, 's-financeMember')
    assert.equal(detail.status, 200)
    const source = await s.pg.query(
      'SELECT m.body, m.deleted_at IS NOT NULL AS deleted FROM evidence_link e JOIN message m ON m.id = e.message_id WHERE e.record_id = $1',
      [expense.id],
    )
    assert.deepEqual(source.rows, [{ body: null, deleted: true }])
    assert.equal(
      (await s.api.get(`${s.base}/expenses/${expense.id}/files/${fileId}`, 's-plain')).status,
      302,
    )
    const copy = await s.pg.query<{ storage_key: string }>(
      'SELECT storage_key FROM file WHERE id = $1',
      [fileId],
    )
    assert.ok(s.store.has(copy.rows[0]!.storage_key))
  }),
)

test(
  '저장소 객체를 지우지 못해도 성공하고 메시지를 복구하지 않는다',
  run(async s => {
    const { message, key } = await s.send(s.room, true)
    s.store.storage.remove = async () => {
      throw new Error('STORAGE_DELETE_FAILED')
    }
    assert.equal((await s.remove(message.id)).status, 200)
    assert.ok(s.store.has(key!))
    const row = await s.pg.query('SELECT body FROM message WHERE id = $1', [message.id])
    assert.deepEqual(row.rows, [{ body: null }])
  }),
)

test(
  '동시에 두 번 삭제해도 새 판은 하나만 생기고 사진 객체는 한 번만 지운다',
  run(async s => {
    const { message, key } = await s.send(s.room, true)
    const responses = await Promise.all([s.remove(message.id), s.remove(message.id)])
    assert.deepEqual(
      responses.map(response => response.status),
      [200, 200],
    )
    const versions = await s.pg.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM record_version WHERE record_id = $1',
      [message.id],
    )
    assert.equal(versions.rows[0]!.n, 2)
    assert.deepEqual(s.store.removed, [key])
  }),
)

test(
  'DB 거래가 실패하면 본문·사진·판을 보존하고 저장소 객체도 지우지 않는다',
  run(async s => {
    const { message, key } = await s.send(s.room, true)
    await s.pg.exec(`CREATE FUNCTION reject_message_delete() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.body IS NULL THEN RAISE EXCEPTION 'TEST_ROLLBACK'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER reject_message_delete BEFORE UPDATE ON message FOR EACH ROW EXECUTE FUNCTION reject_message_delete();`)
    assert.equal((await s.remove(message.id)).status, 500)
    const row = await s.pg.query('SELECT body, deleted_at FROM message WHERE id = $1', [message.id])
    assert.deepEqual(row.rows, [{ body: BODY, deleted_at: null }])
    const files = await s.pg.query<{ storage_key: string | null }>(
      'SELECT storage_key FROM file WHERE id = $1',
      [message.photos[0]!.id],
    )
    assert.equal(files.rows[0]!.storage_key, key)
    const versions = await s.pg.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM record_version WHERE record_id = $1',
      [message.id],
    )
    assert.equal(versions.rows[0]!.n, 1)
    assert.deepEqual(s.store.removed, [])
    assert.ok(s.store.has(key!))
  }),
)
