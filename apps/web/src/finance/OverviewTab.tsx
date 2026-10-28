import { useState } from 'react'
import type { FinanceOverview } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { openMenu, openRecord } from '@/lib/go-to'
import { CLOSING_LOST, OVERVIEW_LOAD_FAILED, PERIODS_LOAD_FAILED } from '@/lib/messages'
import { useSplit } from '@/lib/use-split'
import { useMenuQuery } from '@/lib/use-menu-query'
import { OverviewCards, type OverviewCardLinks } from './OverviewCards'
import { OverviewEvents } from './OverviewEvents'
import { OverviewItems } from './OverviewItems'
import { OverviewRate } from './OverviewRate'
import { OverviewRecent } from './OverviewRecent'
import { BudgetTab } from './BudgetTab'
import { chosenPeriod, PeriodSelect } from './PeriodSelect'
import { useFinanceOverview } from './useFinanceOverview'
import { usePeriodChoice } from './useFinanceQuery'
import { usePeriods } from './useIncomes'

type Props = {
  councilId: string
  // 예산을 고칠 수 있는 재정부(finance.manage). 총예산 링크 이름('편성')과 기간 만들기 버튼만 가른다. 읽기는 가리지 않는다.
  canManage: boolean
  onForbidden: () => void
}

export type OverviewOpeners = OverviewCardLinks & {
  onItems?: (() => void) | undefined
  onEvent: (eventId: string) => void
  onExpense: (expenseId: string) => void
}

// 개요 한 기간의 화면(와이어프레임 FIN-00 차례): 카드 넷 → 전체 집행률 → 행사별 → 최근 지출 → 예산 항목별 현황.
// 넓은 화면(lg)의 표와 좁은 화면의 카드 줄은 wide가 가른다. 부품 확인 화면도 이것을 그린다.
export function OverviewView({
  overview,
  wide,
  openers,
  revealItems = false,
}: {
  overview: FinanceOverview
  wide: boolean
  openers: OverviewOpeners
  revealItems?: boolean | undefined
}) {
  return (
    <div className="flex flex-col gap-3">
      <OverviewCards overview={overview} links={openers} />
      <OverviewRate overview={overview} />
      <OverviewEvents rows={overview.events} wide={wide} onOpen={openers.onEvent} />
      <OverviewRecent
        rows={overview.recent}
        wide={wide}
        onOpen={openers.onExpense}
        onAll={openers.onSpent}
      />
      <OverviewItems overview={overview} onOpen={openers.onItems} reveal={revealItems} />
    </div>
  )
}

// 사용 내역과 구매로 나간 뒤 뒤로 가기로 같은 예산 현황에 돌아오게 기록을 쌓는다.
function openersOf(
  councilId: string,
  periodId: string,
  budget: Pick<OverviewOpeners, 'onBudget' | 'budgetLabel' | 'onItems'>,
): OverviewOpeners {
  return {
    ...budget,
    onSpent: () => openMenu('finance', councilId, { tab: 'ledger', period: periodId }),
    onCommitted: () =>
      openMenu('finance', councilId, { tab: 'ledger', period: periodId, spending: 'committed' }),
    onEvent: eventId => openRecord('events', councilId, eventId, { tab: 'money' }),
    onExpense: expenseId => openRecord('expenses', councilId, expenseId),
  }
}

function PeriodOverview({
  councilId,
  periodId,
  onBudget,
  onItems,
  revealItems,
  canManage,
  onForbidden,
}: Props & {
  periodId: string
  onBudget: () => void
  onItems: () => void
  revealItems: boolean
}) {
  const read = useFinanceOverview(councilId, periodId, onForbidden)
  const wide = useSplit()
  const { state } = read
  if (read.lost) return <StateMessage kind="error">{CLOSING_LOST}</StateMessage>
  if (state.kind === 'loading') return <StateMessage kind="loading">불러오는 중…</StateMessage>
  if (state.kind === 'failed')
    return (
      <div className="flex flex-col gap-3">
        <StateMessage kind="error">{OVERVIEW_LOAD_FAILED}</StateMessage>
        <Button variant="outline" className="self-start" onClick={() => void read.reload()}>
          다시 시도
        </Button>
      </div>
    )
  const { overview } = state.data
  // 목록에 있던 기간이 그사이 지워졌다(기간 목록이 다시 읽으면 사라진다).
  if (overview === null) return <StateMessage kind="error">{CLOSING_LOST}</StateMessage>
  return (
    <OverviewView
      overview={overview}
      wide={wide}
      openers={openersOf(councilId, periodId, {
        onBudget,
        budgetLabel: canManage ? '편성' : '내역',
        onItems,
      })}
      revealItems={revealItems}
    />
  )
}

// 개요 탭(DEC-92): 모든 운영진의 재정 첫 탭. 기간을 고르고(기본은 지금 기간) 예산과 쓴 돈을 한눈에 본다.
// 숫자는 예산 셈(약정과 사용 가능)이고 결산서를 읽지 않는다. 처리 버튼은 없다.
export function OverviewTab({ councilId, canManage, onForbidden }: Props) {
  const [editing, setEditing] = useState(false)
  const periods = usePeriods(councilId, onForbidden)
  const choice = usePeriodChoice(councilId)
  const query = useMenuQuery('finance', councilId)
  if (periods.state.kind === 'failed')
    return <StateMessage kind="error">{PERIODS_LOAD_FAILED}</StateMessage>
  if (periods.state.kind === 'loading')
    return <StateMessage kind="loading">불러오는 중…</StateMessage>
  const list = periods.state.data.periods
  const period = chosenPeriod(list, choice.chosenId)
  if (period === null)
    return <BudgetTab councilId={councilId} canManage={canManage} onForbidden={onForbidden} />
  return (
    <div className="flex flex-col gap-3">
      <PeriodSelect periods={list} value={period.id} onChange={choice.choose} />
      <PeriodOverview
        key={`${period.id}-${editing}`}
        councilId={councilId}
        periodId={period.id}
        onBudget={() => setEditing(true)}
        onItems={() => setEditing(true)}
        canManage={canManage}
        revealItems={query.query['section'] === 'items'}
        onForbidden={onForbidden}
      />
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent aria-describedby={undefined} className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{canManage ? '예산 편성' : '예산 항목'}</DialogTitle>
          </DialogHeader>
          <BudgetTab councilId={councilId} canManage={canManage} onForbidden={onForbidden} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
