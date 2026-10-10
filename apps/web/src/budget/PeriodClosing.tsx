import { useState } from 'react'
import { Check } from 'lucide-react'
import { ReopenPeriodSchema, type BudgetPlanResponse, type ClosePeriodRequest, type ReopenPeriodRequest } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { won } from '../purchases/purchase-view'
import { closedDay, closingRequirements, defaultCarryoverLine, readyToClose } from './budget-view'
import type { BudgetResult } from './useBudget'

type StatusProps = { plan: BudgetPlanResponse; finance: boolean; onReopen: (input: ReopenPeriodRequest) => Promise<BudgetResult> }

// 마감한 기간의 상태. 구성원 누구나 보고, 재정 권한자는 사유를 적어 다시 연다(행사 정산 다시 열기와 같다).
// 다음 기간이 마감돼 있으면 다시 열 수 없다(마감은 앞 기간부터 차례로 된다).
export function PeriodStatus({ plan, finance, onReopen }: StatusProps) {
  const [reason, setReason] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const { closed } = plan.period
  if (!closed) return null
  const { carriedOver, next } = plan.closing
  const input = { version: plan.period.version, reason: reason ?? '' }
  async function reopen() {
    setBusy(true)
    setMessage('')
    const result = await onReopen(input)
    setBusy(false)
    if (result.ok) setReason(null)
    else setMessage(result.message)
  }
  return <section aria-label="마감 상태" className={cn(cardClass, 'flex flex-col gap-2 p-4')}>
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone="success">마감</Badge>
      <span className="text-sm wrap-anywhere text-gray-700">{closedDay(closed.at)} · {closed.by.name}</span>
    </div>
    <p className="text-sm wrap-anywhere text-gray-700">
      {carriedOver ? `남은 돈 ${won(carriedOver.amount)}을 ${carriedOver.period.name} 수입으로 넘겼어요.` : '넘긴 돈이 없어요.'}</p>
    {finance && (next?.closed
      ? <p className="text-xs wrap-anywhere text-gray-500">다음 기간({next.name})이 마감돼 있어 다시 열 수 없어요.</p>
      : reason === null
        ? <Button variant="outline" size="sm" className="self-start" disabled={busy} onClick={() => setReason('')}>마감 다시 열기</Button>
        : <div className="flex flex-col gap-2">
          <Label className="flex flex-col gap-1.5">다시 여는 사유
            <Textarea rows={2} value={reason} onChange={event => setReason(event.target.value)} /></Label>
          <p className="text-xs text-gray-500">{carriedOver
            ? `다시 열면 넘긴 이월금 ${won(carriedOver.amount)}이 취소되고, 이 기간의 편성·수입·지출을 바꿀 수 있어요.`
            : '다시 열면 이 기간의 편성·수입·지출을 바꿀 수 있어요.'}</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setReason(null)}>돌아가기</Button>
            <Button disabled={busy || !ReopenPeriodSchema.safeParse(input).success} onClick={() => void reopen()}>다시 열기</Button>
          </div>
        </div>)}
    {message && <StateMessage kind="error">{message}</StateMessage>}
  </section>
}

type ChecklistProps = { plan: BudgetPlanResponse; onClose: (input: ClosePeriodRequest) => Promise<BudgetResult> }

// 끝난 열린 기간의 마감 조건. 재정 권한자에게만 보인다.
// 조건이 모두 맞으면 같은 자리에서 한 번 더 물은 뒤 마감한다(행사 정산과 같다). 남은 돈은 다음 기간의 수입으로 넘어간다.
export function ClosingChecklist({ plan, onClose }: ChecklistProps) {
  const lines = plan.closing.next?.incomes ?? []
  const [confirming, setConfirming] = useState(false)
  const [lineId, setLineId] = useState(() => defaultCarryoverLine(lines))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const ready = readyToClose(plan)
  const { balance } = plan.totals
  // 남은 돈이 있을 때만 다음 기간으로 넘긴다.
  const target = balance > 0 ? plan.closing.next : null
  async function close() {
    setBusy(true)
    setMessage('')
    // 편성을 새로 받아 고른 줄이 없어졌으면 고르지 않은 것으로 보낸다.
    const result = await onClose({ version: plan.period.version, carryoverLineId: target && lines.some(line => line.id === lineId) ? lineId : null })
    setBusy(false)
    if (result.ok) setConfirming(false)
    else setMessage(result.message)
  }
  return <section aria-label="마감하려면" className={cn(cardClass, 'flex flex-col gap-2 p-4')}>
    <h3 className="text-sm font-semibold text-gray-900">마감하려면</h3>
    <ul className="flex flex-col gap-1.5">{closingRequirements(plan).map(item => <li key={item.key} className="flex flex-col gap-0.5">
      <span className={cn('flex items-center gap-1 text-sm wrap-anywhere', item.done ? 'text-gray-500' : 'text-gray-900')}>
        {item.done && <Check aria-hidden className="size-3.5 shrink-0 text-green-600" />}{item.label}</span>
      {!item.done && <span className="text-xs text-gray-500">{item.hint}</span>}
    </li>)}</ul>
    {confirming
      ? <div className="flex flex-col gap-2">
        <p className="text-xs text-gray-500">마감하면 이 기간의 편성·수입·지출을 바꿀 수 없어요.</p>
        <p className="text-xs wrap-anywhere text-gray-500">
          {target ? `남은 돈 ${won(balance)}은 ${target.name} 수입으로 넘어가요.` : '남은 돈이 없어 넘기는 돈은 없어요.'}</p>
        {target && lines.length > 0 && <Label className="flex flex-col gap-1.5">이월금 수입 항목
          <NativeSelect value={lineId} onChange={event => setLineId(event.target.value)}>
            <option value="">고르지 않음</option>
            {lines.map(line => <option key={line.id} value={line.id}>{line.name}</option>)}
          </NativeSelect></Label>}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>그대로 두기</Button>
          <Button disabled={busy || !ready} onClick={() => void close()}>기간 마감</Button>
        </div>
      </div>
      : <Button className="self-start" disabled={!ready} onClick={() => setConfirming(true)}>기간 마감</Button>}
    {message && <StateMessage kind="error">{message}</StateMessage>}
  </section>
}
