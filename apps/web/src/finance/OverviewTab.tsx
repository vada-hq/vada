import type { Closing, ClosingLine } from '@vada/contracts'
import { Meter } from '@/components/Meter'
import { NumberCard } from '@/components/NumberCard'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CLOSING_LOST, OVERVIEW_LOAD_FAILED, PERIODS_LOAD_FAILED } from '@/lib/messages'
import { signedWon } from './closing-view'
import { overviewOf, sourcesLabel } from './overview-view'
import { chosenPeriod, PeriodSelect } from './PeriodSelect'
import { wonLabel } from './purchase-view'
import { useClosing } from './useClosing'
import { usePeriodChoice } from './useFinanceQuery'
import { usePeriods } from './useIncomes'

type Props = {
  councilId: string
  onForbidden: () => void
  // 회계 기간이 없을 때 만들러 가는 곳(예산 탭)
  onOpenBudget: () => void
}

// 맨 위 수 카드 넷: 총예산(재원의 합), 지출 예산, 실제 지출, 남은 예산과 집행률(와이어프레임 FIN-00 재정 요약 카드).
function SummaryCards({ closing }: { closing: Closing }) {
  const numbers = overviewOf(closing)
  const sources = sourcesLabel(numbers.sources)
  const noBudget = numbers.rate === null
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <NumberCard
        label="총예산"
        value={sources === null ? null : wonLabel(numbers.total)}
        sub={sources ?? '수입 예산 없음'}
      />
      <NumberCard
        label="지출 예산"
        value={noBudget ? null : wonLabel(numbers.expenseBudget)}
        sub={noBudget ? '지출 예산 없음' : `항목 ${closing.expense.items.length}개`}
      />
      <NumberCard
        label="실제 지출"
        value={wonLabel(numbers.spent)}
        sub={`지출 ${closing.exportInfo.expenseCount}건`}
      />
      <NumberCard
        label="남은 예산"
        value={noBudget ? null : signedWon(numbers.left)}
        sub={noBudget ? '지출 예산 없음' : `집행률 ${numbers.rate}%`}
      >
        {!noBudget && (
          <Meter
            className="mt-1"
            value={numbers.spent}
            max={numbers.expenseBudget}
            label="집행률"
          />
        )}
      </NumberCard>
    </div>
  )
}

// 지출 예산 항목 한 줄: 이름과 쓴 돈 / 예산, 막대, 남은 금액과 집행률.
function ItemRow({ line }: { line: ClosingLine }) {
  return (
    <li className="flex flex-col gap-1 text-sm">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-gray-700 wrap-anywhere">{line.purpose}</span>
        <span className="whitespace-nowrap text-gray-900">
          {wonLabel(line.actual)} / {wonLabel(line.budget)}
        </span>
      </div>
      {line.budget > 0 && (
        <Meter value={line.actual} max={line.budget} label={`${line.purpose} 집행률`} />
      )}
      <span className="text-xs text-gray-500">
        남은 금액 {signedWon(line.difference)}
        {line.rate !== null && ` · ${line.rate}%`}
      </span>
    </li>
  )
}

// 예산 항목 밖의 지출(0원이면 줄이지 않는다). 위 카드의 실제 지출에는 들어 있다.
function OutsideRow({ label, amount }: { label: string; amount: number }) {
  if (amount === 0) return null
  return (
    <li className="flex items-start justify-between gap-3 text-sm">
      <span className="min-w-0 text-gray-700 wrap-anywhere">{label}</span>
      <span className="whitespace-nowrap text-gray-900">{signedWon(amount)}</span>
    </li>
  )
}

// 예산 항목별 지출(와이어프레임 FIN-00 재정 데이터 목록, navigation.md 작업 40).
function ItemsSection({ closing }: { closing: Closing }) {
  const { items, noItem, otherPeriod } = closing.expense
  return (
    <Card className="flex flex-col gap-3 p-4">
      <h3 className="text-sm font-semibold text-gray-900">예산 항목별 지출</h3>
      {items.length === 0 && noItem === 0 && otherPeriod === 0 ? (
        <StateMessage kind="empty">지출 예산 항목 없음</StateMessage>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map(line => (
            <ItemRow key={line.id} line={line} />
          ))}
          <OutsideRow label="예산 항목 없음" amount={noItem} />
          <OutsideRow label="다른 기간 항목" amount={otherPeriod} />
        </ul>
      )}
    </Card>
  )
}

function PeriodOverview({
  councilId,
  periodId,
  onForbidden,
}: {
  councilId: string
  periodId: string
  onForbidden: () => void
}) {
  const read = useClosing(councilId, periodId, true, onForbidden)
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
  return (
    <>
      <SummaryCards closing={state.data.closing} />
      <ItemsSection closing={state.data.closing} />
    </>
  )
}

// 개요 탭(재정부): 기간을 고르고(기본은 지금 기간) 예산과 쓴 돈을 한눈에 본다. 숫자는 결산서와 같은 계산이다.
// 공개 전 결산서는 재정부만 읽으므로(DEC-70) 이 탭도 재정부에게만 있다.
export function OverviewTab({ councilId, onForbidden, onOpenBudget }: Props) {
  const periods = usePeriods(councilId, onForbidden)
  const choice = usePeriodChoice(councilId)
  if (periods.state.kind === 'failed')
    return <StateMessage kind="error">{PERIODS_LOAD_FAILED}</StateMessage>
  if (periods.state.kind === 'loading')
    return <StateMessage kind="loading">불러오는 중…</StateMessage>
  const list = periods.state.data.periods
  const period = chosenPeriod(list, choice.chosenId)
  if (period === null)
    return (
      <div className="flex flex-col items-start gap-3">
        <StateMessage kind="empty">회계 기간 없음</StateMessage>
        <Button onClick={onOpenBudget}>예산 탭에서 만들기</Button>
      </div>
    )
  return (
    <div className="flex flex-col gap-3">
      <PeriodSelect periods={list} value={period.id} onChange={choice.choose} />
      <PeriodOverview
        key={period.id}
        councilId={councilId}
        periodId={period.id}
        onForbidden={onForbidden}
      />
    </div>
  )
}
