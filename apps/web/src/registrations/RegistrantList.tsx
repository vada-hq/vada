import { useState } from 'react'
import type { RegistrationEntry, RegistrationFormView } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatKoreanTime, phoneText } from '../public/registration-text'
import { pressed } from '../purchases/purchase-view'
import RegistrantDialog, { type RegistrantActions } from './RegistrantDialog'
import { countText, filterRegistrants, findRegistrants, hasFees, paymentChip, type RegistrantFilter } from './registration-view'

// settled: 행사 정산이 끝났으면 입금 확인 버튼을 감추고 이유를 적는다.
type Props = RegistrantActions & { form: RegistrationFormView; registrations: RegistrationEntry[]; settled: boolean }
type FilterOption = { value: RegistrantFilter; label: string }
const paymentFilters: FilterOption[] = [{ value: 'unpaid', label: '입금 전' }, { value: 'paid', label: '입금 확인' }]
const attendanceFilters: FilterOption[] = [{ value: 'checkedIn', label: '참석' }, { value: 'notCheckedIn', label: '참석 전' }]

// 와이어프레임 EVT-04의 신청자 명단. 참가비가 있으면 입금 상태 칩과 거르기를 두고, 줄에서 바로 입금을 확인한다.
// 참석은 칩과 거르기를 늘 두고, 참석 전인 줄에서 바로 확인한다(QR을 못 꺼내는 사람을 이름으로 찾아 확인).
// 나머지 일(확인 취소·참가비 바꾸기·신청 취소)은 관리 대화상자에서 한다.
// 명단 내려받기는 두지 않는다(파일은 앱이 지울 수 없다).
export default function RegistrantList({ form, registrations, settled, onConfirmPayment, onCheckIn, ...actions }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<RegistrantFilter>('all')
  const [managing, setManaging] = useState<string | null>(null)
  // 줄에서 누른 입금 확인·참석 확인. 응답이 올 때까지 줄 버튼을 끈다.
  const [pending, setPending] = useState<{ id: string; action: 'payment' | 'checkIn' } | null>(null)
  const [message, setMessage] = useState('')
  const fees = hasFees(form)
  const filters: FilterOption[] = [{ value: 'all', label: '전체' }, ...fees ? paymentFilters : [], ...attendanceFilters]
  // 참가비를 없앤 뒤 남은 입금 거르기는 전체로 본다.
  const active = filters.some(item => item.value === filter) ? filter : 'all'
  const shown = findRegistrants(filterRegistrants(registrations, active), query)
  // 순번은 신청한 순서다. 찾거나 걸러도 바뀌지 않는다.
  const order = new Map(registrations.map((item, index) => [item.id, index + 1]))
  // 관리 중인 신청은 새로 받은 목록에서 같은 ID로 찾는다. 취소해서 사라지면 대화상자를 닫는다.
  const managed = managing === null ? null : registrations.find(item => item.id === managing) ?? null
  async function run(item: RegistrationEntry, action: 'payment' | 'checkIn') {
    if (pending) return
    setPending({ id: item.id, action })
    setMessage('')
    const result = await (action === 'payment' ? onConfirmPayment : onCheckIn)(item.id)
    setPending(null)
    if (!result.ok) setMessage(result.message)
  }
  return <section aria-label="신청자" className={cn(cardClass, 'flex flex-col gap-3 p-4')}>
    <h3 className="text-sm font-semibold text-gray-900">신청자 <span className="font-normal text-gray-500">{countText(form.count, form.capacity)}</span></h3>
    {form.purged ? <StateMessage kind="notice">보관 기간이 지나 신청자 정보를 지웠어요(신청 {form.count}명 · 참석 {form.checkedIn}명).</StateMessage>
      : registrations.length === 0 ? <StateMessage kind="empty">아직 신청한 사람이 없어요.</StateMessage>
      : <>
        <div className="flex flex-wrap gap-2" aria-label="명단 거르기">
          {filters.map(item => <Button key={item.value} variant="outline" size="sm" className={pressed} aria-pressed={active === item.value}
            onClick={() => setFilter(item.value)}>{`${item.label} ${filterRegistrants(registrations, item.value).length}`}</Button>)}
        </div>
        {fees && settled && <StateMessage kind="notice">정산이 끝난 행사라 입금과 참가비를 바꿀 수 없어요.</StateMessage>}
        <Input aria-label="이름이나 학번으로 찾기" placeholder="이름이나 학번으로 찾기" value={query} onChange={item => setQuery(item.target.value)} />
        <ol className="flex flex-col divide-y">
          {shown.map(item => {
            const chip = paymentChip(item)
            return <li key={item.id} className="flex flex-col gap-1.5 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="w-8 shrink-0 text-xs text-gray-400">{order.get(item.id)}</span>
                <span className="font-medium wrap-anywhere text-gray-900">{item.name}</span>
                <span className="text-gray-600">{item.studentId}</span>
                {item.phone && <span className="text-gray-600">{phoneText(item.phone)}</span>}
                <span className="text-xs text-gray-400 sm:ml-auto">{formatKoreanTime(item.createdAt)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-11">
                {fees && <Badge tone={chip.tone}>{chip.text}</Badge>}
                {fees && item.duesMember && <Badge tone="info">학생회비 납부</Badge>}
                {item.checkedIn && <Badge tone="success">참석</Badge>}
                <div className="ml-auto flex gap-1">
                  {item.checkedIn === null && <Button variant="outline" size="sm" aria-label={`${item.name} 참석 확인`} disabled={pending !== null}
                    onClick={() => void run(item, 'checkIn')}>{pending?.id === item.id && pending.action === 'checkIn' ? '확인하는 중…' : '참석'}</Button>}
                  {fees && !settled && item.paid === null && item.fee > 0 && <Button size="sm" aria-label={`${item.name} 입금 확인`}
                    disabled={pending !== null} onClick={() => void run(item, 'payment')}>
                    {pending?.id === item.id && pending.action === 'payment' ? '확인하는 중…' : '입금 확인'}</Button>}
                  <Button variant="ghost" size="sm" aria-label={`${item.name} 관리`} onClick={() => setManaging(item.id)}>관리</Button>
                </div>
              </div>
            </li>
          })}
        </ol>
        {shown.length === 0 && <StateMessage kind="empty">찾는 신청자가 없어요.</StateMessage>}
      </>}
    {message && <StateMessage kind="error">{message}</StateMessage>}
    <RegistrantDialog form={form} entry={managed} settled={settled} onClose={() => setManaging(null)} onConfirmPayment={onConfirmPayment}
      onCheckIn={onCheckIn} {...actions} />
  </section>
}
