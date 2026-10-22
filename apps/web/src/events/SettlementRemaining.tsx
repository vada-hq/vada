import type { EventSettlement, SettlementTarget } from '@vada/contracts'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { REMAINING_LABEL, targetLabel } from './settlement-view'

type Open = {
  onOpenRequest: (requestId: string) => void
  onOpenExpense: (expenseId: string) => void
}

function TargetButton({
  target,
  onOpenRequest,
  onOpenExpense,
}: Open & { target: SettlementTarget }) {
  const open = () =>
    target.type === 'request' ? onOpenRequest(target.id) : onOpenExpense(target.id)
  return (
    <Button
      variant="link"
      className="h-auto max-w-full justify-start p-0 text-left text-sm whitespace-normal wrap-anywhere"
      onClick={open}
    >
      {targetLabel(target)}
    </Button>
  )
}

// 정산에 남은 것: 종류마다 수와 대상. 대상을 누르면 그 요청이나 지출이 열린다. 다 끝나면 '정산이 끝났어요'.
export function SettlementRemaining({
  settlement,
  ...open
}: Open & { settlement: EventSettlement }) {
  const rows = settlement.remaining.filter(row => row.count > 0)
  return (
    <section aria-label="정산에 남은 것" className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-gray-700">정산에 남은 것</h3>
      {settlement.settled && <Alert tone="success">정산이 끝났어요</Alert>}
      <ul className="flex flex-col gap-3">
        {rows.map(row => (
          <li key={row.kind} className="flex flex-col gap-1 rounded-sm border p-3">
            <span className="text-sm font-medium text-gray-900">
              {REMAINING_LABEL[row.kind]} {row.count}개
            </span>
            {row.targets.map(target => (
              <TargetButton key={`${target.type}-${target.id}`} target={target} {...open} />
            ))}
            {row.targets.length > 0 && row.count > row.targets.length && (
              <span className="text-xs text-gray-500">외 {row.count - row.targets.length}개</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
