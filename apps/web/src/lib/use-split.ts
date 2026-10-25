import { useSyncExternalStore } from 'react'

// 목록과 방을 나란히, 업무를 표로 둘 만큼 넓은 화면(Tailwind lg). 옆 메뉴(w-60)를 빼도 방 칸이 휴대폰 폭보다 넓다.
const SPLIT_QUERY = '(min-width: 64rem)'
// 칸이 넷인 읽기 표를 둘 만큼 넓은 화면(Tailwind sm). 그보다 좁은 휴대폰은 카드 줄이다.
const WIDE_QUERY = '(min-width: 40rem)'

const media = (query: string) => window.matchMedia?.(query)

function subscribeTo(query: string) {
  return (change: () => void) => {
    const list = media(query)
    list?.addEventListener('change', change)
    return () => list?.removeEventListener('change', change)
  }
}

const splitSubscribe = subscribeTo(SPLIT_QUERY)
const wideSubscribe = subscribeTo(WIDE_QUERY)

export function useSplit() {
  return useSyncExternalStore(splitSubscribe, () => media(SPLIT_QUERY)?.matches ?? false)
}

export function useWide() {
  return useSyncExternalStore(wideSubscribe, () => media(WIDE_QUERY)?.matches ?? false)
}
