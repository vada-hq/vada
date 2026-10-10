import { useEffect, useState, type FormEvent } from 'react'
import { AlertCircle, CalendarDays, MapPin } from 'lucide-react'
import { dateFromKorean, RegisterSchema, type PublicRegistrationForm, type RegistrationState } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { PublicLayout } from './PublicLayout'
import { fetchPublicForm, register } from './public-api'
import { minePath } from './public-route'
import { eventTimeText, privacyNotice, registrationFailure, registrationMessage, stateText } from './registration-text'
import { savedToken, saveToken } from './saved-tokens'

// 시작 전이면 시작 시각에 다시 불러온다. 기기 시계가 서버보다 빨라 아직 시작 전이라는 답이 오면 잠시 뒤 다시 본다.
function reopenDelay(opensAt: string) {
  const wait = dateFromKorean(opensAt).getTime() - Date.now()
  return wait > 0 ? Math.min(wait + 500, 2_147_483_647) : 5_000
}
// 와이어프레임 EXT-02C: 정원 참은 주황, 멈춤은 빨강, 시작 전·마감은 회색
const toneOf: Partial<Record<RegistrationState, string>> = { full: 'text-orange-600', paused: 'text-red-600' }

// 와이어프레임 EXT-02A: 로그인 없이 휴대폰으로 참가 신청을 한다.
export default function ApplyPage({ code, onRegistered = token => window.location.assign(minePath(token)) }: {
  code: string; onRegistered?: (token: string) => void }) {
  const [loaded, setLoaded] = useState<PublicRegistrationForm | 'missing' | 'failed' | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [name, setName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [phone, setPhone] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved] = useState(() => savedToken(code))
  useEffect(() => {
    const controller = new AbortController()
    void fetchPublicForm(code, controller.signal).then(result => { if (!controller.signal.aborted) setLoaded(result) })
    return () => controller.abort()
  }, [code, attempt])
  const form = typeof loaded === 'object' ? loaded : null
  useEffect(() => {
    if (form?.state !== 'upcoming' || !form.opensAt) return
    const timer = setTimeout(() => setAttempt(value => value + 1), reopenDelay(form.opensAt))
    return () => clearTimeout(timer)
  }, [form])

  if (loaded === null) return <PublicLayout><StateMessage kind="loading">신청 정보를 불러오는 중…</StateMessage></PublicLayout>
  if (loaded === 'missing') {
    return <PublicLayout><StateMessage kind="error">신청 링크를 찾을 수 없어요. 주소를 다시 확인해 주세요.</StateMessage></PublicLayout>
  }
  if (loaded === 'failed' || !form) {
    return <PublicLayout>
      <div className="flex flex-col items-start gap-3">
        <StateMessage kind="error">신청 정보를 불러오지 못했어요.</StateMessage>
        <Button variant="outline" onClick={() => { setLoaded(null); setAttempt(value => value + 1) }}>다시 시도</Button>
      </div>
    </PublicLayout>
  }
  const input = { name, studentId, phone: form.collectPhone ? phone : null, agreed }
  const valid = RegisterSchema.safeParse(input).success
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form || !valid || busy) return
    setBusy(true)
    setError('')
    const result = await register(code, { ...input, agreed: true })
    if (result.ok) {
      saveToken(code, result.token)
      onRegistered(result.token)
      return
    }
    setBusy(false)
    setError(result.code === null ? registrationFailure : registrationMessage(result.code))
    // 정원이 찼거나, 받지 않게 됐거나, 운영진이 설정을 바꿨으면 바뀐 내용을 다시 받아 화면을 맞춘다.
    if (result.code === 'REGISTRATION_FULL' || result.code === 'REGISTRATION_NOT_OPEN' || result.code === 'FORM_CHANGED') setAttempt(value => value + 1)
  }
  const time = eventTimeText(form.event.startsAt, form.event.endsAt)
  const notice = stateText(form.state, form.opensAt)
  return <PublicLayout organizationName={form.organizationName}>
    <section className="flex flex-col gap-2" aria-label="행사 정보">
      <h1 className="text-lg font-semibold wrap-anywhere text-gray-900">{form.event.name}</h1>
      {time && <p className="flex items-start gap-1.5 text-sm text-gray-600"><CalendarDays aria-hidden className="mt-0.5 size-4 shrink-0 text-gray-400" />{time}</p>}
      {form.event.place && <p className="flex items-start gap-1.5 text-sm wrap-anywhere text-gray-600">
        <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-gray-400" />{form.event.place}</p>}
      {form.state === 'open' && form.remaining !== null && <Badge tone="info" className="self-start">남은 자리 {form.remaining}</Badge>}
      {form.notice && <p className="text-sm whitespace-pre-line wrap-anywhere text-gray-600">{form.notice}</p>}
    </section>
    {saved && <Alert tone="info" className="flex flex-wrap items-center gap-x-2 text-sm">
      이 기기에서 이미 신청했어요.<a href={minePath(saved)} className="font-medium underline underline-offset-2">내 신청 보기</a>
    </Alert>}
    {notice ? <Card role="status" className="flex flex-col items-center gap-1 p-5 text-center">
      <AlertCircle aria-hidden className={cn('size-6 text-gray-500', toneOf[form.state])} />
      <h2 className={cn('text-sm font-semibold text-gray-900', toneOf[form.state])}>{notice.title}</h2>
      <p className="text-xs text-gray-500">{notice.description}</p>
    </Card> : <form className="flex flex-col gap-4 border-t pt-5" noValidate onSubmit={event => { void submit(event) }}>
      <p className="text-xs text-gray-500">아래 정보를 넣고 참가 신청을 마쳐 주세요.</p>
      <Label className="flex flex-col gap-1.5">이름
        <Input value={name} autoComplete="name" onChange={event => setName(event.target.value)} /></Label>
      <Label className="flex flex-col gap-1.5">학번
        <Input value={studentId} inputMode="numeric" autoComplete="off" onChange={event => setStudentId(event.target.value)} /></Label>
      {form.collectPhone && <Label className="flex flex-col gap-1.5">휴대폰 번호
        <Input type="tel" value={phone} inputMode="tel" autoComplete="tel" onChange={event => setPhone(event.target.value)} /></Label>}
      <section aria-label="개인정보 수집·이용 안내" className="flex flex-col gap-1 rounded-md bg-gray-50 p-3 text-xs text-gray-600">
        <h2 className="font-medium text-gray-700">개인정보 수집·이용 안내</h2>
        <ul className="flex flex-col gap-0.5">
          {privacyNotice({ organizationName: form.organizationName, eventName: form.event.name, collectPhone: form.collectPhone, purgeAfter: form.purgeAfter })
            .map(line => <li key={line} className="wrap-anywhere">{line}</li>)}
        </ul>
      </section>
      <Label className="flex items-center gap-2 text-sm font-normal">
        <input type="checkbox" className="size-4 accent-blue-600" checked={agreed} onChange={event => setAgreed(event.target.checked)} />
        개인정보 수집·이용에 동의해요(필수)
      </Label>
      <Button type="submit" className="w-full" disabled={!valid || busy}>{busy ? '신청하는 중…' : '신청하기'}</Button>
      {error && <StateMessage kind="error">{error}</StateMessage>}
    </form>}
  </PublicLayout>
}
