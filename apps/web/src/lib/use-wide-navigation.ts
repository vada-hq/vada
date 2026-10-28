import { useSyncExternalStore } from 'react'

// 옆 메뉴·서랍·아래 탭 줄은 Tailwind md 한 경계를 쓴다.
const WIDE_NAVIGATION = '(min-width: 48rem)'
const media = () => window.matchMedia?.(WIDE_NAVIGATION)
function subscribe(change: () => void) {
  const query = media()
  query?.addEventListener('change', change)
  return () => query?.removeEventListener('change', change)
}
export function useWideNavigation() {
  return useSyncExternalStore(subscribe, () => media()?.matches ?? true)
}
