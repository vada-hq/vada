import { useSyncExternalStore } from 'react'

// 목록과 방을 나란히 둘 만큼 넓은 화면(Tailwind lg). 옆 메뉴(w-60)를 빼도 방 칸이 휴대폰 폭보다 넓다.
const SPLIT_QUERY = '(min-width: 64rem)'

const media = () => window.matchMedia?.(SPLIT_QUERY)

function subscribe(change: () => void) {
  const query = media()
  query?.addEventListener('change', change)
  return () => query?.removeEventListener('change', change)
}

export function useSplit() {
  return useSyncExternalStore(subscribe, () => media()?.matches ?? false)
}
