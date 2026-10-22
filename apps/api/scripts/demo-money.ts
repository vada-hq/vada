import { koreanYearOf } from '@vada/contracts'
import { createAccount } from '../src/accounts/service.js'
import { addBudgetItem, createFiscalPeriod } from '../src/budget/service.js'
import type { Tx } from '../src/db/types.js'
import { createExpense } from '../src/expenses/service.js'
import { createPurchaseRequest } from '../src/purchases/service.js'
import { decideLineItems } from '../src/purchases/decide.js'
import type { DemoCast } from './demo-people.js'
import { demoDay } from './demo-dates.js'

// 시연 학생회의 돈: 계좌 둘, 이번 해 예산, 구매 요청(결재 대기, 일부 승인), 환급 전 지출 하나(증빙 사진 없음).
// 돈을 쓰는 일은 재정부원이 하고, 요청은 요청한 운영진이 낸다. 모두 서비스 함수를 거쳐 판과 같은 검사를 받는다.
// 계좌번호와 예금주는 지어낸 것이다.

async function addAccounts(tx: Tx, cast: DemoCast) {
  await createAccount(tx, cast.financeHead, {
    name: '학생회비 통장',
    bank: '시연은행',
    accountNumber: '000-00-000001',
    holder: 'VADA 시연 학생회',
    type: 'main',
  })
  const business = await createAccount(tx, cast.financeHead, {
    name: '행사 통장',
    bank: '시연은행',
    accountNumber: '000-00-000002',
    holder: 'VADA 시연 학생회',
    type: 'business',
  })
  return business.id
}

const BUDGET_ITEMS = [
  { purpose: '행사 운영비', amount: 1_500_000 },
  { purpose: '비품 구입', amount: 300_000 },
  { purpose: '홍보물 제작', amount: 400_000 },
] as const

async function addBudget(tx: Tx, cast: DemoCast, now: Date) {
  const year = koreanYearOf(now)
  await createFiscalPeriod(tx, cast.financeHead, {
    name: `${year}년`,
    startsOn: `${year}-01-01`,
    endsOn: `${year}-12-31`,
  })
  let items: { id: string; purpose: string }[] = []
  for (const item of BUDGET_ITEMS)
    items = (await addBudgetItem(tx, cast.financeHead, item, now)).items
  const idOf = (purpose: string) => items.find(item => item.purpose === purpose)?.id
  const events = idOf(BUDGET_ITEMS[0].purpose)
  if (!events) throw new Error('Demo budget item is missing')
  return events
}

async function addRequests(tx: Tx, cast: DemoCast, ctx: { eventsBudgetItemId: string; now: Date }) {
  const { eventsBudgetItemId, now } = ctx
  await createPurchaseRequest(
    tx,
    cast.publicityMember,
    {
      title: '총회 홍보 포스터 인쇄',
      body: '학과 게시판 열 곳에 붙일 포스터입니다.',
      neededBy: demoDay(now, 'posterNeededBy'),
      items: [{ name: 'A2 포스터 인쇄', quantity: 10, link: null, options: '무광' }],
    },
    now,
  )
  const { request } = await createPurchaseRequest(
    tx,
    cast.planningMember,
    {
      title: '환영회 간식',
      body: null,
      neededBy: null,
      items: [
        { name: '과자 세트', quantity: 20, link: null, options: null },
        { name: '탄산음료 묶음', quantity: 40, link: null, options: null },
      ],
    },
    now,
  )
  const [snack, drink] = request.items
  if (!snack || !drink) throw new Error('Demo request has no items')
  await decideLineItems(tx, cast.financeHead, request.id, {
    now,
    input: {
      decisions: [
        {
          lineItemId: snack.id,
          outcome: 'approved',
          amount: 60_000,
          budgetItemId: eventsBudgetItemId,
        },
        { lineItemId: drink.id, outcome: 'rejected', reason: '행사장 매점에서 살 수 있습니다.' },
      ],
    },
  })
}

// 먼저 낸 사람(기획부원)이 있고 환급하지 않은 지출 하나. 증빙 사진은 붙이지 않는다.
async function addExpense(
  tx: Tx,
  cast: DemoCast,
  ctx: { accountId: string; budgetItemId: string; now: Date },
) {
  await createExpense(
    tx,
    cast.financeHead,
    {
      vendor: '시연마트',
      description: '환영회 현수막과 장식',
      amount: 85_000,
      paidOn: demoDay(ctx.now, 'expensePaid'),
      method: 'card',
      paidBy: cast.planningMember.memberId,
      reason: null,
      budgetItemId: ctx.budgetItemId,
      requestedBy: cast.planningMember.memberId,
      accountId: ctx.accountId,
      lines: [],
    },
    ctx.now,
  )
}

export async function addMoney(tx: Tx, cast: DemoCast, now: Date) {
  const accountId = await addAccounts(tx, cast)
  const eventsBudgetItemId = await addBudget(tx, cast, now)
  await addRequests(tx, cast, { eventsBudgetItemId, now })
  await addExpense(tx, cast, { accountId, budgetItemId: eventsBudgetItemId, now })
}
