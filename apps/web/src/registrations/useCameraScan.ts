import { useEffect, useState, type RefObject } from 'react'
import { useLatest } from '@/lib/use-latest'
import { CameraError, openCamera, stopCamera, type CameraProblem } from './camera'
import { loadQrReader, type QrReader } from './qr-reader'

// 판독 간격(ms). 결과를 보이는 동안과 요청 중에는 읽지 않는다.
const SCAN_INTERVAL_MS = 200

export type CameraState = 'starting' | 'loading' | 'ready' | CameraProblem | 'reader'

type Control = {
  stopped: () => boolean
  // 참이면 이번 판독을 건너뛴다(결과를 보이는 동안, 요청 중).
  paused: RefObject<boolean>
  onText: (text: string) => Promise<void>
}

// 카메라를 켜고 판독기를 불러온다. 실패하면 상태로 알리고 켠 카메라를 끈다. 끝나기 전에 닫혔으면 null이다.
async function prepare(
  element: HTMLVideoElement | null,
  ctl: Control,
  set: (s: CameraState) => void,
) {
  let stream: MediaStream
  try {
    stream = await openCamera()
  } catch (error) {
    if (!ctl.stopped()) set(error instanceof CameraError ? error.problem : 'failed')
    return null
  }
  if (ctl.stopped()) {
    stopCamera(stream)
    return null
  }
  if (element) {
    element.srcObject = stream
    // 자동 재생이 막혀도 판독은 프레임으로 한다. iOS는 playsInline·muted가 있어야 화면 안에서 재생한다.
    await element.play().catch(() => undefined)
  }
  set('loading')
  try {
    return { stream, reader: await loadQrReader() }
  } catch {
    // 판독기를 못 받으면 카메라도 끈다.
    stopCamera(stream)
    if (element) element.srcObject = null
    if (!ctl.stopped()) set('reader')
    return null
  }
}

// 판독을 SCAN_INTERVAL_MS마다 되풀이한다. 멈추는 함수를 돌려준다.
function runLoop(reader: QrReader, element: HTMLVideoElement | null, ctl: Control) {
  let timer: ReturnType<typeof setTimeout> | undefined
  async function tick() {
    if (ctl.stopped() || !element) return
    if (!ctl.paused.current) {
      const text = await reader.read(element).catch(() => null)
      if (ctl.stopped()) return
      if (text !== null) await ctl.onText(text)
      if (ctl.stopped()) return
    }
    timer = setTimeout(() => void tick(), SCAN_INTERVAL_MS)
  }
  void tick()
  return () => clearTimeout(timer)
}

// 화면이 숨으면 카메라를 끄고 다시 보이면 켠다. attempt가 바뀌면 처음부터 다시 켠다([다시 시도]).
export function useCameraScan(
  video: RefObject<HTMLVideoElement | null>,
  paused: RefObject<boolean>,
  onText: (text: string) => Promise<void>,
) {
  const [camera, setCamera] = useState<CameraState>('starting')
  const [attempt, setAttempt] = useState(0)
  const [hidden, setHidden] = useState(() => document.visibilityState === 'hidden')
  const textHandler = useLatest(onText)
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
    let stopLoop = () => {}
    const ctl: Control = {
      stopped: () => stopped,
      paused,
      onText: text => textHandler.current(text),
    }
    setCamera('starting')
    void prepare(element, ctl, setCamera).then(ready => {
      if (!ready) return
      // 판독기를 받는 동안 닫혔으면 켜 둔 카메라를 여기서 끈다(정리 함수는 이미 지나갔다).
      if (stopped) return stopCamera(ready.stream)
      stream = ready.stream
      setCamera('ready')
      stopLoop = runLoop(ready.reader, element, ctl)
    })
    return () => {
      stopped = true
      stopLoop()
      if (stream) stopCamera(stream)
      if (element) element.srcObject = null
    }
  }, [hidden, attempt, video, paused, textHandler])
  return { camera, retry: () => setAttempt(value => value + 1) }
}
