import { useState } from 'react'
import { SetFeeAccountSchema, type FeeAccountView, type SetFeeAccountRequest } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FeeResult } from './useFeeSettings'

type Props = {
  open: boolean
  // 지금 계좌. 없으면 처음 넣는다.
  account: FeeAccountView | null
  onClose: () => void
  onSubmit: (input: SetFeeAccountRequest) => Promise<FeeResult>
}

// 참가비를 받는 학생회 계좌. 재정 담당자가 정하고, 신청한 학생은 내 신청 화면에서 이 계좌를 본다.
export default function FeeAccountDialog({ open, account, onClose, onSubmit }: Props) {
  return <Dialog open={open} onOpenChange={next => { if (!next) onClose() }}>
    {open && <DialogContent><Form key={account?.version ?? 0} account={account} onClose={onClose} onSubmit={onSubmit} /></DialogContent>}
  </Dialog>
}

function Form({ account, onClose, onSubmit }: Omit<Props, 'open'>) {
  const [bank, setBank] = useState(account?.bank ?? '')
  const [accountNumber, setAccountNumber] = useState(account?.accountNumber ?? '')
  const [holder, setHolder] = useState(account?.holder ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const input = { version: account?.version ?? 0, bank, accountNumber, holder }
  // 버튼은 서버와 같은 스키마로 켠다.
  const valid = SetFeeAccountSchema.safeParse(input).success
  async function save() {
    setBusy(true)
    setMessage('')
    const result = await onSubmit(input)
    setBusy(false)
    if (result.ok) onClose()
    else setMessage(result.message)
  }
  return <>
    <DialogHeader>
      <DialogTitle>받는 계좌</DialogTitle>
      <DialogDescription>참가비를 받을 학생회 계좌예요. 신청한 학생에게 이 계좌를 알려요.</DialogDescription>
    </DialogHeader>
    <div className="flex flex-col gap-3">
      <Label className="flex flex-col gap-1.5">은행<Input value={bank} onChange={event => setBank(event.target.value)} /></Label>
      <Label className="flex flex-col gap-1.5">계좌번호
        <Input value={accountNumber} autoComplete="off" onChange={event => setAccountNumber(event.target.value)} /></Label>
      <Label className="flex flex-col gap-1.5">예금주<Input value={holder} onChange={event => setHolder(event.target.value)} /></Label>
      {message && <StateMessage kind="error">{message}</StateMessage>}
    </div>
    <DialogFooter>
      <Button variant="outline" disabled={busy} onClick={onClose}>닫기</Button>
      <Button disabled={busy || !valid} onClick={() => void save()}>{busy ? '저장하는 중…' : '저장'}</Button>
    </DialogFooter>
  </>
}
