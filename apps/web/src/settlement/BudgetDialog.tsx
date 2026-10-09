import { useState } from 'react'
import { SetEventBudgetSchema, type SetEventBudgetRequest } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { budgetInput } from './settlement-view'
import type { FinanceResult } from './useEventFinance'

type Props = { open: boolean; budget: number | null; version: number; onClose: () => void; onSubmit: (input: SetEventBudgetRequest) => Promise<FinanceResult> }

// 예산 정하기. 비우면 미정이다.
export default function BudgetDialog({ open, onClose, ...props }: Props) {
  return <Dialog open={open} onOpenChange={next => { if (!next) onClose() }}>
    {open && <DialogContent><Form onClose={onClose} {...props} /></DialogContent>}
  </Dialog>
}

function Form({ budget, version, onClose, onSubmit }: Omit<Props, 'open'>) {
  const [amount, setAmount] = useState(budget === null ? '' : budget.toLocaleString('ko-KR'))
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const input = { version, budget: budgetInput(amount) }
  // 버튼은 서버와 같은 스키마로 켠다.
  const valid = SetEventBudgetSchema.safeParse(input).success
  async function save() {
    setBusy(true)
    setMessage('')
    const result = await onSubmit(input)
    setBusy(false)
    if (result.ok) onClose()
    else setMessage(result.message)
  }
  return <>
    <DialogHeader><DialogTitle>예산 정하기</DialogTitle><DialogDescription>비우면 미정이에요.</DialogDescription></DialogHeader>
    <Label className="flex flex-col gap-1.5">예산(원)
      <Input inputMode="numeric" value={amount} onChange={event => setAmount(event.target.value)} /></Label>
    {message && <StateMessage kind="error">{message}</StateMessage>}
    <DialogFooter>
      <Button variant="outline" disabled={busy} onClick={onClose}>닫기</Button>
      <Button disabled={busy || !valid} onClick={() => void save()}>저장</Button>
    </DialogFooter>
  </>
}
