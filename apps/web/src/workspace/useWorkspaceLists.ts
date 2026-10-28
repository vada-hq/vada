import { useEffect, useRef } from 'react'
import { updateAppBadge } from '@/lib/app-badge'
import { useRoomList } from '../chat/useRoomList'
import { useSidebarEvents } from '../events/useSidebarEvents'
import { useTaskCount } from '../tasks/useTaskCount'
import type { CouncilData } from './useCouncilData'

// 옆 메뉴의 수(안 읽은 대화, 지난 업무)와 그 화면이 같은 목록을 쓴다. 학생회 정보가 읽힌 뒤에 읽기 시작한다.
// '공간'의 완료하지 않은 행사도 같은 때 읽는다. 재정 결재 대기 수는 옆 메뉴에 두지 않아 읽지 않는다(DEC-96, 재정부 홈 첫 카드가 맡음).
export function useWorkspaceLists(councilId: string, data: CouncilData) {
  const ready = data.state.kind === 'ready'
  const rooms = useRoomList(councilId, data.reload, ready)
  const unread = rooms.state.kind === 'ready' ? rooms.state.data.unreadTotal : 0
  const badgeShown = useRef(false)
  useEffect(() => {
    if (!ready || rooms.state.kind !== 'ready') return
    badgeShown.current = true
    void updateAppBadge(unread)
  }, [ready, rooms.state, unread])
  // 학생회를 바꾸면(작업 공간이 새로 그려짐) 새 목록을 읽거나 못 읽는 동안 이전 학생회의 수가 남지 않게 지운다.
  // 이 화면이 배지를 정한 적이 없으면(처음 열 때) 푸시가 남긴 배지는 그대로 둔다.
  useEffect(
    () => () => {
      if (!badgeShown.current) return
      badgeShown.current = false
      void updateAppBadge(0)
    },
    [councilId],
  )
  const { tasks, count: taskCount } = useTaskCount(councilId, data.reload, ready)
  const events = useSidebarEvents(councilId, data.reload, ready)
  // 학생회를 잃었거나 다시 읽는 중이면 남은 줄을 그리지 않는다.
  const openEvents = ready && events.state.kind === 'ready' ? events.state.data.events : null
  return {
    lists: { rooms, tasks },
    counts: { unread, taskCount },
    openEvents,
  }
}
