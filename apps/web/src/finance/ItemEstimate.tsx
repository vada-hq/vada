import { purchaseEstimateOf, type PurchaseLineItem } from '@vada/contracts'
import { wonLabel } from './purchase-view'

export function ItemEstimate({ item }: { item: PurchaseLineItem }) {
  const estimate = purchaseEstimateOf(item)
  let label: string
  if (estimate.total != null) label = `예상 ${wonLabel(estimate.total)}`
  else if (estimate.subtotal != null)
    label = `예상 상품 합계 ${wonLabel(estimate.subtotal)} · 배송비 미확인`
  else if (item.estimatedShippingFee != null)
    label = `예상 배송비 ${wonLabel(item.estimatedShippingFee)} · 단가 미확인`
  else return null
  return <p className="text-xs break-keep text-gray-500 tabular-nums">{label}</p>
}
