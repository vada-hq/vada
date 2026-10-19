import { useEffect, useRef } from 'react'

// 쪽 위에 뜨는 오류 문구가 긴 목록의 먼 줄에서 한 동작의 결과일 때, 휴대폰 화면에서는 화면 밖에 있을 수 있다.
// 문구가 바뀌면 그 문구를 화면 안으로 스크롤한다. 돌려준 ref를 문구를 감싼 요소에 단다.
export function useReveal<T extends HTMLElement>(text: string) {
  const ref = useRef<T>(null)
  useEffect(() => {
    // jsdom에는 scrollIntoView가 없다.
    if (text) ref.current?.scrollIntoView?.({ block: 'nearest' })
  }, [text])
  return ref
}
