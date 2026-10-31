import {
  CreatePurchaseRequestSchema,
  type BudgetResponse,
  type PurchaseRequestDetail,
} from '@vada/contracts'
import { budgetOf } from '../../budget/queries.js'
import { decideLineItems } from '../../purchases/decide.js'
import { createPurchaseRequest } from '../../purchases/service.js'
import {
  changer,
  fail,
  pass,
  SMOKE_RECEIPT_KEY,
  withConnections,
  type SmokeCase,
} from './pg-smoke-kit.js'
import { moneyScene } from './pg-smoke-money-kit.js'

const ITEM = { name: '예상 음료', quantity: 2, estimatedUnitPrice: 100, estimatedShippingFee: 30 }
const SUBTOTAL = 200
const ESTIMATED_TOTAL = 230
const CONFIRMED = 777

const beforeMatches = (request: PurchaseRequestDetail, budget: BudgetResponse) =>
  request.items[0]?.amount === null &&
  request.estimate?.subtotal === SUBTOTAL &&
  request.estimate.total === ESTIMATED_TOTAL &&
  budget.items[0]?.committed === 0

const afterMatches = (request: PurchaseRequestDetail, budget: BudgetResponse) =>
  request.items[0]?.amount === CONFIRMED &&
  request.items[0].estimatedUnitPrice === ITEM.estimatedUnitPrice &&
  request.estimate?.total === ESTIMATED_TOTAL &&
  budget.items[0]?.committed === CONFIRMED

// PostgreSQL 드라이버의 numeric 읽기와 승인 금액 분리를 실제 서비스 길로 확인한다.
export const purchaseEstimateCase: SmokeCase = {
  name: '구매 예상 가격 저장과 승인 금액 분리(024-11)',
  run: context =>
    withConnections(context, async open => {
      const main = open()
      const scene = await moneyScene(main, context, 'purchase-estimate')
      const requester = changer(main.db, context, scene.requester)
      const finance = changer(main.db, context, scene.finance[0])
      const { request } = await requester('council.view', (tx, actor) =>
        createPurchaseRequest(
          tx,
          actor,
          CreatePurchaseRequestSchema.parse({ title: '예상값 확인', items: [ITEM] }),
          { now: context.now, receiptKey: SMOKE_RECEIPT_KEY },
        ),
      )
      const item = request.items[0]!
      const before = await finance('council.view', (tx, actor) => budgetOf(tx, actor, context.now))
      if (!beforeMatches(request, before))
        return fail('예상 금액 저장/조회 또는 승인 전 예산 분리 실패')
      const { request: approved } = await finance('council.view', (tx, actor) =>
        decideLineItems(tx, actor, request.id, {
          now: context.now,
          input: {
            decisions: [
              {
                lineItemId: item.id,
                outcome: 'approved',
                amount: CONFIRMED,
                budgetItemId: scene.budgetItemId,
              },
            ],
          },
        }),
      )
      const after = await finance('council.view', (tx, actor) => budgetOf(tx, actor, context.now))
      return afterMatches(approved, after)
        ? pass('예상 가격은 보존되고 승인자가 정한 금액만 약정에 반영됨')
        : fail('승인 금액 또는 약정에 예상값이 섞임')
    }),
}
