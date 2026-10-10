import { useState } from 'react'
import type { EventSummary, RegistrationFormView } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { dayText, eventTimeText, formatKoreanTime, stateLabel } from '../public/registration-text'
import EventInfoDialog from './EventInfoDialog'
import RegistrantList from './RegistrantList'
import RegistrationFormDialog from './RegistrationFormDialog'
import { applyUrl, countText, stateTone } from './registration-view'
import type { RegistrationHook } from './useRegistration'

type Props = {
  organizationId: string
  event: EventSummary
  state: RegistrationHook
  onEventChange: (event: EventSummary) => void
  // 남이 행사 정보를 먼저 바꿨으면 행사 목록을 다시 받는다.
  onEventStale?: () => void
}

const periodText = (form: RegistrationFormView) =>
  `${form.opensAt ? `${formatKoreanTime(form.opensAt)} ` : ''}~ ${formatKoreanTime(form.closesAt)}`

// 행사의 참가자 탭: 행사 일시·장소, 참가 신청 설정, 신청자 명단. 부서가 있는 구성원만 본다.
export default function RegistrationPanel({ organizationId, event, state, onEventChange, onEventStale = () => {} }: Props) {
  const [editingEvent, setEditingEvent] = useState(false)
  const [editingForm, setEditingForm] = useState(false)
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)
  if (state.loadError) {
    return <Card className="flex flex-col gap-3 p-6"><StateMessage kind="error">참가 신청을 불러오지 못했어요.</StateMessage>
      <Button variant="outline" className="self-start" onClick={state.refresh}>다시 시도</Button></Card>
  }
  if (!state.data) return <StateMessage kind="loading">참가 신청을 불러오는 중…</StateMessage>
  const { form, registrations } = state.data
  const time = eventTimeText(event.startsAt, event.endsAt)
  async function toggle(current: RegistrationFormView) {
    setMessage('')
    const result = await state.update({ version: current.version, accepting: !current.accepting, opensAt: current.opensAt, closesAt: current.closesAt,
      capacity: current.capacity, notice: current.notice, collectPhone: current.collectPhone })
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
        <Button variant="outline" size="sm" aria-label="행사 정보 수정" onClick={() => setEditingEvent(true)}>수정</Button>
      </div>
      {time ? <p className="text-sm text-gray-700">{time}</p> : <p className="text-sm text-gray-500">일시를 넣어 주세요.</p>}
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
          <div className="flex gap-3"><dt className="w-14 shrink-0 text-gray-500">휴대폰</dt>
            <dd className="text-gray-700">{form.collectPhone ? '휴대폰 번호도 받아요.' : '휴대폰 번호는 받지 않아요.'}</dd></div>
          {form.notice && <div className="flex gap-3"><dt className="w-14 shrink-0 text-gray-500">안내</dt>
            <dd className="min-w-0 whitespace-pre-line wrap-anywhere text-gray-700">{form.notice}</dd></div>}
        </dl>
        <p className="text-xs text-gray-500">행사가 끝나고 30일 뒤({dayText(form.purgeAfter)}) 신청자 정보를 지워요.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditingForm(true)}>설정 바꾸기</Button>
          <Button variant="outline" size="sm" onClick={() => void toggle(form)}>{form.accepting ? '신청 받기 멈추기' : '다시 받기'}</Button>
        </div>
      </> : <>
        <p className="text-sm text-gray-500">아직 참가 신청을 받지 않아요. 신청 링크를 만들면 학생들이 로그인 없이 휴대폰으로 신청해요.</p>
        <Button className="self-start" disabled={!event.startsAt} onClick={() => setEditingForm(true)}>참가 신청 받기</Button>
        {!event.startsAt && <p className="text-xs text-gray-500">행사 일시를 먼저 넣어야 신청을 받을 수 있어요.</p>}
      </>}
      {message && <StateMessage kind="error">{message}</StateMessage>}
    </section>
    {form && <RegistrantList form={form} registrations={registrations} onCancel={state.cancel} />}
    <EventInfoDialog open={editingEvent} organizationId={organizationId} event={event} onClose={() => setEditingEvent(false)}
      onSaved={saved => { setEditingEvent(false); onEventChange(saved) }} onStale={onEventStale} />
    <RegistrationFormDialog open={editingForm} event={event} form={form} phoneCount={registrations.filter(item => item.phone !== null).length}
      onClose={() => setEditingForm(false)}
      onSubmit={input => form ? state.update({ ...input, version: form.version, accepting: form.accepting }) : state.create(input)} />
  </div>
}
