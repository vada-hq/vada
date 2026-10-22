import { useState } from 'react'
import type { BudgetResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { BUDGET_LOAD_FAILED } from '@/lib/messages'
import { periodRange } from './budget-form'
import { BudgetItemDialog } from './BudgetItemDialog'
import type { BudgetChangeHandlers } from './useBudgetChange'
import { PeriodCreateDialog } from './PeriodCreateDialog'
import { wonLabel } from './purchase-view'
import { useBudget } from './useBudget'

type Props = {
  councilId: string
  // `finance.manage`가 있을 때만 만들고 더한다. 보는 것은 모든 운영진이다.
  canManage: boolean
  onForbidden: () => void
}

function Items({ items }: { items: BudgetResponse['items'] }) {
  if (items.length === 0) return <StateMessage kind="empty">예산 항목이 아직 없어요.</StateMessage>
  return (
    <ul aria-label="예산 항목" className="flex flex-col gap-2">
      {items.map(item => (
        <li key={item.id}>
          <Card className="flex items-start justify-between gap-3 p-3 text-sm">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="wrap-anywhere text-gray-900">{item.purpose}</span>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={item.type === 'income' ? 'info' : 'neutral'}>
                  {item.type === 'income' ? '수입' : '지출'}
                </Badge>
                {item.event && (
                  <span className="text-xs text-gray-500 wrap-anywhere">{item.event.name}</span>
                )}
              </div>
            </div>
            <span className="shrink-0 font-medium text-gray-700">{wonLabel(item.amount)}</span>
          </Card>
        </li>
      ))}
    </ul>
  )
}

type Open = 'period' | 'item' | null

function Loaded({
  data,
  canManage,
  onOpen,
}: {
  data: BudgetResponse
  canManage: boolean
  onOpen: (dialog: 'period' | 'item') => void
}) {
  if (!data.period)
    return (
      <div className="flex flex-col items-start gap-3">
        <StateMessage kind="empty">
          {canManage
            ? '아직 회계 기간이 없어요. 만들면 구매 요청을 결재할 수 있어요.'
            : '아직 회계 기간이 없어요. 재정부가 만들면 여기에 보여요.'}
        </StateMessage>
        {canManage && <Button onClick={() => onOpen('period')}>회계 기간 만들기</Button>}
      </div>
    )
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium wrap-anywhere text-gray-900">{data.period.name}</h2>
        <p className="text-xs text-gray-500">{periodRange(data.period)}</p>
      </div>
      <Items items={data.items} />
      {canManage && (
        <Button className="self-start" variant="outline" onClick={() => onOpen('item')}>
          항목 더하기
        </Button>
      )}
    </div>
  )
}

function Dialogs({
  open,
  councilId,
  suggested,
  handlers,
  onClose,
}: {
  open: Open
  councilId: string
  suggested: BudgetResponse['suggested']
  handlers: BudgetChangeHandlers
  onClose: () => void
}) {
  if (open === 'period')
    return (
      <PeriodCreateDialog
        councilId={councilId}
        suggested={suggested}
        onClose={onClose}
        {...handlers}
      />
    )
  if (open === 'item')
    return <BudgetItemDialog councilId={councilId} onClose={onClose} {...handlers} />
  return null
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <StateMessage kind="error">{BUDGET_LOAD_FAILED}</StateMessage>
      <Button variant="outline" onClick={onRetry}>
        다시 시도
      </Button>
    </div>
  )
}

// 예산 탭: 지금 회계 기간과 지출 예산 항목. 재정부는 기간을 만들고 항목을 더한다.
export function BudgetTab({ councilId, canManage, onForbidden }: Props) {
  const budget = useBudget(councilId, onForbidden)
  const [dialog, setDialog] = useState<Open>(null)
  const [lost, setLost] = useState<string | null>(null)
  const { state } = budget
  const handlers = {
    onForbidden,
    onLost: (message: string) => {
      setDialog(null)
      setLost(message)
    },
    onSaved: () => {
      setDialog(null)
      void budget.reload()
    },
  }
  if (state.kind === 'loading') return <StateMessage kind="loading">예산 불러오는 중…</StateMessage>
  if (state.kind === 'failed') return <LoadFailed onRetry={() => void budget.reload()} />
  return (
    <div className="flex flex-col gap-3">
      {lost && <StateMessage kind="error">{lost}</StateMessage>}
      <Loaded
        data={state.budget}
        canManage={canManage}
        onOpen={next => {
          setLost(null)
          setDialog(next)
        }}
      />
      <Dialogs
        open={dialog}
        councilId={councilId}
        suggested={state.budget.suggested}
        handlers={handlers}
        onClose={() => setDialog(null)}
      />
    </div>
  )
}
