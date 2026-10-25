import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DELETED_MESSAGE,
  type ChatMessage,
  type ChatPhotoListResponse,
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
import { ERASED_BY_REQUEST, eraseMessages, erasePlanOf } from './erase.js'
import { noticeStagesOf } from './stage.js'
import { createChatRoutes } from './routes.js'

// 지운 메시지(기능 021 조각 8, DEC-54, DEC-88): 행은 남고 본문과 사진이 모든 판에서 비며, 모든 조회가 그 자리를 '삭제된 메시지'로 보인다.
const noon = new Date('2026-10-25T03:00:00Z')
const JOINED = '2026-03-01T00:00:00Z'
const WRITER = 's-planningMember'
const FINANCE = 's-financeMember'
const BODY = '내 계좌 110-123-456789로 보내 줘'

async function start() {
  const { pg, db, close } = await createTestDb()
  const council = await seedCouncil(db, pg)
  const other = await seedCouncil(db, pg, 'o')
  const store = fakeStorage()
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      expenses: createExpenseRoutes(db, testSession, {
        receiptKey: 'test-receipt-key',
        clock: () => noon,
        storage: store.storage,
      }),
      chat: createChatRoutes(db, testSession, { clock: () => noon, storage: store.storage }),
    }),
  )
  const base = `/api/organizations/${council.councilId}`
  const otherBase = `/api/organizations/${other.councilId}`
  await api.get(`${base}/rooms`, 's-president')
  await api.get(`${otherBase}/rooms`, 'o-president')
  await pg.query('UPDATE room_membership SET joined_at = $1', [JOINED])
  const allRoom = async (councilId: string) =>
    (
      await pg.query<{ id: string }>(
        `SELECT cr.id FROM chat_room cr JOIN record r ON r.id = cr.id
          WHERE r.council_id = $1 AND cr.type = 'all_members'`,
        [councilId],
      )
    ).rows[0]!.id
  // 글과 사진 한 장짜리 메시지를 보낸다.
  const sendWithPhoto = async (at: string, room: string, user: string) => {
    const issued = (await (
      await api.post(`${at}/rooms/${room}/uploads`, {}, user)
    ).json()) as PhotoUploadResponse
    store.put(issued.key)
    const sent = await api.post(
      `${at}/rooms/${room}/messages`,
      { body: BODY, photos: [issued.key] },
      user,
    )
    assert.equal(sent.status, 201)
    const message = (await sent.json()) as ChatMessage
    return { key: issued.key, fileId: message.photos[0]!.id, messageId: message.id }
  }
  return { pg, db, close, api, base, otherBase, council, other, store, allRoom, sendWithPhoto }
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
const erase = (s: Kit, ids: string[]) =>
  s.db.transaction(tx => eraseMessages(tx, ids, { actor: null, reason: ERASED_BY_REQUEST }))
const pageOf = async (s: Kit, room: string, user = 's-president') =>
  (await (await s.api.get(`${s.base}/rooms/${room}/messages`, user)).json()) as MessagePageResponse

test(
  '지우면 메시지는 본문 null·지운 시각·사진 없음으로 보이고, 사진 보기는 404, 사진 목록에서 빠지며, 다른 메시지는 그대로다',
  run(async s => {
    const room = await s.allRoom(s.council.councilId)
    const erased = await s.sendWithPhoto(s.base, room, WRITER)
    const kept = await s.sendWithPhoto(s.base, room, WRITER)
    assert.equal((await s.api.get(`${s.base}/files/${erased.fileId}`, 's-plain')).status, 302)
    await erase(s, [erased.messageId])

    const page = await pageOf(s, room)
    const shown = page.messages.find(item => item.id === erased.messageId)!
    assert.equal(shown.body, null)
    assert.equal(shown.photos.length, 0)
    assert.ok(shown.deletedAt && !Number.isNaN(Date.parse(shown.deletedAt)))
    assert.equal(shown.senderId, s.council.people.planningMember.memberId)
    const other = page.messages.find(item => item.id === kept.messageId)!
    assert.deepEqual([other.body, other.deletedAt, other.photos.length], [BODY, null, 1])

    assert.equal((await s.api.get(`${s.base}/files/${erased.fileId}`, 's-plain')).status, 404)
    assert.equal((await s.api.get(`${s.base}/files/${kept.fileId}`, 's-plain')).status, 302)
    const list = (await (
      await s.api.get(`${s.base}/chat/photos`, FINANCE)
    ).json()) as ChatPhotoListResponse
    assert.deepEqual(
      list.photos.map(photo => photo.id),
      [kept.fileId],
    )
    // 지운 사진은 증빙으로 옮길 수 없다(볼 수 없는 사진과 같은 오류).
    const made = (await (
      await s.api.post(
        `${s.base}/expenses`,
        { vendor: '다이소', description: '마커', amount: 1000, paidOn: '2026-10-25' },
        FINANCE,
      )
    ).json()) as { expense: ExpenseDetail }
    const moved = await s.api.post(
      `${s.base}/expenses/${made.expense.id}/evidence/from-chat`,
      { photoId: erased.fileId },
      FINANCE,
    )
    assert.equal(moved.status, 409)
  }),
)

test(
  '지우면 메시지와 붙은 파일의 모든 판에서 본문·이름·저장소 위치가 비고, 메시지에 사유 있는 새 판이 남으며, 증빙 복사본은 그대로다',
  run(async s => {
    const room = await s.allRoom(s.council.councilId)
    const erased = await s.sendWithPhoto(s.base, room, WRITER)
    const made = (await (
      await s.api.post(
        `${s.base}/expenses`,
        { vendor: '다이소', description: '마커', amount: 1000, paidOn: '2026-10-25' },
        FINANCE,
      )
    ).json()) as { expense: ExpenseDetail }
    const attached = await s.api.post(
      `${s.base}/expenses/${made.expense.id}/evidence/from-chat`,
      { photoId: erased.fileId },
      FINANCE,
    )
    assert.equal(attached.status, 201)
    const evidenceFile = ((await attached.json()) as { expense: ExpenseDetail }).expense
      .evidence[0]!.fileId
    // 같은 모양의 다른 학생회 메시지
    const foreign = await s.sendWithPhoto(
      s.otherBase,
      await s.allRoom(s.other.councilId),
      'o-planningMember',
    )

    await erase(s, [erased.messageId])

    const versions = await s.pg.query<{ record_id: string; data: Record<string, unknown> }>(
      'SELECT record_id, data FROM record_version WHERE record_id = ANY($1)',
      [[erased.messageId, erased.fileId]],
    )
    const text = JSON.stringify(versions.rows)
    assert.ok(!text.includes(BODY), '판에 본문이 남지 않는다')
    assert.ok(!text.includes(erased.key), '판에 저장소 위치가 남지 않는다')
    assert.ok(!text.includes('photo-1.jpg'), '판에 파일 이름이 남지 않는다')
    const last = await s.pg.query<{ changed_by: string | null; reason: string; deleted: boolean }>(
      `SELECT changed_by, reason, (data ->> 'deleted_at') IS NOT NULL AS deleted FROM record_version
        WHERE record_id = $1 ORDER BY version_no DESC LIMIT 1`,
      [erased.messageId],
    )
    assert.deepEqual(last.rows[0], { changed_by: null, reason: ERASED_BY_REQUEST, deleted: true })
    const fileRow = await s.pg.query('SELECT name, storage_key FROM file WHERE id = $1', [
      erased.fileId,
    ])
    assert.deepEqual(fileRow.rows, [{ name: null, storage_key: null }])
    // 증빙 복사본과 근거 연결, 다른 학생회 메시지는 그대로다.
    const copy = await s.pg.query<{ storage_key: string | null }>(
      'SELECT storage_key FROM file WHERE id = $1',
      [evidenceFile],
    )
    assert.match(copy.rows[0]!.storage_key ?? '', /^evidence\//)
    const view = await s.api.get(
      `${s.base}/expenses/${made.expense.id}/files/${evidenceFile}`,
      's-plain',
    )
    assert.equal(view.status, 302)
    const links = await s.pg.query('SELECT 1 FROM evidence_link WHERE message_id = $1', [
      erased.messageId,
    ])
    assert.equal(links.rows.length, 1)
    const untouched = await s.pg.query<{ body: string; storage_key: string }>(
      `SELECT m.body, f.storage_key FROM message m JOIN file f ON f.attached_to_id = m.id WHERE m.id = $1`,
      [foreign.messageId],
    )
    assert.deepEqual(untouched.rows, [{ body: BODY, storage_key: foreign.key }])
    // 지운 공지는 업무 결과물로서 빠짐이다.
    assert.deepEqual(
      await noticeStagesOf(s.db, [erased.messageId, foreign.messageId]),
      new Map([
        [erased.messageId, 'excluded'],
        [foreign.messageId, 'finished'],
      ]),
    )
  }),
)

test(
  '지울 것의 셈: 그 학생회의 그 사람이 [from, until)에 보낸 것만, 이미 지운 것은 따로 센다',
  run(async s => {
    const room = await s.allRoom(s.council.councilId)
    const first = await s.sendWithPhoto(s.base, room, WRITER)
    const second = await s.sendWithPhoto(s.base, room, WRITER)
    const byOther = await s.sendWithPhoto(s.base, room, 's-plain')
    const late = await s.sendWithPhoto(s.base, room, WRITER)
    const at = (id: string, when: string) =>
      s.pg.query('UPDATE message SET sent_at = $2 WHERE id = $1', [id, when])
    await at(first.messageId, '2026-10-25T01:00:00Z')
    await at(second.messageId, '2026-10-25T01:59:59.999Z')
    await at(byOther.messageId, '2026-10-25T01:30:00Z')
    await at(late.messageId, '2026-10-25T02:00:00Z')
    const scope = {
      councilId: s.council.councilId,
      senderId: s.council.people.planningMember.memberId,
      from: new Date('2026-10-25T01:00:00Z'),
      until: new Date('2026-10-25T02:00:00Z'),
    }
    const plan = await erasePlanOf(s.db, scope)
    assert.deepEqual(new Set(plan.messageIds), new Set([first.messageId, second.messageId]))
    assert.deepEqual(new Set(plan.storageKeys), new Set([first.key, second.key]))
    // 판: 메시지마다 1, 파일마다 1
    assert.deepEqual(plan.counts, {
      messages: 2,
      versions: 4,
      files: 2,
      objects: 2,
      alreadyErased: 0,
    })
    await erase(s, [first.messageId])
    assert.deepEqual((await erasePlanOf(s.db, scope)).counts, {
      messages: 1,
      versions: 2,
      files: 1,
      objects: 1,
      alreadyErased: 1,
    })
    // 다른 학생회의 번호로는 아무것도 없다.
    assert.deepEqual(
      (await erasePlanOf(s.db, { ...scope, councilId: s.other.councilId })).counts.messages,
      0,
    )
  }),
)

test(
  '방의 마지막 메시지가 지운 것이면 방 줄 미리보기는 사진이 아니라 삭제된 메시지다',
  run(async s => {
    const room = await s.allRoom(s.council.councilId)
    const erased = await s.sendWithPhoto(s.base, room, WRITER)
    const previewOf = async () =>
      (
        (await (await s.api.get(`${s.base}/rooms`, 's-president')).json()) as RoomListResponse
      ).rooms.find(item => item.id === room)?.lastMessage
    assert.equal((await previewOf())?.preview, BODY)
    await erase(s, [erased.messageId])
    assert.deepEqual(await previewOf(), {
      senderName: 's planningMember',
      preview: DELETED_MESSAGE,
    })
  }),
)
