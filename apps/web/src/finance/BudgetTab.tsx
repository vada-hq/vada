import { useEffect, useState, type ReactNode } from 'react'
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
import { usePeriods } from './useIncomes'
import { usePeriodChoice } from './useFinanceQuery'
import { PeriodSelect } from './PeriodSelect'
import { afterWindowsClosed } from '@/lib/use-window-history'

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
  if (items.length === 0) return <StateMessage kind="empty">예산 항목이 아직 없어요.</StateMessage>
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
  periodSelect,
}: {
  data: BudgetResponse
  councilId: string
  canManage: boolean
  handlers: BudgetChangeHandlers
  onOpen: (dialog: 'period' | 'item') => void
  periodSelect: ReactNode
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
      {/* 페이지 전체의 행동은 머리에 둔다(와이어프레임: 요약 오른쪽 위). 항목이 많아도 스크롤하지 않고 보인다. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          {periodSelect ?? (
            <h2 className="text-base font-medium wrap-anywhere text-gray-900">
              {data.period.name}
            </h2>
          )}
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
  periodId,
  existing,
  handlers,
  onStale,
  onClose,
}: {
  open: Open
  councilId: string
  periodId: string | undefined
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
        periodId={periodId}
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

function periodPicker(
  periods: ReturnType<typeof usePeriods>['state'],
  period: BudgetResponse['period'],
  choose: (id: string) => void,
) {
  if (periods.kind !== 'ready' || !period || periods.data.periods.length === 0) return null
  return <PeriodSelect periods={periods.data.periods} value={period.id} onChange={choose} />
}

// 예산 탭: 지금 회계 기간과 예산 항목. 재정부는 기간을 만들고, 여러 행을 편성하고, 항목마다 고치거나 지운다.
export function BudgetTab({ councilId, canManage, onForbidden }: Props) {
  const choice = usePeriodChoice(councilId)
  const periods = usePeriods(councilId, onForbidden)
  const budget = useBudget(councilId, onForbidden, choice.chosenId ?? undefined)
  const [dialog, setDialog] = useState<Open>(null)
  const [lost, setLost] = useState<string | null>(null)
  const { state } = budget
  useEffect(() => {
    if (choice.chosenId || state.kind !== 'ready' || state.budget.period) return
    const latest = periods.state.kind === 'ready' ? periods.state.data.periods[0] : undefined
    if (latest) afterWindowsClosed(() => choice.choose(latest.id))
  })
  const handlers = {
    onForbidden,
    onLost: (message: string) => {
      setDialog(null)
      setLost(message)
    },
    onSaved: (saved: BudgetResponse) => {
      const madeId = dialog === 'period' ? saved.period?.id : undefined
      setDialog(null)
      // 창의 방문 기록을 거둔 뒤 기간을 바꿔야 닫힘이 옛 기간 주소로 되돌리지 않는다.
      if (madeId) afterWindowsClosed(() => choice.choose(madeId))
      void budget.reload()
      void periods.reload()
    },
  }
  if (state.kind === 'loading') return <StateMessage kind="loading">예산 불러오는 중…</StateMessage>
  if (state.kind === 'failed') return <LoadFailed onRetry={() => void budget.reload()} />
  return (
    <div className="flex flex-col gap-3 max-sm:[&_select]:min-h-11">
      {lost && <StateMessage kind="error">{lost}</StateMessage>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        {canManage && state.budget.period && (
          <Button variant="outline" className="max-sm:min-h-11" onClick={() => setDialog('period')}>
            회계 기간 만들기
          </Button>
        )}
      </div>
      <Loaded
        data={state.budget}
        councilId={councilId}
        canManage={canManage}
        handlers={handlers}
        periodSelect={periodPicker(periods.state, state.budget.period, choice.choose)}
        onOpen={next => {
          setLost(null)
          setDialog(next)
        }}
      />
      <Dialogs
        open={dialog}
        councilId={councilId}
        periodId={choice.chosenId ?? undefined}
        existing={state.budget.items}
        handlers={handlers}
        onStale={() => void budget.reload()}
        onClose={() => setDialog(null)}
      />
    </div>
  )
}
