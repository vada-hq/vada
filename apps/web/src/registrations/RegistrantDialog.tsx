import { useState } from 'react'
import type { RegistrationEntry, RegistrationFormView } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { depositorName, formatKoreanTime, won } from '../public/registration-text'
import { hasFees } from './registration-view'
import type { RegistrationResult } from './useRegistration'

export type RegistrantActions = {
  onCancel: (registrationId: string) => Promise<RegistrationResult>
  onConfirmPayment: (registrationId: string) => Promise<RegistrationResult>
  onCancelPayment: (registrationId: string) => Promise<RegistrationResult>
  onSetDuesMember: (registrationId: string, duesMember: boolean) => Promise<RegistrationResult>
}
type Props = RegistrantActions & {
  form: RegistrationFormView
  // 지금 보는 신청. 목록이 새로 오면 같은 ID의 새 값을 넘긴다. 신청이 사라지면 null이다.
  entry: RegistrationEntry | null
  onClose: () => void
}

// 신청자 한 명의 관리: 입금 확인·확인 취소, 참가비 바꾸기(학생 문의 때), 신청 취소. 취소는 같은 자리에서 한 번 더 묻는다.
export default function RegistrantDialog({ entry, onClose, ...props }: Props) {
  return <Dialog open={entry !== null} onOpenChange={open => { if (!open) onClose() }}>
    {entry && <DialogContent><Body key={entry.id} entry={entry} onClose={onClose} {...props} /></DialogContent>}
  </Dialog>
}

function Body({ form, entry, onClose, onCancel, onConfirmPayment, onCancelPayment, onSetDuesMember }: Omit<Props, 'entry'> & { entry: RegistrationEntry }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const fees = hasFees(form)
  async function run(action: () => Promise<RegistrationResult>, closeAfter = false) {
    setBusy(true)
    setMessage('')
    const result = await action()
    setBusy(false)
    if (!result.ok) setMessage(result.message)
    else if (closeAfter) onClose()
  }
  if (confirming) {
    return <>
      <DialogHeader>
        <DialogTitle>신청을 취소할까요?</DialogTitle>
        <DialogDescription>{entry.name}({entry.studentId})의 신청을 취소하면 이 사람의 정보를 바로 지워요.
          {entry.paid && ` 받은 참가비 ${won(entry.paid.amount)}은 그대로 남아요. 돌려줬다면 먼저 입금 확인을 취소해 주세요.`}</DialogDescription>
      </DialogHeader>
      {message && <StateMessage kind="error">{message}</StateMessage>}
      <DialogFooter>
        <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>돌아가기</Button>
        <Button variant="destructive" disabled={busy} onClick={() => void run(() => onCancel(entry.id), true)}>{busy ? '취소하는 중…' : '취소하기'}</Button>
      </DialogFooter>
    </>
  }
  return <>
    <DialogHeader>
      <DialogTitle className="wrap-anywhere">{entry.name}</DialogTitle>
      <DialogDescription>학번 {entry.studentId}</DialogDescription>
    </DialogHeader>
    {fees && <dl className="flex flex-col gap-3 text-sm">
      <div className="flex flex-col gap-1">
        <dt className="text-xs text-gray-500">입금자명</dt>
        <dd className="wrap-anywhere text-gray-900">{depositorName(entry.name, entry.studentId)}</dd>
      </div>
      <div className="flex flex-col gap-1.5">
        <dt className="text-xs text-gray-500">참가비</dt>
        <dd className="flex flex-wrap items-center gap-2 text-gray-900">
          {won(entry.fee)}
          {entry.duesMember && <Badge tone="info">학생회비 납부</Badge>}
        </dd>
        {form.memberFee !== null && entry.duesMember !== null && <dd>
          <Button variant="outline" size="sm" disabled={busy || entry.paid !== null}
            onClick={() => void run(() => onSetDuesMember(entry.id, !entry.duesMember))}>
            {entry.duesMember ? '미납자 참가비로 바꾸기' : '납부자 참가비로 바꾸기'}</Button>
        </dd>}
      </div>
      {/* 낼 참가비가 없으면 입금 칸을 두지 않는다. */}
      {(entry.paid || entry.fee > 0) && <div className="flex flex-col gap-1.5">
        <dt className="text-xs text-gray-500">입금</dt>
        {entry.paid ? <>
          <dd className="text-gray-900">입금 확인 · {formatKoreanTime(entry.paid.at)} · {entry.paid.by.name}</dd>
          <dd><Button variant="outline" size="sm" disabled={busy} onClick={() => void run(() => onCancelPayment(entry.id))}>입금 확인 취소</Button></dd>
        </> : <>
          <dd className="text-gray-900">입금 전</dd>
          <dd><Button size="sm" disabled={busy} onClick={() => void run(() => onConfirmPayment(entry.id))}>입금 확인</Button></dd>
        </>}
      </div>}
    </dl>}
    {message && <StateMessage kind="error">{message}</StateMessage>}
    <DialogFooter>
      <Button variant="outline" disabled={busy} onClick={onClose}>닫기</Button>
      <Button variant="destructive" disabled={busy} onClick={() => { setMessage(''); setConfirming(true) }}>신청 취소</Button>
    </DialogFooter>
  </>
}
