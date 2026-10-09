import { useState } from 'react'
import { SaveBudgetPlanSchema, type BudgetPlanResponse, type SaveBudgetPlanRequest } from '@vada/contracts'
import { StatGrid } from '@/components/StatGrid'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
import { won } from '../purchases/purchase-view'
import { budgetText } from '../settlement/settlement-view'
import { draftOf, draftTotals, eventDraft, newLine, planInput, rebaseDraft, type DraftLine } from './budget-view'
import type { BudgetResult } from './useBudget'

type Props = { plan: BudgetPlanResponse; onCancel: () => void; onSave: (input: SaveBudgetPlanRequest) => Promise<BudgetResult> }

// 편성 수정. 기간·수입·행사·운영을 한 번에 고쳐 저장한다. 저장 버튼은 서버와 같은 스키마로 켠다.
export default function BudgetPlanForm({ plan, onCancel, onSave }: Props) {
  const [draft, setDraft] = useState(() => draftOf(plan))
  // 저장에 실패하면 부르는 쪽이 편성을 새로 받는다. 그때 입력을 새 편성 위에 다시 얹고, 오류 문구는 그대로 둔다.
  const [base, setBase] = useState(plan)
  if (base !== plan) {
    setBase(plan)
    setDraft(previous => rebaseDraft(previous, base, plan))
  }
  const [adding, setAdding] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const input = planInput(draft, plan.period.version)
  const valid = SaveBudgetPlanSchema.safeParse(input).success
  const totals = draftTotals(draft)
  // 원래 이 기간에 있던 행사도 빼면 다시 넣을 수 있다.
  const pool = [...plan.events, ...plan.candidates].filter(entry => !draft.events.some(line => line.eventId === entry.eventId))
  const used = new Map(plan.operating.map(line => [line.id, line.expenseCount]))
  const received = new Map(plan.incomes.map(line => [line.id, line.incomeCount]))
  async function save() {
    setBusy(true)
    setMessage('')
    const result = await onSave(input)
    setBusy(false)
    if (!result.ok) setMessage(result.message)
  }
  function addEvent() {
    const entry = pool.find(candidate => candidate.eventId === adding)
    if (!entry) return
    setDraft(previous => ({ ...previous, events: [...previous.events, eventDraft(entry)] }))
    setAdding('')
  }
  return <section aria-label="편성 수정" className="flex flex-col gap-4">
    <section aria-label="기간" className={cn(cardClass, 'flex flex-col gap-3 p-4')}>
      <h3 className="text-sm font-semibold text-gray-900">기간</h3>
      <Label className="flex flex-col gap-1.5">이름<Input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></Label>
      <div className="grid grid-cols-2 gap-3">
        <Label className="flex flex-col gap-1.5">시작일
          <Input type="date" value={draft.startsOn} onChange={event => setDraft({ ...draft, startsOn: event.target.value })} /></Label>
        <Label className="flex flex-col gap-1.5">끝일
          <Input type="date" value={draft.endsOn} onChange={event => setDraft({ ...draft, endsOn: event.target.value })} /></Label>
      </div>
    </section>
    <LinesEditor title="수입 예산" addLabel="수입 추가" lines={draft.incomes} used={received} usedText="이 항목을 고른 수입이 있어요"
      onChange={incomes => setDraft({ ...draft, incomes })} />
    <section aria-label="행사 예산" className={cn(cardClass, 'flex flex-col gap-3 p-4')}>
      <h3 className="text-sm font-semibold text-gray-900">행사 예산</h3>
      {draft.events.length > 0 && <ul className="flex flex-col gap-3">{draft.events.map(line => <li key={line.eventId} aria-label={line.name}
        className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <span className="min-w-0 flex-1 text-sm font-medium wrap-anywhere text-gray-900">{line.name}</span>
        {line.settled
          ? <span className="flex items-center gap-2 text-sm text-gray-700">{budgetText(line.budget)}<Badge tone="success">정산 완료</Badge></span>
          : <Label className="flex flex-col gap-1.5 sm:w-40">예산(원)
            <Input inputMode="numeric" value={line.amount} onChange={event => setDraft({ ...draft,
              events: draft.events.map(item => item.eventId === line.eventId ? { ...item, amount: event.target.value } : item) })} /></Label>}
        <Button variant="outline" size="sm" onClick={() => setDraft({ ...draft, events: draft.events.filter(item => item.eventId !== line.eventId) })}>빼기</Button>
      </li>)}</ul>}
      {pool.length > 0 && <div className="flex items-end gap-2">
        <Label className="flex min-w-0 flex-1 flex-col gap-1.5">넣을 행사
          <NativeSelect value={adding} onChange={event => setAdding(event.target.value)}>
            <option value="">—</option>
            {pool.map(entry => <option key={entry.eventId} value={entry.eventId}>{entry.name}</option>)}
          </NativeSelect></Label>
        <Button variant="outline" disabled={!adding} onClick={addEvent}>넣기</Button>
      </div>}
    </section>
    <LinesEditor title="운영 예산" addLabel="항목 추가" lines={draft.operating} used={used} usedText="이 항목을 고른 지출이 있어요"
      onChange={operating => setDraft({ ...draft, operating })} />
    <StatGrid label="합계 미리 보기" className="grid-cols-3 gap-3" stats={[{ label: '수입 예산', value: won(totals.income) }, { label: '예산', value: won(totals.budget) },
      { label: '배정 안 한 돈', value: totals.unallocated < 0 ? `${won(-totals.unallocated)} 초과` : won(totals.unallocated),
        tone: totals.unallocated < 0 ? 'danger' : undefined }]} />
    {message && <StateMessage kind="error">{message}</StateMessage>}
    <div className="flex justify-end gap-2">
      <Button variant="outline" disabled={busy} onClick={onCancel}>취소</Button>
      <Button disabled={busy || !valid} onClick={() => void save()}>저장</Button>
    </div>
  </section>
}

// used: 줄마다 그 줄을 고른 기록(지출·수입) 수. 0이 아니면 지우지 못하고 usedText로 이유를 적는다.
type LinesProps = { title: string; addLabel: string; lines: DraftLine[]; used: Map<string, number>; usedText: string
  onChange: (lines: DraftLine[]) => void }
// 이름·금액 줄 묶음. 줄마다 "{묶음} {번호}"로 이름을 붙여 칸을 찾기 쉽게 한다.
function LinesEditor({ title, addLabel, lines, used, usedText, onChange }: LinesProps) {
  const update = (key: string, change: Partial<DraftLine>) => onChange(lines.map(line => line.key === key ? { ...line, ...change } : line))
  return <section aria-label={title} className={cn(cardClass, 'flex flex-col gap-3 p-4')}>
    <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
    {lines.length > 0 && <ul className="flex flex-col gap-3">{lines.map((line, index) => {
      const inUse = line.id !== null && (used.get(line.id) ?? 0) > 0
      return <li key={line.key} aria-label={`${title} ${index + 1}`} className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Label className="flex min-w-0 flex-1 flex-col gap-1.5">이름<Input value={line.name} onChange={event => update(line.key, { name: event.target.value })} /></Label>
          <Label className="flex flex-col gap-1.5 sm:w-40">금액(원)
            <Input inputMode="numeric" value={line.amount} onChange={event => update(line.key, { amount: event.target.value })} /></Label>
          <Button variant="outline" size="sm" disabled={inUse} onClick={() => onChange(lines.filter(item => item.key !== line.key))}>지우기</Button>
        </div>
        {inUse && <p className="text-xs text-gray-500">{usedText}</p>}
      </li>
    })}</ul>}
    <Button variant="outline" size="sm" className="self-start" onClick={() => onChange([...lines, newLine()])}>{addLabel}</Button>
  </section>
}
