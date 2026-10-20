import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  PHOTO_MAX_BYTES,
  PHOTO_MAX_COUNT,
  type ChatMessage,
  type MessagePageResponse,
  type PhotoUploadResponse,
} from '@vada/contracts'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import { createRateLimiter } from '../http/rate-limit.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { fakeStorage } from '../test-support/storage.js'
import { isStorageKeyConflict } from './photos.js'
import { createChatRoutes } from './routes.js'

const now = new Date('2026-10-19T03:00:00Z')
const JOINED = '2026-03-01T00:00:00Z'

async function start(configured = true, uploadLimiter?: ReturnType<typeof createRateLimiter>) {
  const { pg, db, close } = await createTestDb()
  const council = await seedCouncil(db, pg)
  const other = await seedCouncil(db, pg, 'o')
  const store = fakeStorage()
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      chat: createChatRoutes(db, testSession, {
        clock: () => now,
        ...(configured ? { storage: store.storage } : {}),
        ...(uploadLimiter ? { uploadLimiter } : {}),
      }),
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
  const upload = (room: string, user?: string) =>
    api.post(`${base}/rooms/${room}/uploads`, {}, user)
  // 주소를 받고 객체가 올라간 것처럼 저장소에 둔다.
  const issued = async (at: string, room: string, user: string) => {
    const response = await api.post(`${at}/rooms/${room}/uploads`, {}, user)
    assert.equal(response.status, 200)
    return ((await response.json()) as PhotoUploadResponse).key
  }
  const uploadedIn = async (at: string, room: string, user: string) => {
    const key = await issued(at, room, user)
    store.put(key)
    return key
  }
  const uploaded = async (room: string, user: string, size = 1000, type = 'image/jpeg') => {
    const key = await issued(base, room, user)
    store.put(key, size, type)
    return key
  }
  const send = (room: string, user: string | undefined, body: unknown) =>
    api.post(`${base}/rooms/${room}/messages`, body, user)
  const count = async (sql: string) => Number(((await pg.query(sql)).rows[0] as { n: string }).n)
  return {
    pg,
    close,
    api,
    base,
    otherBase: `/api/organizations/${other.councilId}`,
    council,
    other,
    store,
    roomId,
    upload,
    uploaded,
    uploadedIn,
    send,
    messages: () => count('SELECT count(*) AS n FROM message'),
    files: () => count('SELECT count(*) AS n FROM file'),
  }
}
type Setup = Awaited<ReturnType<typeof start>>
const run =
  (body: (s: Setup) => Promise<void>, configured = true) =>
  async () => {
    const s = await start(configured)
    try {
      await body(s)
    } finally {
      await s.close()
    }
  }
const json = async <T>(response: Response) => (await response.json()) as T
const errorOf = async (response: Response) => (await json<{ error: string }>(response)).error

test(
  '올리기 주소는 참여자에게만 나가고 키는 학생회·나·번호이며 JPEG만 덮어쓰기 없이 올린다',
  run(async s => {
    const planning = await s.roomId(s.council.councilId, '기획부')
    const response = await s.upload(planning, 's-planningMember')
    assert.equal(response.status, 200)
    const issued = await json<PhotoUploadResponse>(response)
    const prefix = `chat/${s.council.councilId}/${s.council.people.planningMember.memberId}/`
    assert.ok(issued.key.startsWith(prefix), issued.key)
    assert.match(issued.key.slice(prefix.length), /^[0-9a-f-]{36}$/)
    assert.equal(issued.url, `https://r2.test/up/${issued.key}`)
    assert.deepEqual(issued.headers, { 'Content-Type': 'image/jpeg', 'If-None-Match': '*' })
    assert.equal(issued.expiresAt, '2026-10-19T03:10:00.000Z')
    const another = await json<PhotoUploadResponse>(await s.upload(planning, 's-planningMember'))
    assert.notEqual(another.key, issued.key)
    // 방 참여자가 아니거나, 로그인하지 않았거나, 다른 학생회 사람이면 주소가 없다.
    assert.equal((await s.upload(planning, 's-financeMember')).status, 403)
    assert.equal((await s.upload(planning)).status, 401)
    // 다른 학생회 사람은 그 학생회 운영진이 아니라 권한 확인에서 막힌다(403).
    assert.equal((await s.upload(planning, 'o-president')).status, 403)
    assert.deepEqual(s.store.issued.length, 2)
  }),
)

test('올리기 주소 요청은 모르는 키를 거절하고 속도 제한이 있다', async () => {
  const s = await start(true, createRateLimiter({ limit: 2, windowMs: 10_000 }))
  try {
    const all = await s.roomId(s.council.councilId, 'all')
    const extra = await s.api.post(`${s.base}/rooms/${all}/uploads`, { size: 1 }, 's-president')
    assert.equal(extra.status, 400)
    assert.equal((await s.upload(all, 's-president')).status, 200)
    assert.equal((await s.upload(all, 's-president')).status, 200)
    assert.equal((await s.upload(all, 's-president')).status, 429)
    assert.equal((await s.upload(all, 's-plain')).status, 200)
  } finally {
    await s.close()
  }
})

test(
  '사진만 보내면 본문이 빈 글인 메시지가 생기고 사진 기록이 붙으며 읽기에 보인다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const key = await s.uploaded(all, 's-president', 2345)
    const response = await s.send(all, 's-president', { photos: [key] })
    assert.equal(response.status, 201)
    const sent = await json<ChatMessage>(response)
    assert.equal(sent.body, '')
    assert.equal(sent.photos.length, 1)
    const { rows } = await s.pg.query<{
      storage_key: string
      media_type: string
      size_bytes: string | number
      attached_to_id: string
      name: string
    }>('SELECT storage_key, media_type, size_bytes, attached_to_id, name FROM file')
    assert.deepEqual(
      rows.map(row => ({ ...row, size_bytes: String(row.size_bytes) })),
      [
        {
          storage_key: key,
          media_type: 'image/jpeg',
          size_bytes: '2345',
          attached_to_id: sent.id,
          name: 'photo-1.jpg',
        },
      ],
    )
    const versions = await s.pg.query(
      `SELECT 1 FROM record_version WHERE record_id = $1 AND version_no = 1`,
      [sent.photos[0]!.id],
    )
    assert.equal(versions.rows.length, 1)
    const page = await json<MessagePageResponse>(
      await s.api.get(`${s.base}/rooms/${all}/messages`, 's-plain'),
    )
    assert.deepEqual(page.messages.at(-1)!.photos, sent.photos)
  }),
)

test(
  '글과 사진을 함께 보내면 사진은 보낸 차례대로 붙고 한 메시지에 열 장까지다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const keys: string[] = []
    for (let n = 0; n < PHOTO_MAX_COUNT; n += 1) keys.push(await s.uploaded(all, 's-president'))
    const response = await s.send(all, 's-president', { body: '행사 사진', photos: keys })
    assert.equal(response.status, 201)
    const sent = await json<ChatMessage>(response)
    assert.equal(sent.body, '행사 사진')
    const { rows } = await s.pg.query<{ storage_key: string }>(
      `SELECT f.storage_key FROM file f JOIN record r ON r.id = f.id ORDER BY r.created_at, f.id`,
    )
    assert.deepEqual(
      rows.map(row => row.storage_key),
      keys,
    )
    const more = await s.uploaded(all, 's-president')
    assert.equal((await s.send(all, 's-president', { photos: [...keys, more] })).status, 400)
    assert.equal(await s.messages(), 1)
  }),
)

test(
  '저장소의 크기가 0이거나 10MB를 넘거나 JPEG가 아니거나 없으면 400 UPLOAD_MISMATCH이고 객체를 지우며 메시지가 없다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const cases: [number, string][] = [
      [0, 'image/jpeg'],
      [PHOTO_MAX_BYTES + 1, 'image/jpeg'],
      [1000, 'image/png'],
      [1000, 'text/html'],
    ]
    for (const [size, type] of cases) {
      const key = await s.uploaded(all, 's-president', size, type)
      const response = await s.send(all, 's-president', { body: '사진', photos: [key] })
      assert.equal(response.status, 400, `${size} ${type}`)
      assert.equal(await errorOf(response), 'UPLOAD_MISMATCH')
      assert.ok(s.store.removed.includes(key))
      assert.equal(s.store.has(key), false)
    }
    // 한도 딱 맞는 크기(1바이트, 10MB)는 통과한다.
    for (const size of [1, PHOTO_MAX_BYTES]) {
      const key = await s.uploaded(all, 's-president', size)
      assert.equal((await s.send(all, 's-president', { photos: [key] })).status, 201)
    }
    // 올리지 않은 키: 지울 것이 없어도 같은 오류다.
    const issued = await json<PhotoUploadResponse>(await s.upload(all, 's-president'))
    const missing = await s.send(all, 's-president', { photos: [issued.key] })
    assert.equal(await errorOf(missing), 'UPLOAD_MISMATCH')
    assert.equal(await s.messages(), 2)
    assert.equal(await s.files(), 2)
  }),
)

test(
  '한 장이라도 어긋나면 메시지도 다른 사진 기록도 생기지 않고 어긋난 객체만 지운다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const good = await s.uploaded(all, 's-president')
    const bad = await s.uploaded(all, 's-president', 1000, 'image/png')
    const response = await s.send(all, 's-president', { photos: [good, bad] })
    assert.equal(await errorOf(response), 'UPLOAD_MISMATCH')
    assert.deepEqual(s.store.removed, [bad])
    assert.equal(await s.messages(), 0)
    assert.equal(await s.files(), 0)
    assert.equal((await s.send(all, 's-president', { photos: [good] })).status, 201)
  }),
)

test(
  '남의 키, 다른 학생회 키, 형식이 틀린 키는 400이고 그 객체를 지우지 않는다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const theirs = await s.uploaded(all, 's-plain')
    const prefix = `chat/${s.council.councilId}/${s.council.people.president.memberId}/`
    const foreign = `chat/${s.other.councilId}/${s.council.people.president.memberId}/${crypto.randomUUID()}`
    const receipt = `receipts/${s.council.councilId}/x`
    const odd = `${prefix}${crypto.randomUUID()}/../../${s.council.people.plain.memberId}/x`
    const notUuid = `${prefix}abc`
    for (const key of [theirs, foreign, receipt, odd, notUuid]) {
      s.store.put(key)
      const response = await s.send(all, 's-president', { photos: [key] })
      assert.equal(response.status, 400, key)
      assert.equal(await errorOf(response), 'INVALID_INPUT')
      assert.equal(s.store.has(key), true)
    }
    assert.deepEqual(s.store.removed, [])
    assert.equal(await s.messages(), 0)
  }),
)

test(
  '같은 키로 다시 보내면 409 PHOTO_ALREADY_SENT이고 객체는 남으며 메시지가 늘지 않는다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const planning = await s.roomId(s.council.councilId, '기획부')
    const key = await s.uploaded(all, 's-president')
    assert.equal((await s.send(all, 's-president', { photos: [key] })).status, 201)
    const again = await s.send(planning, 's-president', { body: '또', photos: [key] })
    assert.equal(again.status, 409)
    assert.equal(await errorOf(again), 'PHOTO_ALREADY_SENT')
    assert.deepEqual(s.store.removed, [])
    assert.equal(s.store.has(key), true)
    assert.equal(await s.messages(), 1)
    assert.equal(await s.files(), 1)
  }),
)

test(
  '같은 키를 동시에 두 번 보내도 하나만 생기고 나머지는 409 PHOTO_ALREADY_SENT다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const key = await s.uploaded(all, 's-president')
    const results = await Promise.all([
      s.send(all, 's-president', { photos: [key] }),
      s.send(all, 's-president', { photos: [key] }),
    ])
    assert.deepEqual(
      results.map(response => response.status).sort((a, b) => a - b),
      [201, 409],
    )
    assert.equal(await s.messages(), 1)
    assert.equal(await s.files(), 1)
  }),
)

test(
  '방 참여자가 아니면 사진을 붙여도 403이고 메시지와 사진 기록이 없다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const planning = await s.roomId(s.council.councilId, '기획부')
    const key = await s.uploaded(all, 's-financeMember')
    const response = await s.send(planning, 's-financeMember', { photos: [key] })
    assert.equal(response.status, 403)
    assert.equal(await s.messages(), 0)
    assert.equal(await s.files(), 0)
    assert.equal(s.store.has(key), true)
    assert.equal((await s.send(planning, undefined, { body: 'x' })).status, 401)
  }),
)

test(
  'R2 값이 없으면 사진은 503 STORAGE_NOT_CONFIGURED이고 글만 보내기는 그대로 돈다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const upload = await s.upload(all, 's-president')
    assert.equal(upload.status, 503)
    assert.equal(await errorOf(upload), 'STORAGE_NOT_CONFIGURED')
    const key = `chat/${s.council.councilId}/${s.council.people.president.memberId}/${crypto.randomUUID()}`
    const photo = await s.send(all, 's-president', { body: '사진', photos: [key] })
    assert.equal(photo.status, 503)
    assert.equal(await errorOf(photo), 'STORAGE_NOT_CONFIGURED')
    assert.equal(await s.messages(), 0)
    assert.equal((await s.send(all, 's-president', { body: '글' })).status, 201)
    const file = await s.api.get(`${s.base}/files/${crypto.randomUUID()}`, 's-president')
    assert.equal(file.status, 404)
  }, false),
)

test(
  '사진 보기는 참여자에게 5분 서명 주소로 302를 주고 볼 수 없는 메시지의 사진은 404다',
  run(async s => {
    const planning = await s.roomId(s.council.councilId, '기획부')
    const key = await s.uploaded(planning, 's-planningHead')
    const sent = await json<ChatMessage>(
      await s.send(planning, 's-planningHead', { photos: [key] }),
    )
    const fileId = sent.photos[0]!.id
    const view = (user?: string, id = fileId) => s.api.get(`${s.base}/files/${id}`, user)
    const seen = await view('s-planningMember')
    assert.equal(seen.status, 302)
    assert.equal(
      seen.headers.get('location'),
      `https://r2.test/down/${key}?n=photo-1.jpg&t=image%2Fjpeg`,
    )
    assert.match(seen.headers.get('cache-control') ?? '', /no-store/)
    // 방 참여자가 아니면(회장도), 없는 번호나 틀린 번호면 404다. 다른 학생회 사람은 권한 확인에서 403이다. 로그인하지 않으면 401이다.
    for (const user of ['s-financeMember', 's-president'])
      assert.equal((await view(user)).status, 404, user)
    assert.equal((await view('o-president')).status, 403)
    assert.equal((await view('s-planningMember', crypto.randomUUID())).status, 404)
    assert.equal((await view('s-planningMember', 'not-a-uuid')).status, 404)
    assert.equal((await view()).status, 401)
    // 사진이 아닌 기록(메시지 번호)도 사진으로 열리지 않는다.
    assert.equal((await view('s-planningMember', sent.id)).status, 404)
  }),
)

test(
  '들어오기 전에 보낸 메시지의 사진은 404이고 방에서 빠진 사람도 볼 수 없다',
  run(async s => {
    const planning = await s.roomId(s.council.councilId, '기획부')
    const key = await s.uploaded(planning, 's-planningHead')
    const sent = await json<ChatMessage>(
      await s.send(planning, 's-planningHead', { photos: [key] }),
    )
    const fileId = sent.photos[0]!.id
    const memberId = s.council.people.planningMember.memberId
    assert.equal((await s.api.get(`${s.base}/files/${fileId}`, 's-planningMember')).status, 302)
    await s.pg.query(
      `UPDATE room_membership SET joined_at = now() + interval '1 hour' WHERE member_id = $1`,
      [memberId],
    )
    assert.equal((await s.api.get(`${s.base}/files/${fileId}`, 's-planningMember')).status, 404)
    await s.pg.query('DELETE FROM room_membership WHERE member_id = $1', [memberId])
    assert.equal((await s.api.get(`${s.base}/files/${fileId}`, 's-planningMember')).status, 404)
  }),
)

test(
  '들어오기 전의 같은 기수 공지의 사진은 열리고, 공지를 떼면 다시 404이며, 다른 학생회 사진 번호는 404다',
  run(async s => {
    const all = await s.roomId(s.council.councilId, 'all')
    const key = await s.uploaded(all, 's-president')
    const sent = await json<ChatMessage>(await s.send(all, 's-president', { photos: [key] }))
    const fileId = sent.photos[0]!.id
    await s.pg.query(`UPDATE message SET sent_at = '2026-06-01T00:00:00Z' WHERE id = $1`, [sent.id])
    await s.pg.query(
      `UPDATE room_membership SET joined_at = '2026-07-01T00:00:00Z' WHERE member_id = $1`,
      [s.council.people.plain.memberId],
    )
    const view = () => s.api.get(`${s.base}/files/${fileId}`, 's-plain')
    assert.equal((await view()).status, 404)
    const mark = (isNotice: boolean) =>
      s.api.post(`${s.base}/messages/${sent.id}/notice`, { isNotice }, 's-president')
    assert.equal((await mark(true)).status, 200)
    assert.equal((await view()).status, 302)
    assert.equal((await mark(false)).status, 200)
    assert.equal((await view()).status, 404)
    // 다른 학생회의 사진 번호를 내 학생회 주소로 열어도 404다.
    const foreignRoom = await s.roomId(s.other.councilId, 'all')
    const foreignKey = await s.uploadedIn(s.otherBase, foreignRoom, 'o-president')
    const foreign = await json<ChatMessage>(
      await s.api.post(
        `${s.otherBase}/rooms/${foreignRoom}/messages`,
        { photos: [foreignKey] },
        'o-president',
      ),
    )
    const response = await s.api.get(`${s.base}/files/${foreign.photos[0]!.id}`, 's-president')
    assert.equal(response.status, 404)
  }),
)

test('같은 키 충돌은 두 드라이버의 오류 모양 모두에서 이미 보낸 사진으로 알아본다', () => {
  for (const shape of [
    { constraint: 'file_storage_key_key' },
    { constraint_name: 'file_storage_key_key' },
  ]) {
    const error = Object.assign(new Error('x'), { code: '23505', ...shape })
    assert.equal(isStorageKeyConflict(error), true)
    assert.equal(isStorageKeyConflict(new Error('wrap', { cause: error })), true)
  }
  const other = Object.assign(new Error('x'), { code: '23505', constraint_name: 'record_pkey' })
  assert.equal(isStorageKeyConflict(other), false)
})
