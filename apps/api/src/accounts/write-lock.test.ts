import assert from 'node:assert/strict'
import { test } from 'node:test'
import { drizzle } from 'drizzle-orm/pglite'
import { createApp } from '../app.js'
import { createExpenseRoutes } from '../expenses/routes.js'
import { BODY, withAccounts } from '../test-support/accounts.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createAccountRoutes } from './routes.js'

// 쓰기 거래는 학생회 행 잠금 → 운영진 확인 → 계좌 행 읽기 순서다. 잠금을 빼면 이 시험이 실패한다.
test(
  '계좌 쓰기 세 길과 계좌를 쓴 지출은 학생회 행을 FOR NO KEY UPDATE로 잠근 뒤에 계좌를 읽는다',
  withAccounts(async t => {
    const queries: string[] = []
    const db = drizzle(t.pg, { logger: { logQuery: query => void queries.push(query) } })
    const api = caller(
      createApp({
        auth: { handler: async () => new Response() },
        trustedOrigin: ORIGIN,
        accounts: createAccountRoutes(db, testSession),
        expenses: createExpenseRoutes(db, testSession, { receiptKey: 'test-receipt-key' }),
      }),
    )
    const id = await t.make({ name: '기존' })
    const spendId = await t.make({ name: '지출용' })
    const expenses = t.base.replace('accounts', 'expenses')
    const spend = { vendor: '가게', description: '물건', amount: 1000, paidOn: '2020-01-01' }
    const calls: [string, unknown, number][] = [
      [t.base, { ...BODY, name: '새 계좌' }, 201],
      [`${t.base}/${id}`, { ...BODY, name: '고침' }, 200],
      [`${t.base}/${id}/close`, {}, 200],
      [expenses, { ...spend, accountId: spendId }, 201],
    ]
    for (const [path, body, status] of calls) {
      queries.length = 0
      assert.equal((await api.post(path, body, 's-financeMember')).status, status, path)
      const lock = queries.findIndex(
        query => query.includes('from "council"') && query.endsWith(' for no key update'),
      )
      assert.ok(lock >= 0, `${path}: 학생회 행 잠금이 없다`)
      const member = queries.findIndex(query => query.includes('"member_login"'))
      assert.ok(member > lock, `${path}: 운영진 확인이 잠금보다 앞선다`)
      const reads = queries.findIndex(query => query.includes('from "account"'))
      assert.ok(reads > member, `${path}: 계좌를 읽는 문장이 운영진 확인보다 앞선다`)
    }
  }),
)
