import type { PurchaseView } from '@vada/contracts'

const base = (councilId: string) =>
  `/api/organizations/${encodeURIComponent(councilId)}/purchase-requests`

export const purchaseCreatePath = base
export const purchasesPath = (councilId: string, view: PurchaseView) =>
  `${base(councilId)}?view=${view}`
export const purchasePath = (councilId: string, requestId: string) =>
  `${base(councilId)}/${encodeURIComponent(requestId)}`
export const purchaseCancelPath = (councilId: string, requestId: string) =>
  `${purchasePath(councilId, requestId)}/cancel`
export const purchaseItemCancelPath = (councilId: string, requestId: string, lineItemId: string) =>
  `${purchasePath(councilId, requestId)}/items/${encodeURIComponent(lineItemId)}/cancel`
export const purchaseDecisionsPath = (councilId: string, requestId: string) =>
  `${purchasePath(councilId, requestId)}/decisions`

export const councilPath = (councilId: string) =>
  `/api/organizations/${encodeURIComponent(councilId)}`
// 기간을 주면 그 기간의 예산, 없으면 오늘이 든 기간의 예산이다.
export const budgetPath = (councilId: string, periodId?: string) =>
  `${councilPath(councilId)}/budget${periodId ? `?period=${encodeURIComponent(periodId)}` : ''}`
export const eventSettlementsPath = (councilId: string) =>
  `${councilPath(councilId)}/event-settlements`
export const fiscalPeriodsPath = (councilId: string) => `${councilPath(councilId)}/fiscal-periods`
const budgetItemsPath = (councilId: string) => `${councilPath(councilId)}/budget-items`
// 예산 편성: 여러 행을 한 거래로 넣는다.
export const budgetItemsBatchPath = (councilId: string) => `${budgetItemsPath(councilId)}/batch`
export const budgetItemPath = (councilId: string, itemId: string) =>
  `${budgetItemsPath(councilId)}/${encodeURIComponent(itemId)}`
export const budgetItemDeletePath = (councilId: string, itemId: string) =>
  `${budgetItemPath(councilId, itemId)}/delete`
export const accountsPath = (councilId: string) => `${councilPath(councilId)}/accounts`
export const accountPath = (councilId: string, accountId: string) =>
  `${accountsPath(councilId)}/${encodeURIComponent(accountId)}`
export const accountClosePath = (councilId: string, accountId: string) =>
  `${accountPath(councilId, accountId)}/close`

export const feePaymentsPath = (councilId: string, studentId?: string) =>
  `${councilPath(councilId)}/fee-payments${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ''}`
export const feePaymentRemovePath = (councilId: string, paymentId: string) =>
  `${councilPath(councilId)}/fee-payments/${encodeURIComponent(paymentId)}/remove`
