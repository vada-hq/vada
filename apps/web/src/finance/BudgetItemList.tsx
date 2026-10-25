import type { ReactNode } from 'react'
import type { BudgetItemUsage, EventRef } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { signedWon } from './closing-view'
import { wonLabel } from './purchase-view'

type Line = BudgetItemUsage & {
  id: string
  purpose: string
  amount: number
  event?: EventRef | null
}

// 흐린 한 줄의 금액들. 좁으면 '·' 자리에서 줄을 바꾸고 금액 안에서는 바꾸지 않는다.
function Dim({ parts }: { parts: string[] }) {
  return (
    <p className="text-xs text-gray-500 tabular-nums">
      {parts.map((part, index) => (
        <span key={part}>
          {index > 0 && ' · '}
          <span className="whitespace-nowrap">{part}</span>
        </span>
      ))}
    </p>
  )
}

// 지출 항목은 배정·실제 지출·지출 예정을 흐리게 두고 사용 가능만 키운다(음수면 빨강). 수입 항목은 예산과 들어온 돈이다.
function Numbers({ item }: { item: Line }) {
  if (item.type === 'income')
    return (
      <>
        <Dim parts={[`예산 ${wonLabel(item.amount)}`]} />
        <p className="text-base font-semibold text-gray-900 tabular-nums">
          들어온 돈 {wonLabel(item.actual)}
        </p>
      </>
    )
  return (
    <>
      <Dim
        parts={[
          `배정 ${wonLabel(item.amount)}`,
          `실제 지출 ${wonLabel(item.actual)}`,
          `지출 예정 ${wonLabel(item.committed)}`,
        ]}
      />
      <p
        className={cn(
          'text-base font-semibold tabular-nums',
          item.available < 0 ? 'text-red-600' : 'text-blue-700',
        )}
      >
        사용 가능 {signedWon(item.available)}
      </p>
    </>
  )
}

// 예산 항목 칸 하나(와이어프레임 EVT-FIN-01B '예산 항목별 현황'): 이름 → 흐린 한 줄 → 사용 가능.
// 대부분이 지출 항목이라 종류 칩은 수입 항목에만 둔다. 긴 이름은 두 줄, 행사 이름은 한 줄로 자르고 전체는 title로 둔다.
// actions는 이름 줄 오른쪽 끝의 동작(예산 탭의 '⋯' 메뉴)이다. 없으면 두지 않는다.
function BudgetItemLine({ item, actions }: { item: Line; actions?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-start gap-2">
        <span
          title={item.purpose}
          className="line-clamp-2 min-w-0 flex-1 text-sm font-medium wrap-anywhere text-gray-900"
        >
          {item.purpose}
        </span>
        {item.type === 'income' && <Badge tone="info">수입</Badge>}
        {actions && <div className="-my-2 -mr-1.5 shrink-0">{actions}</div>}
      </div>
      {item.event && (
        <span title={item.event.name} className="line-clamp-1 text-xs wrap-anywhere text-gray-500">
          {item.event.name}
        </span>
      )}
      <Numbers item={item} />
    </div>
  )
}

// 예산 항목 칸의 목록. 놓인 자리의 폭으로 좁으면 1열, 넓으면 2~3열이다. 예산 탭과 행사 '예산·정산'이 같이 쓴다.
export function BudgetItemList<T extends Line>({
  items,
  label,
  actions,
}: {
  items: T[]
  label?: string
  actions?: (item: T) => ReactNode
}) {
  return (
    <div className="@container">
      <ul aria-label={label} className="grid gap-2 @2xl:grid-cols-2 @4xl:grid-cols-3">
        {items.map(item => (
          <li key={item.id}>
            <Card className="h-full p-3">
              <BudgetItemLine item={item} actions={actions?.(item)} />
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
