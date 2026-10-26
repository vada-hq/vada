import { useEffect } from 'react'
import { appPath, EVENT_TABS, eventRoomPath, type EventTab } from '@vada/contracts'
import { navigate, rewriteAddress, useHere } from '@/lib/app-location'
import { withTaskLayout } from '@/lib/task-layout'

const tabOf = (value: string | undefined): EventTab =>
  EVENT_TABS.find(tab => tab === value) ?? 'messages'

const tabQuery = (tab: EventTab, memberId: string) =>
  tab === 'messages' ? {} : tab === 'tasks' ? withTaskLayout(memberId, { tab }) : { tab }

// 열려 있는 행사와 탭. 행사 하나는 /events/학생회/행사?tab= 주소가 원문이라 새로고침해도 같다.
// 모르는 탭이나 다른 꼴의 주소는 읽은 꼴로 고쳐 쓰고(replace), 탭을 바꿔도 기록을 쌓지 않는다.
// 업무 탭으로 갈 때는 그 사람(memberId)이 마지막에 고른 업무 배치를 싣는다(lib/task-layout.ts).
// 행사 주소가 아니면(목록) null이다.
export function useEventAddress(councilId: string, memberId: string) {
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
    // 메시지 탭에서 고른 방. 처음 여는 방이면 없다(DEC-96).
    room: open.query['room'] ?? null,
    from: here.from,
    setTab: (tab: EventTab) =>
      navigate(appPath({ ...open, query: tabQuery(tab, memberId) }), { replace: true }),
    // 방 전환도 탭처럼 기록을 쌓지 않는다.
    setRoom: (roomId: string) =>
      navigate(eventRoomPath(councilId, open.recordId, roomId), { replace: true }),
  }
}
