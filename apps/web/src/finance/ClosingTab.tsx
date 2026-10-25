import { useState } from 'react'
import { koreanDateOf, type Closing, type FiscalPeriodSummary } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { monthDayTime } from '@/lib/korean-date-text'
import {
  CLOSING_HIDDEN,
  CLOSING_LOAD_FAILED,
  CLOSING_LOST,
  PERIODS_LOAD_FAILED,
} from '@/lib/messages'
import { useNow } from '@/lib/use-now'
import { ClosingActions } from './ClosingActions'
import { ClosingChecks, type ClosingOpeners } from './ClosingChecks'
import { ClosingExport } from './ClosingExport'
import {
  ClosingAccountsSection,
  ClosingExpenseSection,
  ClosingIncomeSection,
  ClosingNumbers,
} from './ClosingSections'
import { ClosingStatusBadge } from './ClosingStatusBadge'
import { defaultClosingPeriod } from './closing-view'
import { chosenPeriod, PeriodSelect } from './PeriodSelect'
import { useClosing, useClosingChange, type ClosingRead } from './useClosing'
import { usePeriodChoice } from './useFinanceQuery'
import { usePeriods } from './useIncomes'

type Props = {
  councilId: string
  // 공개·다시 열기와 감사용 내보내기는 재정부(`finance.manage`)만이다. 공개 전 결산서도 재정부만 본다.
  canManage: boolean
  onForbidden: () => void
  openers: ClosingOpeners
}

function ClosingBody({
  read,
  ...rest
}: Omit<Props, 'onForbidden'> & {
  read: ClosingRead
  change: ReturnType<typeof useClosingChange>
}) {
  const { state } = read
  if (read.lost) return <StateMessage kind="error">{CLOSING_LOST}</StateMessage>
  if (state.kind === 'loading') return <StateMessage kind="loading">불러오는 중…</StateMessage>
  if (state.kind === 'failed')
    return (
      <div className="flex flex-col gap-3">
        <StateMessage kind="error">{CLOSING_LOAD_FAILED}</StateMessage>
        <Button variant="outline" className="self-start" onClick={() => void read.reload()}>
          다시 시도
        </Button>
      </div>
    )
  return <ClosingView closing={state.data.closing} {...rest} />
}

function ClosingView({
  closing,
  councilId,
  canManage,
  openers,
  change,
}: Omit<Props, 'onForbidden'> & {
  closing: Closing
  change: ReturnType<typeof useClosingChange>
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <ClosingStatusBadge status={closing.status} />
        {closing.publishedAt && (
          <span className="text-xs text-gray-500">{monthDayTime(closing.publishedAt)} 공개</span>
        )}
      </div>
      <ClosingActions closing={closing} change={change} canManage={canManage} />
      <ClosingNumbers closing={closing} />
      <ClosingIncomeSection closing={closing} />
      <ClosingExpenseSection closing={closing} />
      <ClosingAccountsSection closing={closing} />
      <ClosingChecks closing={closing} openers={openers} />
      <ClosingExport councilId={councilId} closing={closing} />
    </>
  )
}

// 기간 하나의 결산. 기간을 바꾸면 처음부터 다시 만든다(이전 기간의 거절 문구가 남지 않게).
// 공개 전에는 재정부가 아니면 서버가 403이므로 읽지 않고 안내만 보인다.
function PeriodClosing({
  period,
  onChanged,
  onForbidden,
  ...rest
}: Props & {
  period: FiscalPeriodSummary
  onChanged: () => void
}) {
  const hidden = period.status === 'draft' && !rest.canManage
  const read = useClosing(rest.councilId, period.id, !hidden, onForbidden)
  const change = useClosingChange(rest.councilId, period.id, read, { onChanged, onForbidden })
  if (hidden) return <StateMessage kind="notice">{CLOSING_HIDDEN}</StateMessage>
  return <ClosingBody read={read} change={change} {...rest} />
}

// 기본 기간은 목록을 처음 읽었을 때 한 번만 정해 둔다. 공개해서 목록이 바뀌어도 보던 기간에 남는다.
// 고른 기간은 주소에 남아 새로고침해도 같다.
function usePinnedPeriod(councilId: string, list: FiscalPeriodSummary[], today: string) {
  const [pinned, setPinned] = useState<string | null>(null)
  const choice = usePeriodChoice(councilId)
  if (pinned === null && list.length > 0)
    setPinned(defaultClosingPeriod(list, today) ?? chosenPeriod(list, null)?.id ?? null)
  return [choice.chosenId ?? pinned, choice.choose] as const
}

// 결산 탭: 기간을 고르고(기본은 끝났고 공개하지 않은 가장 이른 기간, 없으면 지금 기간) 그 기간의 결산서를 본다.
export function ClosingTab(props: Props) {
  const periods = usePeriods(props.councilId, props.onForbidden)
  const today = koreanDateOf(useNow())
  const list = periods.state.kind === 'ready' ? periods.state.data.periods : []
  const [chosenId, setChosenId] = usePinnedPeriod(props.councilId, list, today)
  const period = chosenPeriod(list, chosenId)
  if (periods.state.kind === 'failed')
    return <StateMessage kind="error">{PERIODS_LOAD_FAILED}</StateMessage>
  if (periods.state.kind === 'loading')
    return <StateMessage kind="loading">불러오는 중…</StateMessage>
  if (period === null)
    return (
      <StateMessage kind="empty">회계 기간이 없어요. 예산 탭에서 먼저 만들어 주세요.</StateMessage>
    )
  return (
    <div className="flex flex-col gap-3">
      <PeriodSelect periods={list} value={period.id} onChange={setChosenId} />
      <PeriodClosing
        key={period.id}
        period={period}

        onChanged={() => void periods.reload()}
        {...props}
      />
    </div>
  )
}
