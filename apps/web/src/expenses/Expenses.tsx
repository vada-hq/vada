import { useState } from 'react'
import { Plus, Receipt } from 'lucide-react'
import type { EventSummary, ExpenseDetail } from '@vada/contracts'
import { EmptyState } from '@/components/EmptyState'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card, cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { won } from '../purchases/purchase-view'
import ExpenseCard from './ExpenseCard'
import ExpenseDetailDialog from './ExpenseDetailDialog'
import ExpenseFormDialog from './ExpenseFormDialog'
import { groupByMonth } from './expense-view'
import type { Expenses as State } from './useExpenses'

type Props = { organizationId: string; finance: boolean; viewerMembershipId: string; events: EventSummary[]; state: State }

// 사용 내역. 학생회 구성원 누구나 결제일 최근 순으로 지출과 증빙 여부를 본다.
export default function Expenses({ organizationId, finance, viewerMembershipId, events, state }: Props) {
  const [opened, setOpened] = useState<string | null>(null)
  const [form, setForm] = useState<{ expense: ExpenseDetail | null } | null>(null)
  if (!state.data) return <div className="p-4 sm:p-6">{state.loadError
    ? <Card className="flex flex-col gap-3 p-6"><StateMessage kind="error">사용 내역을 불러오지 못했어요.</StateMessage>
      <Button variant="outline" className="self-start" onClick={state.refresh}>다시 시도</Button></Card>
    : <StateMessage kind="loading">사용 내역 불러오는 중…</StateMessage>}</div>
  const { expenses, totals, truncated } = state.data
  const stats: [string, string][] = [['이번 달', won(totals.thisMonth)], ['전체', won(totals.total)], ['증빙 누락', `${totals.missingEvidence}건`]]
  return <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <section aria-label="지출 요약" className={cn(cardClass, 'grid grid-cols-3 gap-2 p-4')}>
        {stats.map(([label, value]) => <div key={label} className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs text-gray-500">{label}</span>
          <span className="text-sm font-semibold wrap-anywhere text-gray-900">{value}</span>
        </div>)}
      </section>
      {finance && <Button className="self-start" onClick={() => setForm({ expense: null })}><Plus />지출 기록</Button>}
      {truncated && <StateMessage kind="notice">최근 300개만 보여요.</StateMessage>}
      {expenses.length === 0
        ? <Card><EmptyState icon={Receipt} title="아직 기록된 지출이 없어요" description={finance ? '결제한 뒤 지출을 기록해 주세요.' : undefined} /></Card>
        : groupByMonth(expenses).map(group => <section key={group.title} aria-label={group.title} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-gray-900">{group.title}</h3>
          <ul className="flex flex-col gap-2">{group.expenses.map(expense => <ExpenseCard key={expense.id} expense={expense} onOpen={() => setOpened(expense.id)} />)}</ul>
        </section>)}
    </div>
    <ExpenseDetailDialog organizationId={organizationId} expenseId={opened} finance={finance} onClose={() => setOpened(null)} onChanged={state.refresh}
      onEdit={expense => { setOpened(null); setForm({ expense }) }} />
    <ExpenseFormDialog organizationId={organizationId} viewerMembershipId={viewerMembershipId} events={events} open={form !== null}
      expense={form?.expense ?? null} onClose={() => setForm(null)}
      onSubmit={input => form?.expense ? state.update(form.expense.id, { ...input, version: form.expense.version }) : state.create(input)}
      onSaved={saved => { setForm(null); state.refresh(); setOpened(saved.id) }} />
  </div>
}
