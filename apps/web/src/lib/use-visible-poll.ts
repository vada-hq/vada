import { useEffect } from 'react'
import { useLatest } from './use-latest'

// 화면이 보이는 동안만 일정 간격으로 run을 부른다. 숨으면 멈추고, 다시 보이면 바로 한 번 부르고 이어 간다.
// 보이지 않는 화면이 서버를 계속 두드리지 않게 하고, 돌아왔을 때 오래된 값을 보이지 않게 한다.
export function useVisiblePoll(run: () => void, intervalMs: number) {
  const latest = useLatest(run)
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    const stop = () => {
      clearInterval(timer)
      timer = undefined
    }
    const start = () => {
      stop()
      timer = setInterval(() => latest.current(), intervalMs)
    }
    const onChange = () => {
      if (document.visibilityState !== 'visible') return stop()
      latest.current()
      start()
    }
    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onChange)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onChange)
    }
  }, [intervalMs, latest])
}
