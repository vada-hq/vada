import { useState } from 'react'
import type { BudgetResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { BUDGET_LOAD_FAILED } from '@/lib/budget-messages'
import { periodRange } from './budget-form'
import { BudgetItemActions } from './BudgetItemActions'
import { BudgetItemList } from './BudgetItemList'
import { BudgetItemDialog } from './BudgetItemDialog'
import type { BudgetChangeHandlers } from './useBudgetChange'
import { PeriodCreateDialog } from './PeriodCreateDialog'
import { useBudget } from './useBudget'

type Props = {
  councilId: string
  // `finance.manage`가 있을 때만 만들고 더한다. 보는 것은 모든 운영진이다.
  canManage: boolean
  onForbidden: () => void
}

type ItemsProps = {
  items: BudgetResponse['items']
  councilId: string
  canManage: boolean
  handlers: BudgetChangeHandlers
}

// 항목마다 '⋯' 메뉴(고치기·지우기·이력 보기)를 둔다.
function Items({ items, councilId, canManage, handlers }: ItemsProps) {
  if (items.length === 0) return <StateMessage kind="empty">예산 항목 없음</StateMessage>
  return (
    <BudgetItemList
      items={items}
      label="예산 항목"
      actions={item => (
        <BudgetItemActions councilId={councilId} item={item} canManage={canManage} {...handlers} />
      )}
    />
  )
}

type Open = 'period' | 'item' | null

function Loaded({
  data,
  councilId,
  canManage,
  handlers,
  onOpen,
}: {
  data: BudgetResponse
  councilId: string
  canManage: boolean
  handlers: BudgetChangeHandlers
  onOpen: (dialog: 'period' | 'item') => void
}) {
  if (!data.period)
    return (
      <div className="flex flex-col items-start gap-3">
        <StateMessage kind="empty">회계 기간 없음</StateMessage>
        {canManage && <Button onClick={() => onOpen('period')}>회계 기간 만들기</Button>}
      </div>
    )
  return (
    <div className="flex flex-col gap-3">
      {/* 페이지 전체의 행동은 머리에 둔다(와이어프레임: 요약 오른쪽 위). 항목이 많아도 스크롤하지 않고 보인다. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-base font-medium wrap-anywhere text-gray-900">{data.period.name}</h2>
          <p className="text-xs text-gray-500">{periodRange(data.period)}</p>
        </div>
        {canManage && (
          <Button className="shrink-0" variant="outline" onClick={() => onOpen('item')}>
            예산 편성
          </Button>
        )}
      </div>
      <Items items={data.items} councilId={councilId} canManage={canManage} handlers={handlers} />
    </div>
  )
}

function Dialogs({
  open,
  councilId,
  existing,
  handlers,
  onStale,
  onClose,
}: {
  open: Open
  councilId: string
  // 편성 창이 같은 이름을 미리 짚는 지금 기간의 항목(이 탭이 이미 읽은 예산)
  existing: BudgetResponse['items']
  handlers: BudgetChangeHandlers
  onStale: () => void
  onClose: () => void
}) {
  if (open === 'period')
    return <PeriodCreateDialog councilId={councilId} onClose={onClose} {...handlers} />
  if (open === 'item')
    return (
      <BudgetItemDialog
        councilId={councilId}
        existing={existing}
        onStale={onStale}
        onClose={onClose}
        {...handlers}
      />
    )
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

// 예산 탭: 지금 회계 기간과 예산 항목. 재정부는 기간을 만들고, 여러 행을 편성하고, 항목마다 고치거나 지운다.
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
        councilId={councilId}
        canManage={canManage}
        handlers={handlers}
        onOpen={next => {
          setLost(null)
          setDialog(next)
        }}
      />
      <Dialogs
        open={dialog}
        councilId={councilId}
        existing={state.budget.items}
        handlers={handlers}
        onStale={() => void budget.reload()}
        onClose={() => setDialog(null)}
      />
    </div>
  )
}
