import { useState } from 'react'
import type { RegistrationEntry, RegistrationFormView } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatKoreanTime, phoneText } from '../public/registration-text'
import { countText, findRegistrants } from './registration-view'
import type { RegistrationResult } from './useRegistration'

type Props = { form: RegistrationFormView; registrations: RegistrationEntry[]; onCancel: (registrationId: string) => Promise<RegistrationResult> }

// 와이어프레임 EVT-04의 신청자 명단. 입금·참석 칸은 M3b·M3c에서 더한다. 명단 내려받기는 두지 않는다(파일은 앱이 지울 수 없다).
export default function RegistrantList({ form, registrations, onCancel }: Props) {
  const [query, setQuery] = useState('')
  const [target, setTarget] = useState<RegistrationEntry | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const shown = findRegistrants(registrations, query)
  // 순번은 신청한 순서다. 찾아도 바뀌지 않는다.
  const order = new Map(registrations.map((item, index) => [item.id, index + 1]))
  async function cancel() {
    if (!target || busy) return
    setBusy(true)
    setMessage('')
    const result = await onCancel(target.id)
    setBusy(false)
    setTarget(null)
    if (!result.ok) setMessage(result.message)
  }
  return <section aria-label="신청자" className={cn(cardClass, 'flex flex-col gap-3 p-4')}>
    <h3 className="text-sm font-semibold text-gray-900">신청자 <span className="font-normal text-gray-500">{countText(form.count, form.capacity)}</span></h3>
    {form.purged ? <StateMessage kind="notice">보관 기간이 지나 신청자 정보를 지웠어요(신청 {form.count}명).</StateMessage>
      : registrations.length === 0 ? <StateMessage kind="empty">아직 신청한 사람이 없어요.</StateMessage>
      : <>
        <Input aria-label="이름이나 학번으로 찾기" placeholder="이름이나 학번으로 찾기" value={query} onChange={item => setQuery(item.target.value)} />
        <ol className="flex flex-col divide-y">
          {shown.map(item => <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
            <span className="w-8 shrink-0 text-xs text-gray-400">{order.get(item.id)}</span>
            <span className="font-medium wrap-anywhere text-gray-900">{item.name}</span>
            <span className="text-gray-600">{item.studentId}</span>
            {item.phone && <span className="text-gray-600">{phoneText(item.phone)}</span>}
            <span className="text-xs text-gray-400 sm:ml-auto">{formatKoreanTime(item.createdAt)}</span>
            <Button variant="ghost" size="sm" aria-label={`${item.name} 신청 취소`} onClick={() => setTarget(item)}>취소</Button>
          </li>)}
        </ol>
        {shown.length === 0 && <StateMessage kind="empty">찾는 신청자가 없어요.</StateMessage>}
      </>}
    {message && <StateMessage kind="error">{message}</StateMessage>}
    <Dialog open={target !== null} onOpenChange={open => { if (!open && !busy) setTarget(null) }}>
      {target && <DialogContent>
        <DialogHeader>
          <DialogTitle>신청을 취소할까요?</DialogTitle>
          <DialogDescription>{target.name}({target.studentId})의 신청을 취소하면 이 사람의 정보를 바로 지워요.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => setTarget(null)}>돌아가기</Button>
          <Button variant="destructive" disabled={busy} onClick={() => void cancel()}>{busy ? '취소하는 중…' : '취소하기'}</Button>
        </DialogFooter>
      </DialogContent>}
    </Dialog>
  </section>
}
