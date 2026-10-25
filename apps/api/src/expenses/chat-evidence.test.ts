import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  EVIDENCE_MAX,
  PHOTO_MAX_BYTES,
  type ChatMessage,
  type ExpenseDetail,
  type PhotoUploadResponse,
} from '@vada/contracts'
import { createApp } from '../app.js'
import { createChatRoutes } from '../chat/routes.js'
import { createTestDb } from '../db/test-db.js'
import { createRateLimiter, type RateLimiter } from '../http/rate-limit.js'
import { clockNow, createRecord } from '../records/records.js'
import { linkEvidence } from '../records/evidence-link.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { fakeStorage } from '../test-support/storage.js'
import { createExpenseRoutes } from './routes.js'

const FINANCE = 's-financeMember'
const MISSING = '019e0000-0000-7000-8000-000000000000'
const BASE = { vendor: '다이소', description: '마커', amount: 15000, paidOn: '2026-10-25' }
const JOINED = '2026-03-01T00:00:00Z'
const SIZE = 4321
const noon = new Date('2026-10-25T03:00:00Z')

async function start(options: { noStorage?: boolean; uploadLimiter?: RateLimiter } = {}) {
  const { pg, db, close } = await createTestDb()
  const council = await seedCouncil(db, pg)
  const other = await seedCouncil(db, pg, 'o')
  const store = fakeStorage()
  const storage = options.noStorage ? undefined : store.storage
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      expenses: createExpenseRoutes(db, testSession, {
        receiptKey: 'test-receipt-key',
        clock: () => noon,
        storage,
        ...(options.uploadLimiter ? { uploadLimiter: options.uploadLimiter } : {}),
      }),
      chat: createChatRoutes(db, testSession, { clock: () => noon, storage }),
    }),
  )
  const base = `/api/organizations/${council.councilId}`
  const otherBase = `/api/organizations/${other.councilId}`
  await api.get(`${base}/rooms`, 's-president')
  await api.get(`${otherBase}/rooms`, 'o-president')
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
  // 대화방에 사진 한 장짜리 메시지를 보낸다. 크기와 형식은 보낸 뒤 저장소에서 바꿀 수 있다.
  const photoIn = async (at: string, room: string, user: string, size = SIZE) => {
    const issued = (await (
      await api.post(`${at}/rooms/${room}/uploads`, {}, user)
    ).json()) as PhotoUploadResponse
    store.put(issued.key, size)
    const sent = await api.post(`${at}/rooms/${room}/messages`, { photos: [issued.key] }, user)
    assert.equal(sent.status, 201)
    const message = (await sent.json()) as ChatMessage
    return { key: issued.key, fileId: message.photos[0]!.id, messageId: message.id }
  }
  const count = async (sql: string, params: unknown[] = []) =>
    Number(((await pg.query(sql, params)).rows[0] as { n: string }).n)
  const expenses = `${base}/expenses`
  const make = async () => {
    const response = await api.post(expenses, BASE, FINANCE)
    return ((await response.json()) as { expense: ExpenseDetail }).expense
  }
  const attach = (expenseId: string, body: unknown, user = FINANCE) =>
    api.post(`${expenses}/${expenseId}/evidence/from-chat`, body, user)
  return {
    pg,
    db,
    close,
    api,
    base,
    otherBase,
    council,
    other,
    store,
    roomId,
    photoIn,
    make,
    attach,
    expenses,
    evidences: () => count('SELECT count(*) AS n FROM evidence'),
    // 대화 사진 파일은 이미 있으니 증빙 파일만 센다.
    evidenceFiles: () =>
      count(`SELECT count(*) AS n FROM file f JOIN evidence e ON e.id = f.attached_to_id`),
    links: () => count('SELECT count(*) AS n FROM evidence_link'),
    nothingMade: async () =>
      (await count('SELECT count(*) AS n FROM evidence')) +
      (await count('SELECT count(*) AS n FROM evidence_link')),
  }
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
const errorOf = async (response: Response) => ((await response.json()) as { error: string }).error
const detailOf = async (response: Response) =>
  ((await response.json()) as { expense: ExpenseDetail }).expense
// 어떤 실패에도 증빙·연결·파일이 없고 복사본이 저장소에 남지 않는다.
async function assertNothingKept(s: Kit, copiedBefore = 0) {
  assert.equal(await s.nothingMade(), 0)
  assert.equal(await s.evidenceFiles(), 0)
  for (const [, to] of s.store.copied.slice(copiedBefore)) assert.equal(s.store.has(to), false, to)
}

test(
  '대화 사진을 증빙으로 복사한다: 새 키·같은 크기와 형식의 새 파일·증빙(판 1)·근거 한 줄, 원본은 그대로, 응답에 근거가 없다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const photo = await s.photoIn(s.base, all, 's-planningMember')
    const made = await s.make()
    const response = await s.attach(made.id, { photoId: photo.fileId, type: 'tax_invoice' })
    assert.equal(response.status, 201)
    const text = await response.clone().text()
    assert.ok(!text.includes(photo.messageId), '근거 메시지가 응답에 실리지 않는다')
    assert.ok(!text.includes('evidence/'), '저장소 키가 응답에 실리지 않는다')
    const detail = await detailOf(response)
    assert.deepEqual(
      detail.evidence.map(item => item.type),
      ['tax_invoice'],
    )
    const evidenceId = detail.evidence[0]!.id
    const me = s.council.people.financeMember.memberId
    const files = await s.pg.query<{ storage_key: string; size_bytes: number; media: string }>(
      `SELECT storage_key, size_bytes, media_type AS media FROM file WHERE attached_to_id = $1`,
      [evidenceId],
    )
    assert.equal(files.rows.length, 1)
    const copy = files.rows[0]!
    assert.match(
      copy.storage_key,
      new RegExp(`^evidence/${s.council.councilId}/${me}/[0-9a-f-]{36}$`),
    )
    assert.notEqual(copy.storage_key, photo.key)
    assert.deepEqual([Number(copy.size_bytes), copy.media], [SIZE, 'image/jpeg'])
    assert.deepEqual(s.store.copied, [[photo.key, copy.storage_key]])
    const links = await s.pg.query<{ record_id: string; message_id: string }>(
      'SELECT record_id, message_id FROM evidence_link',
    )
    assert.deepEqual(links.rows, [{ record_id: evidenceId, message_id: photo.messageId }])
    for (const id of [evidenceId, detail.evidence[0]!.fileId])
      assert.equal(
        await s.pg
          .query('SELECT 1 FROM record_version WHERE record_id=$1 AND version_no=1', [id])
          .then(r => r.rows.length),
        1,
      )
    // 원본 파일 행과 객체와 메시지의 사진은 그대로다.
    assert.equal(s.store.has(photo.key), true)
    assert.deepEqual(s.store.removed, [])
    const original = await s.pg.query(`SELECT 1 FROM file WHERE id = $1 AND storage_key = $2`, [
      photo.fileId,
      photo.key,
    ])
    assert.equal(original.rows.length, 1)
    // 기존 보기 경로로 새 키가 열린다.
    const view = await s.api.get(
      `${s.expenses}/${made.id}/files/${detail.evidence[0]!.fileId}`,
      's-plain',
    )
    assert.equal(view.status, 302)
    assert.ok(view.headers.get('location')?.includes(copy.storage_key))
    // 종류를 고르지 않으면 영수증이고, 같은 사진을 다시 붙이면 새 복사본이 하나 더 생긴다.
    const again = await detailOf(await s.attach(made.id, { photoId: photo.fileId }))
    assert.deepEqual(
      again.evidence.map(item => item.type),
      ['tax_invoice', 'receipt'],
    )
    assert.equal(s.store.copied.length, 2)
    assert.notEqual(s.store.copied[0]![1], s.store.copied[1]![1])
  }),
)

test(
  '재정부가 아니면 403(회장단 포함), 로그인 안 하면 401, 없는 지출과 다른 학생회 지출은 404이고 403이 409보다 먼저다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const photo = await s.photoIn(s.base, all, 's-planningMember')
    const made = await s.make()
    const body = { photoId: photo.fileId }
    for (const user of ['s-president', 's-planningMember', 's-ended', 'o-financeMember'])
      assert.equal((await s.attach(made.id, body, user)).status, 403, user)
    // 볼 수 없는 사진이어도 재정부가 아니면 403이다.
    assert.equal((await s.attach(made.id, { photoId: MISSING }, 's-president')).status, 403)
    assert.equal((await s.attach(made.id, body, '')).status, 401)
    assert.equal((await s.attach(MISSING, body)).status, 404)
    assert.equal((await s.attach('not-a-uuid', body)).status, 404)
    const foreign = await s.api.post(
      `${s.otherBase}/expenses/${made.id}/evidence/from-chat`,
      body,
      'o-financeMember',
    )
    assert.equal(foreign.status, 404)
    await assertNothingKept(s)
    assert.deepEqual(s.store.copied, [])
  }),
)

test(
  '입력 경우: 번호가 없거나 빈 값·공백·상한 초과·NUL·홀로 쓰인 서러게이트·uuid 아님·모르는 키·모르는 종류는 400',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const photo = await s.photoIn(s.base, all, 's-planningMember')
    const made = await s.make()
    const bad: unknown[] = [
      {},
      { photoId: '' },
      { photoId: '   ' },
      { photoId: 'a'.repeat(37) },
      { photoId: '😀'.repeat(37) },
      { photoId: `${MISSING}\u0000` },
      { photoId: `${MISSING}\uD800` },
      { photoId: 'not-a-uuid' },
      { photoId: photo.fileId, extra: 1 },
      { photoId: photo.fileId, type: 'selfie' },
      { photoId: null },
    ]
    for (const body of bad)
      assert.equal((await s.attach(made.id, body)).status, 400, JSON.stringify(body))
    await assertNothingKept(s)
  }),
)

test(
  '볼 수 없는 사진은 모두 같은 409 MESSAGE_INVALID이고 아무것도 생기지 않는다: 안 들어간 방(회장단방 포함), 들어오기 전, 증빙 파일 번호, 없는 번호',
  run(async s => {
    const mine = s.council.councilId
    const planning = await s.photoIn(s.base, await s.roomId(mine, '기획부'), 's-planningMember')
    const leadership = await s.photoIn(s.base, await s.roomId(mine, 'leadership'), 's-president')
    const all = await s.roomId(mine, 'all')
    const before = await s.photoIn(s.base, all, 's-president')
    const made = await s.make()
    // 붙은 증빙의 파일 번호는 대화 사진이 아니다.
    const attached = await detailOf(await s.attach(made.id, { photoId: before.fileId }))
    const evidenceFile = attached.evidence[0]!.fileId
    // 재정부원은 이 사진이 올라온 뒤에 전체방에 들어왔다(1마이크로초 차이).
    await s.pg.query(
      `UPDATE room_membership SET joined_at = (SELECT sent_at FROM message WHERE id = $1) + interval '1 microsecond'
        WHERE member_id = $2 AND room_id = $3`,
      [before.messageId, s.council.people.financeMember.memberId, all],
    )
    const links = await s.links()
    for (const photoId of [
      planning.fileId,
      leadership.fileId,
      before.fileId,
      evidenceFile,
      MISSING,
    ]) {
      const response = await s.attach(made.id, { photoId })
      assert.equal(response.status, 409, photoId)
      assert.equal(await errorOf(response), 'MESSAGE_INVALID', photoId)
    }
    assert.equal(await s.links(), links)
    assert.equal(await s.evidences(), 1)
    assert.equal(s.store.copied.length, 1)
  }),
)

test(
  '들어온 시각과 같은 시각에 보낸 사진은 보이고, 들어오기 전의 공지 사진도 같은 기수면 보인다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const photo = await s.photoIn(s.base, all, 's-president')
    const me = s.council.people.financeMember.memberId
    const joinAt = (offset: string) =>
      s.pg.query(
        `UPDATE room_membership SET joined_at = (SELECT sent_at FROM message WHERE id = $1) ${offset}
          WHERE member_id = $2 AND room_id = $3`,
        [photo.messageId, me, all],
      )
    const made = await s.make()
    await joinAt('')
    assert.equal((await s.attach(made.id, { photoId: photo.fileId })).status, 201)
    await joinAt("+ interval '1 microsecond'")
    assert.equal(
      await errorOf(await s.attach(made.id, { photoId: photo.fileId })),
      'MESSAGE_INVALID',
    )
    // 공지로 표시된 메시지의 사진은 들어오기 전 것도 같은 기수면 보인다.
    await s.pg.query('UPDATE message SET is_notice = true WHERE id = $1', [photo.messageId])
    assert.equal((await s.attach(made.id, { photoId: photo.fileId })).status, 201)
    // 공지의 보낸 날이 지금 기수 밖이면 안 보인다.
    await s.pg.query(`UPDATE message SET sent_at = '2025-10-25T03:00:00Z' WHERE id = $1`, [
      photo.messageId,
    ])
    assert.equal(
      await errorOf(await s.attach(made.id, { photoId: photo.fileId })),
      'MESSAGE_INVALID',
    )
  }),
)

test(
  '다른 학생회의 사진은 같은 시각·같은 크기·내가 그 방의 참여 줄을 가져도 409이고, 근거 잇기도 다른 학생회 메시지를 막는다',
  run(async s => {
    const theirAll = await s.roomId(s.other.councilId, 'all')
    const theirs = await s.photoIn(s.otherBase, theirAll, 'o-president')
    const mine = await s.photoIn(s.base, await s.roomId(s.council.councilId, 'all'), 's-president')
    // 거르기를 지웠을 때 통과하도록 내 재정부원이 그 방의 참여 줄도 가진 것처럼 둔다.
    await s.pg.query(
      'INSERT INTO room_membership (room_id, member_id, joined_at) VALUES ($1, $2, $3)',
      [theirAll, s.council.people.financeMember.memberId, JOINED],
    )
    const made = await s.make()
    const response = await s.attach(made.id, { photoId: theirs.fileId })
    assert.equal(response.status, 409)
    assert.equal(await errorOf(response), 'MESSAGE_INVALID')
    assert.equal(await s.nothingMade(), 0)
    // 근거 잇기가 한 번 더 막아 주므로, 거르기가 빠지면 복사가 일어났는지로 잡는다.
    assert.deepEqual(s.store.copied, [])
    assert.equal((await s.attach(made.id, { photoId: mine.fileId })).status, 201)
    // 근거 잇기 도우미는 가리키는 메시지의 학생회를 따로 본다.
    const evidenceId = (await s.pg.query<{ id: string }>('SELECT id FROM evidence')).rows[0]!.id
    await assert.rejects(
      s.db.transaction(tx => linkEvidence(tx, s.council.councilId, evidenceId, theirs.messageId)),
      error => error instanceof Error && error.message === 'MESSAGE_INVALID',
    )
    assert.equal(await s.links(), 1)
  }),
)

test(
  '복사하는 사이 사진을 볼 수 없게 되면 거래 안 다시 보기가 409 MESSAGE_INVALID로 막고 복사본을 지운다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const photo = await s.photoIn(s.base, all, 's-president')
    const made = await s.make()
    const real = s.store.storage.copy.bind(s.store.storage)
    s.store.storage.copy = async (from, to) => {
      await real(from, to)
      await s.pg.query('DELETE FROM room_membership WHERE member_id = $1 AND room_id = $2', [
        s.council.people.financeMember.memberId,
        all,
      ])
    }
    const response = await s.attach(made.id, { photoId: photo.fileId })
    assert.equal(response.status, 409)
    assert.equal(await errorOf(response), 'MESSAGE_INVALID')
    assert.equal(s.store.copied.length, 1)
    await assertNothingKept(s)
    assert.equal(s.store.has(photo.key), true)
  }),
)

test(
  '원본이 JPEG 1바이트~10MB가 아니면 400 UPLOAD_MISMATCH이고 원본을 지우지 않으며 복사하지 않는다. 경계 값은 된다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const made = await s.make()
    const cases: [number, string][] = [
      [0, 'image/jpeg'],
      [PHOTO_MAX_BYTES + 1, 'image/jpeg'],
      [1000, 'image/png'],
    ]
    for (const [size, type] of cases) {
      const photo = await s.photoIn(s.base, all, 's-president')
      s.store.put(photo.key, size, type)
      const response = await s.attach(made.id, { photoId: photo.fileId })
      assert.equal(response.status, 400, `${size} ${type}`)
      assert.equal(await errorOf(response), 'UPLOAD_MISMATCH')
      assert.equal(s.store.has(photo.key), true)
    }
    // 저장소에 없는 원본도 같은 오류다.
    const gone = await s.photoIn(s.base, all, 's-president')
    await s.store.storage.remove(gone.key)
    assert.equal(
      await errorOf(await s.attach(made.id, { photoId: gone.fileId })),
      'UPLOAD_MISMATCH',
    )
    assert.deepEqual(s.store.copied, [])
    await assertNothingKept(s)
    for (const size of [1, PHOTO_MAX_BYTES]) {
      const photo = await s.photoIn(s.base, all, 's-president', size)
      assert.equal((await s.attach(made.id, { photoId: photo.fileId })).status, 201, String(size))
    }
    assert.equal(await s.evidences(), 2)
  }),
)

test(
  '복사가 실패하거나 새 객체가 원본과 다르면 기록하지 않고 복사본을 지운다. 원본은 지우지 않는다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const photo = await s.photoIn(s.base, all, 's-president')
    const made = await s.make()
    s.store.flags.failCopy = true
    assert.equal((await s.attach(made.id, { photoId: photo.fileId })).status, 500)
    s.store.flags.failCopy = false
    s.store.flags.corruptCopy = true
    assert.equal((await s.attach(made.id, { photoId: photo.fileId })).status, 500)
    assert.equal(s.store.copied.length, 1)
    assert.deepEqual(s.store.removed.length, 2)
    await assertNothingKept(s)
    assert.equal(s.store.has(photo.key), true)
    assert.ok(!s.store.removed.includes(photo.key))
  }),
)

test(
  '거래가 실패하면 복사본이 남지 않는다: 취소한 지출 409 EXPENSE_CANCELLED, 21번째 409 EVIDENCE_LIMIT, 완료한 행사의 지출',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const photo = await s.photoIn(s.base, all, 's-president')
    const body = { photoId: photo.fileId }
    const cancelled = await s.make()
    await s.api.post(`${s.expenses}/${cancelled.id}/cancel`, { reason: '잘못' }, FINANCE)
    let response = await s.attach(cancelled.id, body)
    assert.equal(response.status, 409)
    assert.equal(await errorOf(response), 'EXPENSE_CANCELLED')
    await assertNothingKept(s)
    assert.equal(s.store.copied.length, 1)
    assert.equal(s.store.removed.length, 1)
    assert.equal(s.store.has(photo.key), true)

    const full = await s.make()
    for (let index = 0; index < EVIDENCE_MAX; index += 1)
      assert.equal((await s.attach(full.id, body)).status, 201)
    const before = s.store.copied.length
    response = await s.attach(full.id, body)
    assert.equal(response.status, 409)
    assert.equal(await errorOf(response), 'EVIDENCE_LIMIT')
    assert.equal(s.store.copied.length, before + 1)
    assert.equal(s.store.has(s.store.copied.at(-1)![1]), false)
    assert.equal(await s.evidences(), EVIDENCE_MAX)
    assert.equal(await s.links(), EVIDENCE_MAX)

    // 완료한 행사의 지출은 증빙도 붙지 않는다.
    const eventId = await s.db.transaction(tx =>
      createRecord(tx, {
        kind: 'event',
        councilId: s.council.councilId,
        actor: s.council.people.president.memberId,
        values: { name: '봄 축제', startsAt: new Date('2026-10-20T00:00:00Z') },
      }),
    )
    const inEvent = await detailOf(await s.api.post(s.expenses, { ...BASE, eventId }, FINANCE))
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
          actedAt: clockNow,
          reason: null,
        },
      }),
    )
    response = await s.attach(inEvent.id, body)
    assert.equal(response.status, 409)
    assert.equal(await errorOf(response), 'EVENT_COMPLETED')
    assert.equal(s.store.has(s.store.copied.at(-1)![1]), false)
    assert.equal(await s.evidences(), EVIDENCE_MAX)
  }),
)

test('저장소 값이 없으면 503이고 403이 먼저다. 지출 쓰기와 읽기는 돈다', async () => {
  const s = await start({ noStorage: true })
  try {
    const made = await s.make()
    const body = { photoId: MISSING }
    assert.equal((await s.attach(made.id, body, 's-president')).status, 403)
    const response = await s.attach(made.id, body)
    assert.equal(response.status, 503)
    assert.equal(await errorOf(response), 'STORAGE_NOT_CONFIGURED')
    assert.equal((await s.api.get(s.expenses, FINANCE)).status, 200)
  } finally {
    await s.close()
  }
})

test('사진 한도는 증빙 올리기와 같다: 넘으면 429이고 복사하지 않는다', async () => {
  const s = await start({ uploadLimiter: createRateLimiter({ limit: 2, windowMs: 10_000 }) })
  try {
    const all = await s.roomId(s.council.councilId, 'all')
    const photo = await s.photoIn(s.base, all, 's-president')
    const made = await s.make()
    const statuses: number[] = []
    for (let n = 0; n < 3; n += 1)
      statuses.push((await s.attach(made.id, { photoId: photo.fileId })).status)
    assert.deepEqual(statuses, [201, 201, 429])
    assert.equal(s.store.copied.length, 2)
  } finally {
    await s.close()
  }
})
