import assert from 'node:assert/strict'
import { test } from 'node:test'
import { strFromU8, unzipSync } from 'fflate'
import { createApp } from '../app.js'
import { errorOf, FINANCE } from '../test-support/closing.js'
import { photoOf, seedExport, zipPath } from '../test-support/closing-export.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { withSettlement } from '../test-support/settlement.js'
import { createClosingExportRoutes } from './export-routes.js'

// 증빙 묶음(기능 009 조각 5): 감사용 엑셀과 증빙번호로 이름 붙은 사진을 ZIP 하나로 흘려보낸다.

const bytesOf = async (response: Response) => new Uint8Array(await response.arrayBuffer())

test(
  '묶음: 감사용 엑셀과 증빙번호로 이름 붙은 사진이 들고 바이트가 저장소와 같다. 이름에 사용처가 없다',
  withSettlement(async t => {
    const { period, later, earlier } = await seedExport(t)
    await photoOf(t, later, 'k/later-1', [1, 2, 3, 4])
    await photoOf(t, later, 'k/later-2', [9, 8, 7])
    await photoOf(t, earlier, 'k/earlier-1', [5, 5, 5, 5, 5])
    const response = await t.api.get(zipPath(t, period), FINANCE)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'application/zip')
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.match(response.headers.get('content-disposition') ?? '', /filename\*=UTF-8''/)
    const files = unzipSync(await bytesOf(response))
    assert.deepEqual(Object.keys(files).sort(), [
      '2026-2 결산(감사용) 2026-10-25.xlsx',
      '증빙/1-1_영수증.jpg',
      '증빙/2-1_영수증.jpg',
      '증빙/2-2_영수증.jpg',
    ])
    assert.deepEqual([...files['증빙/1-1_영수증.jpg']!], [5, 5, 5, 5, 5])
    assert.deepEqual([...files['증빙/2-1_영수증.jpg']!], [1, 2, 3, 4])
    assert.deepEqual([...files['증빙/2-2_영수증.jpg']!], [9, 8, 7])
    assert.ok(!Object.keys(files).some(name => name.includes('문구점') || name.includes('식당')))
    // 안의 엑셀은 감사용이다
    assert.ok(files['2026-2 결산(감사용) 2026-10-25.xlsx']!.length > 1000)
  }),
)

test(
  '못 읽은 사진은 빠진 증빙.txt에 증빙번호로 적고 나머지는 든다. 로그에 키와 파일 이름이 없다',
  withSettlement(async t => {
    const { period, later, earlier } = await seedExport(t)
    await photoOf(t, earlier, 'k/secret-key-a', [1, 1])
    await photoOf(t, later, 'k/secret-key-b', [2, 2])
    await photoOf(t, later, 'k/secret-key-c', [3, 3])
    t.store.unreadable.add('k/secret-key-b')
    const logged: string[] = []
    const originals = { log: console.log, warn: console.warn, error: console.error }
    for (const level of ['log', 'warn', 'error'] as const)
      console[level] = (...args: unknown[]) => void logged.push(args.map(String).join(' '))
    let response: Response
    try {
      response = await t.api.get(zipPath(t, period), FINANCE)
    } finally {
      Object.assign(console, originals)
    }
    assert.equal(response.status, 200)
    const files = unzipSync(await bytesOf(response))
    assert.ok(files['증빙/1-1_영수증.jpg'])
    assert.ok(files['증빙/2-2_영수증.jpg'])
    assert.ok(!files['증빙/2-1_영수증.jpg'])
    const missing = strFromU8(files['빠진 증빙.txt']!)
    assert.ok(missing.includes('증빙/2-1_영수증.jpg'))
    assert.ok(!missing.includes('2-2_'))
    assert.ok(!missing.includes('secret-key'))
    assert.ok(!logged.join('\n').includes('secret-key'))
    assert.ok(!logged.join('\n').includes('.jpg'))
  }),
)

test(
  '빠진 사진이 없으면 빠진 증빙.txt가 없다',
  withSettlement(async t => {
    const { period, earlier } = await seedExport(t)
    await photoOf(t, earlier, 'k/ok', [1])
    const files = unzipSync(await bytesOf(await t.api.get(zipPath(t, period), FINANCE)))
    assert.ok(!files['빠진 증빙.txt'])
  }),
)

test(
  '사진은 받는 만큼만 한 장씩 읽는다',
  withSettlement(async t => {
    const { period, later } = await seedExport(t)
    for (const index of [1, 2, 3, 4, 5]) await photoOf(t, later, `k/p${index}`, [index])
    const reads: string[] = []
    const read = t.store.storage.read.bind(t.store.storage)
    t.store.storage.read = key => {
      reads.push(key)
      return read(key)
    }
    const response = await t.api.get(zipPath(t, period), FINANCE)
    await new Promise(resolve => setTimeout(resolve, 50))
    assert.ok(reads.length <= 1, `받기 전에 ${reads.length}장을 읽었다`)
    await response.body!.cancel()
  }),
)

test(
  '권한과 상한: 재정부만, 다른 학생회 404·403, 로그인 없으면 401, 사진이 많거나 크면 409',
  withSettlement(async t => {
    const { period, earlier } = await seedExport(t)
    const status = async (user?: string) => (await t.api.get(zipPath(t, period), user)).status
    assert.equal(await status(), 401)
    assert.equal(await status('s-planningMember'), 403)
    assert.equal(await status('s-president'), 403)
    assert.equal(await status('o-financeMember'), 403)
    const theirs = await t.budgetOf(t.other)
    assert.equal((await t.api.get(zipPath(t, theirs.period), FINANCE)).status, 404)
    // 합 1GB를 넘으면 묶음만 409이고 엑셀은 된다
    const evidence = await t.evidence(earlier)
    await t.make(t.council, 'file', {
      name: 'evidence.jpg',
      mediaType: 'image/jpeg',
      sizeBytes: 1_000_000_001,
      storageKey: 'k/huge',
      attachedToId: evidence,
    })
    const big = await t.api.get(zipPath(t, period), FINANCE)
    assert.equal(big.status, 409)
    assert.equal(await errorOf(big), 'EXPORT_TOO_LARGE')
  }),
)

test(
  '저장소가 없으면 묶음만 503이고, 권한이 먼저다',
  withSettlement(async t => {
    const { period } = await seedExport(t)
    const app = caller(
      createApp({
        auth: { handler: async () => new Response() },
        trustedOrigin: ORIGIN,
        closingExport: createClosingExportRoutes(t.db, testSession, {
          clock: () => new Date('2026-10-25T03:00:00Z'),
        }),
      }),
    )
    const got = await app.get(zipPath(t, period), FINANCE)
    assert.equal(got.status, 503)
    assert.equal(await errorOf(got), 'STORAGE_NOT_CONFIGURED')
    assert.equal((await app.get(zipPath(t, period), 's-planningMember')).status, 403)
  }),
)

test(
  '같은 학생회의 묶음이 도는 중이면 429이고, 끝나거나 끊기면 다시 받는다',
  withSettlement(async t => {
    const { period } = await seedExport(t)
    const first = await t.api.get(zipPath(t, period), FINANCE)
    assert.equal(first.status, 200)
    const second = await t.api.get(zipPath(t, period), FINANCE)
    assert.equal(second.status, 429)
    assert.equal(await errorOf(second), 'TOO_MANY_REQUESTS')
    await bytesOf(first)
    const again = await t.api.get(zipPath(t, period), FINANCE)
    assert.equal(again.status, 200)
    await bytesOf(again)
    const dropped = await t.api.get(zipPath(t, period), FINANCE)
    assert.equal(dropped.status, 200)
    await dropped.body!.cancel()
    const last = await t.api.get(zipPath(t, period), FINANCE)
    assert.equal(last.status, 200)
    await bytesOf(last)
  }),
)

test(
  '계정마다 한도를 넘으면 429다(시험은 한도를 2로 둔다)',
  withSettlement(
    async t => {
      const { period } = await seedExport(t)
      for (let turn = 0; turn < 2; turn += 1) {
        const response = await t.api.get(zipPath(t, period), FINANCE)
        assert.equal(response.status, 200)
        await bytesOf(response)
      }
      assert.equal((await t.api.get(zipPath(t, period), FINANCE)).status, 429)
      // 다른 계정은 따로 센다
      assert.equal((await t.api.get(zipPath(t, period), 's-planningMember')).status, 403)
    },
    { bundleLimit: 2 },
  ),
)
