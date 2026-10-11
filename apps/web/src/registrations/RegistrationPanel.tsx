import { useState } from 'react'
import type { EventSummary, RegistrationFormView } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { dayText, eventTimeText, formatKoreanTime, stateLabel, won } from '../public/registration-text'
import EventInfoDialog from './EventInfoDialog'
import RegistrantList from './RegistrantList'
import RegistrationFormDialog from './RegistrationFormDialog'
import { applyUrl, countText, feeText, stateTone } from './registration-view'
import type { RegistrationHook } from './useRegistration'

type Props = {
  organizationId: string
  event: EventSummary
  state: RegistrationHook
  onEventChange: (event: EventSummary) => void
  // 남이 행사 정보를 먼저 바꿨으면 행사 목록을 다시 받는다.
  onEventStale?: () => void
  // 완료한 행사(M5a)는 볼 수만 있다. 행사 정보·신청 설정·신청자 단추가 없다.
  readOnly?: boolean
}

const periodText = (form: RegistrationFormView) =>
  `${form.opensAt ? `${formatKoreanTime(form.opensAt)} ` : ''}~ ${formatKoreanTime(form.closesAt)}`

// 행사의 참가자 탭: 행사 일시·장소, 참가 신청 설정, 신청자 명단. 부서가 있는 구성원만 본다.
export default function RegistrationPanel({ organizationId, event, state, onEventChange, onEventStale = () => {}, readOnly = false }: Props) {
  const [editingEvent, setEditingEvent] = useState(false)
  const [editingForm, setEditingForm] = useState(false)
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)
  // 멈추기·다시 받기를 누르는 동안 버튼을 끈다.
  const [toggling, setToggling] = useState(false)
  if (state.loadError) {
    return <Card className="flex flex-col gap-3 p-6"><StateMessage kind="error">참가 신청을 불러오지 못했어요.</StateMessage>
      <Button variant="outline" className="self-start" onClick={state.refresh}>다시 시도</Button></Card>
  }
  if (!state.data) return <StateMessage kind="loading">참가 신청을 불러오는 중…</StateMessage>
  // 정산한 행사면 입금·참가비 버튼을 감추고 금액 칸을 끈다(서버도 막는다).
  const { form, registrations, account, roster, settled } = state.data
  const time = eventTimeText(event.startsAt, event.endsAt)
  async function toggle(current: RegistrationFormView) {
    if (toggling) return
    setToggling(true)
    setMessage('')
    const result = await state.update({ version: current.version, accepting: !current.accepting, opensAt: current.opensAt, closesAt: current.closesAt,
      capacity: current.capacity, notice: current.notice, collectPhone: current.collectPhone, fee: current.fee, memberFee: current.memberFee })
    setToggling(false)
    if (!result.ok) setMessage(result.message)
  }
  async function copy(code: string) {
    setMessage('')
    try {
      await navigator.clipboard.writeText(applyUrl(code))
      setCopied(true)
    } catch {
      setMessage('링크를 복사하지 못했어요. 링크를 직접 골라 복사해 주세요.')
    }
  }
  return <div className="flex flex-col gap-4">
    <section aria-label="행사 정보" className={cn(cardClass, 'flex flex-col gap-2 p-4')}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">행사 정보</h3>
        {!readOnly && <Button variant="outline" size="sm" aria-label="행사 정보 수정" onClick={() => setEditingEvent(true)}>수정</Button>}
      </div>
      {time ? <p className="text-sm text-gray-700">{time}</p> : <p className="text-sm text-gray-500">{readOnly ? '일시 미정' : '일시를 넣어 주세요.'}</p>}
      {event.place && <p className="text-sm wrap-anywhere text-gray-700">{event.place}</p>}
    </section>
    <section aria-label="참가 신청" className={cn(cardClass, 'flex flex-col gap-3 p-4')}>
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-900">참가 신청</h3>
        {form && <Badge tone={stateTone(form.state)}>{stateLabel(form.state)}</Badge>}
      </div>
      {form ? <>
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-sm wrap-anywhere text-gray-700">{applyUrl(form.code)}</p>
          <Button variant="outline" size="sm" onClick={() => void copy(form.code)}>링크 복사</Button>
        </div>
        {copied && <StateMessage kind="notice">링크를 복사했어요.</StateMessage>}
        <dl className="flex flex-col gap-1.5 text-sm">
          <div className="flex gap-3"><dt className="w-14 shrink-0 text-gray-500">기간</dt><dd className="text-gray-700">{periodText(form)}</dd></div>
          <div className="flex gap-3"><dt className="w-14 shrink-0 text-gray-500">신청</dt><dd className="text-gray-700">{countText(form.count, form.capacity)}</dd></div>
          <div className="flex gap-3"><dt className="w-14 shrink-0 text-gray-500">참석</dt><dd className="text-gray-700">{form.checkedIn}명</dd></div>
          <div className="flex gap-3"><dt className="w-14 shrink-0 text-gray-500">휴대폰</dt>
            <dd className="text-gray-700">{form.collectPhone ? '휴대폰 번호도 받아요.' : '휴대폰 번호는 받지 않아요.'}</dd></div>
          {form.notice && <div className="flex gap-3"><dt className="w-14 shrink-0 text-gray-500">안내</dt>
            <dd className="min-w-0 whitespace-pre-line wrap-anywhere text-gray-700">{form.notice}</dd></div>}
          <div className="flex gap-3"><dt className="w-14 shrink-0 text-gray-500">참가비</dt><dd className="text-gray-700">{feeText(form)}</dd></div>
          {form.fee > 0 && account && <div className="flex gap-3"><dt className="w-14 shrink-0 text-gray-500">계좌</dt>
            <dd className="min-w-0 wrap-anywhere text-gray-700">{account.bank} {account.accountNumber} ({account.holder})</dd></div>}
        </dl>
        {form.payments.count > 0 && <p className="text-sm text-gray-700">받은 참가비 {won(form.payments.total)} · {form.payments.count}명</p>}
        {form.memberFee !== null && roster === null && <Alert tone="warning">
          학생회비 명단이 없어 지금 신청하는 사람은 모두 미납자 참가비가 돼요. 재정 담당자에게 명단을 올려 달라고 해 주세요.</Alert>}
        <p className="text-xs text-gray-500">행사가 끝나고 30일 뒤({dayText(form.purgeAfter)}) 신청자 정보를 지워요.</p>
        {!readOnly && <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditingForm(true)}>설정 바꾸기</Button>
          <Button variant="outline" size="sm" disabled={toggling} onClick={() => void toggle(form)}>{form.accepting ? '신청 받기 멈추기' : '다시 받기'}</Button>
        </div>}
      </> : <>
        {readOnly ? <p className="text-sm text-gray-500">참가 신청을 받지 않은 행사예요.</p> : <>
          <p className="text-sm text-gray-500">아직 참가 신청을 받지 않아요. 신청 링크를 만들면 학생들이 로그인 없이 휴대폰으로 신청해요.</p>
          <Button className="self-start" disabled={!event.startsAt} onClick={() => setEditingForm(true)}>참가 신청 받기</Button>
          {!event.startsAt && <p className="text-xs text-gray-500">행사 일시를 먼저 넣어야 신청을 받을 수 있어요.</p>}
        </>}
      </>}
      {message && <StateMessage kind="error">{message}</StateMessage>}
    </section>
    {form && <RegistrantList form={form} registrations={registrations} settled={settled} readOnly={readOnly} onCancel={state.cancel} onConfirmPayment={state.confirmPayment}
      onCancelPayment={state.cancelPayment} onSetDuesMember={state.setDuesMember} onCheckIn={state.checkIn} onCancelCheckIn={state.cancelCheckIn}
      onScan={state.scan} />}
    <EventInfoDialog open={editingEvent} organizationId={organizationId} event={event} onClose={() => setEditingEvent(false)}
      // 행사 끝이 바뀌면 참가 신청의 지울 날과 상태도 바뀌므로 다시 불러온다.
      onSaved={saved => { setEditingEvent(false); onEventChange(saved); if (form) state.refresh() }} onStale={onEventStale} />
    <RegistrationFormDialog open={editingForm} event={event} form={form} phoneCount={registrations.filter(item => item.phone !== null).length}
      account={account} roster={roster} settled={settled}
      onClose={() => setEditingForm(false)}
      onSubmit={input => form ? state.update({ ...input, version: form.version, accepting: form.accepting }) : state.create(input)} />
  </div>
}
