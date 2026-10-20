import { useEffect, useRef } from 'react'
import { useLatest } from './use-latest'

// 있던 것(권한, 대상)이 없어진 순간 한 번 onLost를 부른다. 처음부터 없던 것에는 부르지 않는다.
// 없어진 자리에 아무 말이 없으면 사용자는 까닭을 모른다(docs/work-method.md '자주 잡힌 것' 1번).
export function useLost(has: boolean, onLost: () => void) {
  const before = useRef(has)
  const latest = useLatest(onLost)
  useEffect(() => {
    if (before.current && !has) latest.current()
    before.current = has
  }, [has, latest])
}
