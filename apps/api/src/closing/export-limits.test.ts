import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApp } from '../app.js'
import { errorOf, FINANCE, readClosing } from '../test-support/closing.js'
import { exportPath, seedExport, zipPath } from '../test-support/closing-export.js'
import { ORIGIN, testSession } from '../test-support/http.js'
import { withSettlement } from '../test-support/settlement.js'
import { createClosingExportRoutes } from './export-routes.js'

// 내보내기 상한과 연결 끊김(기능 009 조각 5 검토 반영).

const bytesOf = async (response: Response) => new Uint8Array(await response.arrayBuffer())

test(
  '연결이 끊기면 자리를 푼다: 이미 끊긴 요청도, 받는 중에 끊긴 요청도',
  withSettlement(async t => {
    const { period } = await seedExport(t)
    const app = createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      closingExport: createClosingExportRoutes(t.db, testSession, {
        clock: () => new Date('2026-10-25T03:00:00Z'),
        storage: t.store.storage,
      }),
    })
    const get = (signal?: AbortSignal) =>
      app.request(zipPath(t, period), {
        headers: { 'x-test-user': FINANCE },
        ...(signal ? { signal } : {}),
      })
    // 이미 끊긴 요청은 자리를 잡자마자 푼다
    const gone = new AbortController()
    gone.abort()
    await get(gone.signal)
    const first = await get()
    assert.equal(first.status, 200)
    await bytesOf(first)
    // 받는 중에 신호만 오고 스트림 취소는 없어도 자리가 풀린다
    const midway = new AbortController()
    const open = await get(midway.signal)
    assert.equal(open.status, 200)
    assert.equal((await get()).status, 429)
    midway.abort()
    const after = await get()
    assert.equal(after.status, 200)
    await bytesOf(after)
  }),
)

test(
  '사진이 2,000장을 넘으면 묶음만 409다. 엑셀은 된다',
  withSettlement(async t => {
    const { period, earlier } = await seedExport(t)
    const evidence = await t.evidence(earlier)
    await t.pg.query(
      `WITH r AS (INSERT INTO record (kind, council_id) SELECT 'file', $1 FROM generate_series(1, 2001) RETURNING id)
       INSERT INTO file (id, name, media_type, size_bytes, storage_key, attached_to_id)
       SELECT id, 'e.jpg', 'image/jpeg', 1, 'k/' || id, $2 FROM r`,
      [t.council.councilId, evidence],
    )
    const big = await t.api.get(zipPath(t, period), FINANCE)
    assert.equal(big.status, 409)
    assert.equal(await errorOf(big), 'EXPORT_TOO_LARGE')
    assert.equal((await t.api.get(exportPath(t, period, 'audit'), FINANCE)).status, 200)
    const info = (await readClosing(t, period)).exportInfo
    assert.deepEqual([info.workbookTooLarge, info.bundleTooLarge], [false, true])
  }),
)

test(
  '사진 합이 1GB를 넘으면 엑셀은 200이고 묶음은 409다',
  withSettlement(async t => {
    const { period, earlier } = await seedExport(t)
    const evidence = await t.evidence(earlier)
    await t.make(t.council, 'file', {
      name: 'evidence.jpg',
      mediaType: 'image/jpeg',
      sizeBytes: 1_000_000_001,
      storageKey: 'k/huge',
      attachedToId: evidence,
    })
    assert.equal((await t.api.get(exportPath(t, period, 'audit'), FINANCE)).status, 200)
    const big = await t.api.get(zipPath(t, period), FINANCE)
    assert.equal(big.status, 409)
    assert.equal(await errorOf(big), 'EXPORT_TOO_LARGE')
  }),
)

test(
  '수입이 1,000건을 넘으면 엑셀도 묶음도 409다',
  withSettlement(async t => {
    const { period } = await seedExport(t)
    await t.pg.query(
      `WITH r AS (INSERT INTO record (kind, council_id) SELECT 'income', $1 FROM generate_series(1, 1000) RETURNING id)
       INSERT INTO income (id, fiscal_period_id, source, amount, received_on)
       SELECT id, $2, 'fee', 1, '2026-10-21' FROM r`,
      [t.council.councilId, period],
    )
    for (const path of [exportPath(t, period, 'public'), zipPath(t, period)]) {
      const big = await t.api.get(path, FINANCE)
      assert.equal(big.status, 409, path)
      assert.equal(await errorOf(big), 'EXPORT_TOO_LARGE')
    }
    const info = (await readClosing(t, period)).exportInfo
    assert.deepEqual(
      [info.workbookTooLarge, info.bundleTooLarge, info.bundleAvailable],
      [true, true, true],
    )
  }),
)
