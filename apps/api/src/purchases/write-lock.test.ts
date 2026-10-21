import assert from 'node:assert/strict'
import { test } from 'node:test'
import { drizzle } from 'drizzle-orm/pglite'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createPurchaseRoutes } from './routes.js'

const noon = new Date('2026-10-25T03:00:00Z')

// 쓰기 거래는 학생회 행 잠금 → 운영진 확인 → 요청 행 읽기와 잠금 순서다(명세 '위험').
// 잠금을 빼거나 잠그지 않는 거래로 바꾸면 이 시험이 실패한다. 결재와 취소가 겹칠 때 하나만 되는 것이 이 순서에 기댄다.
test('구매 요청 쓰기 둘은 학생회 행을 FOR NO KEY UPDATE로 잠근 뒤에 운영진을 확인하고, 취소는 요청 행도 잠근다', async () => {
  const { pg, close } = await createTestDb()
  try {
    const queries: string[] = []
    const db = drizzle(pg, { logger: { logQuery: query => void queries.push(query) } })
    const council = await seedCouncil(db, pg)
    const api = caller(
      createApp({
        auth: { handler: async () => new Response() },
        trustedOrigin: ORIGIN,
        purchases: createPurchaseRoutes(db, testSession, { clock: () => noon }),
      }),
    )
    const base = `/api/organizations/${council.councilId}/purchase-requests`
    const created = await api.post(
      base,
      { title: '마커', items: [{ name: 'a', quantity: 1 }] },
      's-planningMember',
    )
    assert.equal(created.status, 201)
    const { request } = (await created.json()) as { request: { id: string } }
    const lockOf = (list: string[]) =>
      list.findIndex(
        query => query.includes('from "council"') && query.endsWith(' for no key update'),
      )
    queries.length = 0
    await api.post(base, { title: '둘', items: [{ name: 'a', quantity: 1 }] }, 's-planningMember')
    const lock = lockOf(queries)
    assert.ok(lock >= 0, '만들기: 학생회 행 잠금이 없다')
    assert.ok(
      queries.findIndex(query => query.includes('"member_login"')) > lock,
      '만들기: 운영진 확인이 잠금보다 앞선다',
    )
    assert.ok(
      queries.findIndex(query => query.includes('insert into "record"')) >
        queries.findIndex(query => query.includes('"member_login"')),
      '만들기: 쓰기가 운영진 확인보다 앞선다',
    )
    queries.length = 0
    assert.equal(
      (await api.post(`${base}/${request.id}/cancel`, {}, 's-planningMember')).status,
      204,
    )
    const councilLock = lockOf(queries)
    const actor = queries.findIndex(query => query.includes('"member_login"'))
    const requestLock = queries.findIndex(
      query => query.includes('from "request"') && query.endsWith(' for no key update'),
    )
    const decided = queries.findIndex(query => query.includes('from "approval"'))
    assert.ok(councilLock >= 0 && actor > councilLock, '취소: 학생회 잠금 뒤에 운영진 확인')
    assert.ok(requestLock > actor, '취소: 요청 행 잠금이 운영진 확인보다 앞선다')
    assert.ok(decided > requestLock, '취소: 결재 수는 요청 행을 잠근 뒤에 센다')
  } finally {
    await close()
  }
})
