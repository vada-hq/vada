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
