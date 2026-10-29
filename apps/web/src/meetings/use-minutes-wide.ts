import { useSyncExternalStore } from 'react'

// 회의록의 안건 목록은 Tailwind sm에서 휴대폰 칩 줄과 옆 칸으로 나뉜다. 안건 더하기 폼은 한 곳에만 그린다:
// 둘 다 그리면 CSS로 숨은 쪽 폼에 쓰던 글이 남아 확정과 떠날 때 확인을 계속 막는다(mtg-6 검토).
// 폭을 모르면(matchMedia가 없는 환경) null이고, 그때는 두 곳 모두 그린다.
const SM = '(min-width: 40rem)'
const media = () => (typeof window.matchMedia === 'function' ? window.matchMedia(SM) : null)
function subscribe(change: () => void) {
  const query = media()
  query?.addEventListener('change', change)
  return () => query?.removeEventListener('change', change)
}
export function useMinutesWide(): boolean | null {
  return useSyncExternalStore(subscribe, () => media()?.matches ?? null)
}
