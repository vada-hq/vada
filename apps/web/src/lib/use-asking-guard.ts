import { useEffect, useRef } from 'react'
import { useLatest } from './use-latest'

// 확인 대화상자를 연 동안 다시 읽은 값이 그 동작을 막으면(동작이 빠짐, 권한을 잃음, 이미 완료됨) 확인을 닫고 이유를 보인다.
// reason은 막는 이유이고 막지 않으면 null이다. 확인이 닫혀 있으면(asking이 false) 부르지 않는다.
// 내 요청이 돌려준 값 때문에 동작이 빠지는 것은 막힌 것이 아니다. 요청은 돌려받은 guarded로 보낸다:
// 보내는 동안과 확인이 닫힐 때까지 알리지 않고, 요청이 아무 값도 바꾸지 못했으면(changed가 false) 다시 지킨다.
// 이렇게 하면 성공 직후 '빠졌다'는 알림이 값이 놓이는 순서에 기대지 않고 뜨지 않는다.
export function useAskingGuard<R extends string>(
  asking: boolean,
  reason: R | null,
  onGone: (reason: R) => void,
) {
  const ownChange = useRef(false)
  const latest = useLatest(onGone)
  useEffect(() => {
    if (!asking) ownChange.current = false
  }, [asking])
  useEffect(() => {
    if (asking && reason !== null && !ownChange.current) latest.current(reason)
  }, [asking, reason, latest])
  return async function guarded<T>(request: () => Promise<T>, changed: (result: T) => boolean) {
    ownChange.current = true
    const result = await request()
    if (!changed(result)) ownChange.current = false
    return result
  }
}
