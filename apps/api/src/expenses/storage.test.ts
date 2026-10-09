import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createR2Storage, r2ConfigFrom } from './storage.js'

const config = { accountId: 'acc', accessKeyId: 'AKID', secretAccessKey: 'secret-value', bucket: 'vada-receipts' }
const fixed = () => new Date('2026-10-09T05:00:00.000Z')

test('올리기 주소는 버킷 경로·10분 만료·형식 서명을 담고, 보기 주소는 5분 만료와 파일 이름을 담는다', async () => {
  const storage = createR2Storage(config, fetch, fixed)
  const upload = await storage.uploadUrl('receipts/a/e1/r1', 'image/jpeg')
  const url = new URL(upload.url)
  assert.equal(url.origin, 'https://acc.r2.cloudflarestorage.com')
  assert.equal(url.pathname, '/vada-receipts/receipts/a/e1/r1')
  assert.equal(url.searchParams.get('X-Amz-Expires'), '600')
  assert.equal(url.searchParams.get('X-Amz-SignedHeaders'), 'content-type;host')
  assert.equal(url.searchParams.get('X-Amz-Date'), '20261009T050000Z')
  assert.equal(url.searchParams.get('X-Amz-Credential'), 'AKID/20261009/auto/s3/aws4_request')
  assert.match(url.searchParams.get('X-Amz-Signature') ?? '', /^[0-9a-f]{64}$/)
  assert.deepEqual(upload.headers, { 'Content-Type': 'image/jpeg' })
  assert.equal(upload.expiresAt.toISOString(), '2026-10-09T05:10:00.000Z')
  assert.ok(!upload.url.includes('secret-value'))
  const name = '체육대회 영수증 (1).jpg'
  const download = new URL(await storage.downloadUrl('receipts/a/e1/r1', name, 'image/jpeg'))
  assert.equal(download.pathname, '/vada-receipts/receipts/a/e1/r1')
  assert.equal(download.searchParams.get('X-Amz-Expires'), '300')
  assert.equal(download.searchParams.get('X-Amz-SignedHeaders'), 'host')
  assert.equal(download.searchParams.get('response-content-type'), 'image/jpeg')
  assert.equal(download.searchParams.get('response-content-disposition'), `inline; filename*=UTF-8''${encodeURIComponent(name)}`)
})

test('HEAD는 크기·형식을 읽고 404는 없음으로 본다. DELETE의 404는 지운 것으로 본다', async () => {
  const seen: Request[] = []
  const responses = [
    new Response(null, { status: 200, headers: { 'Content-Length': '1234', 'Content-Type': 'image/jpeg' } }),
    new Response(null, { status: 404 }), new Response(null, { status: 500 }),
    new Response(null, { status: 204 }), new Response(null, { status: 404 }), new Response(null, { status: 403 }),
  ]
  const fetcher = (async (input: RequestInfo | URL) => { seen.push(input as Request); return responses.shift()! }) as typeof fetch
  const storage = createR2Storage(config, fetcher, fixed)
  assert.deepEqual(await storage.head('receipts/a/e1/r1'), { size: 1234, contentType: 'image/jpeg' })
  assert.equal(await storage.head('receipts/a/e1/r1'), null)
  await assert.rejects(storage.head('receipts/a/e1/r1'), /STORAGE_HEAD_FAILED/)
  await storage.remove('receipts/a/e1/r1')
  await storage.remove('receipts/a/e1/r1')
  await assert.rejects(storage.remove('receipts/a/e1/r1'), /STORAGE_DELETE_FAILED/)
  assert.deepEqual(seen.map(request => request.method), ['HEAD', 'HEAD', 'HEAD', 'DELETE', 'DELETE', 'DELETE'])
  for (const request of seen) {
    assert.equal(new URL(request.url).pathname, '/vada-receipts/receipts/a/e1/r1')
    assert.ok(request.headers.get('Authorization')?.startsWith('AWS4-HMAC-SHA256 Credential=AKID/20261009/auto/s3/aws4_request'))
  }
})

test('네 환경변수가 모두 있어야 저장소를 켠다', () => {
  const env = { R2_ACCOUNT_ID: 'acc', R2_ACCESS_KEY_ID: 'AKID', R2_SECRET_ACCESS_KEY: 'secret-value', R2_BUCKET: ' vada-receipts ' }
  assert.deepEqual(r2ConfigFrom(env), config)
  for (const key of Object.keys(env)) assert.equal(r2ConfigFrom({ ...env, [key]: ' ' }), null, key)
  assert.equal(r2ConfigFrom({}), null)
})
