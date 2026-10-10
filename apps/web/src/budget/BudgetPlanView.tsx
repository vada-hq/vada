import type { ReactNode } from 'react'
import { Download, Plus } from 'lucide-react'
import type { BudgetPlanResponse, ClosePeriodRequest, ReopenPeriodRequest } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { StatGrid, type Stat } from '@/components/StatGrid'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { timeText, won } from '../purchases/purchase-view'
import { budgetText, remainingText } from '../settlement/settlement-view'
import IncomeCard from './IncomeCard'
import { ClosingChecklist, PeriodStatus } from './PeriodClosing'
import { budgetHistoryText, periodDayText, rateText, shareText } from './budget-view'
import type { BudgetResult } from './useBudget'

type Props = {
  plan: BudgetPlanResponse
  finance: boolean
  onOpenEvent: (eventId: string) => void
  onOpenIncome: (incomeId: string) => void
  onRecordIncome: () => void
  // 결산서 내려받기. 실패 문구는 버튼 아래에 보인다.
  download: { busy: boolean; message: string; start: () => void }
  onClosePeriod: (input: ClosePeriodRequest) => Promise<BudgetResult>
  onReopenPeriod: (input: ReopenPeriodRequest) => Promise<BudgetResult>
}

// 숫자 한 쌍(이름·값). 카드 안에서 휴대폰은 2열, 넓으면 4열로 놓는다.
function Figure({ label, value, danger = false }: { label: string; value: ReactNode; danger?: boolean }) {
  return <div className="flex min-w-0 flex-col"><dt className="text-gray-500">{label}</dt>
    <dd className={cn('font-medium wrap-anywhere text-gray-900', danger && 'text-destructive')}>{value}</dd></div>
}

// 예산 보기. 구성원 누구나 편성과 집행, 수입, 마감 상태를 보고 결산서를 내려받는다.
// 알림·수입 기록·마감 조건은 재정 권한자에게만 보이고, 마감한 기간에는 수입 기록이 없다.
export default function BudgetPlanView({ plan, finance, onOpenEvent, onOpenIncome, onRecordIncome, download, onClosePeriod, onReopenPeriod }: Props) {
  const { totals } = plan
  const stats: Stat[] = [
    { label: '예산', value: won(totals.budget), note: totals.undecided ? `예산 미정 행사 ${totals.undecided}개` : undefined },
    { label: '실제 지출', value: won(totals.spent) },
    { label: '지출 예정', value: won(totals.planned), note: totals.plannedUnknown ? `금액을 모르는 품목 ${totals.plannedUnknown}개 제외` : undefined },
    { label: '남은 예산', value: remainingText(totals.remaining), tone: totals.remaining < 0 ? 'danger' : undefined },
  ]
  const unallocated = totals.income - totals.budget
  return <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="text-base font-semibold wrap-anywhere text-gray-900">{plan.period.name}</h2>
        <p className="text-xs text-gray-500">{periodDayText(plan.period.startsOn)} ~ {periodDayText(plan.period.endsOn)}</p>
      </div>
      <Button variant="outline" size="sm" disabled={download.busy} onClick={download.start}>
        <Download />{download.busy ? '내려받는 중…' : '결산서 내려받기'}</Button>
    </div>
    {download.message && <StateMessage kind="error">{download.message}</StateMessage>}
    {/* 두 묶음은 형제라 key가 겹치면 안 된다. 기간이 바뀌면 입력 중인 사유·확인 상태를 새로 시작한다. */}
    <PeriodStatus key={`status-${plan.period.id}`} plan={plan} finance={finance} onReopen={onReopenPeriod} />
    <StatGrid label="예산 요약" className="grid-cols-2 gap-3 sm:grid-cols-4" stats={stats} />
    {unallocated < 0
      ? <Alert tone="warning">배정이 수입보다 {won(-unallocated)} 많아요</Alert>
      : <p className="text-sm text-gray-700">수입 예산 {won(totals.income)} · 배정 안 한 돈 {won(unallocated)}</p>}
    {/* 남은 돈은 실제 수입 − 실제 지출이다. 0보다 작으면 수입 기록이 빠졌을 가능성이 크다. */}
    {totals.balance < 0
      ? <Alert tone="warning" className="flex flex-col gap-1">
        <p>실제 지출이 실제 수입보다 {won(-totals.balance)} 많아요</p>
        {finance && <p>빠진 수입 기록이 없는지 확인해 주세요.</p>}
      </Alert>
      : <p className="text-sm text-gray-700">실제 수입 {won(totals.received)} · 남은 돈 {won(totals.balance)}</p>}
    {finance && (plan.notices.eventsWithSpending > 0 || plan.notices.operatingOutside > 0) && <Alert tone="info" className="flex flex-col gap-1">
      {plan.notices.eventsWithSpending > 0 && <p>지출이 있는데 기간에 넣지 않은 행사 {plan.notices.eventsWithSpending}개 — 편성 수정에서 행사를 넣어 주세요.</p>}
      {plan.notices.operatingOutside > 0 && <p>어느 기간에도 들지 않는 상시 운영 지출 {plan.notices.operatingOutside}건 — 결제일이 들도록 기간 날짜를 확인해 주세요.</p>}
    </Alert>}
    {finance && !plan.period.closed && plan.closing.ended && <ClosingChecklist key={`closing-${plan.period.id}`} plan={plan} onClose={onClosePeriod} />}
    <section aria-label="수입" className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-gray-900">수입</h3>
      {plan.incomes.length === 0 ? <p className="text-xs text-gray-500">수입 예산이 없어요</p>
        : <ul className="flex flex-col gap-2">{plan.incomes.map(line => {
          const share = shareText(line.received, line.amount)
          return <li key={line.id} className={cn(cardClass, 'flex flex-col gap-2 p-4')}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 text-sm font-medium wrap-anywhere text-gray-900">{line.name}</span>
              {share && <span className="ml-auto text-xs text-gray-500">{share}</span>}
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
              <Figure label="예산" value={won(line.amount)} />
              <Figure label="실제 수입" value={won(line.received)} />
            </dl>
          </li>
        })}</ul>}
      {plan.unassignedIncome.count > 0 && <p className="text-xs text-gray-600">
        수입 항목을 고르지 않은 수입 {plan.unassignedIncome.count}건 · {won(plan.unassignedIncome.received)}</p>}
    </section>
    <section aria-label="수입 내역" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">수입 내역</h3>
        {finance && !plan.period.closed && <Button variant="outline" size="sm" onClick={onRecordIncome}><Plus />수입 기록</Button>}
      </div>
      {plan.incomeRecordsTruncated && <StateMessage kind="notice">최근 300건만 보여요</StateMessage>}
      {plan.incomeRecords.length === 0 ? <p className="text-xs text-gray-500">기록한 수입이 없어요</p>
        : <ul className="flex flex-col gap-2">{plan.incomeRecords.map(income =>
          <IncomeCard key={income.id} income={income} onOpen={() => onOpenIncome(income.id)} />)}</ul>}
    </section>
    <section aria-label="행사 예산" className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-gray-900">행사 예산</h3>
      {plan.events.length === 0 ? <p className="text-xs text-gray-500">넣은 행사가 없어요</p>
        : <ul className="flex flex-col gap-2">{plan.events.map(line => {
          const rate = rateText(line.spent, line.budget)
          return <li key={line.eventId} className={cn(cardClass, 'flex flex-col gap-2 p-4')}>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={() => onOpenEvent(line.eventId)}
                className="h-auto min-w-0 shrink justify-start p-0 text-left text-sm font-medium whitespace-normal wrap-anywhere text-gray-900 hover:bg-transparent hover:underline">{line.name}</Button>
              {line.settled && <Badge tone="success">정산 완료</Badge>}
              {rate && <span className="ml-auto text-xs text-gray-500">{rate}</span>}
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
              <Figure label="예산" value={budgetText(line.budget)} />
              <Figure label="실제 지출" value={won(line.spent)} />
              <Figure label="지출 예정" value={won(line.planned)} />
              <Figure label="남은 예산" value={remainingText(line.remaining)} danger={line.remaining !== null && line.remaining < 0} />
            </dl>
          </li>
        })}</ul>}
    </section>
    <section aria-label="운영 예산" className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-gray-900">운영 예산</h3>
      {plan.operating.length === 0 ? <p className="text-xs text-gray-500">운영 예산이 없어요</p>
        : <ul className="flex flex-col gap-2">{plan.operating.map(line => {
          const rate = rateText(line.spent, line.amount)
          return <li key={line.id} className={cn(cardClass, 'flex flex-col gap-2 p-4')}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 text-sm font-medium wrap-anywhere text-gray-900">{line.name}</span>
              {rate && <span className="ml-auto text-xs text-gray-500">{rate}</span>}
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
              <Figure label="예산" value={won(line.amount)} />
              <Figure label="실제 지출" value={won(line.spent)} />
              <Figure label="남은 예산" value={remainingText(line.remaining)} danger={line.remaining < 0} />
            </dl>
          </li>
        })}</ul>}
      {plan.unassigned.count > 0 && <p className="text-xs text-gray-600">운영 항목을 고르지 않은 지출 {plan.unassigned.count}건 · {won(plan.unassigned.spent)}</p>}
    </section>
    {plan.history.length > 0 && <section aria-label="처리 기록" className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold text-gray-900">처리 기록</h3>
      <ol className="flex flex-col gap-0.5 text-xs text-gray-600">{plan.history.map(entry => <li key={entry.id} className="wrap-anywhere">
        {entry.actor.name} · {timeText(entry.createdAt)} · {budgetHistoryText(entry)}</li>)}</ol>
    </section>}
  </div>
}
