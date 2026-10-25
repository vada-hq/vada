import { useEffect } from 'react'
import { useLatest } from '@/lib/use-latest'

// 행사를 만들거나 기본정보를 고치거나 완료·완료 취소한 뒤, 옆 메뉴 '공간'의 행사 줄을 바로 다시 읽게 한다(15초 주기를 기다리지 않는다).
// 행사를 바꾸는 곳(행사 목록, 행사 화면, 홈, 업무 상세, 옆 메뉴)이 여럿이고 작업 공간에서 멀어서, 콜백을 잇지 않고 창 이벤트로 알린다.
const EVENTS_CHANGED = 'vada:events-changed'

export const announceEventsChanged = () => window.dispatchEvent(new Event(EVENTS_CHANGED))

export function useEventsChanged(onChanged: () => void) {
  const latest = useLatest(onChanged)
  useEffect(() => {
    const listener = () => latest.current()
    window.addEventListener(EVENTS_CHANGED, listener)
    return () => window.removeEventListener(EVENTS_CHANGED, listener)
  }, [latest])
}
