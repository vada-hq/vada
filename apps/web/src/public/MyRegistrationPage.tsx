import { useEffect, useState } from 'react'
import { CalendarDays, CheckCircle2, MapPin } from 'lucide-react'
import type { MyRegistration } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PublicLayout } from './PublicLayout'
import { cancelMine, lookup } from './public-api'
import { eventTimeText, formatKoreanTime, phoneText, registrationFailure, registrationMessage } from './registration-text'
import { forgetToken } from './saved-tokens'

type Loaded = { kind: 'loading' } | { kind: 'missing' } | { kind: 'failed' } | { kind: 'ready'; registration: MyRegistration }
const missingText = '신청 정보를 찾을 수 없어요. 취소했거나 보관 기간이 지났을 수 있어요.'

function EventSummary({ registration }: { registration: MyRegistration }) {
  const time = eventTimeText(registration.event.startsAt, registration.event.endsAt)
  return <section aria-label="행사 정보" className="flex flex-col gap-1.5">
    <p className="text-base font-semibold wrap-anywhere text-gray-900">{registration.event.name}</p>
    {time && <p className="flex items-start gap-1.5 text-sm text-gray-600"><CalendarDays aria-hidden className="mt-0.5 size-4 shrink-0 text-gray-400" />{time}</p>}
    {registration.event.place && <p className="flex items-start gap-1.5 text-sm wrap-anywhere text-gray-600">
      <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-gray-400" />{registration.event.place}</p>}
  </section>
}

// 와이어프레임 EXT-02B: 신청 완료와 내 신청. 개인 링크(/r#토큰)로 연다.
export default function MyRegistrationPage({ token }: { token: string | null }) {
  const [loaded, setLoaded] = useState<Loaded>(token ? { kind: 'loading' } : { kind: 'missing' })
  const [attempt, setAttempt] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!token) return
    let active = true
    void lookup(token).then(result => {
      if (!active) return
      setLoaded(result.ok ? { kind: 'ready', registration: result.registration } : { kind: result.missing ? 'missing' : 'failed' })
    })
    return () => { active = false }
  }, [token, attempt])

  async function copy() {
    setError('')
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
    } catch {
      setError('주소를 복사하지 못했어요. 주소창에서 직접 복사해 주세요.')
    }
  }
  async function cancel() {
    if (!token || busy) return
    setBusy(true)
    setError('')
    const result = await cancelMine(token)
    setBusy(false)
    setConfirming(false)
    if (!result.ok) {
      setError(result.code === null ? registrationFailure : registrationMessage(result.code))
      return
    }
    forgetToken(result.registration.code)
    setLoaded({ kind: 'ready', registration: result.registration })
  }

  if (loaded.kind === 'loading') return <PublicLayout><StateMessage kind="loading">신청 정보를 불러오는 중…</StateMessage></PublicLayout>
  if (loaded.kind === 'missing') return <PublicLayout><StateMessage kind="notice">{missingText}</StateMessage></PublicLayout>
  if (loaded.kind === 'failed') {
    return <PublicLayout>
      <div className="flex flex-col items-start gap-3">
        <StateMessage kind="error">신청 정보를 불러오지 못했어요.</StateMessage>
        <Button variant="outline" onClick={() => { setLoaded({ kind: 'loading' }); setAttempt(value => value + 1) }}>다시 시도</Button>
      </div>
    </PublicLayout>
  }
  const { registration } = loaded
  if (registration.cancelled) {
    return <PublicLayout organizationName={registration.organizationName}>
      <h1 className="text-lg font-semibold text-gray-900">신청을 취소했어요</h1>
      <EventSummary registration={registration} />
      <p className="text-sm text-gray-500">입력한 정보는 지웠어요. 다시 참가하려면 신청 링크에서 새로 신청해 주세요.</p>
    </PublicLayout>
  }
  const rows: [string, string | null][] = [['이름', registration.name], ['학번', registration.studentId],
    ['휴대폰 번호', registration.phone && phoneText(registration.phone)], ['신청 시각', formatKoreanTime(registration.createdAt)]]
  return <PublicLayout organizationName={registration.organizationName}>
    <div className="flex flex-col items-center gap-2 pt-2 text-center">
      <CheckCircle2 aria-hidden className="size-10 text-green-600" />
      <h1 className="text-lg font-semibold text-gray-900">참가 신청이 완료됐어요</h1>
    </div>
    <EventSummary registration={registration} />
    <section aria-label="신청한 내용" className="flex flex-col gap-1.5 rounded-md bg-gray-50 p-3 text-sm">
      {rows.filter((row): row is [string, string] => row[1] !== null).map(([label, value]) => <div key={label} className="flex justify-between gap-3">
        <span className="shrink-0 text-gray-500">{label}</span><span className="text-right wrap-anywhere text-gray-900">{value}</span>
      </div>)}
    </section>
    <section aria-label="주소 저장" className="flex flex-col items-start gap-2">
      <p className="text-sm text-gray-600">이 화면 주소를 저장해 두세요. 신청을 확인하고 취소할 때 필요해요.</p>
      <Button variant="outline" onClick={() => { void copy() }}>주소 복사</Button>
      {copied && <StateMessage kind="notice">주소를 복사했어요.</StateMessage>}
    </section>
    {registration.cancellable ? <div className="flex flex-col items-start gap-2">
      <p className="text-sm text-gray-600">{`${formatKoreanTime(registration.closesAt)}까지 취소할 수 있어요.`}</p>
      <Button variant="outline" onClick={() => setConfirming(true)}>신청 취소</Button>
    </div> : <p className="text-sm text-gray-500">마감 뒤에 취소하려면 학생회에 문의해 주세요.</p>}
    {error && <StateMessage kind="error">{error}</StateMessage>}
    <Dialog open={confirming} onOpenChange={open => { if (!busy) setConfirming(open) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>신청을 취소할까요?</DialogTitle>
          <DialogDescription>취소하면 입력한 정보를 바로 지워요. 다시 참가하려면 처음부터 신청해야 해요.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>돌아가기</Button>
          <Button variant="destructive" disabled={busy} onClick={() => { void cancel() }}>{busy ? '취소하는 중…' : '취소하기'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </PublicLayout>
}
