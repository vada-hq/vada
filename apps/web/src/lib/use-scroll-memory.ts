import { useLayoutEffect, type RefObject } from 'react'

// 스크롤 위치 기억(DEC-78 이동 11). 브라우저의 자동 복원은 목록을 그리기 전에 일해서 어긋나므로 끄고(scrollRestoration = 'manual'),
// 본문의 위치를 칸(방문 기록 한 칸)마다 sessionStorage에 두었다가, 뒤로 돌아오면 그린 뒤 그 자리로 간다. 새 칸은 맨 위에서 연다.
// sessionStorage는 탭마다 따로라 새로 고침에는 남고 다른 탭에는 새지 않는다. 못 쓰는 브라우저에서는 기억하지 않고 맨 위에서 연다.
const PREFIX = 'vada.scroll.'
// 목록을 못 불러오는 등으로 그 자리까지 영영 길어지지 않을 때 기다리는 한계.
const GIVE_UP_MS = 3000
const TOUCH_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const

function readTop(spot: string) {
  try {
    const value = Number(window.sessionStorage.getItem(PREFIX + spot))
    return Number.isFinite(value) && value > 0 ? value : 0
  } catch {
    return 0
  }
}

function writeTop(spot: string, top: number) {
  try {
    window.sessionStorage.setItem(PREFIX + spot, String(Math.round(top)))
  } catch {
    // 가득 찼거나 막혔다. 돌아왔을 때 맨 위에서 열릴 뿐이다.
  }
}

// 저장된 자리로 간다. 내용이 아직 짧으면(불러오는 중) 내용이 바뀔 때마다 다시 시도하고, 닿으면·사용자가 직접 스크롤하면·오래 걸리면 멈춘다.
// 돌려주는 함수는 멈추게 하고, restoring()은 아직 시도 중인지 알려 준다.
function restore(element: HTMLElement, top: number) {
  let active = true
  const stop = () => {
    active = false
    observer.disconnect()
    clearTimeout(timer)
    for (const type of TOUCH_EVENTS) element.removeEventListener(type, stop)
  }
  const apply = () => {
    if (!active) return
    element.scrollTop = top
    if (element.scrollHeight - element.clientHeight >= top) stop()
  }
  const observer = new MutationObserver(apply)
  const timer = setTimeout(stop, GIVE_UP_MS)
  observer.observe(element, { childList: true, subtree: true })
  for (const type of TOUCH_EVENTS) element.addEventListener(type, stop, { passive: true })
  apply()
  return { stop, restoring: () => active }
}

export function useScrollMemory(ref: RefObject<HTMLElement | null>, spot: string) {
  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => {
      window.history.scrollRestoration = previous
    }
  }, [])
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const top = readTop(spot)
    element.scrollTop = 0
    const attempt = top > 0 ? restore(element, top) : null
    // 되돌아오는 동안의 알림(짧은 내용에서 잘린 위치)이 저장된 자리를 덮어쓰지 않게 한다.
    const onScroll = () => {
      if (!attempt?.restoring()) writeTop(spot, element.scrollTop)
    }
    element.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      element.removeEventListener('scroll', onScroll)
      attempt?.stop()
    }
  }, [ref, spot])
}
