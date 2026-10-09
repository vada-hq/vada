import { useState } from 'react'
import { CreateIncomeSchema, UpdateIncomeSchema, type CreateIncomeRequest, type IncomeDetail } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { todayInSeoul } from '../purchases/purchase-view'
import { budgetInput } from '../settlement/settlement-view'
import { periodDayText } from './budget-view'
import { defaultReceivedOn } from './income-view'
import type { IncomeResult } from './useIncomes'

type Props = {
  open: boolean
  period: { startsOn: string; endsOn: string }
  // 이 기간의 수입 줄. 없으면 항목 고르기를 두지 않는다.
  lines: { id: string; name: string }[]
  // 있으면 수정, 없으면 새 기록이다.
  income: IncomeDetail | null
  onClose: () => void
  onSubmit: (input: CreateIncomeRequest) => Promise<IncomeResult>
  onSaved: (income: IncomeDetail) => void
}

// 수입 기록·수정. 통장에 들어온 돈 한 건이고, 받은 날은 이 기간 안이어야 한다.
export default function IncomeFormDialog({ open, income, onClose, ...props }: Props) {
  return <Dialog open={open} onOpenChange={next => { if (!next) onClose() }}>
    {open && <DialogContent><Form key={income?.id ?? 'new'} income={income} onClose={onClose} {...props} /></DialogContent>}
  </Dialog>
}

function Form({ period, lines, income, onClose, onSubmit, onSaved }: Omit<Props, 'open'>) {
  const [budgetLineId, setBudgetLineId] = useState(income?.budgetLine?.id ?? '')
  const [description, setDescription] = useState(income?.description ?? '')
  const [receivedOn, setReceivedOn] = useState(income?.receivedOn ?? defaultReceivedOn(period, todayInSeoul()))
  // 금액은 글 칸이다. "750,000"처럼 쉼표·"원"을 넣어도 읽는다.
  const [amount, setAmount] = useState(income ? income.amount.toLocaleString('ko-KR') : '')
  const [note, setNote] = useState(income?.note ?? '')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const input: CreateIncomeRequest = { description, amount: budgetInput(amount) ?? Number.NaN, receivedOn, budgetLineId: budgetLineId || null,
    note: note.trim() ? note : null }
  const inside = period.startsOn <= receivedOn && receivedOn <= period.endsOn
  // 버튼은 서버와 같은 스키마로 켠다. 길이 숫자를 화면에 다시 적지 않는다.
  const valid = inside && (income ? UpdateIncomeSchema.safeParse({ ...input, version: income.version }).success : CreateIncomeSchema.safeParse(input).success)
  async function save() {
    setBusy(true)
    setMessage('')
    const result = await onSubmit(input)
    setBusy(false)
    if (result.ok) onSaved(result.income)
    else setMessage(result.message)
  }
  return <>
    <DialogHeader>
      <DialogTitle>{income ? '수입 수정' : '수입 기록'}</DialogTitle>
      <DialogDescription>통장에 들어온 돈 한 건을 기록해요.</DialogDescription>
    </DialogHeader>
    <div className="flex flex-col gap-3">
      {lines.length > 0 && <Label className="flex flex-col gap-1.5">수입 항목
        <NativeSelect value={budgetLineId} onChange={event => setBudgetLineId(event.target.value)}>
          <option value="">고르지 않음</option>
          {lines.map(line => <option key={line.id} value={line.id}>{line.name}</option>)}
        </NativeSelect></Label>}
      <Label className="flex flex-col gap-1.5">내용<Input value={description} onChange={event => setDescription(event.target.value)} /></Label>
      <div className="grid grid-cols-2 gap-3">
        <Label className="flex flex-col gap-1.5">받은 날
          <Input type="date" min={period.startsOn} max={period.endsOn} value={receivedOn} onChange={event => setReceivedOn(event.target.value)} /></Label>
        <Label className="flex flex-col gap-1.5">금액(원)
          <Input inputMode="numeric" value={amount} onChange={event => setAmount(event.target.value)} /></Label>
      </div>
      {!inside && <p className="text-xs text-destructive">
        이 기간({periodDayText(period.startsOn)} ~ {periodDayText(period.endsOn)}) 안의 날짜를 골라 주세요.</p>}
      <Label className="flex flex-col gap-1.5">메모<Textarea rows={2} value={note} onChange={event => setNote(event.target.value)} /></Label>
      {message && <StateMessage kind="error">{message}</StateMessage>}
    </div>
    <DialogFooter>
      <Button variant="outline" disabled={busy} onClick={onClose}>닫기</Button>
      <Button disabled={busy || !valid} onClick={() => void save()}>{income ? '저장' : '기록'}</Button>
    </DialogFooter>
  </>
}
