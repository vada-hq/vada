import type { PurchaseDecision, PurchaseLineItem } from '@vada/contracts'
import { decisionLine } from './purchase-text'

// 결재: 어느 품목을 누가 언제 어떻게 결재했는지(반려는 사유까지). 결재가 없으면 보이지 않는다.
export function RequestDecisions({
  decisions,
  items,
}: {
  decisions: PurchaseDecision[]
  items: PurchaseLineItem[]
}) {
  if (decisions.length === 0) return null
  const nameOf = (id: string) => items.find(item => item.id === id)?.name
  return (
    <section aria-label="결재" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-fg-secondary">결재</h3>
      <ul className="flex flex-col gap-1 text-xs text-fg-muted">
        {decisions.map(decision => (
          <li key={decision.id} className="wrap-anywhere">
            <span className="font-medium text-fg-secondary">{nameOf(decision.lineItemId)}</span>
            {' — '}
            {decisionLine(decision)}
          </li>
        ))}
      </ul>
    </section>
  )
}
