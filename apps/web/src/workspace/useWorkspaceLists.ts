import { useRoomList } from '../chat/useRoomList'
import { useTaskCount } from '../tasks/useTaskCount'
import type { CouncilData } from './useCouncilData'

// 옆 메뉴의 수(안 읽은 대화, 업무)와 그 화면이 같은 목록을 쓴다. 학생회 정보가 읽힌 뒤에 읽기 시작한다.
export function useWorkspaceLists(councilId: string, data: CouncilData) {
  const ready = data.state.kind === 'ready'
  const rooms = useRoomList(councilId, data.reload, ready)
  const unread = rooms.state.kind === 'ready' ? rooms.state.data.unreadTotal : 0
  const { tasks, count: taskCount } = useTaskCount(councilId, data.reload, ready)
  return { rooms, unread, tasks, taskCount }
}
