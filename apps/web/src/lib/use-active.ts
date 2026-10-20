import { useCallback, useEffect, useRef } from 'react'

// 화면이 아직 떠 있는가. 늦게 온 응답이 사라진 화면의 상태를 건드리지 않게 한다.
// 개발 모드(StrictMode)는 효과를 정리했다 다시 실행하므로 다시 실행될 때 true로 돌려놓는다.
export function useActive() {
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  // 함수로 돌려주어 부르는 쪽이 ref를 렌더에서 만지지 않고 의존 목록에도 안정적으로 넣게 한다.
  return useCallback(() => active.current, [])
}
