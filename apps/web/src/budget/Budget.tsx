import { useState } from 'react'
import { Plus, Wallet } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { todayInSeoul } from '../purchases/purchase-view'
import BudgetPlanForm from './BudgetPlanForm'
import BudgetPlanView from './BudgetPlanView'
import PeriodDialog from './PeriodDialog'
import { currentPeriodId } from './budget-view'
import { createBudgetPeriod, useBudgetPeriods, useBudgetPlan } from './useBudget'

type Props = { organizationId: string; finance: boolean; onOpenEvent: (eventId: string) => void }

// 예산. 구성원 누구나 회계 기간마다 편성과 집행을 본다. 재정 권한자는 기간을 만들고 편성을 고친다.
export default function Budget({ organizationId, finance, onOpenEvent }: Props) {
  const periods = useBudgetPeriods(organizationId, true)
  const [chosen, setChosen] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const list = periods.data?.periods ?? []
  // 방금 만든 기간은 목록을 새로 받기 전에도 연다.
  const periodId = chosen ?? currentPeriodId(list, todayInSeoul())
  const plan = useBudgetPlan(organizationId, periodId)
  if (!periods.data) return <div className="p-4 sm:p-6">{periods.loadError
    ? <Card className="flex flex-col gap-3 p-6"><StateMessage kind="error">예산을 불러오지 못했어요.</StateMessage>
      <Button variant="outline" className="self-start" onClick={periods.refresh}>다시 시도</Button></Card>
    : <StateMessage kind="loading">예산 불러오는 중…</StateMessage>}</div>
  const dialog = <PeriodDialog open={creating} periods={list} onClose={() => setCreating(false)} onCreate={async input => {
    const result = await createBudgetPeriod(organizationId, input)
    if (result.ok) { setCreating(false); setEditing(false); setChosen(result.plan.period.id); periods.refresh() }
    return result
  }} />
  if (periodId === null) return <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
    <Card className="mx-auto flex max-w-3xl flex-col items-center pb-6">
      <EmptyState icon={Wallet} title="아직 회계 기간이 없어요" />
      {finance && <Button onClick={() => setCreating(true)}><Plus />회계 기간 만들기</Button>}
    </Card>
    {dialog}
  </div>
  return <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      {(list.length > 1 || (finance && !editing)) && <div className="flex flex-wrap items-end gap-2">
        {list.length > 1 && <Label className="flex min-w-0 flex-1 flex-col gap-1.5">회계 기간
          <NativeSelect value={periodId} disabled={editing} onChange={event => setChosen(event.target.value)}>
            {list.map(period => <option key={period.id} value={period.id}>{period.name}</option>)}
          </NativeSelect></Label>}
        {finance && !editing && <div className="flex gap-2">
          <Button variant="outline" disabled={!plan.data} onClick={() => setEditing(true)}>편성 수정</Button>
          <Button variant="outline" onClick={() => setCreating(true)}><Plus />새 기간</Button>
        </div>}
      </div>}
      {!plan.data ? (plan.loadError
        ? <Card className="flex flex-col gap-3 p-6"><StateMessage kind="error">편성을 불러오지 못했어요.</StateMessage>
          <Button variant="outline" className="self-start" onClick={plan.refresh}>다시 시도</Button></Card>
        : <StateMessage kind="loading">편성 불러오는 중…</StateMessage>)
        : editing ? <BudgetPlanForm key={plan.data.period.version} plan={plan.data} onCancel={() => setEditing(false)} onSave={async input => {
          const result = await plan.save(input)
          if (result.ok) { setEditing(false); periods.refresh() }
          return result
        }} />
        : <BudgetPlanView plan={plan.data} finance={finance} onOpenEvent={onOpenEvent} />}
    </div>
    {dialog}
  </div>
}
