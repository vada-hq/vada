import type { FinanceOverview } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { openMenu, openRecord } from '@/lib/go-to'
import { CLOSING_LOST, OVERVIEW_LOAD_FAILED, PERIODS_LOAD_FAILED } from '@/lib/messages'
import { useSplit } from '@/lib/use-split'
import { OverviewCards, type OverviewCardLinks } from './OverviewCards'
import { OverviewEvents } from './OverviewEvents'
import { OverviewItems } from './OverviewItems'
import { OverviewRate } from './OverviewRate'
import { OverviewRecent } from './OverviewRecent'
import { chosenPeriod, PeriodSelect } from './PeriodSelect'
import { useFinanceOverview } from './useFinanceOverview'
import { usePeriodChoice } from './useFinanceQuery'
import { usePeriods } from './useIncomes'
import { NoPeriod } from './NoPeriod'

type Props = {
  councilId: string
  // 예산을 고칠 수 있는 재정부(finance.manage). 총예산 '편성'과 기간 만들기 버튼이 이 사람에게만 있다.
  canManage: boolean
  onForbidden: () => void
}

export type OverviewOpeners = OverviewCardLinks & {
  onEvent: (eventId: string) => void
  onExpense: (expenseId: string) => void
}

// 개요 한 기간의 화면(와이어프레임 FIN-00 차례): 카드 넷 → 전체 집행률 → 행사별 → 최근 지출 → 예산 항목별 현황.
// 넓은 화면(lg)의 표와 좁은 화면의 카드 줄은 wide가 가른다. 부품 확인 화면도 이것을 그린다.
export function OverviewView({
  overview,
  wide,
  openers,
}: {
  overview: FinanceOverview
  wide: boolean
  openers: OverviewOpeners
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
      <OverviewItems overview={overview} />
    </div>
  )
}

// 카드와 줄이 가는 곳. 탭을 옮기면 기록을 쌓아 뒤로 가기가 개요로 돌아온다(지출 탭과 예산 탭은 같은 기간이다).
function openersOf(councilId: string, periodId: string, canManage: boolean): OverviewOpeners {
  return {
    onBudget: canManage
      ? () => openMenu('finance', councilId, { tab: 'budget', period: periodId })
      : null,
    onSpent: () => openMenu('finance', councilId, { tab: 'expenses', period: periodId }),
    // 지출 예정은 승인했고 결제하지 않은 품목이라 지출이 아직 없다. 그 품목이 있는 구매 요청 전체로 간다.
    onCommitted: () => openMenu('finance', councilId, { tab: 'requests', view: 'all' }),
    onEvent: eventId => openRecord('events', councilId, eventId, { tab: 'money' }),
    onExpense: expenseId => openRecord('expenses', councilId, expenseId),
  }
}

function PeriodOverview({
  councilId,
  periodId,
  canManage,
  onForbidden,
}: Props & { periodId: string }) {
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
      openers={openersOf(councilId, periodId, canManage)}
    />
  )
}

// 개요 탭(DEC-92): 모든 운영진의 재정 첫 탭. 기간을 고르고(기본은 지금 기간) 예산과 쓴 돈을 한눈에 본다.
// 숫자는 예산 셈(약정과 사용 가능)이고 결산서를 읽지 않는다. 처리 버튼은 없다.
export function OverviewTab({ councilId, canManage, onForbidden }: Props) {
  const periods = usePeriods(councilId, onForbidden)
  const choice = usePeriodChoice(councilId)
  if (periods.state.kind === 'failed')
    return <StateMessage kind="error">{PERIODS_LOAD_FAILED}</StateMessage>
  if (periods.state.kind === 'loading')
    return <StateMessage kind="loading">불러오는 중…</StateMessage>
  const list = periods.state.data.periods
  const period = chosenPeriod(list, choice.chosenId)
  if (period === null) return <NoPeriod councilId={councilId} canManage={canManage} />
  return (
    <div className="flex flex-col gap-3">
      <PeriodSelect periods={list} value={period.id} onChange={choice.choose} />
      <PeriodOverview
        key={period.id}
        councilId={councilId}
        periodId={period.id}
        canManage={canManage}
        onForbidden={onForbidden}
      />
    </div>
  )
}
