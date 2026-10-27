import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ExpenseResponse } from '@vada/contracts'
import { MISSING, withAccounts, type AccountKit } from '../test-support/accounts.js'

const pathOf = (t: AccountKit, id: string) =>
  `/api/organizations/${t.council.councilId}/expenses/${id}`
const post = (t: AccountKit, id: string, body: unknown, user = 's-financeMember') =>
  t.api.post(pathOf(t, id), body, user)
const detailOf = async (response: Response) => ((await response.json()) as ExpenseResponse).expense

test(
  '지출 계좌를 지정·변경·비우면 이전 계좌와 바꾼 사람이 판에 남고 같은 값과 생략은 판을 늘리지 않는다',
  withAccounts(async t => {
    const first = await t.make({ name: '대표', type: 'main' })
    const second = await t.make({ name: '사업' })
    const { expense } = await t.spend()
    const id = expense!.id
    for (const accountId of [first, second, null]) {
      const response = await post(t, id, { accountId })
      assert.equal(response.status, 200)
      const detail = await detailOf(response)
      assert.deepEqual(
        detail.account,
        accountId ? { id: accountId, name: accountId === first ? '대표' : '사업' } : null,
      )
      assert.deepEqual(detail.history.at(-1)?.changes, [{ field: 'account' }])
      assert.equal(detail.history.at(-1)?.by?.id, t.council.people.financeMember.memberId)
      const before = await t.versions(id)
      assert.equal((await post(t, id, { accountId })).status, 200)
      assert.equal((await post(t, id, { reason: null })).status, 200)
      assert.equal(await t.versions(id), before)
    }
    const snapshots = await t.pg.query(
      "SELECT data->>'account_id' AS account_id FROM record_version WHERE record_id = $1 ORDER BY version_no",
      [id],
    )
    assert.deepEqual(
      snapshots.rows.map(row => (row as { account_id: string | null }).account_id),
      [null, first, second, null],
    )
  }),
)

test(
  '다른 학생회·닫은·없는 계좌는 ACCOUNT_INVALID이고 다른 칸과 판도 바뀌지 않는다',
  withAccounts(async t => {
    const mine = await t.make({ name: '원래 계좌' })
    const foreign = await t.make({}, t.other)
    const closed = await t.make({ closedOn: '2026-01-01' })
    const { expense } = await t.spend({ accountId: mine })
    for (const accountId of [foreign, closed, MISSING]) {
      const response = await post(t, expense!.id, { accountId, reason: '바뀐 사유' })
      assert.equal(response.status, 409)
      assert.deepEqual(await response.json(), { error: 'ACCOUNT_INVALID' })
      assert.deepEqual((await t.expenseDetail(expense!.id)).account, {
        id: mine,
        name: '원래 계좌',
      })
      assert.equal(await t.versions(expense!.id), 1)
    }
  }),
)

test(
  '기존 계좌가 닫혀도 생략·같은 계좌는 보존하고 다른 칸만 고칠 수 있다',
  withAccounts(async t => {
    const accountId = await t.make({})
    const { expense } = await t.spend({ accountId })
    await t.change(accountId, { closedOn: '2026-10-25' })
    assert.equal((await post(t, expense!.id, { accountId })).status, 200)
    assert.equal(await t.versions(expense!.id), 1)
    const detail = await detailOf(await post(t, expense!.id, { reason: '보충' }))
    assert.equal(detail.account?.id, accountId)
    assert.deepEqual(detail.history.at(-1)?.changes, [{ field: 'reason' }])
  }),
)

test(
  '계좌 고치기도 재정부·학생회 경계를 지키고 미인증은 401이다',
  withAccounts(async t => {
    const accountId = await t.make({})
    const { expense } = await t.spend()
    for (const user of ['s-president', 's-planningMember', 's-plain', 'o-financeMember'])
      assert.equal((await post(t, expense!.id, { accountId }, user)).status, 403)
    assert.equal((await t.api.post(pathOf(t, expense!.id), { accountId })).status, 401)
    assert.equal(await t.versions(expense!.id), 1)
  }),
)

test(
  '공개한 기간의 계좌는 고칠 수 있고 완료 행사·취소 지출은 기존 규칙대로 막는다',
  withAccounts(async t => {
    const accountId = await t.make({})
    const period = await t.recordOf('fiscal_period', {
      name: '지난 기간',
      startsOn: '2026-03-01',
      endsOn: '2026-08-31',
    })
    const { expense } = await t.spend({ paidOn: '2026-05-01' })
    await t.recordOf('account_closing', {
      fiscalPeriodId: period,
      publishedAt: new Date('2026-09-01T00:00:00Z'),
    })
    const changed = await post(t, expense!.id, { accountId })
    assert.equal(changed.status, 200)
    assert.equal((await detailOf(changed)).account?.id, accountId)
    const eventId = await t.event()
    const done = await t.spend({ eventId })
    await t.complete(eventId)
    const cancelled = await t.spend()
    await t.api.post(
      `${pathOf(t, cancelled.expense!.id)}/cancel`,
      { reason: '잘못 적음' },
      's-financeMember',
    )
    for (const [id, error] of [
      [done.expense!.id, 'EVENT_COMPLETED'],
      [cancelled.expense!.id, 'EXPENSE_CANCELLED'],
    ]) {
      const response = await post(t, id!, { accountId })
      assert.equal(response.status, 409)
      assert.deepEqual(await response.json(), { error })
    }
  }),
)
