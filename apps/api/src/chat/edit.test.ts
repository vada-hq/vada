import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import {
  MESSAGE_BODY_MAX,
  type ChatMessage,
  type MessagePageResponse,
  type RoomListResponse,
} from '@vada/contracts'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import { evidenceLink } from '../db/schema.js'
import { createRecord } from '../records/records.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { fakeStorage } from '../test-support/storage.js'
import { createChatRoutes } from './routes.js'

const NOW = new Date('2026-10-25T03:00:00Z')
const WRITER = 's-planningMember'
const OLD = '원래 글'
const NEW = '@새이름 고친 글'

async function start() {
  const kit = await createTestDb()
  const council = await seedCouncil(kit.db, kit.pg)
  const other = await seedCouncil(kit.db, kit.pg, 'o')
  const store = fakeStorage()
  const notifications: string[] = []
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      chat: createChatRoutes(kit.db, testSession, {
        clock: () => NOW,
        storage: store.storage,
        push: {
          seen: () => {},
          notify: async id => {
            notifications.push(id)
          },
        },
      }),
    }),
  )
  const base = `/api/organizations/${council.councilId}`
  const rooms = (await (await api.get(`${base}/rooms`, WRITER)).json()) as RoomListResponse
  await kit.pg.query("UPDATE room_membership SET joined_at = '2026-03-01T00:00:00Z'")
  const room = rooms.rooms.find(item => item.type === 'all_members')!.id
  const send = async (at = room) => {
    const response = await api.post(`${base}/rooms/${at}/messages`, { body: OLD }, WRITER)
    assert.equal(response.status, 201)
    return (await response.json()) as ChatMessage
  }
  const edit = (
    id: string,
    body: unknown = { body: NEW },
    user: string | undefined = WRITER,
    at = base,
  ) => api.post(`${at}/messages/${id}`, body, user)
  const page = async (at = room, user = WRITER) =>
    (await (await api.get(`${base}/rooms/${at}/messages`, user)).json()) as MessagePageResponse
  return { ...kit, council, other, store, api, base, rooms, room, send, edit, page, notifications }
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
  '내 글을 고치면 새 본문·고친 시각·내가 바꾼 판이 생기고 같은 글은 판을 늘리지 않는다',
  run(async s => {
    const sent = await s.send()
    assert.equal(sent.editedAt, null)
    assert.deepEqual(sent.actions, ['message.delete', 'message.edit'])
    assert.deepEqual(await (await s.edit(sent.id, { body: OLD })).json(), sent)
    const response = await s.edit(sent.id)
    assert.equal(response.status, 200)
    const edited = (await response.json()) as ChatMessage
    assert.equal(edited.body, NEW)
    assert.ok(edited.editedAt)
    assert.equal(edited.sentAt, sent.sentAt)
    const versions = await s.pg.query<{
      data: { body: string }
      changed_by: string
      reason: string | null
    }>(
      'SELECT data, changed_by, reason FROM record_version WHERE record_id = $1 ORDER BY version_no',
      [sent.id],
    )
    assert.equal(versions.rows.length, 2)
    assert.equal(versions.rows[0]!.data.body, OLD)
    assert.equal(versions.rows[1]!.data.body, NEW)
    assert.equal(versions.rows[1]!.changed_by, s.council.people.planningMember.memberId)
    assert.equal(versions.rows[1]!.reason, null)
    const again = await s.edit(sent.id)
    assert.deepEqual(await again.json(), edited)
    assert.deepEqual(
      (
        await s.pg.query(
          'SELECT data, changed_by, reason FROM record_version WHERE record_id = $1 ORDER BY version_no',
          [sent.id],
        )
      ).rows,
      versions.rows,
    )
    const others = await s.page(s.room, 's-plain')
    assert.equal(others.messages[0]!.editedAt, edited.editedAt)
    assert.deepEqual(others.messages[0]!.actions, [])
  }),
)

test(
  '남의 글·다른 학생회·없는 번호·안 보이는 글은 404, 미인증은 401이며 원문을 보존한다',
  run(async s => {
    const room = s.rooms.rooms.find(item => item.type === 'department')!.id
    const sent = await s.send(room)
    for (const user of ['s-president', 's-financeMember', 'o-planningMember'])
      assert.equal((await s.edit(sent.id, { body: NEW }, user)).status, 404)
    assert.equal(
      (await s.edit(sent.id, { body: NEW }, WRITER, `/api/organizations/${s.other.councilId}`))
        .status,
      404,
    )
    for (const id of [randomUUID(), 'missing']) assert.equal((await s.edit(id)).status, 404)
    assert.equal((await s.api.post(`${s.base}/messages/${sent.id}`, { body: NEW })).status, 401)
    await s.pg.query(
      "UPDATE room_membership SET joined_at = (SELECT sent_at + interval '1 microsecond' FROM message WHERE id = $1) WHERE room_id = $2",
      [sent.id, room],
    )
    assert.equal((await s.edit(sent.id)).status, 404)
    await s.pg.query('DELETE FROM room_membership WHERE room_id = $1', [room])
    assert.equal((await s.edit(sent.id)).status, 404)
    assert.deepEqual(
      (await s.pg.query('SELECT body, edited_at FROM message WHERE id = $1', [sent.id])).rows,
      [{ body: OLD, edited_at: null }],
    )
  }),
)

test(
  '빈 글·공백·상한 초과·NUL·홀로 쓴 서로게이트·모르는 키는 400이다',
  run(async s => {
    const sent = await s.send()
    for (const body of [
      {},
      { body: '' },
      { body: '  ' },
      { body: 'a'.repeat(MESSAGE_BODY_MAX + 1) },
      { body: '😀'.repeat(MESSAGE_BODY_MAX + 1) },
      { body: 'a\u0000' },
      { body: 'a\uD800' },
      { body: NEW, mentions: [] },
    ])
      assert.equal((await s.edit(sent.id, body)).status, 400, JSON.stringify(body))
    assert.equal((await s.edit(sent.id, { body: '😀'.repeat(MESSAGE_BODY_MAX) })).status, 200)
  }),
)

test(
  '고친 뒤 삭제하면 어느 판에도 옛 글과 새 글이 없고 다시 고칠 수 없다',
  run(async s => {
    const sent = await s.send()
    assert.equal((await s.edit(sent.id)).status, 200)
    assert.equal((await s.api.post(`${s.base}/messages/${sent.id}/delete`, {}, WRITER)).status, 200)
    assert.equal((await s.edit(sent.id)).status, 404)
    const versions = await s.pg.query<{ data: { body: unknown } }>(
      'SELECT data FROM record_version WHERE record_id = $1',
      [sent.id],
    )
    assert.equal(versions.rows.length, 3)
    for (const { data } of versions.rows) assert.equal(data.body, null)
    assert.deepEqual((await s.pg.query('SELECT body FROM message WHERE id = $1', [sent.id])).rows, [
      { body: null },
    ])
  }),
)

test(
  '학생회가 그만두는 중이면 읽기는 유지하고 고치기만 409로 막는다',
  run(async s => {
    const sent = await s.send()
    await s.pg.query('UPDATE council SET closing_requested_at = $1 WHERE id = $2', [
      NOW.toISOString(),
      s.council.councilId,
    ])
    assert.deepEqual((await s.page()).messages[0]!.actions, [])
    const response = await s.edit(sent.id)
    assert.equal(response.status, 409)
    assert.deepEqual(await response.json(), { error: 'COUNCIL_CLOSING' })
  }),
)

test(
  '반려·취소를 포함한 근거 연결은 하나라도 있으면 메뉴와 고치기를 함께 막고 삭제는 허용한다',
  run(async s => {
    for (const [kind, status] of [
      ['request', 'pending'],
      ['request', 'rejected'],
      ['request', 'cancelled'],
      ['expense', 'pending'],
      ['expense', 'cancelled'],
    ] as const) {
      const sent = await s.send()
      await s.db.transaction(async tx => {
        const by = {
          councilId: s.council.councilId,
          actor: s.council.people.planningMember.memberId,
        }
        const id =
          kind === 'request'
            ? await createRecord(tx, {
                ...by,
                kind,
                values: {
                  type: 'purchase',
                  title: kind,
                  requestedBy: by.actor,
                  cancelledAt: status === 'cancelled' ? NOW : null,
                },
              })
            : await createRecord(tx, {
                ...by,
                kind,
                values: {
                  amount: '1000',
                  paidAt: NOW,
                  description: '지출',
                  vendor: '상점',
                  method: 'card',
                  cancelledAt: status === 'cancelled' ? NOW : null,
                },
              })
        if (kind === 'request') {
          const itemId = await createRecord(tx, {
            ...by,
            kind: 'line_item',
            values: { requestId: id, name: '품목', quantity: 1 },
          })
          if (status === 'rejected')
            await createRecord(tx, {
              ...by,
              kind: 'approval',
              values: {
                targetId: itemId,
                targetKind: 'line_item',
                outcome: 'rejected',
                actorId: by.actor,
                actorKind: 'member',
                actedAt: NOW,
              },
            })
        }
        await tx.insert(evidenceLink).values({ recordId: id, messageId: sent.id })
      })
      const shown = (await s.page()).messages.find(m => m.id === sent.id)!
      assert.deepEqual(shown.actions, ['message.delete'])
      assert.equal(shown.made[0]!.blocking, status === 'pending')
      const response = await s.edit(sent.id)
      assert.equal(response.status, 409)
      assert.deepEqual(await response.json(), { error: 'MESSAGE_LINKED' })
      assert.equal(
        (await s.api.post(`${s.base}/messages/${sent.id}/delete`, {}, WRITER)).status,
        200,
      )
    }
  }),
)

test(
  '고쳐도 마지막 시각·안 읽은 수·읽음 표지·알림은 그대로다',
  run(async s => {
    const sent = await s.send()
    const list = async () =>
      (await (await s.api.get(`${s.base}/rooms`, 's-plain')).json()) as RoomListResponse
    const before = await list()
    const markers = await s.pg.query('SELECT * FROM room_membership ORDER BY room_id, member_id')
    const notifications = await s.pg.query('SELECT * FROM notification ORDER BY id')
    const pushes = [...s.notifications]
    assert.equal((await s.edit(sent.id)).status, 200)
    const after = await list()
    assert.equal(after.unreadTotal, before.unreadTotal)
    assert.equal(after.mentionTotal, before.mentionTotal)
    assert.equal(
      after.rooms.find(r => r.id === s.room)!.lastMessageAt,
      before.rooms.find(r => r.id === s.room)!.lastMessageAt,
    )
    assert.deepEqual(
      (await s.pg.query('SELECT * FROM room_membership ORDER BY room_id, member_id')).rows,
      markers.rows,
    )
    assert.deepEqual(
      (await s.pg.query('SELECT * FROM notification ORDER BY id')).rows,
      notifications.rows,
    )
    assert.deepEqual(s.notifications, pushes)
  }),
)

test(
  '보관된 행사 방은 읽기와 삭제만 허용하며 고치기는 ROOM_ARCHIVED다',
  run(async s => {
    const eventId = await s.db.transaction(tx =>
      createRecord(tx, {
        kind: 'event',
        councilId: s.council.councilId,
        actor: s.council.people.president.memberId,
        values: { name: '지난 행사' },
      }),
    )
    const room = s.rooms.rooms.find(item => item.type === 'department')!.id
    const sent = await s.send(room)
    await s.pg.query('UPDATE chat_room SET event_id = $1 WHERE id = $2', [eventId, room])
    await s.db.transaction(tx =>
      createRecord(tx, {
        kind: 'approval',
        councilId: s.council.councilId,
        actor: s.council.people.president.memberId,
        values: {
          targetId: eventId,
          targetKind: 'event',
          outcome: 'completed',
          actorId: s.council.people.president.memberId,
          actorKind: 'member',
          actedAt: NOW,
        },
      }),
    )
    const response = await s.edit(sent.id)
    assert.equal(response.status, 409)
    assert.deepEqual(await response.json(), { error: 'ROOM_ARCHIVED' })
    assert.deepEqual((await s.page(room)).messages[0]!.actions, ['message.delete'])
  }),
)

test(
  '사진만 있는 글은 고칠 수 없고 글과 사진이 함께 있으면 사진을 보존한다',
  run(async s => {
    for (const body of [undefined, OLD]) {
      const upload = await s.api.post(`${s.base}/rooms/${s.room}/uploads`, {}, WRITER)
      const { key } = (await upload.json()) as { key: string }
      s.store.put(key)
      const response = await s.api.post(
        `${s.base}/rooms/${s.room}/messages`,
        { body, photos: [key] },
        WRITER,
      )
      assert.equal(response.status, 201)
      const sent = (await response.json()) as ChatMessage
      assert.equal(sent.photos.length, 1)
      const files = await s.pg.query('SELECT * FROM file WHERE attached_to_id = $1', [sent.id])
      const edited = await s.edit(sent.id)
      if (body === undefined) {
        assert.deepEqual(sent.actions, ['message.delete'])
        assert.equal(edited.status, 409)
        assert.deepEqual(await edited.json(), { error: 'MESSAGE_INVALID' })
      } else {
        assert.equal(edited.status, 200)
        assert.deepEqual(((await edited.json()) as ChatMessage).photos, sent.photos)
      }
      assert.deepEqual(
        (await s.pg.query('SELECT * FROM file WHERE attached_to_id = $1', [sent.id])).rows,
        files.rows,
      )
      assert.ok(s.store.has(key))
      assert.deepEqual(s.store.removed, [])
    }
  }),
)

test(
  '상대가 떠난 읽기 전용 1:1에서도 내 말은 고칠 수 있다',
  run(async s => {
    const peerId = s.council.people.plain.memberId
    const opened = await s.api.post(`${s.base}/direct`, { memberId: peerId }, WRITER)
    const { roomId } = (await opened.json()) as { roomId: string }
    const sent = await s.send(roomId)
    await s.pg.query(
      'UPDATE council_membership SET ends_at = clock_timestamp() WHERE member_id = $1',
      [peerId],
    )
    const rooms = (await (await s.api.get(`${s.base}/rooms`, WRITER)).json()) as RoomListResponse
    assert.equal(rooms.rooms.find(room => room.id === roomId)!.readOnly, true)
    assert.deepEqual((await s.page(roomId)).messages[0]!.actions, [
      'message.delete',
      'message.edit',
    ])
    const edited = await s.edit(sent.id)
    assert.equal(edited.status, 200)
    assert.equal(((await edited.json()) as ChatMessage).body, NEW)
  }),
)

test(
  '목록의 근거 연결은 메시지마다 읽지 않고 한 번에 읽으며 수정은 행 잠금 뒤에 확인한다',
  run(async s => {
    const sent = await s.send()
    await s.send()
    const queries: string[] = []
    const logged = s.drizzle({ logger: { logQuery: query => void queries.push(query) } })
    const api = caller(
      createApp({
        auth: { handler: async () => new Response() },
        trustedOrigin: ORIGIN,
        chat: createChatRoutes(logged, testSession, { clock: () => NOW }),
      }),
    )
    const links = () =>
      queries.filter(
        query => query.includes('from "evidence_link"') && !query.includes('inner join'),
      )
    assert.equal((await api.get(`${s.base}/rooms/${s.room}/messages`, WRITER)).status, 200)
    assert.equal(links().length, 1)
    assert.match(links()[0]!, /"message_id" in \(\$\d+, \$\d+\)/)
    queries.length = 0
    assert.equal(
      (await api.post(`${s.base}/messages/${sent.id}`, { body: NEW }, WRITER)).status,
      200,
    )
    const lockedAt = queries.findIndex(query => query.includes('for update of "message"'))
    assert.ok(lockedAt >= 0)
    assert.ok(queries.indexOf(links()[0]!) > lockedAt)
  }),
)

test(
  '동시에 고쳐도 판을 두 번 남기고 DB 오류는 본문과 판을 함께 되돌린다',
  run(async s => {
    const sent = await s.send()
    const responses = await Promise.all([
      s.edit(sent.id, { body: '수정 1' }),
      s.edit(sent.id, { body: '수정 2' }),
    ])
    assert.deepEqual(
      responses.map(r => r.status),
      [200, 200],
    )
    const before = await s.pg.query(
      'SELECT * FROM record_version WHERE record_id = $1 ORDER BY version_no',
      [sent.id],
    )
    const current = await s.pg.query('SELECT body, edited_at FROM message WHERE id = $1', [sent.id])
    assert.equal(before.rows.length, 3)
    await s.pg.exec(`CREATE FUNCTION reject_message_edit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'TEST_ROLLBACK'; END $$;
    CREATE TRIGGER reject_message_edit BEFORE UPDATE ON message FOR EACH ROW EXECUTE FUNCTION reject_message_edit();`)
    assert.equal((await s.edit(sent.id)).status, 500)
    assert.deepEqual(
      (await s.pg.query('SELECT body, edited_at FROM message WHERE id = $1', [sent.id])).rows,
      current.rows,
    )
    assert.deepEqual(
      (
        await s.pg.query('SELECT * FROM record_version WHERE record_id = $1 ORDER BY version_no', [
          sent.id,
        ])
      ).rows,
      before.rows,
    )
  }),
)
