import { useEffect, useState } from 'react'

const NOW_REFRESH_MS = 30_000

// 화면에 보이는 "지금". 렌더 중에 시계를 읽지 않고, 자정이 지나면 날짜 표시가 바뀌도록 주기적으로 갱신한다.
export function useNow(intervalMs = NOW_REFRESH_MS) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
