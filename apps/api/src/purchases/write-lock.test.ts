import assert from 'node:assert/strict'
import { test } from 'node:test'
import { drizzle } from 'drizzle-orm/pglite'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createBudgetRoutes } from '../budget/routes.js'
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

// 결재는 학생회 행 → 운영진 확인 → 요청 행 → 품목 행 차례로 잠근 뒤에 결재 기록을 읽고 쓴다.
// 이 차례가 같은 품목의 동시 결재와 취소·결재 겹침에서 하나만 되게 한다(실제 PostgreSQL 점검이 같은 두 경우를 더 본다).
test('결재는 학생회 행, 운영진 확인, 요청 행, 품목 행 순으로 잠그고 그 뒤에 결재 기록을 읽는다', async () => {
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
        budget: createBudgetRoutes(db, testSession, { clock: () => noon }),
      }),
    )
    const root = `/api/organizations/${council.councilId}`
    await api.post(
      `${root}/fiscal-periods`,
      { name: '2학기', startsOn: '2026-09-01', endsOn: '2026-12-31' },
      's-financeMember',
    )
    const view = (await (
      await api.post(`${root}/budget-items`, { purpose: '소모품', amount: 1000 }, 's-financeMember')
    ).json()) as { items: { id: string }[] }
    const created = await api.post(
      `${root}/purchase-requests`,
      { title: '마커', items: [{ name: 'a', quantity: 1 }] },
      's-planningMember',
    )
    const { request } = (await created.json()) as {
      request: { id: string; items: { id: string }[] }
    }
    queries.length = 0
    const decided = await api.post(
      `${root}/purchase-requests/${request.id}/decisions`,
      {
        decisions: [
          {
            lineItemId: request.items[0]!.id,
            outcome: 'approved',
            amount: 100,
            budgetItemId: view.items[0]!.id,
          },
        ],
      },
      's-financeMember',
    )
    assert.equal(decided.status, 200)
    const locked = (table: string) =>
      queries.findIndex(
        query => query.includes(`from "${table}"`) && query.endsWith(' for no key update'),
      )
    const councilLock = locked('council')
    const actor = queries.findIndex(query => query.includes('"member_login"'))
    const requestLock = locked('request')
    const itemLock = locked('line_item')
    const decidedRead = queries.findIndex(
      query => query.includes('from "approval"') && query.includes('"target_id" in'),
    )
    const write = queries.findIndex(query => query.includes('insert into "approval"'))
    assert.ok(councilLock >= 0 && actor > councilLock, '학생회 잠금 뒤에 운영진 확인')
    assert.ok(requestLock > actor, '요청 행 잠금이 운영진 확인 뒤')
    assert.ok(itemLock > requestLock, '품목 행 잠금이 요청 행 잠금 뒤')
    assert.ok(decidedRead > itemLock, '이미 결재했는지는 품목을 잠근 뒤에 읽는다')
    assert.ok(write > decidedRead, '결재 기록은 그 뒤에 쓴다')
  } finally {
    await close()
  }
})

// 기간 겹침과 같은 이름 검사는 학생회 행 잠금에 기댄다. 기간 만들기와 항목 더하기가 그 잠금과 운영진 확인 뒤에 읽고 쓴다.
test('기간 만들기와 항목 더하기는 학생회 행 잠금과 운영진 확인 뒤에 읽고 쓴다', async () => {
  const { pg, close } = await createTestDb()
  try {
    const queries: string[] = []
    const db = drizzle(pg, { logger: { logQuery: query => void queries.push(query) } })
    const council = await seedCouncil(db, pg)
    const api = caller(
      createApp({
        auth: { handler: async () => new Response() },
        trustedOrigin: ORIGIN,
        budget: createBudgetRoutes(db, testSession, { clock: () => noon }),
      }),
    )
    const root = `/api/organizations/${council.councilId}`
    const orderOf = (readFrom: string, writeInto: string) => {
      const lock = queries.findIndex(
        query => query.includes('from "council"') && query.endsWith(' for no key update'),
      )
      const actor = queries.findIndex(query => query.includes('"member_login"'))
      const read = queries.findIndex(query => query.includes(`from "${readFrom}"`))
      const write = queries.findIndex(query => query.includes(`insert into "${writeInto}"`))
      assert.ok(lock >= 0 && actor > lock, `${writeInto}: 학생회 잠금 뒤에 운영진 확인`)
      assert.ok(read > actor, `${writeInto}: 겹침·기간 읽기는 운영진 확인 뒤`)
      assert.ok(write > read, `${writeInto}: 쓰기는 읽기 뒤`)
    }
    queries.length = 0
    const period = { name: '2학기', startsOn: '2026-09-01', endsOn: '2026-12-31' }
    assert.equal((await api.post(`${root}/fiscal-periods`, period, 's-financeMember')).status, 201)
    orderOf('fiscal_period', 'fiscal_period')
    queries.length = 0
    const item = { purpose: '소모품', amount: 1 }
    assert.equal((await api.post(`${root}/budget-items`, item, 's-financeMember')).status, 201)
    orderOf('fiscal_period', 'budget_item')
  } finally {
    await close()
  }
})
