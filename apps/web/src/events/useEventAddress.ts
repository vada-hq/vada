import { useEffect } from 'react'
import { appPath, EVENT_TABS, type EventTab } from '@vada/contracts'
import { navigate, rewriteAddress, useHere } from '@/lib/app-location'

const tabOf = (value: string | undefined): EventTab =>
  EVENT_TABS.find(tab => tab === value) ?? 'overview'

// 열려 있는 행사와 탭. 행사 하나는 /events/학생회/행사?tab= 주소가 원문이라 새로고침해도 같다.
// 모르는 탭이나 다른 꼴의 주소는 읽은 꼴로 고쳐 쓰고(replace), 탭을 바꿔도 기록을 쌓지 않는다.
// 행사 주소가 아니면(목록) null이다.
export function useEventAddress(councilId: string) {
  const here = useHere()
  const { location } = here
  const open =
    location?.type === 'record' &&
    location.record === 'events' &&
    location.councilId === councilId.toLowerCase()
      ? location
      : null
  const canonical = open ? appPath(open) : null
  useEffect(() => {
    if (canonical !== null && canonical !== here.path) rewriteAddress(canonical)
  }, [canonical, here.path])
  if (!open) return null
  return {
    eventId: open.recordId,
    tab: tabOf(open.query['tab']),
    from: here.from,
    setTab: (tab: EventTab) =>
      navigate(appPath({ ...open, query: tab === 'overview' ? {} : { tab } }), { replace: true }),
  }
}
