import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Info, RotateCcw, XCircle, type LucideIcon } from 'lucide-react'
import { checkInCodeOf, type RegistrationEntry, type RegistrationFormView } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatKoreanTime, registrationFailure } from '../public/registration-text'
import { CameraError, openCamera, stopCamera, type CameraProblem } from './camera'
import { loadQrReader, type QrReader } from './qr-reader'
import { hasFees, paymentChip } from './registration-view'
import type { RegistrationResult, ScanResult } from './useRegistration'

// 판독 간격(ms). 결과를 보이는 동안과 요청 중에는 읽지 않는다.
export const scanInterval = 200
// 참가 신청 QR이 아닌 것을 읽었을 때 안내를 보이는 시간(ms). 마지막으로 읽은 때부터 센다.
const hintDuration = 2000

type Props = {
  open: boolean
  form: RegistrationFormView
  // 받은 명단. 결과 카드는 찍은 신청을 여기서 찾아 최신 입금·참석 상태를 보인다.
  registrations: RegistrationEntry[]
  // 정산한 행사면 결과 카드에 입금 확인을 두지 않는다(서버도 막는다).
  settled: boolean
  onScan: (code: string) => Promise<ScanResult>
  onCancelCheckIn: (registrationId: string) => Promise<RegistrationResult>
  onConfirmPayment: (registrationId: string) => Promise<RegistrationResult>
  onClose: () => void
}
type Camera = 'starting' | 'loading' | 'ready' | CameraProblem | 'reader'
type Outcome = { kind: 'checked' | 'already' | 'undone'; registrationId: string } | { kind: 'missing' }
  | { kind: 'failed'; offline: boolean; message: string }

const statusText: Partial<Record<Camera, string>> = { starting: '카메라를 켜는 중…', loading: 'QR 판독기를 불러오는 중…', ready: '참가자의 QR을 네모 안에 맞춰 주세요.' }
const problemText: Record<CameraProblem | 'reader', string> = {
  denied: '카메라를 쓸 수 없어요. 브라우저 설정에서 이 사이트의 카메라 사용을 허용해 주세요.',
  unsupported: '이 브라우저에서는 카메라를 쓸 수 없어요.',
  failed: '카메라를 켜지 못했어요.',
  // 앱을 연 뒤 새로 배포했으면 옛 판독기 파일이 없어 다시 시도해도 안 된다. 새로 고치면 새 파일을 받는다.
  reader: 'QR 판독기를 불러오지 못했어요. 페이지를 새로 고친 뒤 다시 열어 주세요.',
}

// 와이어프레임 EVT-04B의 공용 QR 대신 신청자마다의 QR을 운영진이 휴대폰 카메라로 찍는다(대리 참석 막기, spec M3c).
// 찍히면 바로 참석으로 남기고, 결과를 보이는 동안에는 읽지 않는다. [다음]을 누르면 다시 읽는다.
export default function CheckInScanner({ open, onClose, ...props }: Props) {
  return <Dialog open={open} onOpenChange={next => { if (!next) onClose() }}>
    {open && <DialogContent><Scanner onClose={onClose} {...props} /></DialogContent>}
  </Dialog>
}

function Scanner({ form, registrations, settled, onScan, onCancelCheckIn, onConfirmPayment, onClose }: Omit<Props, 'open'>) {
  const video = useRef<HTMLVideoElement>(null)
  // 결과를 보이는 동안과 요청 중에는 판독을 멈춘다. [다음]을 눌러야 다시 읽는다.
  const paused = useRef(false)
  // 대화상자가 열려 있는 동안 true다. 화면이 숨어 카메라를 끈 사이에 온 스캔 결과도 그리고, 닫은 뒤에 온 결과는 그리지 않는다.
  const alive = useRef(true)
  const scan = useRef(onScan)
  const [camera, setCamera] = useState<Camera>('starting')
  const [attempt, setAttempt] = useState(0)
  const [hidden, setHidden] = useState(() => document.visibilityState === 'hidden')
  const [checking, setChecking] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [hint, setHint] = useState(false)
  useEffect(() => { scan.current = onScan })
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])
  // 화면이 숨으면 카메라를 끄고, 다시 보이면 켠다.
  useEffect(() => {
    const update = () => setHidden(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  useEffect(() => {
    if (hidden) return
    const element = video.current
    let stopped = false
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let hintTimer: ReturnType<typeof setTimeout> | undefined
    setCamera('starting')
    async function handle(text: string) {
      const code = checkInCodeOf(text)
      if (code === null) {
        setHint(true)
        clearTimeout(hintTimer)
        hintTimer = setTimeout(() => setHint(false), hintDuration)
        return
      }
      paused.current = true
      setHint(false)
      setChecking(true)
      const result = await scan.current(code)
      if (!alive.current) return
      setChecking(false)
      setOutcome(result.ok ? { kind: result.already ? 'already' : 'checked', registrationId: result.registrationId }
        : result.missing ? { kind: 'missing' } : { kind: 'failed', offline: result.message === registrationFailure, message: result.message })
    }
    async function tick(reader: QrReader) {
      if (stopped || !element) return
      if (!paused.current) {
        const text = await reader.read(element).catch(() => null)
        if (stopped) return
        if (text !== null) await handle(text)
        if (stopped) return
      }
      timer = setTimeout(() => { void tick(reader) }, scanInterval)
    }
    void (async () => {
      try {
        stream = await openCamera()
      } catch (error) {
        if (!stopped) setCamera(error instanceof CameraError ? error.problem : 'failed')
        return
      }
      if (stopped) {
        stopCamera(stream)
        return
      }
      if (element) {
        element.srcObject = stream
        // 자동 재생이 막혀도 판독은 프레임으로 한다. iOS는 playsInline·muted가 있어야 화면 안에서 재생한다.
        try { await element.play() } catch { /* 위와 같다 */ }
      }
      if (stopped) return
      setCamera('loading')
      let reader: QrReader
      try {
        reader = await loadQrReader()
      } catch {
        // 읽을 수 없으면 카메라도 끈다.
        stopCamera(stream)
        if (element) element.srcObject = null
        if (!stopped) setCamera('reader')
        return
      }
      if (stopped) return
      setCamera('ready')
      void tick(reader)
    })()
    // 요청 중이면 확인 중 표시와 판독 멈춤을 그대로 둔다. 응답이 오면 결과를 그리고, [다음]이 다시 읽게 한다.
    return () => {
      stopped = true
      clearTimeout(timer)
      clearTimeout(hintTimer)
      setHint(false)
      if (stream) stopCamera(stream)
      if (element) element.srcObject = null
    }
  }, [hidden, attempt])

  const problem = camera === 'denied' || camera === 'unsupported' || camera === 'failed' || camera === 'reader' ? camera : null
  function next() {
    setOutcome(null)
    paused.current = false
  }
  return <>
    <DialogHeader>
      <DialogTitle>QR로 참석 확인</DialogTitle>
      <DialogDescription>{problem ? 'QR을 찍을 수 없으면 명단에서 이름으로 찾아 [참석]을 눌러 주세요.' : checking ? '확인하는 중…' : statusText[camera]}</DialogDescription>
    </DialogHeader>
    <div className={cn('relative aspect-square w-full overflow-hidden rounded-md bg-gray-900', problem && 'hidden')}>
      <video ref={video} playsInline muted autoPlay aria-label="카메라 화면" className="size-full object-cover" />
      <div aria-hidden className="absolute inset-1/5 rounded-md border-2 border-white/80" />
      {/* 결과는 카메라 화면 위에 겹친다. 판독을 멈춘 동안이라 가려도 되고, 작은 휴대폰에서도 [다음]이 화면 아래로 밀리지 않는다. */}
      {outcome && <div className="absolute inset-3 flex flex-col justify-end">
        <Result key={'registrationId' in outcome ? `${outcome.kind}-${outcome.registrationId}` : outcome.kind} outcome={outcome}
          entry={'registrationId' in outcome ? registrations.find(item => item.id === outcome.registrationId) ?? null : null} form={form}
          settled={settled} onConfirmPayment={onConfirmPayment} onUndo={async id => {
            const result = await onCancelCheckIn(id)
            if (result.ok) setOutcome({ kind: 'undone', registrationId: id })
            return result
          }} onNext={next} />
      </div>}
    </div>
    {problem && <div className="flex flex-col items-start gap-2">
      <Alert tone="warning">{problemText[problem]}</Alert>
      <Button variant="outline" size="sm" onClick={() => setAttempt(value => value + 1)}>다시 시도</Button>
    </div>}
    {hint && <p className="text-sm text-yellow-700">참가 신청 QR이 아니에요.</p>}
    <DialogFooter>
      <Button variant="outline" onClick={onClose}>닫기</Button>
    </DialogFooter>
  </>
}

type ResultProps = {
  outcome: Outcome
  // 찍은 신청. 받은 명단에서 사라졌으면(취소·보관 기간 지남) null이고 찾을 수 없음으로 보인다.
  entry: RegistrationEntry | null
  form: RegistrationFormView
  settled: boolean
  onConfirmPayment: (registrationId: string) => Promise<RegistrationResult>
  onUndo: (registrationId: string) => Promise<RegistrationResult>
  onNext: () => void
}
type Look = { icon: LucideIcon; color: string; title: string; description?: string }

function lookOf(outcome: Outcome, entry: RegistrationEntry | null): Look {
  const missing: Look = { icon: XCircle, color: 'text-red-600', title: '이 행사 신청에서 찾을 수 없어요',
    description: '다른 행사의 QR이거나 취소한 신청일 수 있어요. 명단에서 이름으로 찾아 주세요.' }
  switch (outcome.kind) {
    case 'missing': return missing
    case 'failed': return outcome.offline ? { icon: XCircle, color: 'text-red-600', title: '연결하지 못했어요', description: '다시 찍어 주세요.' }
      : { icon: XCircle, color: 'text-red-600', title: '참석을 확인하지 못했어요', description: outcome.message }
    case 'checked': return entry ? { icon: CheckCircle2, color: 'text-green-600', title: '참석을 확인했어요' } : missing
    case 'undone': return entry ? { icon: RotateCcw, color: 'text-gray-500', title: '참석 확인을 취소했어요' } : missing
    case 'already': return entry ? { icon: Info, color: 'text-blue-600', title: '이미 참석했어요',
      description: entry.checkedIn ? `참석 확인 · ${formatKoreanTime(entry.checkedIn.at)} · ${entry.checkedIn.by.name}` : undefined } : missing
  }
}

// 찍은 결과: 누구인지(이름·학번)와 입금 상태를 크게 보인다. 입금 전이면 그 자리에서 입금을 확인하고, 잘못 찍었으면 참석 확인을 취소한다.
function Result({ outcome, entry, form, settled, onConfirmPayment, onUndo, onNext }: ResultProps) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const look = lookOf(outcome, entry)
  const Icon = look.icon
  const shown = outcome.kind === 'checked' || outcome.kind === 'already' || outcome.kind === 'undone' ? entry : null
  // 입금 칩과 입금 확인은 참석한 사람에게만 보인다. 확인을 취소한 결과에는 이름·학번만 둔다.
  const payment = shown && hasFees(form) && outcome.kind !== 'undone' ? shown : null
  const chip = payment ? paymentChip(payment) : null
  async function run(action: () => Promise<RegistrationResult>) {
    setBusy(true)
    setMessage('')
    const result = await action()
    setBusy(false)
    if (!result.ok) setMessage(result.message)
  }
  // 결과가 바뀌면 보조기술이 읽는다(status). 카드가 카메라 화면보다 크면 카드 안에서 스크롤한다.
  return <section role="status" aria-label="찍은 결과" className="flex max-h-full flex-col gap-3 overflow-y-auto rounded-md border bg-white p-4 shadow-lg">
    <div className="flex items-center gap-2">
      <Icon aria-hidden className={cn('size-5 shrink-0', look.color)} />
      <p className="text-sm font-semibold text-gray-900">{look.title}</p>
    </div>
    {look.description && <p className="text-sm wrap-anywhere text-gray-600">{look.description}</p>}
    {shown && <div className="flex flex-col items-start gap-1">
      <p className="text-lg font-semibold wrap-anywhere text-gray-900">{shown.name}</p>
      <p className="text-sm text-gray-600">학번 {shown.studentId}</p>
      {chip && <Badge tone={chip.tone}>{chip.text}</Badge>}
    </div>}
    {message && <StateMessage kind="error">{message}</StateMessage>}
    <div className="flex flex-wrap justify-end gap-2">
      {payment && !settled && payment.paid === null && payment.fee > 0 && <Button variant="outline" size="sm" disabled={busy}
        onClick={() => void run(() => onConfirmPayment(payment.id))}>입금 확인</Button>}
      {shown && outcome.kind === 'checked' && <Button variant="outline" size="sm" disabled={busy}
        onClick={() => void run(() => onUndo(shown.id))}>참석 확인 취소</Button>}
      <Button disabled={busy} onClick={onNext}>다음</Button>
    </div>
  </section>
}
