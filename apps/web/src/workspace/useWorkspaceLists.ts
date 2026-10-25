import { usePendingCount } from '../finance/usePendingCount'
import { useRoomList } from '../chat/useRoomList'
import { useSidebarEvents } from '../events/useSidebarEvents'
import { useTaskCount } from '../tasks/useTaskCount'
import type { CouncilData } from './useCouncilData'

// 옆 메뉴의 수(안 읽은 대화, 업무, 재정부의 결재 대기)와 그 화면이 같은 목록을 쓴다. 학생회 정보가 읽힌 뒤에 읽기 시작한다.
// '공간'의 완료하지 않은 행사도 같은 때 읽는다.
export function useWorkspaceLists(councilId: string, data: CouncilData) {
  const ready = data.state.kind === 'ready'
  const rooms = useRoomList(councilId, data.reload, ready)
  const unread = rooms.state.kind === 'ready' ? rooms.state.data.unreadTotal : 0
  const { tasks, count: taskCount } = useTaskCount(councilId, data.reload, ready)
  // 결재 대기 수는 결재할 수 있는 사람(재정부)만 읽는다.
  const canApprove = data.view?.permissions.includes('purchase.approve') ?? false
  const { pending, count: pendingCount } = usePendingCount(
    councilId,
    data.reload,
    ready && canApprove,
  )
  const events = useSidebarEvents(councilId, data.reload, ready)
  // 학생회를 잃었거나 다시 읽는 중이면 남은 줄을 그리지 않는다.
  const openEvents = ready && events.state.kind === 'ready' ? events.state.data.events : null
  return {
    lists: { rooms, tasks, pending },
    counts: { unread, taskCount, pendingCount },
    openEvents,
  }
}
