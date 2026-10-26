import { purchaseEstimateOf, type PurchaseLineItem } from '@vada/contracts'
import { wonLabel } from './purchase-view'

export function ItemEstimate({ item }: { item: PurchaseLineItem }) {
  const estimate = purchaseEstimateOf(item)
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-500">
      <dt>예상 단가</dt>
      <dd>{item.estimatedUnitPrice == null ? '미확인' : wonLabel(item.estimatedUnitPrice)}</dd>
      <dt>예상 배송비</dt>
      <dd>{item.estimatedShippingFee == null ? '미확인' : wonLabel(item.estimatedShippingFee)}</dd>
      <dt>예상 합계</dt>
      <dd>
        {estimate.total != null
          ? wonLabel(estimate.total)
          : estimate.subtotal != null
            ? `상품 ${wonLabel(estimate.subtotal)} · 배송비 미확인`
            : '미확인'}
      </dd>
    </dl>
  )
}
