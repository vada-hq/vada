import { useCallback, useEffect, useRef } from 'react'

// 맨 아래에서 이만큼 떨어져 있어도 맨 아래로 본다(손가락 스크롤이 딱 끝에 멈추지 않는다).
const BOTTOM_SLACK = 24

export function isAtBottom(el: Pick<HTMLElement, 'scrollTop' | 'scrollHeight' | 'clientHeight'>) {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_SLACK
}

// 메시지 흐름의 스크롤. 새 메시지(lastId가 바뀜)가 오면 맨 아래에 있을 때만 따라 내려가고,
// 위를 보고 있으면 끌어내리지 않는다. 내가 보낸 메시지는 방금 보낸 것을 봐야 하므로 늘 내려간다.
// 처음에는 맨 아래다.
export function useStickToBottom(lastId: string | undefined, lastIsMine = false) {
  const el = useRef<HTMLDivElement | null>(null)
  const stuck = useRef(true)
  const ref = useCallback((node: HTMLDivElement | null) => {
    el.current = node
  }, [])
  const onScroll = useCallback(() => {
    if (el.current) stuck.current = isAtBottom(el.current)
  }, [])
  useEffect(() => {
    if (!el.current || !(stuck.current || lastIsMine)) return
    el.current.scrollTop = el.current.scrollHeight
    stuck.current = true
  }, [lastId, lastIsMine])
  return { ref, onScroll }
}
