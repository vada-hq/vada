import { useState, type FormEvent } from 'react'
import { ChangeNeededBySchema, type PurchaseItemSummary } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addDays, neededByText, pressed, quickDates } from './purchase-view'

type Props = { items: PurchaseItemSummary[] | null; today: string; busy: boolean; error: string; onClose: () => void
  onSave: (items: PurchaseItemSummary[], neededBy: string | null) => void }

// 여러 품목의 받을 날짜를 한 번에 바꾼다. 빈 값은 "상관없음"이다.
export default function NeededByDialog({ items, ...props }: Props) {
  return <Dialog open={items !== null} onOpenChange={open => { if (!open && !props.busy) props.onClose() }}>
    {items && <DialogContent><DateForm key={items.map(item => `${item.id}:${item.version}`).join()} items={items} {...props} /></DialogContent>}
  </Dialog>
}

function DateForm({ items, today, busy, error, onClose, onSave }: Omit<Props, 'items'> & { items: PurchaseItemSummary[] }) {
  const first = items[0]?.neededBy ?? null
  const [value, setValue] = useState(first && items.every(item => item.neededBy === first) ? first : '')
  const neededBy = value === '' ? null : value
  const valid = ChangeNeededBySchema.safeParse({ items: items.map(({ id, version }) => ({ id, version })), neededBy }).success
  function submit(event: FormEvent) {
    event.preventDefault()
    if (valid && !busy) onSave(items, neededBy)
  }
  return <form className="flex flex-col gap-4" onSubmit={submit}>
    <DialogHeader><DialogTitle>받을 날짜</DialogTitle><DialogDescription>{items.length}개 품목</DialogDescription></DialogHeader>
    <div role="group" aria-label="빠르게 고르기" className="flex flex-wrap gap-2">
      {quickDates.map(option => {
        const date = addDays(today, option.days)
        return <Button key={option.label} type="button" variant="outline" size="sm" className={pressed} aria-pressed={value === date}
          onClick={() => setValue(date)}>{option.label}</Button>
      })}
      <Button type="button" variant="outline" size="sm" className={pressed} aria-pressed={value === ''} onClick={() => setValue('')}>상관없음</Button>
    </div>
    <Label className="flex flex-col gap-1.5">날짜<Input type="date" value={value} min={today} onChange={event => setValue(event.target.value)} /></Label>
    <p className="text-sm text-gray-700">{neededByText(neededBy)}</p>
    {error && <StateMessage kind="error">{error}</StateMessage>}
    <DialogFooter>
      <Button type="button" variant="outline" disabled={busy} onClick={onClose}>취소</Button>
      <Button disabled={busy || !valid}>저장</Button>
    </DialogFooter>
  </form>
}
