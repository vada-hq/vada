import { useState } from 'react'
import { Check, Download, Plus, Receipt } from 'lucide-react'
import { ReopenSettlementSchema, type EventSummary, type ExpenseDetail } from '@vada/contracts'
import { EmptyState } from '@/components/EmptyState'
import { StatGrid, type Stat } from '@/components/StatGrid'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, cardClass } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import ExpenseCard from '../expenses/ExpenseCard'
import ExpenseDetailDialog from '../expenses/ExpenseDetailDialog'
import ExpenseFormDialog from '../expenses/ExpenseFormDialog'
import { expensesBase, sendExpense } from '../expenses/useExpenses'
import { timeText, won } from '../purchases/purchase-view'
import BudgetDialog from './BudgetDialog'
import EventFees from './EventFees'
import { budgetText, defaultFeeIncomeLine, financeHistoryText, readyToSettle, remainingText, requirements, settledDay } from './settlement-view'
import type { EventFinanceState, FinanceResult } from './useEventFinance'

type Props = { organizationId: string; eventId: string; finance: boolean; viewerMembershipId: string; events: EventSummary[]; state: EventFinanceState }

// 행사 재정 탭. 구성원 누구나 숫자·정산 조건·지출·처리 기록을 보고 엑셀을 내려받는다.
// 재정 권한자는 예산을 정하고, 지출을 기록하고, 정산을 닫거나 다시 연다.
export default function EventFinance({ organizationId, eventId, finance, viewerMembershipId, events, state }: Props) {
  const [opened, setOpened] = useState<string | null>(null)
  const [form, setForm] = useState<{ expense: ExpenseDetail | null } | null>(null)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [reopenReason, setReopenReason] = useState<string | null>(null)
  // 고른 참가비 수입 항목. 고르기 전에는 null이고 기본값(이름에 "참가비"가 든 첫 줄)을 쓴다.
  const [feeLineId, setFeeLineId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [downloading, setDownloading] = useState(false)
  if (!state.data) return state.loadError
    ? <Card className="flex flex-col gap-3 p-6"><StateMessage kind="error">재정을 불러오지 못했어요.</StateMessage>
      <Button variant="outline" className="self-start" onClick={state.refresh}>다시 시도</Button></Card>
    : <StateMessage kind="loading">재정 불러오는 중…</StateMessage>
  const { finance: summary, expenses, truncated } = state.data
  const settled = summary.settled
  // 정산 뒤에는 예산·지출 기록을 감춘다. 서버도 막는다.
  const manage = finance && !settled
  async function run(action: () => Promise<FinanceResult>) {
    setBusy(true)
    setMessage('')
    const result = await action()
    setBusy(false)
    if (!result.ok) setMessage(result.message)
    return result.ok
  }
  async function download() {
    setDownloading(true)
    setMessage('')
    const result = await state.download()
    setDownloading(false)
    if (!result.ok) setMessage(result.message)
  }
  const reopenValid = ReopenSettlementSchema.safeParse({ version: summary.version, reason: reopenReason ?? '' }).success
  // 받은 참가비는 정산할 때 행사가 든 기간의 수입이 된다. 새로 받은 목록에 없는 줄이면 고르지 않은 것으로 보낸다(마감과 같다).
  const received = summary.fees?.received ?? 0
  const feeLines = summary.period?.incomes ?? []
  const feeLine = feeLineId ?? defaultFeeIncomeLine(feeLines)
  const settleInput = { version: summary.version, feeIncomeLineId: received > 0 && feeLines.some(line => line.id === feeLine) ? feeLine : null }
  const stats: Stat[] = [
    { label: '예산', value: budgetText(summary.budget),
      action: manage ? <Button variant="outline" size="sm" className="mt-1 self-start" onClick={() => setBudgetOpen(true)}>예산 정하기</Button> : undefined },
    { label: '실제 지출', value: won(summary.spent) },
    { label: '지출 예정', value: won(summary.planned), note: summary.plannedUnknown ? `금액을 모르는 품목 ${summary.plannedUnknown}개 제외` : undefined },
    { label: '남은 예산', value: remainingText(summary.remaining), tone: summary.remaining !== null && summary.remaining < 0 ? 'danger' : undefined },
  ]
  return <div className="flex flex-col gap-4">
    {settled && <section aria-label="정산 상태" className={cn(cardClass, 'flex flex-col gap-2 p-4')}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="success">정산 완료</Badge>
        <span className="text-sm wrap-anywhere text-gray-700">{settledDay(settled.at)} · {settled.by.name}</span>
      </div>
      {/* 마감한 회계 기간의 행사는 정산을 다시 열 수 없다. 서버도 막는다. */}
      {finance && summary.periodClosed && <p className="text-xs text-gray-500">마감한 회계 기간의 행사라 정산을 다시 열 수 없어요.</p>}
      {finance && !summary.periodClosed && (reopenReason === null
        ? <Button variant="outline" size="sm" className="self-start" disabled={busy} onClick={() => setReopenReason('')}>정산 다시 열기</Button>
        : <div className="flex flex-col gap-2">
          <Label className="flex flex-col gap-1.5">다시 여는 사유
            <Textarea rows={2} value={reopenReason} onChange={event => setReopenReason(event.target.value)} /></Label>
          <p className="text-xs text-gray-500">{summary.feeIncome
            ? `다시 열면 참가비 수입 ${won(summary.feeIncome.amount)}이 취소되고, 지출과 예산을 바꿀 수 있어요.` : '다시 열면 지출과 예산을 바꿀 수 있어요.'}</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setReopenReason(null)}>돌아가기</Button>
            <Button disabled={busy || !reopenValid} onClick={() => void run(() => state.reopen({ version: summary.version, reason: reopenReason }))
              .then(done => { if (done) setReopenReason(null) })}>다시 열기</Button>
          </div>
        </div>)}
    </section>}
    <StatGrid label="행사 재정" className="grid-cols-2 gap-3 sm:grid-cols-4" stats={stats} />
    {summary.fees && <EventFees fees={summary.fees} feeIncome={summary.feeIncome} hint={finance && !settled} />}
    {!settled && <section aria-label="정산하려면" className={cn(cardClass, 'flex flex-col gap-2 p-4')}>
      <h3 className="text-sm font-semibold text-gray-900">정산하려면</h3>
      <ul className="flex flex-col gap-1.5">{requirements(summary).map(item => <li key={item.key} className="flex flex-col gap-0.5">
        <span className={cn('flex items-center gap-1 text-sm wrap-anywhere', item.done ? 'text-gray-500' : 'text-gray-900')}>
          {item.done && <Check aria-hidden className="size-3.5 shrink-0 text-green-600" />}{item.label}</span>
        {finance && !item.done && <span className="text-xs text-gray-500">{item.hint}</span>}
      </li>)}</ul>
      {finance && (confirming
        ? <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-500">정산을 마치면 이 행사의 지출·예산·증빙 삭제가 잠겨요.</p>
          {received > 0 && summary.period && <p className="text-xs wrap-anywhere text-gray-500">
            {`받은 참가비 ${won(received)}은 ${summary.period.name} 수입으로 들어가요.`}</p>}
          {summary.fees && <p className="text-xs text-gray-500">정산 뒤에는 입금 확인과 참가비를 바꿀 수 없어요.</p>}
          {received > 0 && feeLines.length > 0 && <Label className="flex flex-col gap-1.5">참가비 수입 항목
            <NativeSelect value={feeLine} onChange={event => setFeeLineId(event.target.value)}>
              <option value="">고르지 않음</option>
              {feeLines.map(line => <option key={line.id} value={line.id}>{line.name}</option>)}
            </NativeSelect></Label>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>그대로 두기</Button>
            <Button disabled={busy || !readyToSettle(summary)} onClick={() => void run(() => state.settle(settleInput)).then(() => setConfirming(false))}>정산 완료</Button>
          </div>
        </div>
        : <Button className="self-start" disabled={busy || !readyToSettle(summary)} onClick={() => setConfirming(true)}>정산 완료</Button>)}
    </section>}
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={downloading} onClick={() => void download()}><Download />{downloading ? '내려받는 중…' : '엑셀 내려받기'}</Button>
      {manage && <Button variant="outline" onClick={() => setForm({ expense: null })}><Plus />지출 기록</Button>}
    </div>
    {message && <StateMessage kind="error">{message}</StateMessage>}
    <section aria-label="이 행사의 지출" className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-gray-900">지출</h3>
      {truncated && <StateMessage kind="notice">최근 300개만 보여요.</StateMessage>}
      {expenses.length === 0 ? <Card><EmptyState icon={Receipt} title="이 행사에 기록된 지출이 없어요" /></Card>
        : <ul className="flex flex-col gap-2">{expenses.map(expense => <ExpenseCard key={expense.id} expense={expense} onOpen={() => setOpened(expense.id)} />)}</ul>}
    </section>
    {summary.history.length > 0 && <section aria-label="처리 기록" className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold text-gray-900">처리 기록</h3>
      <ol className="flex flex-col gap-0.5 text-xs text-gray-600">{summary.history.map(entry => <li key={entry.id} className="wrap-anywhere">
        {entry.actor.name} · {timeText(entry.createdAt)} · {financeHistoryText(entry)}</li>)}</ol>
    </section>}
    <BudgetDialog open={budgetOpen} budget={summary.budget} version={summary.version} onClose={() => setBudgetOpen(false)} onSubmit={state.setBudget} />
    <ExpenseDetailDialog organizationId={organizationId} expenseId={opened} finance={finance} onClose={() => setOpened(null)} onChanged={state.refresh}
      onEdit={expense => { setOpened(null); setForm({ expense }) }} />
    <ExpenseFormDialog organizationId={organizationId} viewerMembershipId={viewerMembershipId} events={events} initialEventId={eventId}
      open={form !== null} expense={form?.expense ?? null} onClose={() => setForm(null)}
      onSubmit={input => form?.expense
        ? sendExpense(`${expensesBase(organizationId)}/${encodeURIComponent(form.expense.id)}`, 'PATCH', { ...input, version: form.expense.version })
        : sendExpense(expensesBase(organizationId), 'POST', input)}
      onSaved={saved => { setForm(null); state.refresh(); setOpened(saved.id) }} />
  </div>
}
