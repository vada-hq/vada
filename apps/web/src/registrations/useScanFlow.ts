import { useEffect, useRef, useState } from 'react'
import { tokenHashOfQr, type ApplicantChange } from '@vada/contracts'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { checkInByHash, type ScanOutcome } from './check-in'

// 우리 QR이 아닌 것을 읽었을 때 안내를 보이는 시간(ms). 마지막으로 읽은 때부터 센다.
const HINT_MS = 2000

type Options = EventDialogHandlers & {
  councilId: string
  eventId: string
  // 출석이 확인됐거나 이미 출석이다.
  onChecked: (applicant: ApplicantChange) => void
}

// 찍은 글자 하나의 흐름: 우리 QR이 아니면 안내만, 맞으면 판독을 멈추고 출석을 보내 결과를 보인다. [다음]이 판독을 다시 연다.
export function useScanFlow({ councilId, eventId, onChecked, ...handlers }: Options) {
  // 결과를 보이는 동안과 요청 중에는 판독을 멈춘다.
  const paused = useRef(false)
  // 닫힌 뒤에 온 응답은 그리지 않는다.
  const alive = useRef(true)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [checking, setChecking] = useState(false)
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null)
  const [hint, setHint] = useState(false)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      clearTimeout(hintTimer.current)
    }
  }, [])

  function showHint() {
    setHint(true)
    clearTimeout(hintTimer.current)
    hintTimer.current = setTimeout(() => setHint(false), HINT_MS)
  }

  async function onText(text: string) {
    const tokenHash = tokenHashOfQr(text)
    if (tokenHash === null) return showHint()
    paused.current = true
    setHint(false)
    setChecking(true)
    const result = await checkInByHash(councilId, eventId, tokenHash, handlers)
    if (result === 'lost') return
    // 요청 중에 창을 닫았어도 서버에 남은 출석은 목록에 반영한다.
    if (result.kind === 'checked' || result.kind === 'already') onChecked(result.applicant)
    if (!alive.current) return
    setChecking(false)
    setOutcome(result)
  }

  function next() {
    setOutcome(null)
    paused.current = false
  }
  return { paused, onText, checking, outcome, hint, next }
}
