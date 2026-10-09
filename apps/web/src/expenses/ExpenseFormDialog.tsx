import { useState } from 'react'
import { CreateExpenseSchema, EXPENSE_METHODS, UpdateExpenseSchema, type CreateExpenseRequest, type EventSummary, type ExpenseDetail,
  type ExpenseItem, type ExpenseMethod } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { useOrganizationMembers } from '../organization/useOrganizationMembers'
import { productNameOf } from '../purchases/PurchaseItemCard'
import { todayInSeoul, won } from '../purchases/purchase-view'
import { methodLabels } from './expense-view'
import type { ExpenseResult } from './useExpenses'
import { useLinkableItems } from './useLinkableItems'

type Props = {
  organizationId: string
  viewerMembershipId: string
  events: EventSummary[]
  // 행사 재정 탭에서 열면 그 행사를 미리 고른다.
  initialEventId?: string
  open: boolean
  // 있으면 수정, 없으면 새 기록이다.
  expense: ExpenseDetail | null
  onClose: () => void
  onSubmit: (input: CreateExpenseRequest) => Promise<ExpenseResult>
  onSaved: (expense: ExpenseDetail) => void
}

// 지출 기록·수정. 영수증은 기록한 뒤 상세에서 올린다.
export default function ExpenseFormDialog({ open, expense, onClose, ...props }: Props) {
  return <Dialog open={open} onOpenChange={next => { if (!next) onClose() }}>
    {open && <DialogContent><Form key={expense?.id ?? 'new'} expense={expense} onClose={onClose} {...props} /></DialogContent>}
  </Dialog>
}

const itemText = (item: ExpenseItem) => [productNameOf(item), item.quantity === null ? '수량 확인 필요' : `${item.quantity}개`,
  ...(item.quantity !== null && item.estimatedUnitPrice !== null ? [`예상 ${won(item.quantity * item.estimatedUnitPrice)}`] : []),
  item.requester.name].join(' · ')

function Form({ organizationId, viewerMembershipId, events, initialEventId, expense, onClose, onSubmit, onSaved }: Omit<Props, 'open'>) {
  const [eventId, setEventId] = useState(expense?.event?.id ?? initialEventId ?? '')
  const [vendor, setVendor] = useState(expense?.vendor ?? '')
  const [description, setDescription] = useState(expense?.description ?? '')
  const [paidOn, setPaidOn] = useState(expense?.paidOn ?? todayInSeoul())
  const [method, setMethod] = useState<ExpenseMethod>(expense?.method ?? 'council_card')
  const [payer, setPayer] = useState(expense?.payerMembershipId ?? viewerMembershipId)
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '')
  const [note, setNote] = useState(expense?.note ?? '')
  const [itemIds, setItemIds] = useState<string[]>(expense?.items.map(item => item.id) ?? [])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const members = useOrganizationMembers(organizationId, true)
  const linkable = useLinkableItems(organizationId, true)
  // 고른 행사의 품목만 고른다. 수정할 때는 이미 연결한 품목도 목록에 둔다.
  const choices = eventId ? [...(expense?.items ?? []), ...(linkable.data?.items ?? [])]
    .filter((item, index, list) => item.event.id === eventId && list.findIndex(other => other.id === item.id) === index) : []
  const input: CreateExpenseRequest = { eventId: eventId || null, vendor, description, amount: amount.trim() === '' ? Number.NaN : Number(amount),
    paidOn, method, payerMembershipId: payer, note: note.trim() ? note : null, itemIds, budgetLineId: null }
  // 버튼은 서버와 같은 스키마로 켠다. 길이 숫자를 화면에 다시 적지 않는다.
  const valid = expense ? UpdateExpenseSchema.safeParse({ ...input, version: expense.version }).success : CreateExpenseSchema.safeParse(input).success
  const loaded = members.data?.members ?? []
  // 구성원 목록을 받기 전에도 지금 고른 사람은 고를 수 있게 둔다.
  const people = loaded.some(member => member.id === payer) ? loaded
    : [{ id: payer, name: payer === expense?.payerMembershipId ? expense.payer.name : '나' }, ...loaded]
  function chooseEvent(next: string) {
    setEventId(next)
    setItemIds([])
  }
  async function save() {
    setBusy(true)
    setMessage('')
    const result = await onSubmit(input)
    setBusy(false)
    if (result.ok) onSaved(result.expense)
    else setMessage(result.message)
  }
  return <>
    <DialogHeader>
      <DialogTitle>{expense ? '지출 수정' : '지출 기록'}</DialogTitle>
      <DialogDescription>결제 한 번을 기록해요. 영수증은 기록한 뒤 올려요.</DialogDescription>
    </DialogHeader>
    <div className="flex flex-col gap-3">
      <Label className="flex flex-col gap-1.5">행사
        <NativeSelect value={eventId} onChange={event => chooseEvent(event.target.value)}>
          <option value="">상시 운영</option>
          {events.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </NativeSelect></Label>
      <Label className="flex flex-col gap-1.5">사용처<Input value={vendor} onChange={event => setVendor(event.target.value)} /></Label>
      <Label className="flex flex-col gap-1.5">내용<Input value={description} onChange={event => setDescription(event.target.value)} /></Label>
      <div className="grid grid-cols-2 gap-3">
        <Label className="flex flex-col gap-1.5">결제일<Input type="date" value={paidOn} onChange={event => setPaidOn(event.target.value)} /></Label>
        <Label className="flex flex-col gap-1.5">금액(원)
          <Input type="number" inputMode="numeric" min={0} step={1} value={amount} onChange={event => setAmount(event.target.value)} /></Label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Label className="flex flex-col gap-1.5">결제 수단
          <NativeSelect value={method} onChange={event => setMethod(event.target.value as ExpenseMethod)}>
            {EXPENSE_METHODS.map(value => <option key={value} value={value}>{methodLabels[value]}</option>)}
          </NativeSelect></Label>
        <Label className="flex flex-col gap-1.5">결제한 사람
          <NativeSelect value={payer} onChange={event => setPayer(event.target.value)}>
            {people.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
          </NativeSelect></Label>
      </div>
      <Label className="flex flex-col gap-1.5">메모<Textarea rows={2} value={note} onChange={event => setNote(event.target.value)} /></Label>
      {eventId && <section aria-label="연결할 품목" className="flex flex-col gap-1.5">
        <h3 className="text-sm font-medium text-gray-700">연결할 품목</h3>
        {linkable.loadError && <StateMessage kind="error">연결할 품목을 불러오지 못했어요.</StateMessage>}
        {choices.length === 0 ? <p className="text-xs text-gray-500">연결할 승인 품목이 없어요.</p>
          : choices.map(item => <Label key={item.id} className="flex items-start gap-2 font-normal">
            <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-blue-600" checked={itemIds.includes(item.id)}
              onChange={event => setItemIds(previous => event.target.checked ? [...previous, item.id] : previous.filter(id => id !== item.id))} />
            <span className="min-w-0 text-sm wrap-anywhere">{itemText(item)}</span>
          </Label>)}
      </section>}
      {message && <StateMessage kind="error">{message}</StateMessage>}
    </div>
    <DialogFooter>
      <Button variant="outline" disabled={busy} onClick={onClose}>닫기</Button>
      <Button disabled={busy || !valid} onClick={() => void save()}>{expense ? '저장' : '기록'}</Button>
    </DialogFooter>
  </>
}
