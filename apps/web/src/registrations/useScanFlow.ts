import { useEffect, useRef, useState } from 'react'
import { tokenHashOfQr, type ApplicantChange } from '@vada/contracts'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { checkInByHash, type ScanOutcome } from './check-in'

// 우리 QR이 아닌 것을 읽었을 때 안내를 보이는 시간(ms). 마지막으로 읽은 때부터 센다.
const HINT_MS = 2000

type Options = EventDialogHandlers & {
  councilId: string
  eventId: string
  // 출석이 확인됐거나 이미 출석이거나, 찍은 줄이 바뀌었다(입금, 출석 취소).
  onChecked: (applicant: ApplicantChange) => void
}

const withApplicant = (current: ScanOutcome | null, applicant: ApplicantChange) =>
  current && 'applicant' in current && current.applicant.id === applicant.id
    ? { ...current, applicant }
    : current

// [새로 읽기]는 같은 QR로 출석을 다시 보내 already가 온다. 그 출석은 이번 찍기가 남긴 것이라 이미 출석(입장 불가)으로 부르지 않는다.
// 출석 번호가 다르면 그사이 다른 운영진이 취소·재출석한 것이라 이번 찍기의 출석이 아니다([입장 안 함]으로 취소하지 않는다).
function keepChecked(before: ScanOutcome | null, after: ScanOutcome): ScanOutcome {
  if (before?.kind !== 'checked' || after.kind !== 'already') return after
  if (after.applicant.id !== before.applicant.id) return after
  if (after.attendanceId !== before.attendanceId) return after
  const { checkedInAt: _first, ...person } = after
  return { ...person, kind: 'checked' }
}

// 우리 QR이 아닌 것을 읽었다는 안내. 마지막으로 읽은 때부터 HINT_MS 동안 보인다.
function useHint() {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [hint, setHint] = useState(false)
  useEffect(() => () => clearTimeout(timer.current), [])
  function show() {
    setHint(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setHint(false), HINT_MS)
  }
  return { hint, show, hide: () => setHint(false) }
}

// 찍은 글자 하나의 흐름: 우리 QR이 아니면 안내만, 맞으면 판독을 멈추고 출석을 보내 결과를 보인다. [다음 사람]이 판독을 다시 연다.
export function useScanFlow({ councilId, eventId, onChecked, ...handlers }: Options) {
  // 결과를 보이는 동안과 요청 중에는 판독을 멈춘다.
  const paused = useRef(false)
  const lastText = useRef<string | null>(null)
  // 닫힌 뒤에 온 응답은 그리지 않는다.
  const alive = useRef(true)
  const [checking, setChecking] = useState(false)
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null)
  // 찍을 때마다 늘어난다. 결과 카드가 앞 사람의 상태(방금 받은 입금)를 이어받지 않게 key로 쓴다.
  const [scan, setScan] = useState(0)
  const hint = useHint()
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  async function onText(text: string, before: ScanOutcome | null = null) {
    const tokenHash = tokenHashOfQr(text)
    if (tokenHash === null) return hint.show()
    lastText.current = text
    paused.current = true
    hint.hide()
    setChecking(true)
    const result = await checkInByHash(councilId, eventId, tokenHash, handlers)
    if (result === 'lost') return
    // 요청 중에 창을 닫았어도 서버에 남은 출석은 목록에 반영한다.
    if (result.kind === 'checked' || result.kind === 'already') onChecked(result.applicant)
    if (!alive.current) return
    setChecking(false)
    setOutcome(keepChecked(before, result))
    setScan(value => value + 1)
  }

  function next() {
    setOutcome(null)
    paused.current = false
  }
  function changed(applicant: ApplicantChange) {
    onChecked(applicant)
    if (alive.current) setOutcome(current => withApplicant(current, applicant))
  }
  function reload() {
    if (!lastText.current) return
    const before = outcome
    setOutcome(null)
    void onText(lastText.current, before)
  }
  return { paused, onText, checking, outcome, scan, hint: hint.hint, next, changed, reload }
}
