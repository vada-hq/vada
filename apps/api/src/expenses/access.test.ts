import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BudgetResponse, ExpenseDetail, ExpensesResponse } from '@vada/contracts'
import { errorOf, MISSING, runPurchases, type PurchaseKit } from '../test-support/purchases.js'

const FINANCE = 's-financeMember'
const BASE = { vendor: '다이소', description: '마커', amount: 15000, paidOn: '2026-10-25' }

const expenseOf = async (response: Response) =>
  ((await response.json()) as { expense: ExpenseDetail }).expense
const root = (s: PurchaseKit, councilId = s.council.councilId) =>
  `/api/organizations/${councilId}/expenses`

test(
  '요청을 거친 지출의 상세는 결제 내역 줄마다 품목의 예산 항목 이름을 준다',
  runPurchases(async s => {
    const base = `/api/organizations/${s.council.councilId}`
    await s.api.post(
      `${base}/fiscal-periods`,
      { name: '2026 2학기', startsOn: '2026-09-01', endsOn: '2026-12-31' },
      FINANCE,
    )
    const budget = (await (
      await s.api.post(`${base}/budget-items`, { purpose: '소모품', amount: 100000 }, FINANCE)
    ).json()) as BudgetResponse
    const request = await s.made({
      title: '마커와 자석',
      items: [
        { name: '마커', quantity: 3 },
        { name: '자석', quantity: 2 },
      ],
    })
    const [first, second] = request.items.map(item => item.id) as [string, string]
    // 승인한 품목의 예산 항목은 결재가 저장한다.
    assert.equal(
      (
        await s.api.post(
          `${base}/purchase-requests/${request.id}/decisions`,
          {
            decisions: [
              {
                lineItemId: first,
                outcome: 'approved',
                amount: 9000,
                budgetItemId: budget.items[0]!.id,
              },
              {
                lineItemId: second,
                outcome: 'approved',
                amount: 6000,
                budgetItemId: budget.items[0]!.id,
              },
            ],
          },
          FINANCE,
        )
      ).status,
      200,
    )
    const detail = await expenseOf(
      await s.api.post(
        root(s),
        {
          ...BASE,
          lines: [
            { lineItemId: first, amount: 9000 },
            { lineItemId: second, amount: 6000 },
          ],
        },
        FINANCE,
      ),
    )
    assert.deepEqual(
      detail.lines.map(line => [line.name, line.budgetPurpose]),
      [
        ['마커', '소모품'],
        ['자석', '소모품'],
      ],
    )
    // 요청 없는 지출에는 결제 내역이 없다.
    assert.deepEqual((await expenseOf(await s.api.post(root(s), BASE, FINANCE))).lines, [])
  }),
)

test(
  '지출 상세는 로그인하지 않으면 401이다',
  runPurchases(async s => {
    const made = await expenseOf(await s.api.post(root(s), BASE, FINANCE))
    const response = await s.api.get(`${root(s)}/${made.id}`)
    assert.equal(response.status, 401)
    assert.equal(await errorOf(response), 'UNAUTHENTICATED')
    assert.equal((await s.api.get(`${root(s)}/${MISSING}`)).status, 401)
  }),
)

test(
  '다른 학생회 지출의 환급은 404이고 아무것도 바뀌지 않는다',
  runPurchases(async s => {
    const theirs = await expenseOf(
      await s.api.post(
        root(s, s.other.councilId),
        { ...BASE, paidBy: s.other.people.planningMember.memberId },
        'o-financeMember',
      ),
    )
    const response = await s.api.post(`${root(s)}/${theirs.id}/reimburse`, {}, FINANCE)
    assert.equal(response.status, 404)
    assert.equal(await errorOf(response), 'NOT_FOUND')
    assert.equal(await s.versions(theirs.id), 1)
    // 내 학생회 주소에 다른 학생회 사람이 들어와도 403이다.
    const crossed = await s.api.post(`${root(s)}/${theirs.id}/reimburse`, {}, 'o-financeMember')
    assert.equal(crossed.status, 403)
    const own = await expenseOf(
      await s.api.get(`${root(s, s.other.councilId)}/${theirs.id}`, 'o-financeMember'),
    )
    assert.equal(own.reimbursed, false)
  }),
)

test(
  '지출 목록은 내 학생회의 지출만 준다: 다른 학생회 지출이 섞이지 않고 서로 보이지 않는다',
  runPurchases(async s => {
    const mine = await expenseOf(await s.api.post(root(s), { ...BASE, vendor: '우리' }, FINANCE))
    const theirs = await expenseOf(
      await s.api.post(root(s, s.other.councilId), { ...BASE, vendor: '남의' }, 'o-financeMember'),
    )
    const listOf = async (url: string, user: string) =>
      ((await (await s.api.get(url, user)).json()) as ExpensesResponse).expenses.map(
        item => item.id,
      )
    assert.deepEqual(await listOf(root(s), FINANCE), [mine.id])
    assert.deepEqual(await listOf(root(s, s.other.councilId), 'o-financeMember'), [theirs.id])
  }),
)
