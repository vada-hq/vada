import type { PurchaseLineItem, PurchaseShipment } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { wonLabel } from './purchase-view'
import { ItemCancelButton } from './ItemCancel'
import { ItemStatusBadge } from './StatusBadge'
import type { ItemCancel } from './useCancelItem'

// 링크는 운영진이 쓴 주소다. 계약이 http·https만 받지만 화면도 새 창과 noopener noreferrer로만 연다.
export function ItemLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-700 underline underline-offset-4 wrap-anywhere"
    >
      {href}
    </a>
  )
}

function ItemFacts({ item }: { item: PurchaseLineItem }) {
  return (
    <div className="flex flex-col gap-1 text-xs text-gray-500">
      {item.options && <span className="wrap-anywhere">{item.options}</span>}
      {item.link && <ItemLink href={item.link} />}
      {item.amount !== null && <span>{wonLabel(item.amount)}</span>}
      {item.budgetItem && <span className="wrap-anywhere">{item.budgetItem.purpose}</span>}
    </div>
  )
}

// 품목 목록: 이름과 수량, 상태(결제함), 옵션, 링크, 승인한 금액과 예산 항목, 서버가 준 [품목 취소]
// 결재 중이면 대기 품목은 결재 칸에만 있어(같은 품목을 두 번 보이지 않음) 남은 것이 없으면 목록도 없다.
export function RequestItems({
  items,
  cancel,
  shipments = [],
}: {
  items: PurchaseLineItem[]
  cancel: ItemCancel
  shipments?: PurchaseShipment[]
}) {
  const covered = new Set(
    shipments.filter(shipment => !shipment.cancelledAt).flatMap(shipment => shipment.lineItemIds),
  )
  if (items.length === 0) return null
  return (
    <section aria-label="품목" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-gray-700">품목</h3>
      <ul className="flex flex-col gap-2">
        {items.map(item => (
          <li key={item.id} className="flex flex-col gap-1 rounded-sm border p-3">
            <div className="flex items-start gap-2">
              <span className="min-w-0 flex-1 text-sm font-medium wrap-anywhere text-gray-900">
                {item.name} × {item.quantity}
              </span>
              <ItemStatusBadge status={item.status} />
              {item.paid && <Badge tone="success">결제함</Badge>}
              {covered.has(item.id) && <Badge>송장 등록됨</Badge>}
            </div>
            <ItemFacts item={item} />
            <ItemCancelButton item={item} cancel={cancel} />
          </li>
        ))}
      </ul>
    </section>
  )
}
