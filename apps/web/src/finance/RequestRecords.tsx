import type { PurchaseDecision, PurchaseLineItem, PurchaseVersion } from '@vada/contracts'
import { decisionLine, versionLine } from './purchase-text'

// 결재 이력: 어느 품목을 누가 언제 어떻게 결재했는지(반려는 사유까지). 결재가 없으면 보이지 않는다.
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
    <section aria-label="결재 이력" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-gray-700">결재 이력</h3>
      <ul className="flex flex-col gap-1 text-xs text-gray-500">
        {decisions.map(decision => (
          <li key={decision.id} className="wrap-anywhere">
            <span className="font-medium text-gray-700">{nameOf(decision.lineItemId)}</span>
            {' — '}
            {decisionLine(decision)}
          </li>
        ))}
      </ul>
    </section>
  )
}

// 이력: 오래된 판부터 모두. 판마다 바꾼 사람·시각과 바뀐 것이다(DEC-34, DEC-46).
export function RequestHistory({ history }: { history: PurchaseVersion[] }) {
  return (
    <section aria-label="이력" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-gray-700">이력</h3>
      <ol className="flex flex-col gap-1 text-xs text-gray-500">
        {history.map(version => (
          <li key={version.versionNo} className="wrap-anywhere">
            {versionLine(version)}
          </li>
        ))}
      </ol>
    </section>
  )
}
