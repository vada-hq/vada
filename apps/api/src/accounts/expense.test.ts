import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MISSING, withAccounts } from '../test-support/accounts.js'

const errorOf = async (response: Response) => ((await response.json()) as { error: string }).error

test(
  '지출에 계좌를 보내면 남고 상세에 계좌 이름이 보인다',
  withAccounts(async t => {
    const id = await t.make({ name: '대표', type: 'main' })
    const { status, expense } = await t.spend({ accountId: id })
    assert.equal(status, 201)
    assert.deepEqual(expense!.account, { id, name: '대표' })
    assert.deepEqual((await t.expenseDetail(expense!.id, 's-plain')).account, { id, name: '대표' })
    assert.equal(await t.count('SELECT count(*) AS n FROM expense WHERE account_id = $1', [id]), 1)
  }),
)

test(
  '계좌 없이 적으면 account가 null이다(기존 동작)',
  withAccounts(async t => {
    const { status, expense } = await t.spend()
    assert.equal(status, 201)
    assert.equal(expense!.account, null)
  }),
)

test(
  '닫은 계좌와 다른 학생회 계좌와 없는 계좌는 409 ACCOUNT_INVALID이고 지출이 생기지 않는다',
  withAccounts(async t => {
    const closed = await t.make({ name: '닫음' })
    await t.change(closed, { closedOn: '2026-01-01' })
    const foreign = await t.make({ name: '남의 것' }, t.other)
    for (const accountId of [closed, foreign, MISSING]) {
      const { status, response } = await t.spend({ accountId })
      assert.equal(status, 409, accountId)
      assert.equal(await errorOf(response), 'ACCOUNT_INVALID')
    }
    assert.equal(await t.count('SELECT count(*) AS n FROM expense'), 0)
    assert.equal(await t.count("SELECT count(*) AS n FROM record WHERE kind = 'expense'"), 0)
  }),
)

test(
  '번호 형식이 틀리면 400, 회장단은 403이고, 닫은 뒤에도 기존 지출에는 계좌 이름이 보인다',
  withAccounts(async t => {
    assert.equal((await t.spend({ accountId: 'x' })).status, 400)
    const id = await t.make({})
    assert.equal((await t.spend({ accountId: id }, 's-president')).status, 403)
    const { expense } = await t.spend({ accountId: id })
    assert.equal((await t.post(`/${id}/close`, {})).status, 200)
    assert.deepEqual((await t.expenseDetail(expense!.id)).account, { id, name: '운영비' })
  }),
)
