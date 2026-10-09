import { useState } from 'react'
import { CreateBudgetPeriodSchema, type CreateBudgetPeriodRequest } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { todayInSeoul } from '../purchases/purchase-view'
import { defaultNewPeriod } from './budget-view'
import type { BudgetResult } from './useBudget'

type Props = { open: boolean; periods: { endsOn: string }[]; onClose: () => void; onCreate: (input: CreateBudgetPeriodRequest) => Promise<BudgetResult> }

// 회계 기간 만들기. 기본값은 학기와 바로 뒤 방학을 묶은 기간이다.
export default function PeriodDialog({ open, onClose, ...props }: Props) {
  return <Dialog open={open} onOpenChange={next => { if (!next) onClose() }}>
    {open && <DialogContent><Form onClose={onClose} {...props} /></DialogContent>}
  </Dialog>
}

function Form({ periods, onClose, onCreate }: Omit<Props, 'open'>) {
  const [value, setValue] = useState(() => defaultNewPeriod(periods, todayInSeoul()))
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  // 버튼은 서버와 같은 스키마로 켠다.
  const valid = CreateBudgetPeriodSchema.safeParse(value).success
  async function create() {
    setBusy(true)
    setMessage('')
    const result = await onCreate(value)
    setBusy(false)
    if (!result.ok) setMessage(result.message)
  }
  return <>
    <DialogHeader><DialogTitle>회계 기간 만들기</DialogTitle></DialogHeader>
    <div className="flex flex-col gap-3">
      <Label className="flex flex-col gap-1.5">이름<Input value={value.name} onChange={event => setValue({ ...value, name: event.target.value })} /></Label>
      <div className="grid grid-cols-2 gap-3">
        <Label className="flex flex-col gap-1.5">시작일
          <Input type="date" value={value.startsOn} onChange={event => setValue({ ...value, startsOn: event.target.value })} /></Label>
        <Label className="flex flex-col gap-1.5">끝일
          <Input type="date" value={value.endsOn} onChange={event => setValue({ ...value, endsOn: event.target.value })} /></Label>
      </div>
      {message && <StateMessage kind="error">{message}</StateMessage>}
    </div>
    <DialogFooter>
      <Button variant="outline" disabled={busy} onClick={onClose}>닫기</Button>
      <Button disabled={busy || !valid} onClick={() => void create()}>만들기</Button>
    </DialogFooter>
  </>
}
