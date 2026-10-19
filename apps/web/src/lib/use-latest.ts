import { useEffect, useRef } from 'react'

// 부르는 쪽이 매번 새 함수를 넘겨도 그 함수를 쓰는 effect가 다시 돌지 않도록, 마지막으로 받은 값만 ref에 담아 둔다. 쓸 때는 ref.current다. ref 객체는 렌더마다 같아서 effect의 의존 목록에 넣어도 다시 돌지 않는다.
export function useLatest<T>(value: T) {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  })
  return ref
}
