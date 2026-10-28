import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createR2Storage, r2ConfigFrom } from './storage.js'

const config = {
  accountId: 'acc',
  accessKeyId: 'AKID',
  secretAccessKey: 'secret-value',
  bucket: 'vada-receipts',
}
const fixed = () => new Date('2026-10-09T05:00:00.000Z')

test('올리기 주소는 버킷 경로·10분 만료·형식 서명을 담고, 보기 주소는 5분 만료와 파일 이름을 담는다', async () => {
  const storage = createR2Storage(config, fetch, fixed)
  const upload = await storage.uploadUrl('receipts/a/e1/r1', 'image/jpeg')
  const url = new URL(upload.url)
  assert.equal(url.origin, 'https://acc.r2.cloudflarestorage.com')
  assert.equal(url.pathname, '/vada-receipts/receipts/a/e1/r1')
  assert.equal(url.searchParams.get('X-Amz-Expires'), '600')
  assert.equal(url.searchParams.get('X-Amz-SignedHeaders'), 'content-type;host;if-none-match')
  assert.equal(url.searchParams.get('X-Amz-Date'), '20261009T050000Z')
  assert.equal(url.searchParams.get('X-Amz-Credential'), 'AKID/20261009/auto/s3/aws4_request')
  assert.match(url.searchParams.get('X-Amz-Signature') ?? '', /^[0-9a-f]{64}$/)
  assert.deepEqual(upload.headers, { 'Content-Type': 'image/jpeg', 'If-None-Match': '*' })
  assert.equal(upload.expiresAt.toISOString(), '2026-10-09T05:10:00.000Z')
  assert.ok(!upload.url.includes('secret-value'))
  const name = '체육대회 영수증 (1).jpg'
  const signed = await storage.downloadUrl('receipts/a/e1/r1', name, 'image/jpeg')
  // 공백이 주소에서 +로 나가면 저장소가 서명할 때와 다른 값으로 읽을 수 있다.
  assert.ok(!signed.includes('+'), signed)
  const download = new URL(signed)
  assert.equal(download.pathname, '/vada-receipts/receipts/a/e1/r1')
  assert.equal(download.searchParams.get('X-Amz-Expires'), '300')
  assert.equal(download.searchParams.get('X-Amz-SignedHeaders'), 'host')
  assert.equal(download.searchParams.get('response-content-type'), 'image/jpeg')
  assert.equal(
    download.searchParams.get('response-content-disposition'),
    `inline;filename*=UTF-8''${encodeURIComponent(name)}`,
  )
})

test('HEAD는 크기·형식을 읽고 404는 없음으로 본다. DELETE의 404는 지운 것으로 본다', async () => {
  const seen: Request[] = []
  const responses = [
    new Response(null, {
      status: 200,
      headers: {
        'Content-Length': '1234',
        'Content-Type': 'image/jpeg',
        'Last-Modified': 'Fri, 09 Oct 2026 05:00:00 GMT',
      },
    }),
    new Response(null, { status: 404 }),
    new Response(null, { status: 500 }),
    new Response(null, { status: 204 }),
    new Response(null, { status: 404 }),
    new Response(null, { status: 403 }),
  ]
  const fetcher = (async (input: RequestInfo | URL) => {
    seen.push(input as Request)
    return responses.shift()!
  }) as typeof fetch
  const storage = createR2Storage(config, fetcher, fixed)
  assert.deepEqual(await storage.head('receipts/a/e1/r1'), {
    size: 1234,
    contentType: 'image/jpeg',
    lastModified: fixed(),
  })
  assert.equal(await storage.head('receipts/a/e1/r1'), null)
  await assert.rejects(storage.head('receipts/a/e1/r1'), /STORAGE_HEAD_FAILED/)
  await storage.remove('receipts/a/e1/r1')
  await storage.remove('receipts/a/e1/r1')
  await assert.rejects(storage.remove('receipts/a/e1/r1'), /STORAGE_DELETE_FAILED/)
  assert.deepEqual(
    seen.map(request => request.method),
    ['HEAD', 'HEAD', 'HEAD', 'DELETE', 'DELETE', 'DELETE'],
  )
  for (const request of seen) {
    assert.equal(new URL(request.url).pathname, '/vada-receipts/receipts/a/e1/r1')
    assert.ok(
      request.headers
        .get('Authorization')
        ?.startsWith('AWS4-HMAC-SHA256 Credential=AKID/20261009/auto/s3/aws4_request'),
    )
  }
})

test('네 환경변수가 모두 있어야 저장소를 켠다', () => {
  const env = {
    R2_ACCOUNT_ID: 'acc',
    R2_ACCESS_KEY_ID: 'AKID',
    R2_SECRET_ACCESS_KEY: 'secret-value',
    R2_BUCKET: ' vada-receipts ',
  }
  assert.deepEqual(r2ConfigFrom(env), config)
  for (const key of Object.keys(env)) assert.equal(r2ConfigFrom({ ...env, [key]: ' ' }), null, key)
  assert.equal(r2ConfigFrom({}), null)
})

test('읽기는 바이트를 주고 404는 없음으로 보며 다른 실패는 키를 담지 않은 오류로 던진다', async () => {
  const responses = [
    new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
    new Response(null, { status: 404 }),
    new Response(null, { status: 500 }),
  ]
  const fetcher = (() => Promise.resolve(responses.shift()!)) as typeof fetch
  const storage = createR2Storage(config, fetcher, fixed)
  assert.deepEqual([...(await storage.read('receipts/a/e1/r1'))!], [1, 2, 3])
  assert.equal(await storage.read('receipts/a/e1/r1'), null)
  await assert.rejects(
    () => storage.read('receipts/a/e1/r1'),
    error => error instanceof Error && error.message === 'STORAGE_READ_FAILED',
  )
})

test('복사는 새 키에 PUT하고 복사 원본을 버킷과 키로 건네며, 실패는 키를 담지 않은 오류로 던진다', async () => {
  const seen: Request[] = []
  const responses = [
    new Response('<CopyObjectResult/>', { status: 200 }),
    new Response(null, { status: 500 }),
  ]
  const fetcher = (async (input: RequestInfo | URL) => {
    seen.push(input as Request)
    return responses.shift()!
  }) as typeof fetch
  const storage = createR2Storage(config, fetcher, fixed)
  await storage.copy('chat/a/b/c d', 'evidence/a/b/c')
  await assert.rejects(
    () => storage.copy('chat/a/b/c', 'evidence/a/b/d'),
    error => error instanceof Error && error.message === 'STORAGE_COPY_FAILED',
  )
  const [first] = seen
  assert.equal(first!.method, 'PUT')
  assert.equal(new URL(first!.url).pathname, '/vada-receipts/evidence/a/b/c')
  assert.equal(first!.headers.get('x-amz-copy-source'), 'vada-receipts/chat/a/b/c%20d')
  assert.ok(first!.headers.get('Authorization')?.includes('x-amz-copy-source'))
})

test('ListObjectsV2는 접두어와 쪽 토큰을 서명하고 키·올린 시각·다음 토큰을 읽는다', async () => {
  const seen: Request[] = []
  const responses = [
    `<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
      <EncodingType>url</EncodingType><IsTruncated>true</IsTruncated>
      <Contents><Key>chat%2Fa%2F%ED%95%9C%20%26%2B.jpg</Key>
      <LastModified>2026-10-09T05:00:00.000Z</LastModified></Contents>
      <NextContinuationToken>next&amp;+&#47;=</NextContinuationToken></ListBucketResult>`,
    '<ListBucketResult><EncodingType>url</EncodingType><IsTruncated>false</IsTruncated></ListBucketResult>',
  ]
  const fetcher = (async (request: RequestInfo | URL) => {
    seen.push(request as Request)
    return new Response(responses.shift())
  }) as typeof fetch
  const storage = createR2Storage(config, fetcher, fixed)
  assert.deepEqual(await storage.list('chat/'), {
    objects: [{ key: 'chat/a/한 &+.jpg', lastModified: fixed() }],
    continuationToken: 'next&+/=',
  })
  assert.deepEqual(await storage.list('chat/', 'next&+/='), { objects: [] })
  for (const request of seen) {
    const url = new URL(request.url)
    assert.equal(request.method, 'GET')
    assert.equal(url.pathname, '/vada-receipts/')
    assert.equal(url.searchParams.get('list-type'), '2')
    assert.equal(url.searchParams.get('prefix'), 'chat/')
    assert.equal(url.searchParams.get('encoding-type'), 'url')
    assert.equal(url.searchParams.get('max-keys'), '1000')
    assert.ok(request.headers.has('Authorization'))
    assert.ok(request.signal)
  }
  assert.equal(new URL(seen[1]!.url).searchParams.get('continuation-token'), 'next&+/=')
})

test('목록 실패·깨진 응답·시각 누락과 잘못된 쪽 토큰은 객체를 돌려주지 않는다', async () => {
  const invalid = [
    '<Error><Message>secret-key</Message></Error>',
    '<ListBucketResult><IsTruncated>true</IsTruncated></ListBucketResult>',
    '<ListBucketResult><IsTruncated>maybe</IsTruncated></ListBucketResult>',
    '<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>chat/a</Key></Contents></ListBucketResult>',
    '<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>chat/a</Key><LastModified>bad</LastModified></Contents></ListBucketResult>',
    '<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>chat/a</Key><LastModified>0</LastModified></Contents></ListBucketResult>',
    '<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>chat/a</Key><LastModified>2026-02-30T00:00:00Z</LastModified></Contents></ListBucketResult>',
    '<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>chat/%ZZ</Key><LastModified>2026-10-09T05:00:00Z</LastModified></Contents></ListBucketResult>',
    '<ListBucketResult><IsTruncated>false</IsTruncated>',
    '<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>chat/a</Key><Key>chat/b</Key><LastModified>2026-10-09T05:00:00Z</LastModified></Contents></ListBucketResult>',
    '<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>chat/a&#x110000;</Key><LastModified>2026-10-09T05:00:00Z</LastModified></Contents></ListBucketResult>',
    '<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>chat/a</Key><LastModified>2026-10-09T05:00:00Z</LastModified></Contents></ListBucketResult><Error/>',
  ]
  for (const body of invalid) {
    const storage = createR2Storage(
      config,
      () =>
        Promise.resolve(
          new Response(
            body.replace(
              '<ListBucketResult>',
              '<ListBucketResult><EncodingType>url</EncodingType>',
            ),
          ),
        ),
      fixed,
    )
    await assert.rejects(storage.list('chat/'), /STORAGE_LIST_FAILED/)
  }
  const failed = createR2Storage(
    config,
    () => Promise.resolve(new Response(null, { status: 503 })),
    fixed,
  )
  await assert.rejects(failed.list('chat/'), /STORAGE_LIST_FAILED/)
  const missingDate = createR2Storage(config, () => Promise.resolve(new Response(null)), fixed)
  assert.equal((await missingDate.head('chat/a'))?.lastModified, null)
})
