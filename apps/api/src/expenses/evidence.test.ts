import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  EVIDENCE_MAX,
  PHOTO_MAX_BYTES,
  type ExpenseDetail,
  type PhotoUploadResponse,
} from '@vada/contracts'
import { createRateLimiter } from '../http/rate-limit.js'
import { errorOf, MISSING, runPurchases, startPurchases } from '../test-support/purchases.js'
import type { PurchaseKit } from '../test-support/purchases.js'

const FINANCE = 's-financeMember'
const BASE = {
  method: 'card',
  vendor: '다이소',
  description: '마커',
  amount: 15000,
  paidOn: '2026-10-25',
}

const expenseOf = async (response: Response) =>
  ((await response.json()) as { expense: ExpenseDetail }).expense
const root = (s: PurchaseKit, councilId = s.council.councilId) =>
  `/api/organizations/${councilId}/expenses`
const make = async (s: PurchaseKit) => expenseOf(await s.api.post(root(s), BASE, FINANCE))
const counts = (s: PurchaseKit) =>
  Promise.all(['evidence', 'file'].map(table => s.count(`SELECT count(*) AS n FROM ${table}`)))

// 주소를 받고 객체가 올라간 것처럼 저장소에 둔다.
async function uploaded(s: PurchaseKit, expenseId: string, size = 1000, type = 'image/jpeg') {
  const response = await s.api.post(`${root(s)}/${expenseId}/uploads`, {}, FINANCE)
  assert.equal(response.status, 200)
  const issued = (await response.json()) as PhotoUploadResponse
  s.store.put(issued.key, size, type)
  return issued.key
}
const attach = (s: PurchaseKit, expenseId: string, body: unknown, user = FINANCE) =>
  s.api.post(`${root(s)}/${expenseId}/evidence`, body, user)

test(
  '재정부가 올리기 주소를 받는다: 내 학생회와 내 번호가 든 evidence 키, JPEG만, 덮어쓸 수 없다',
  runPurchases(async s => {
    const made = await make(s)
    const response = await s.api.post(`${root(s)}/${made.id}/uploads`, {}, FINANCE)
    assert.equal(response.status, 200)
    const issued = (await response.json()) as PhotoUploadResponse
    const me = s.council.people.financeMember.memberId
    assert.match(issued.key, new RegExp(`^evidence/${s.council.councilId}/${me}/[0-9a-f-]{36}$`))
    assert.equal(issued.headers['Content-Type'], 'image/jpeg')
    assert.equal(issued.headers['If-None-Match'], '*')
    assert.deepEqual(s.store.issued, [issued.key])
  }),
)

test(
  '올리기 주소의 권한: 재정부가 아니면 403, 로그인 안 하면 401, 없는 지출과 다른 학생회 지출은 404, 모르는 키는 400',
  runPurchases(async s => {
    const made = await make(s)
    const url = `${root(s)}/${made.id}/uploads`
    for (const user of ['s-president', 's-planningMember', 's-ended', 'o-financeMember'])
      assert.equal((await s.api.post(url, {}, user)).status, 403, user)
    assert.equal((await s.api.post(url, {}, '')).status, 401)
    assert.equal((await s.api.post(`${root(s)}/${MISSING}/uploads`, {}, FINANCE)).status, 404)
    assert.equal((await s.api.post(`${root(s)}/not-a-uuid/uploads`, {}, FINANCE)).status, 404)
    const foreign = `${root(s, s.other.councilId)}/${made.id}/uploads`
    assert.equal((await s.api.post(foreign, {}, 'o-financeMember')).status, 404)
    assert.equal((await s.api.post(url, { extra: 1 }, FINANCE)).status, 400)
    assert.deepEqual(s.store.issued, [])
  }),
)

test(
  '증빙을 붙인다: 201, 증빙과 파일이 판 1과 함께 생기고 상세에 종류와 목록 수가 보인다',
  runPurchases(async s => {
    const made = await make(s)
    const key = await uploaded(s, made.id, 4321)
    const response = await attach(s, made.id, { key, type: 'tax_invoice' })
    assert.equal(response.status, 201)
    const detail = await expenseOf(response)
    assert.deepEqual(
      detail.evidence.map(item => item.type),
      ['tax_invoice'],
    )
    assert.equal(detail.evidenceCount, 1)
    const evidenceId = detail.evidence[0]!.id
    assert.equal(await s.versions(evidenceId), 1)
    assert.equal(await s.versions(detail.evidence[0]!.fileId), 1)
    const stored = await s.pg.query<{ storage_key: string; size_bytes: number; attached: string }>(
      'SELECT storage_key, size_bytes, attached_to_id AS attached FROM file',
    )
    assert.deepEqual(stored.rows, [{ storage_key: key, size_bytes: 4321, attached: evidenceId }])
    // 종류를 고르지 않으면 영수증이다.
    const second = await attach(s, made.id, { key: await uploaded(s, made.id) })
    assert.deepEqual(
      (await expenseOf(second)).evidence.map(item => item.type),
      ['tax_invoice', 'receipt'],
    )
    const list = (await (await s.api.get(root(s), 's-planningMember')).json()) as {
      expenses: { evidenceCount: number }[]
    }
    assert.equal(list.expenses[0]!.evidenceCount, 2)
  }),
)

test(
  '붙이기의 입력과 권한: 키가 없거나 종류가 모르는 값이거나 모르는 키면 400, 재정부가 아니면 403, 로그인 안 하면 401, 없는 지출 404',
  runPurchases(async s => {
    const made = await make(s)
    const key = await uploaded(s, made.id)
    const bad: unknown[] = [
      {},
      { key: '' },
      { key: '  ' },
      { key: 'a'.repeat(129) },
      { key: '😀'.repeat(129) },
      { key: 'a\u0000' },
      { key: 'a\uD800' },
      { key, type: 'selfie' },
      { key, extra: 1 },
    ]
    for (const body of bad) assert.equal((await attach(s, made.id, body)).status, 400)
    for (const user of ['s-president', 's-planningMember', 's-ended', 'o-financeMember'])
      assert.equal((await attach(s, made.id, { key }, user)).status, 403, user)
    assert.equal((await attach(s, made.id, { key }, '')).status, 401)
    assert.equal((await attach(s, MISSING, { key })).status, 404)
    assert.equal((await attach(s, 'not-a-uuid', { key })).status, 404)
    const foreign = await s.api.post(
      `${root(s, s.other.councilId)}/${made.id}/evidence`,
      { key },
      'o-financeMember',
    )
    assert.equal(foreign.status, 404)
    assert.deepEqual(await counts(s), [0, 0])
    assert.equal(s.store.removed.length, 0)
  }),
)

test(
  '남의 키, 대화 사진 키, 다른 학생회의 키는 400이고 객체를 지우지 않는다',
  runPurchases(async s => {
    const made = await make(s)
    const me = s.council.people.financeMember.memberId
    const others = [
      `evidence/${s.council.councilId}/${s.council.people.president.memberId}/${MISSING}`,
      `chat/${s.council.councilId}/${me}/${MISSING}`,
      `evidence/${s.other.councilId}/${me}/${MISSING}`,
      `evidence/${s.council.councilId}/${me}/not-a-uuid`,
      `evidence/${s.council.councilId}/${me}/${MISSING}/x`,
    ]
    for (const key of others) {
      s.store.put(key)
      const response = await attach(s, made.id, { key })
      assert.equal(response.status, 400, key)
      assert.equal(await errorOf(response), 'INVALID_INPUT')
      assert.equal(s.store.has(key), true, key)
    }
    assert.deepEqual(s.store.removed, [])
    assert.deepEqual(await counts(s), [0, 0])
  }),
)

test(
  '저장소의 크기와 형식이 어긋나면 400 UPLOAD_MISMATCH이고 그 객체를 지운다: 올리지 않음, 0바이트, 10MB 초과, JPEG 아님',
  runPurchases(async s => {
    const made = await make(s)
    const notUploaded = (await (
      await s.api.post(`${root(s)}/${made.id}/uploads`, {}, FINANCE)
    ).json()) as PhotoUploadResponse
    const cases: [string, string][] = [
      [notUploaded.key, 'missing'],
      [await uploaded(s, made.id, 0), 'empty'],
      [await uploaded(s, made.id, PHOTO_MAX_BYTES + 1), 'big'],
      [await uploaded(s, made.id, 1000, 'image/png'), 'png'],
    ]
    for (const [key, name] of cases) {
      const response = await attach(s, made.id, { key })
      assert.equal(response.status, 400, name)
      assert.equal(await errorOf(response), 'UPLOAD_MISMATCH', name)
      assert.equal(s.store.has(key), false, name)
    }
    // 정확히 10MB와 1바이트는 받는다.
    for (const size of [1, PHOTO_MAX_BYTES])
      assert.equal(
        (await attach(s, made.id, { key: await uploaded(s, made.id, size) })).status,
        201,
        String(size),
      )
    assert.deepEqual(await counts(s), [2, 2])
  }),
)

test(
  '같은 키를 다시 붙이면 409 PHOTO_ALREADY_SENT이고 객체를 지우지 않으며 증빙이 늘지 않는다',
  runPurchases(async s => {
    const made = await make(s)
    const other = await make(s)
    const key = await uploaded(s, made.id)
    assert.equal((await attach(s, made.id, { key })).status, 201)
    for (const target of [made.id, other.id]) {
      const again = await attach(s, target, { key })
      assert.equal(again.status, 409)
      assert.equal(await errorOf(again), 'PHOTO_ALREADY_SENT')
    }
    assert.equal(s.store.has(key), true)
    assert.deepEqual(await counts(s), [1, 1])
  }),
)

test(
  '취소한 지출에는 붙지 않는다: 409 EXPENSE_CANCELLED이고 증빙이 생기지 않는다',
  runPurchases(async s => {
    const made = await make(s)
    const key = await uploaded(s, made.id)
    await s.api.post(`${root(s)}/${made.id}/cancel`, { reason: '잘못' }, FINANCE)
    const response = await attach(s, made.id, { key })
    assert.equal(response.status, 409)
    assert.equal(await errorOf(response), 'EXPENSE_CANCELLED')
    assert.deepEqual(await counts(s), [0, 0])
  }),
)

test(
  '한 지출에 20장까지다: 21번째는 409 EVIDENCE_LIMIT이고, 다른 지출에는 붙는다',
  runPurchases(async s => {
    const made = await make(s)
    const other = await make(s)
    for (let index = 0; index < EVIDENCE_MAX; index += 1)
      assert.equal((await attach(s, made.id, { key: await uploaded(s, made.id) })).status, 201)
    const key = await uploaded(s, made.id)
    const over = await attach(s, made.id, { key })
    assert.equal(over.status, 409)
    assert.equal(await errorOf(over), 'EVIDENCE_LIMIT')
    assert.deepEqual(await counts(s), [EVIDENCE_MAX, EVIDENCE_MAX])
    assert.equal((await attach(s, other.id, { key })).status, 201)
  }),
)

test(
  '동시에 같은 키를 붙이면 하나만 되고 하나는 409 PHOTO_ALREADY_SENT이다',
  runPurchases(async s => {
    const made = await make(s)
    const key = await uploaded(s, made.id)
    const results = await Promise.all([attach(s, made.id, { key }), attach(s, made.id, { key })])
    assert.deepEqual(
      results.map(r => r.status).sort((a, b) => a - b),
      [201, 409],
    )
    assert.deepEqual(await counts(s), [1, 1])
  }),
)

test(
  '모든 운영진이 5분 서명 주소로 302로 본다: 취소한 지출의 사진도 본다',
  runPurchases(async s => {
    const made = await make(s)
    const detail = await expenseOf(await attach(s, made.id, { key: await uploaded(s, made.id) }))
    const url = `${root(s)}/${made.id}/files/${detail.evidence[0]!.fileId}`
    await s.api.post(`${root(s)}/${made.id}/cancel`, { reason: '잘못' }, FINANCE)
    for (const user of [FINANCE, 's-president', 's-planningMember', 's-plain']) {
      const response = await s.api.get(url, user)
      assert.equal(response.status, 302, user)
      assert.match(response.headers.get('location') ?? '', /^https:\/\/r2\.test\/down\/evidence\//)
      assert.equal(response.headers.get('cache-control'), 'private, no-store')
    }
    assert.equal((await s.api.get(url, 's-ended')).status, 403)
    assert.equal((await s.api.get(url, 'o-financeMember')).status, 403)
    assert.equal((await s.api.get(url)).status, 401)
  }),
)

test(
  '다른 지출의 파일, 대화 사진, 다른 학생회, 없는 번호는 404이다',
  runPurchases(async s => {
    const made = await make(s)
    const other = await make(s)
    const detail = await expenseOf(await attach(s, made.id, { key: await uploaded(s, made.id) }))
    const fileId = detail.evidence[0]!.fileId
    assert.equal((await s.api.get(`${root(s)}/${other.id}/files/${fileId}`, FINANCE)).status, 404)
    // 증빙 번호는 파일 번호가 아니다.
    const evidenceId = detail.evidence[0]!.id
    assert.equal(
      (await s.api.get(`${root(s)}/${made.id}/files/${evidenceId}`, FINANCE)).status,
      404,
    )
    const foreign = `${root(s, s.other.councilId)}/${made.id}/files/${fileId}`
    assert.equal((await s.api.get(foreign, 'o-financeMember')).status, 404)
    for (const id of [MISSING, 'not-a-uuid'])
      assert.equal((await s.api.get(`${root(s)}/${made.id}/files/${id}`, FINANCE)).status, 404, id)
    // 대화에 붙은 사진 파일은 증빙 길로 열리지 않는다.
    const chat = await s.pg.query<{ id: string }>(
      `INSERT INTO record (id, kind, council_id) VALUES ($1, 'file', $2) RETURNING id`,
      [MISSING.replace('0000', '0001'), s.council.councilId],
    )
    await s.pg.query(
      `INSERT INTO file (id, name, media_type, size_bytes, storage_key) VALUES ($1, 'p.jpg', 'image/jpeg', 1, 'chat/x/y/z')`,
      [chat.rows[0]!.id],
    )
    assert.equal(
      (await s.api.get(`${root(s)}/${made.id}/files/${chat.rows[0]!.id}`, FINANCE)).status,
      404,
    )
  }),
)

test('저장소 값이 없으면 증빙만 503이고 지출 쓰기와 읽기는 돈다', async () => {
  const s = await startPurchases({ noStorage: true })
  try {
    const made = await make(s)
    const upload = await s.api.post(`${root(s)}/${made.id}/uploads`, {}, FINANCE)
    assert.equal(upload.status, 503)
    assert.equal(await errorOf(upload), 'STORAGE_NOT_CONFIGURED')
    const key = `evidence/${s.council.councilId}/${s.council.people.financeMember.memberId}/${MISSING}`
    assert.equal((await attach(s, made.id, { key })).status, 503)
    // 403이 503보다 먼저다.
    assert.equal((await attach(s, made.id, { key }, 's-president')).status, 403)
    assert.equal((await s.api.get(root(s), FINANCE)).status, 200)
    assert.equal((await s.api.get(`${root(s)}/${made.id}`, FINANCE)).status, 200)
    assert.equal((await s.api.post(root(s), BASE, FINANCE)).status, 201)
  } finally {
    await s.close()
  }
})

test('올리기 주소는 대화 사진과 같은 한도로 센다: 넘으면 429이다', async () => {
  const s = await startPurchases({
    uploadLimiter: createRateLimiter({ limit: 2, windowMs: 10_000 }),
  })
  try {
    const made = await make(s)
    const url = `${root(s)}/${made.id}/uploads`
    assert.deepEqual(
      [
        (await s.api.post(url, {}, FINANCE)).status,
        (await s.api.post(url, {}, FINANCE)).status,
        (await s.api.post(url, {}, FINANCE)).status,
      ],
      [200, 200, 429],
    )
  } finally {
    await s.close()
  }
})
