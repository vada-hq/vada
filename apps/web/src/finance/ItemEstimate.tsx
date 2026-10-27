import { purchaseEstimateOf, type PurchaseLineItem } from '@vada/contracts'
import { wonLabel } from './purchase-view'

export function ItemEstimate({ item }: { item: PurchaseLineItem }) {
  const estimate = purchaseEstimateOf(item)
  const amount = estimate.total ?? estimate.subtotal
  if (amount == null) return null
  return (
    <p className="text-xs text-gray-500 tabular-nums">
      {estimate.total != null
        ? `예상 ${wonLabel(amount)}`
        : `상품 ${wonLabel(amount)} · 배송비 미확인`}
    </p>
  )
}
