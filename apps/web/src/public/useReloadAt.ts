import { useEffect } from 'react'
import { dateFromKorean } from '@vada/contracts'
import { useLatest } from '@/lib/use-latest'

// 브라우저 타이머는 약 24.8일(2^31ms)을 넘기면 바로 울린다. 하루씩 끊어 기다린다.
const MAX_WAIT_MS = 86_400_000
// 기기 시계가 서버보다 앞서면 시각이 지났는데도 서버는 아직 시작 전이라 답한다. 그때 서버를 두드리지 않게 하는 바닥이다.
const MIN_WAIT_MS = 2_000

// 한국 시각 at(YYYY-MM-DDTHH:mm)이 되면 reload를 부른다. 화면은 reload로 새 값을 받으면 다시 이 효과를 건다(data가 deps).
export function useReloadAt(at: string | null, reload: () => void, data: unknown) {
  const latest = useLatest(reload)
  useEffect(() => {
    if (at === null) return
    const wait = dateFromKorean(at).getTime() - Date.now()
    const timer = setTimeout(
      () => latest.current(),
      Math.min(Math.max(wait, MIN_WAIT_MS), MAX_WAIT_MS),
    )
    return () => clearTimeout(timer)
  }, [at, data, latest])
}
